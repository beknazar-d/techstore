// ВНУТРЕННИЙ модуль слоя данных: локальная «база» в localStorage.
// Импортировать только из файлов src/api/. Компоненты сюда не ходят.
// При переходе на Supabase этот файл удаляется, а функции в соседних файлах
// получают новую реализацию с теми же сигнатурами.

import { createSeed } from '../data/seed'
import type { Category, Order, OrderEvent, Product, TradeInEvent, TradeInRequest } from '../types'
import { ApiError } from './errors'

/** Версия в ключе: при несовместимом изменении структуры меняем v1 → v2, и данные пересоздаются. */
const DB_KEY = 'phone-market:db:v2'

export interface Db {
  categories: Category[]
  products: Product[]
  orders: Order[]
  orderEvents: OrderEvent[]
  tradeIns: TradeInRequest[]
  tradeInEvents: TradeInEvent[]
  nextOrderNumber: number
  nextTradeInNumber: number
}

/** «Таблицы», об изменении которых узнают подписчики. */
export type DbTable = 'categories' | 'products' | 'orders' | 'tradeIns'

const ALL_TABLES: DbTable[] = ['categories', 'products', 'orders', 'tradeIns']

type Listener = (tables: DbTable[]) => void

const listeners = new Set<Listener>()

/** Запасной вариант, если localStorage недоступен (приватный режим, запрет в настройках). */
let memoryDb: Db | null = null

function isDb(value: unknown): value is Db {
  if (typeof value !== 'object' || value === null) return false
  const db = value as Record<string, unknown>
  return (
    Array.isArray(db.categories) &&
    Array.isArray(db.products) &&
    Array.isArray(db.orders) &&
    Array.isArray(db.orderEvents) &&
    Array.isArray(db.tradeIns) &&
    Array.isArray(db.tradeInEvents) &&
    typeof db.nextOrderNumber === 'number' &&
    typeof db.nextTradeInNumber === 'number'
  )
}

/**
 * Читает базу. Каждый раз заново из localStorage, чтобы видеть изменения из других вкладок
 * (клиент оформил заказ — админка в соседней вкладке получает свежий остаток).
 */
export function readDb(): Db {
  if (memoryDb) return memoryDb
  try {
    const raw = localStorage.getItem(DB_KEY)
    if (raw) {
      const parsed: unknown = JSON.parse(raw)
      if (isDb(parsed)) return parsed
    }
  } catch {
    // Битый JSON или localStorage недоступен — ниже создадим демо-данные.
  }
  const seeded = createSeed()
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(seeded))
  } catch {
    memoryDb = seeded
  }
  return seeded
}

function writeDb(db: Db): void {
  if (memoryDb) {
    memoryDb = db
    return
  }
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db))
  } catch {
    throw new ApiError(
      'storage',
      'Не удалось сохранить данные: в хранилище браузера закончилось место. Удалите лишние фото.',
    )
  }
}

function emit(tables: DbTable[]): void {
  for (const listener of listeners) {
    try {
      listener(tables)
    } catch (error) {
      console.error(error)
    }
  }
}

/**
 * Изменяет базу: читает свежую копию, применяет `fn`, сохраняет и оповещает подписчиков.
 * Чтение и запись идут синхронно подряд — как одна транзакция.
 * Если `fn` бросает ошибку, ничего не сохраняется.
 */
export function mutate<T>(changed: DbTable[], fn: (db: Db) => T): T {
  const db = readDb()
  const result = fn(db)
  writeDb(db)
  emit(changed)
  return result
}

/**
 * Подписка на изменения данных — в этой вкладке и в других вкладках того же браузера.
 * Возвращает функцию отписки. В Supabase-версии станет подпиской Realtime.
 */
export function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    // key === null — хранилище очистили целиком.
    if (event.key === DB_KEY || event.key === null) emit(ALL_TABLES)
  })
}

/** Сбрасывает все данные к демо-набору. */
export async function resetDemoData(): Promise<void> {
  const seeded = createSeed()
  writeDb(seeded)
  emit(ALL_TABLES)
}

/** Небольшая задержка, чтобы интерфейс вёл себя как с настоящей сетью (видны состояния загрузки). */
export function delay(ms = 150): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export function nowISO(): string {
  return new Date().toISOString()
}

/** Копия для выдачи наружу: вызывающий код не сможет случайно изменить «базу». */
export function clone<T>(value: T): T {
  return structuredClone(value)
}

/** Подбирает свободный slug: `galaxy-s24`, `galaxy-s24-2`, ... */
export function uniqueSlug(base: string, taken: string[]): string {
  const root = base || 'item'
  let slug = root
  let n = 2
  while (taken.includes(slug)) {
    slug = `${root}-${n}`
    n += 1
  }
  return slug
}
