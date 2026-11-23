// Webhook WhatsApp (Wappi): Wappi присылает сюда входящие сообщения клиентов и смену статуса номера.
// Сообщение сохраняется в bot_chats / bot_messages (channel = 'whatsapp') — админка видит его в «Чатах».
// Дальше — как в Telegram: ИИ отвечает в фоне, а если ИИ или ответы в WhatsApp выключены, чат ждёт менеджера.
//
// Вход без JWT (verify_jwt = false в config.toml). Подлинность — ключ ?key= в адресе вебхука
// (HMAC от токена Wappi, задаётся при подключении в «Настройках»).

import { adminDb, safeEqual } from '../_shared/telegram.ts'
import { whatsappChannel } from '../_shared/channels.ts'
import { answerAfterPause, HANDOFF_NO_AI, loadBotRuntime, reclaimFromManager } from '../_shared/botFlow.ts'
import { base64ToBlob, phoneFromChatId, wappi, wappiCreds, whatsappWebhookKey, type WappiCreds } from '../_shared/wappi.ts'

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void } | undefined

interface WaEvent {
  wh_type?: string
  profile_id?: string
  id?: string
  type?: string
  body?: string
  caption?: string
  mimetype?: string
  file_link?: string
  from?: string
  chatId?: string
  senderName?: string
  contact_name?: string
  is_me?: boolean
  chat_type?: string
  status?: string
  phone?: string
  location?: { latitude?: number; longitude?: number; description?: string }
  latitude?: number
  longitude?: number
}

const HANDOFF_WA_OFF = 'Ответы бота в WhatsApp выключены — ответьте клиенту'

function caption(event: WaEvent, label: string): string {
  const text = event.caption?.trim()
  return text ? `[${label}] ${text}` : `[${label}]`
}

/** Текст для переписки в админке. Файлы приходят в base64 — их не храним, только пометку. */
function describe(event: WaEvent): string {
  switch (event.type) {
    case 'chat':
    case 'text':
      return String(event.body ?? '').trim() || '[Сообщение]'
    case 'ptt':
    case 'audio':
      return '[Голосовое сообщение]'
    case 'image':
      return caption(event, 'Фото')
    case 'video':
      return caption(event, 'Видео')
    case 'document':
      return caption(event, 'Файл')
    case 'sticker':
      return '[Стикер]'
    case 'vcard':
      return '[Контакт]'
    case 'location': {
      const lat = event.location?.latitude ?? event.latitude
      const lng = event.location?.longitude ?? event.longitude
      return lat !== undefined && lng !== undefined
        ? `[Геолокация] https://yandex.ru/maps/?pt=${lng},${lat}&z=16`
        : '[Геолокация]'
    }
    default:
      return String(event.body ?? '').trim().slice(0, 4096) || '[Сообщение]'
  }
}

/** Голосовое: Wappi кладёт файл в body (base64) или даёт ссылку. */
async function voiceBlob(event: WaEvent): Promise<Blob | null> {
  const type = event.mimetype?.split(';')[0] || 'audio/ogg'
  const link = event.file_link || (/^https?:\/\//.test(event.body ?? '') ? event.body : '')
  if (link) {
    const response = await fetch(link)
    return response.ok ? new Blob([await response.arrayBuffer()], { type }) : null
  }
  return event.body ? base64ToBlob(event.body, type) : null
}

async function updateStatus(event: WaEvent): Promise<void> {
  const status = /online|authori[sz]ed|true/i.test(String(event.status ?? '')) ? 'online' : 'offline'
  const phone = String(event.phone ?? '').replace(/\D/g, '')
  await adminDb()
    .from('bot_settings')
    .update({ whatsapp_status: status, ...(phone.length >= 9 && phone.length <= 15 ? { whatsapp_phone: phone } : {}) })
    .eq('id', true)
}

async function handleMessage(creds: WappiCreds, event: WaEvent): Promise<{ work: Promise<void> } | null> {
  const chatId = String(event.chatId || event.from || '')
  // Только личные сообщения клиентов: свои, групповые и рассылки — мимо.
  if (!chatId || event.is_me || /@(g\.us|broadcast|newsletter)$|^status@/.test(chatId)) return null

  const db = adminDb()
  const { settings, ai, raw } = await loadBotRuntime('whatsapp_enabled')
  const botOn = Boolean(settings?.is_enabled && raw?.whatsapp_enabled !== false)
  const aiReady = Boolean(ai && botOn)
  const text = describe(event)

  const { data: chat, error } = await db.rpc('whatsapp_receive_message', {
    p_whatsapp_chat_id: chatId,
    p_customer_name: event.senderName || event.contact_name || '',
    p_customer_phone: phoneFromChatId(chatId),
    p_text: text,
    p_handoff_reason: aiReady ? null : botOn ? HANDOFF_NO_AI : HANDOFF_WA_OFF,
  })
  if (error || !chat) throw error ?? new Error('whatsapp_receive_message returned nothing')

  // Отметить прочитанным — у клиента синие галочки, как у живого продавца.
  if (event.id) void wappi(creds, 'sync/message/mark/read', { body: { message_id: event.id } }).catch(() => undefined)

  // Первое сообщение, а ИИ не отвечает — хотя бы поприветствуем, чтобы клиент не ждал в тишине.
  if (!aiReady && botOn && settings?.greeting?.trim()) {
    const { count } = await db.from('bot_messages').select('id', { count: 'exact', head: true }).eq('chat_id', chat.id)
    if (count === 1) {
      await whatsappChannel(creds, chatId)
        .sendText(settings.greeting)
        .then(() => db.rpc('bot_record_outgoing', { p_chat_id: chat.id, p_sender: 'bot', p_text: settings.greeting }))
        .catch((sendError) => console.error('whatsapp greeting failed', sendError))
    }
  }

  if (!aiReady || !ai || !settings) return null
  await reclaimFromManager(chat)
  if (chat.mode === 'manager') return null
  if (chat.mode === 'closed') await db.from('bot_chats').update({ mode: 'bot' }).eq('id', chat.id)
  const isVoice = event.type === 'ptt' || event.type === 'audio'
  return { work: answerAfterPause(whatsappChannel(creds, chatId), chat, settings, ai, isVoice ? () => voiceBlob(event) : undefined) }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('ok')

  const key = new URL(req.url).searchParams.get('key') ?? ''
  let creds = await wappiCreds()
  // WhatsApp могли только что подключить или сменить токен — перечитываем, если ключ не сошёлся.
  if (!creds || !safeEqual(key, await whatsappWebhookKey(creds.token))) creds = await wappiCreds(true)
  if (!creds) return new Response('whatsapp is not connected', { status: 503 })
  if (!safeEqual(key, await whatsappWebhookKey(creds.token))) return new Response('forbidden', { status: 403 })

  const payload = (await req.json().catch(() => null)) as { messages?: WaEvent[] | WaEvent } | WaEvent | null
  if (!payload) return new Response('ok')
  const list = 'messages' in payload && payload.messages ? payload.messages : payload
  const events = (Array.isArray(list) ? list : [list]) as WaEvent[]

  const work: Promise<void>[] = []
  for (const event of events) {
    if (event.profile_id && event.profile_id !== creds.profileId) continue
    try {
      if (event.wh_type === 'authorization_status') {
        await updateStatus(event)
      } else if (!event.wh_type || event.wh_type === 'incoming_message') {
        const pending = await handleMessage(creds, event)
        if (pending) work.push(pending.work.catch((error: unknown) => console.error('whatsapp answer failed', error)))
      }
    } catch (error) {
      console.error('whatsapp event failed', event.wh_type, error)
      // 500 → Wappi повторит доставку, сообщение не потеряется.
      return new Response('db error', { status: 500 })
    }
  }

  // Отвечаем Wappi сразу, ИИ работает в фоне.
  if (work.length) {
    const all = Promise.all(work)
    if (typeof EdgeRuntime !== 'undefined') EdgeRuntime.waitUntil(all)
    else await all
  }
  return new Response('ok')
})
