import { shop } from '../config/shop'
import type { GeoPoint } from '../types'

/** Ссылка на точку на карте (открывается и в браузере, и в картах на телефоне). */
export function mapHref(point: GeoPoint): string {
  return `https://maps.google.com/?q=${point.lat},${point.lng}`
}

/** Чат с магазином в WhatsApp, с необязательным готовым текстом. */
export function whatsappHref(text?: string): string {
  const base = `https://wa.me/${shop.whatsapp}`
  return text ? `${base}?text=${encodeURIComponent(text)}` : base
}

/** Чат с магазином в Telegram. */
export function telegramHref(): string {
  return `https://t.me/${shop.telegram}`
}
