import type { ChatMode, OrderStatus, TradeInStatus } from '../types'
import toneStyles from '../components/ui/Tone.module.css'

export type Tone = 'indigo' | 'blue' | 'amber' | 'green' | 'red' | 'violet' | 'teal' | 'orange' | 'gray'

/** Класс CSS-модуля, который задаёт переменные --tone, --tone-soft, --tone-text, --tone-border. */
export function toneClass(tone: Tone): string {
  return toneStyles[tone]
}

export const ORDER_STATUS_TONES: Record<OrderStatus, Tone> = {
  new: 'blue',
  confirmed: 'amber',
  completed: 'green',
  cancelled: 'red',
}

export const TRADE_IN_STATUS_TONES: Record<TradeInStatus, Tone> = {
  new: 'blue',
  evaluated: 'violet',
  accepted: 'teal',
  rejected: 'red',
  completed: 'green',
}

export const CHAT_MODE_TONES: Record<ChatMode, Tone> = {
  manager: 'orange',
  bot: 'teal',
  closed: 'gray',
}
