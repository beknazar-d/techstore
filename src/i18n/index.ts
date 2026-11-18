// Языки интерфейса: русский (по умолчанию) и кыргызский. Без библиотек.
//
//   const t = useT()           — в компонентах: t.home.title, t.order.accepted(1042)
//   msg()                      — вне компонентов (ошибки api, подписи статусов)
//   useLang() / setLang('ky')  — текущий язык и переключение
//
// Словари: src/i18n/ru/<раздел>.ts — эталон, src/i18n/ky/<раздел>.ts — тот же набор ключей
// (TypeScript не даст пропустить перевод). При смене языка приложение перерисовывается
// целиком (см. LanguageRoot), поэтому msg() в render тоже даёт актуальный язык.

import { useSyncExternalStore } from 'react'
import { ru, type Messages } from './ru'
import { ky } from './ky'

export type Lang = 'ru' | 'ky'
export type { Messages }

export const LANGS: { value: Lang; short: string; label: string }[] = [
  { value: 'ru', short: 'РУ', label: 'Русский' },
  { value: 'ky', short: 'КЫ', label: 'Кыргызча' },
]

const STORAGE_KEY = 'phone-market:lang'
const DICTIONARIES: Record<Lang, Messages> = { ru, ky }
/** Локаль для Intl (даты, числа). */
export const INTL_LOCALE: Record<Lang, string> = { ru: 'ru-RU', ky: 'ky-KG' }

function readLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'ru' || saved === 'ky') return saved
  } catch {
    // нет доступа к localStorage
  }
  return 'ru'
}

let current: Lang = readLang()
const listeners = new Set<() => void>()

function applyHtmlLang(lang: Lang): void {
  if (typeof document !== 'undefined') document.documentElement.lang = lang
}
applyHtmlLang(current)

export function getLang(): Lang {
  return current
}

export function setLang(lang: Lang): void {
  if (lang === current) return
  current = lang
  try {
    localStorage.setItem(STORAGE_KEY, lang)
  } catch {
    // язык просто не запомнится
  }
  applyHtmlLang(lang)
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Словарь текущего языка — для кода вне компонентов. */
export function msg(): Messages {
  return DICTIONARIES[current]
}

export function useLang(): Lang {
  return useSyncExternalStore(subscribe, getLang, getLang)
}

/** Словарь текущего языка — в компонентах. */
export function useT(): Messages {
  return DICTIONARIES[useLang()]
}

/** Локаль Intl текущего языка: `ru-RU` / `ky-KG`. */
export function intlLocale(): string {
  return INTL_LOCALE[current]
}

/**
 * Объект-«окно» в словарь: всегда отдаёт значения текущего языка.
 * Нужен, чтобы старые константы вида ORDER_STATUS_LABELS[status] переводились сами.
 */
export function live<T extends object>(pick: (messages: Messages) => T): T {
  return new Proxy({} as T, {
    get: (_target, key) => (pick(msg()) as Record<string | symbol, unknown>)[key],
    has: (_target, key) => key in pick(msg()),
    ownKeys: () => Reflect.ownKeys(pick(msg())),
    getOwnPropertyDescriptor: (_target, key) => {
      const value = (pick(msg()) as Record<string | symbol, unknown>)[key]
      return value === undefined ? undefined : { value, enumerable: true, configurable: true, writable: false }
    },
  })
}
