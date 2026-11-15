// Уведомления менеджерам. Сейчас — заглушка: пишет событие в консоль.
// Позже эти события будет отправлять в Telegram-группу сервер
// (Edge Function + Database Webhooks), а фронтенд вызывать notify() перестанет.

import type { Order, OrderStatus, Product, TradeInRequest, TradeInStatus } from '../types'

export type NotifyEvent =
  | { type: 'order_created'; order: Order }
  | { type: 'order_status_changed'; order: Order; fromStatus: OrderStatus }
  | { type: 'order_cancelled'; order: Order }
  | { type: 'stock_low'; product: Product }
  | { type: 'stock_out'; product: Product }
  | { type: 'trade_in_created'; tradeIn: TradeInRequest }
  | { type: 'trade_in_status_changed'; tradeIn: TradeInRequest; fromStatus: TradeInStatus }

/** Никогда не бросает ошибку: сбой уведомления не должен ломать заказ. */
export async function notify(event: NotifyEvent): Promise<void> {
  try {
    console.info('[notify → Telegram]', event.type, event)
  } catch {
    // Консоль недоступна — молчим.
  }
}
