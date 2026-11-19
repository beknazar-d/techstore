// ВНУТРЕННИЙ модуль слоя данных: общий код для работы с Supabase.
// Импортировать только из файлов src/api/. Компоненты сюда не ходят.

import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { ApiError, type ApiErrorCode } from './errors'
import { getLang, msg } from '../i18n'

export { supabase }

const KNOWN_CODES: ApiErrorCode[] = [
  'validation',
  'not_found',
  'out_of_stock',
  'product_unavailable',
  'invalid_transition',
  'category_not_empty',
  'conflict',
  'auth',
  'storage',
]

interface DbError {
  message?: string
  code?: string
  hint?: string | null
  details?: string | null
}

/**
 * Переводит ошибку Supabase в ApiError с русским текстом.
 * Функции базы бросают ошибки через private.fail: текст по-русски, код — в HINT.
 */
export function toApiError(error: DbError, fallback = msg().errors.requestFailed): ApiError {
  const hint = error.hint ?? ''
  if ((KNOWN_CODES as string[]).includes(hint) && error.message) {
    // Функции базы пишут по-русски; для других языков берём общий текст по коду.
    const translated = getLang() === 'ru' ? undefined : msg().errors.codes[hint]
    if (translated) return new ApiError(hint as ApiErrorCode, translated)
    return new ApiError(hint as ApiErrorCode, error.message)
  }
  switch (error.code) {
    case '23505':
      return new ApiError('conflict', msg().errors.duplicate)
    case '23503':
      return new ApiError('category_not_empty', msg().errors.inUse)
    case '23514':
      return new ApiError('validation', msg().errors.outOfBounds)
    case '42501':
    case 'PGRST301':
    case 'PGRST302':
      return new ApiError('auth', msg().errors.needLogin)
    default:
      break
  }
  if (error.message && /fetch|network/i.test(error.message)) {
    return new ApiError('storage', msg().errors.offline)
  }
  return new ApiError('storage', fallback)
}

/** Возвращает data или бросает ApiError. */
export function unwrap<T>(result: { data: T | null; error: DbError | null }, fallback?: string): T {
  if (result.error) throw toApiError(result.error, fallback)
  return result.data as T
}

// ---------- Подписки на изменения ----------

/** «Таблицы», об изменении которых узнают подписчики (как в useApiQuery). */
export type DbTable = 'categories' | 'products' | 'orders' | 'tradeIns' | 'chats' | 'botSettings' | 'aiSettings' | 'banners' | 'expenses' | 'shopSettings'

type Listener = (tables: DbTable[]) => void

const listeners = new Set<Listener>()

/** Таблицы базы → «таблицы» интерфейса. Realtime включён для них в миграции. */
const REALTIME_TABLES: Record<string, DbTable> = {
  orders: 'orders',
  trade_ins: 'tradeIns',
  products: 'products',
  bot_chats: 'chats',
  bot_messages: 'chats',
}

let channel: RealtimeChannel | null = null

export function emit(tables: DbTable[]): void {
  for (const listener of listeners) {
    try {
      listener(tables)
    } catch (error) {
      console.error(error)
    }
  }
}

function openChannel(): void {
  if (channel) return
  channel = supabase.channel('db-changes')
  for (const [table, mapped] of Object.entries(REALTIME_TABLES)) {
    channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => emit([mapped]))
  }
  channel.subscribe()
}

function closeChannel(): void {
  if (!channel) return
  void supabase.removeChannel(channel)
  channel = null
}

/**
 * Подписка на изменения данных: свои изменения (сразу) и чужие — через Supabase Realtime
 * (новый заказ с сайта, сообщение клиента в Telegram). Возвращает функцию отписки.
 * Realtime отдаёт строки по тем же правилам RLS: аноним видит только товары.
 */
export function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  openChannel()
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) closeChannel()
  }
}

// После входа/выхода у канала меняются права — переподключаемся и перечитываем всё.
supabase.auth.onAuthStateChange((event) => {
  if (event !== 'SIGNED_IN' && event !== 'SIGNED_OUT') return
  if (listeners.size > 0) {
    closeChannel()
    openChannel()
  }
  emit(['categories', 'products', 'orders', 'tradeIns', 'chats', 'botSettings', 'banners'])
})

/** Подбирает свободный slug среди существующих в таблице: `galaxy-s24`, `galaxy-s24-2`, ... */
export async function uniqueSlug(
  table: 'categories' | 'products',
  base: string,
  exceptId?: string,
): Promise<string> {
  const root = base || 'item'
  let query = supabase.from(table).select('id, slug').like('slug', `${root}%`)
  if (exceptId) query = query.neq('id', exceptId)
  const rows = unwrap(await query) as { slug: string }[]
  const taken = new Set(rows.map((row) => row.slug))
  let slug = root
  let n = 2
  while (taken.has(slug)) {
    slug = `${root}-${n}`
    n += 1
  }
  return slug
}
