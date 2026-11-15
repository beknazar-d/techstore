import { shop } from '../config/shop'
import type { Category, Product, SpecField, SpecValue } from '../types'

const NBSP = ' '

/** Целое число с неразрывными пробелами между разрядами: `89 900`. */
export function formatNumber(value: number): string {
  const sign = value < 0 ? '-' : ''
  const digits = String(Math.abs(Math.round(value)))
  return sign + digits.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP)
}

/** Цена: `89 900 ₽` (пробелы неразрывные). */
export function formatPrice(value: number): string {
  return `${formatNumber(value)}${NBSP}${shop.currency}`
}

/** Номер заказа для показа: `№ 1001`. */
export function formatOrderNumber(number: number): string {
  return `№${NBSP}${number}`
}

/** Номер заявки trade-in для показа: `№ T-501`. */
export function formatTradeInNumber(number: number): string {
  return `№${NBSP}T-${number}`
}

/** Значение характеристики для показа: `6.1 дюйм`, `Да`, `256 ГБ`. */
export function formatSpecValue(field: SpecField, value: SpecValue): string {
  if (typeof value === 'boolean') return value ? 'Да' : 'Нет'
  const text = typeof value === 'number' ? String(value).replace('.', ',') : value
  return field.unit ? `${text}${NBSP}${field.unit}` : text
}

export interface SpecRow {
  key: string
  label: string
  value: string
}

/** Строки таблицы характеристик: только заполненные поля, в порядке шаблона категории. */
export function getSpecRows(category: Category | null | undefined, product: Product): SpecRow[] {
  if (!category) return []
  const rows: SpecRow[] = []
  for (const field of category.specFields) {
    const value = product.specs[field.key]
    if (value === undefined || value === '') continue
    rows.push({ key: field.key, label: field.label, value: formatSpecValue(field, value) })
  }
  return rows
}
