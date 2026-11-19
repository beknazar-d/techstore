// Прочие расходы магазина — только для админа (RLS). Учитываются в статистике.
import type { Expense, ExpenseInput } from '../types'
import { emit, supabase, unwrap } from './client'
import { ApiError } from './errors'
import { msg } from '../i18n'

const COLUMNS = 'id, amount, comment, spent_on, created_at'

interface ExpenseRow {
  id: string
  amount: number
  comment: string
  spent_on: string
  created_at: string
}

function fromRow(row: ExpenseRow): Expense {
  return { id: row.id, amount: row.amount, comment: row.comment, spentOn: row.spent_on, createdAt: row.created_at }
}

/** Расходы за период (дни включительно, `YYYY-MM-DD`), новые сверху. */
export async function listExpenses(period: { from: string; to: string }): Promise<Expense[]> {
  const rows = unwrap(
    await supabase
      .from('expenses')
      .select(COLUMNS)
      .gte('spent_on', period.from)
      .lte('spent_on', period.to)
      .order('spent_on', { ascending: false })
      .order('created_at', { ascending: false }),
    msg().adminStats.expensesLoadError,
  ) as ExpenseRow[]
  return rows.map(fromRow)
}

export async function createExpense(input: ExpenseInput): Promise<Expense> {
  const t = msg().adminStats
  if (!Number.isInteger(input.amount) || input.amount <= 0) throw new ApiError('validation', t.expenseAmountError)
  const comment = input.comment.trim()
  if (!comment) throw new ApiError('validation', t.expenseCommentError)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.spentOn)) throw new ApiError('validation', t.expenseDateError)
  const row = unwrap(
    await supabase.from('expenses').insert({ amount: input.amount, comment, spent_on: input.spentOn }).select(COLUMNS).single(),
    t.expenseSaveError,
  ) as ExpenseRow
  emit(['expenses'])
  return fromRow(row)
}

export async function deleteExpense(id: string): Promise<void> {
  const rows = unwrap(await supabase.from('expenses').delete().eq('id', id).select('id')) as { id: string }[]
  if (rows.length === 0) throw new ApiError('not_found', msg().adminStats.expenseNotFound)
  emit(['expenses'])
}
