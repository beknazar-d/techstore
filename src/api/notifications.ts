// События для уведомлений администратора: новый заказ, новая заявка trade-in, клиент ждёт менеджера,
// новое сообщение клиента в чате менеджера. Источник — Supabase Realtime (по правилам RLS,
// поэтому события получает только вошедший админ). Показ уведомлений — в src/admin/notifications.

import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from './client'

export type AdminEvent =
  | { kind: 'order'; id: string; number: number; productName: string; quantity: number; total: number; customerName: string }
  | { kind: 'tradeIn'; id: string; number: number; device: string; customerName: string }
  | { kind: 'handoff'; chatId: string; customerName: string; reason: string }
  | { kind: 'message'; chatId: string; customerName: string; text: string }

interface OrderRow {
  id: string
  number: number
  product_name: string
  quantity: number
  price: number
  customer_name: string
}

interface TradeInRow {
  id: string
  number: number
  customer_name: string
  device: { brand?: string; model?: string } | null
}

interface ChatRow {
  id: string
  customer_name: string
  telegram_username: string
  mode: 'bot' | 'manager' | 'closed'
  handoff_reason: string
}

interface MessageRow {
  chat_id: string
  sender: 'customer' | 'bot' | 'manager'
  text: string
}

function chatName(chat: Pick<ChatRow, 'customer_name' | 'telegram_username'> | undefined): string {
  if (!chat) return ''
  return chat.customer_name || (chat.telegram_username ? `@${chat.telegram_username}` : '')
}

/**
 * Подписка на события для уведомлений. Возвращает отписку.
 * Режимы чатов запоминаем, чтобы понять момент передачи менеджеру (в событии нет старого значения).
 */
export function subscribeAdminEvents(handler: (event: AdminEvent) => void): () => void {
  const chats = new Map<string, Pick<ChatRow, 'customer_name' | 'telegram_username' | 'mode'>>()
  let channel: RealtimeChannel | null = null
  let closed = false

  void (async () => {
    const { data } = await supabase.from('bot_chats').select('id, customer_name, telegram_username, mode')
    for (const chat of (data ?? []) as ChatRow[]) chats.set(chat.id, chat)
    if (closed) return

    channel = supabase
      .channel('admin-notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, ({ new: row }) => {
        const order = row as OrderRow
        handler({
          kind: 'order',
          id: order.id,
          number: order.number,
          productName: order.product_name,
          quantity: order.quantity,
          total: order.price * order.quantity,
          customerName: order.customer_name,
        })
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'trade_ins' }, ({ new: row }) => {
        const tradeIn = row as TradeInRow
        const device = [tradeIn.device?.brand, tradeIn.device?.model].filter(Boolean).join(' ')
        handler({ kind: 'tradeIn', id: tradeIn.id, number: tradeIn.number, device, customerName: tradeIn.customer_name })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bot_chats' }, ({ new: row }) => {
        const chat = row as Partial<ChatRow>
        if (!chat.id || !chat.mode) return
        const before = chats.get(chat.id)
        chats.set(chat.id, {
          customer_name: chat.customer_name ?? '',
          telegram_username: chat.telegram_username ?? '',
          mode: chat.mode,
        })
        if (chat.mode === 'manager' && before?.mode !== 'manager') {
          handler({ kind: 'handoff', chatId: chat.id, customerName: chatName(chat as ChatRow), reason: chat.handoff_reason ?? '' })
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bot_messages' }, ({ new: row }) => {
        const message = row as MessageRow
        const chat = chats.get(message.chat_id)
        // Пока отвечает бот, админа не дёргаем: уведомляем только в чатах, переданных менеджеру.
        if (message.sender !== 'customer' || chat?.mode !== 'manager') return
        handler({ kind: 'message', chatId: message.chat_id, customerName: chatName(chat), text: message.text })
      })
      .subscribe()
  })()

  return () => {
    closed = true
    if (channel) void supabase.removeChannel(channel)
  }
}
