import { intlLocale } from '../i18n'

const dateTimeFormat = () => new Intl.DateTimeFormat(intlLocale(), {
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
})

const dateFormat = () => new Intl.DateTimeFormat(intlLocale(), {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

function parse(value: string): Date | null {
  if (!value) return null
  // `YYYY-MM-DD` разбираем как локальную дату, иначе получится сдвиг по UTC.
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  const date = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

/** `15 ноября, 21:04`. Для ISO-строк из `createdAt`. */
export function formatDateTime(iso: string): string {
  const date = parse(iso)
  return date ? dateTimeFormat().format(date) : ''
}

/** `15 ноября 2026 г.`. Понимает и ISO, и `YYYY-MM-DD`. */
export function formatDate(value: string): string {
  const date = parse(value)
  return date ? dateFormat().format(date) : ''
}

/** Желаемые дата и время заказа одной строкой: `16 ноября 2026 г., 14:30`. Пусто, если не заданы. */
export function formatDesiredDateTime(desiredDate: string, desiredTime: string): string {
  return [formatDate(desiredDate), desiredTime].filter(Boolean).join(', ')
}

/** Сегодня в виде `YYYY-MM-DD` (для `min` у `<input type="date">`). */
export function todayISO(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}
