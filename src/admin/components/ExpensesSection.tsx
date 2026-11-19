import { useState } from 'react'
import { createExpense, deleteExpense, getErrorMessage, listExpenses } from '../../api'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Spinner } from '../../components/ui/Spinner'
import { useApiQuery } from '../../hooks/useApiQuery'
import { formatDate, todayISO } from '../../utils/date'
import { formatPrice } from '../../utils/format'
import { cn } from '../../utils/cn'
import { msg } from '../../i18n'
import { Section } from './AdminBlocks'
import styles from './ExpensesSection.module.css'

interface ExpensesSectionProps {
  /** Период статистики, `YYYY-MM-DD` включительно. */
  from: string
  to: string
  /** Прибыль по заказам за этот период, ₽. */
  profit: number
}

/** «Прочие расходы»: добавить сумму с комментарием, список за период и прибыль после расходов. */
export function ExpensesSection({ from, to, profit }: ExpensesSectionProps) {
  const t = msg().adminStats
  const { data: expenses } = useApiQuery(() => listExpenses({ from, to }), [from, to], ['expenses'])
  const [amount, setAmount] = useState('')
  const [comment, setComment] = useState('')
  const [spentOn, setSpentOn] = useState(todayISO)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)

  const total = (expenses ?? []).reduce((sum, item) => sum + item.amount, 0)
  const net = profit - total

  async function handleAdd(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await createExpense({ amount: Number(amount), comment, spentOn })
      setAmount('')
      setComment('')
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    setError(null)
    try {
      await deleteExpense(id)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setConfirmId(null)
    }
  }

  return (
    <Section title={t.expensesTitle}>
      <p className={styles.hint}>{t.expensesHint}</p>

      <div className={styles.totals}>
        <div className={styles.total}>
          <span className={styles.totalLabel}>{t.expensesTotal}</span>
          <strong className={styles.expense}>{formatPrice(total)}</strong>
        </div>
        <div className={styles.total}>
          <span className={styles.totalLabel}>{t.netProfit}</span>
          <strong className={cn(net < 0 && styles.negative)}>{formatPrice(net)}</strong>
          <span className={styles.totalSub}>{t.netProfitSub}</span>
        </div>
      </div>

      <form className={styles.form} onSubmit={(event) => void handleAdd(event)}>
        <Input
          label={t.expenseAmount}
          type="number"
          inputMode="numeric"
          min="1"
          step="1"
          required
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
        />
        <Input
          label={t.expenseComment}
          placeholder={t.expenseCommentPlaceholder}
          required
          maxLength={500}
          value={comment}
          onChange={(event) => setComment(event.target.value)}
        />
        <Input
          label={t.expenseDate}
          type="date"
          required
          value={spentOn}
          onChange={(event) => setSpentOn(event.target.value)}
        />
        <Button type="submit" icon="add" loading={saving} className={styles.submit}>
          {t.expenseAdd}
        </Button>
      </form>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      {expenses === undefined ? (
        <div className={styles.loader}>
          <Spinner />
        </div>
      ) : expenses.length === 0 ? (
        <p className={styles.empty}>{t.expensesEmpty}</p>
      ) : (
        <ul className={styles.list}>
          {expenses.map((item) => (
            <li key={item.id} className={styles.item}>
              <span className={styles.itemInfo}>
                <span className={styles.itemComment}>{item.comment}</span>
                <span className={styles.itemDate}>{formatDate(item.spentOn)}</span>
              </span>
              <strong className={styles.itemAmount}>−{formatPrice(item.amount)}</strong>
              {confirmId === item.id ? (
                <span className={styles.confirm}>
                  <span>{t.expenseDeleteConfirm}</span>
                  <Button type="button" size="sm" variant="danger" onClick={() => void handleDelete(item.id)}>
                    {t.expenseDeleteYes}
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmId(null)}>
                    {t.expenseDeleteNo}
                  </Button>
                </span>
              ) : (
                <button
                  type="button"
                  className={styles.delete}
                  aria-label={t.expenseDelete}
                  title={t.expenseDelete}
                  onClick={() => setConfirmId(item.id)}
                >
                  <span className="material-symbols-outlined" aria-hidden="true">delete</span>
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}
