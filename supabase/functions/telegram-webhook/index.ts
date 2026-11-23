// Webhook Telegram-бота: Telegram присылает сюда каждое сообщение клиента.
// Сообщение сохраняется в bot_chats / bot_messages — админка видит его сразу (Realtime).
//
// На /start бот отвечает приветствием из настроек. Остальные сообщения:
//   - ИИ включён и ключ подключён, чат у бота → ответ ИИ (в фоне, Telegram не ждёт);
//   - иначе сообщение передаётся менеджеру (чат в режиме «Ждёт менеджера»).
//
// Вход без JWT (verify_jwt = false в config.toml): Telegram не умеет его присылать.
// Подлинность проверяем по заголовку X-Telegram-Bot-Api-Secret-Token.

import { adminDb, botToken, safeEqual, tg, webhookSecret } from '../_shared/telegram.ts'
import { telegramChannel } from '../_shared/channels.ts'
import { answerAfterPause, HANDOFF_NO_AI, loadBotRuntime, reclaimFromManager } from '../_shared/botFlow.ts'
import { downloadTelegramFile } from '../_shared/voice.ts'

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void } | undefined

interface TgUser {
  first_name?: string
  last_name?: string
  username?: string
  language_code?: string
}

interface TgMessage {
  message_id: number
  chat: { id: number; type: string }
  from?: TgUser
  text?: string
  caption?: string
  photo?: unknown[]
  voice?: { file_id: string; duration?: number }
  video?: unknown
  document?: unknown
  sticker?: { emoji?: string }
  contact?: { phone_number?: string }
  location?: { latitude: number; longitude: number }
}

/** Текст для переписки в админке, в том числе для фото, голосовых и т. п. */
function describe(message: TgMessage): string {
  const caption = message.caption?.trim()
  if (message.text?.trim()) return message.text.trim()
  if (message.photo) return caption ? `[Фото] ${caption}` : '[Фото]'
  if (message.video) return caption ? `[Видео] ${caption}` : '[Видео]'
  if (message.voice) return '[Голосовое сообщение]'
  if (message.document) return caption ? `[Файл] ${caption}` : '[Файл]'
  if (message.sticker) return `[Стикер ${message.sticker.emoji ?? ''}]`.replace(' ]', ']')
  if (message.contact?.phone_number) return `[Контакт] ${message.contact.phone_number}`
  if (message.location) {
    const { latitude, longitude } = message.location
    return `[Геолокация] https://yandex.ru/maps/?pt=${longitude},${latitude}&z=16`
  }
  return '[Сообщение]'
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('ok')

  const secret = req.headers.get('x-telegram-bot-api-secret-token') ?? ''
  let token = await botToken()
  // Бота могли только что подключить или сменить токен — перечитываем Vault, если секрет не сошёлся.
  if (!token || !safeEqual(secret, await webhookSecret(token))) token = await botToken(true)
  if (!token) return new Response('bot is not connected', { status: 503 })
  if (!safeEqual(secret, await webhookSecret(token))) {
    return new Response('forbidden', { status: 403 })
  }

  const update = (await req.json().catch(() => null)) as { message?: TgMessage } | null
  const message = update?.message
  // Обрабатываем только личные сообщения боту; группы менеджеров — не переписка с клиентом.
  if (!message || message.chat.type !== 'private') return new Response('ok')

  const db = adminDb()
  const { settings, ai } = await loadBotRuntime()
  const text = describe(message)
  const isStart = /^\/start\b/.test(text)
  const name = [message.from?.first_name, message.from?.last_name].filter(Boolean).join(' ')

  const { data: chat, error } = await db.rpc('bot_receive_message', {
    p_telegram_chat_id: message.chat.id,
    p_customer_name: name,
    p_telegram_username: message.from?.username ?? '',
    p_text: text,
    p_handoff_reason: isStart || ai ? null : HANDOFF_NO_AI,
  })
  if (error || !chat) {
    console.error('bot_receive_message failed', error)
    // 500 → Telegram повторит доставку позже, сообщение не потеряется.
    return new Response('db error', { status: 500 })
  }

  // Клиенту с Telegram на кыргызском — приветствие на кыргызском (если админ его заполнил).
  const greeting =
    message.from?.language_code === 'ky' && settings?.greeting_ky?.trim() ? settings.greeting_ky : settings?.greeting
  if (isStart && settings?.is_enabled && greeting?.trim()) {
    try {
      await tg(token, 'sendMessage', { chat_id: message.chat.id, text: greeting })
      await db.rpc('bot_record_outgoing', { p_chat_id: chat.id, p_sender: 'bot', p_text: greeting })
    } catch (sendError) {
      console.error('greeting failed', sendError)
    }
  }

  if (!isStart && ai) await reclaimFromManager(chat)

  if (!isStart && ai && settings && chat.mode !== 'manager') {
    if (chat.mode === 'closed') await db.from('bot_chats').update({ mode: 'bot' }).eq('id', chat.id)
    const fileId = message.voice?.file_id
    const work = answerAfterPause(
      telegramChannel(token, message.chat.id),
      chat,
      settings,
      ai,
      fileId ? () => downloadTelegramFile(token, fileId) : undefined,
    )
    // Отвечаем Telegram сразу, ИИ работает в фоне — иначе долгий ответ вызовет повторную доставку.
    if (typeof EdgeRuntime !== 'undefined') EdgeRuntime.waitUntil(work)
    else await work
  }

  return new Response('ok')
})
