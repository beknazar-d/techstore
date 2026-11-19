import type { GeoPoint } from '../types'

/** Ссылка на точку на карте (открывается и в браузере, и в картах на телефоне). */
export function mapHref(point: GeoPoint): string {
  return `https://maps.google.com/?q=${point.lat},${point.lng}`
}

/** Чат в WhatsApp по номеру (только цифры), с необязательным готовым текстом. */
export function whatsappHref(number: string, text?: string): string {
  const base = `https://wa.me/${number}`
  return text ? `${base}?text=${encodeURIComponent(text)}` : base
}

/** Чат или канал в Telegram по имени (без «@»). */
export function telegramHref(username: string): string {
  return `https://t.me/${username}`
}

/** Профиль в Instagram по имени (без «@»). */
export function instagramHref(username: string): string {
  return `https://instagram.com/${username}`
}
