// Управление Telegram-ботом и WhatsApp (Wappi) из админки. Только для администратора (JWT + таблица admins).
//
// POST { action: 'connect', token }          — проверить токен (getMe), сохранить в Vault, поставить webhook
// POST { action: 'disconnect' }              — снять webhook, удалить токен из Vault
// POST { action: 'test' }                    — тестовое сообщение в группу менеджеров
// POST { action: 'send', chatId, text }      — ответ менеджера клиенту (в Telegram или WhatsApp — по каналу чата)
// POST { action: 'wa_connect', token, profileId } — проверить профиль Wappi, сохранить токен, поставить вебхук
// POST { action: 'wa_status' }               — статус номера; если не вошли — QR-код для входа
// POST { action: 'wa_disconnect' }           — снять вебхук, удалить токен Wappi
//
// Токены хранятся в Supabase Vault; в ответах функции их нет (только последние 4 символа в bot_settings).

import { createClient } from 'npm:@supabase/supabase-js@2'
import {
  adminDb,
  botToken,
  corsHeaders,
  forgetBotToken,
  json,
  TelegramError,
  tg,
  webhookSecret,
} from '../_shared/telegram.ts'
import {
  forgetWappiCreds,
  wappi,
  wappiCreds,
  WappiError,
  whatsappWebhookKey,
  whatsappWebhookUrl,
  type WappiCreds,
} from '../_shared/wappi.ts'

type Body =
  | { action: 'connect'; token: string }
  | { action: 'disconnect' }
  | { action: 'test' }
  | { action: 'send'; chatId: string; text: string }
  | { action: 'wa_connect'; token: string; profileId: string }
  | { action: 'wa_status' }
  | { action: 'wa_disconnect' }

const TOKEN_RE = /^\d{5,15}:[A-Za-z0-9_-]{30,}$/

function fail(message: string, code: string, status = 400): Response {
  return json({ error: message, code }, status)
}

/** Проверяет, что запрос от вошедшего администратора. */
async function isAdmin(req: Request): Promise<boolean> {
  const authorization = req.headers.get('authorization') ?? ''
  if (!authorization.startsWith('Bearer ')) return false
  const userDb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: userData } = await userDb.auth.getUser()
  if (!userData.user) return false
  // RLS: пользователь видит только свою строку в admins.
  const { data } = await userDb.from('admins').select('user_id').eq('user_id', userData.user.id).maybeSingle()
  return data !== null
}

const NOT_CONNECTED = 'Бот не подключён: вставьте токен в «Настройках» и нажмите «Подключить бота»'
const WA_NOT_CONNECTED = 'WhatsApp не подключён: вставьте токен и ID профиля Wappi в «Настройках» → «WhatsApp»'
const WAPPI_TOKEN_RE = /^[A-Za-z0-9_.-]{20,200}$/
const WAPPI_PROFILE_RE = /^[A-Za-z0-9-]{4,64}$/

interface WappiStatus {
  authorized?: boolean
  phone?: string | number
  payment_expired_at?: string
}

/** Статус номера из Wappi → bot_settings. Возвращает то, что видит админ. */
async function syncWhatsAppStatus(creds: WappiCreds) {
  const status = await wappi<WappiStatus>(creds, 'sync/get/status')
  const phone = String(status.phone ?? '').replace(/\D/g, '')
  const paidUntil = status.payment_expired_at ? new Date(status.payment_expired_at) : null
  const update = {
    whatsapp_status: status.authorized ? 'online' : 'offline',
    whatsapp_phone: phone.length >= 9 && phone.length <= 15 ? phone : '',
    whatsapp_paid_until: paidUntil && !Number.isNaN(paidUntil.getTime()) ? paidUntil.toISOString() : null,
  }
  const { error } = await adminDb().from('bot_settings').update(update).eq('id', true)
  if (error) throw error
  let qr: string | null = null
  if (!status.authorized) {
    const data = await wappi<{ qrCode?: string; qr?: string }>(creds, 'sync/qr/get').catch(() => null)
    const code = data?.qrCode ?? data?.qr ?? ''
    if (code) qr = code.startsWith('data:') ? code : `data:image/png;base64,${code}`
  }
  return {
    authorized: Boolean(status.authorized),
    phone: update.whatsapp_phone,
    paidUntil: update.whatsapp_paid_until,
    qr,
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return fail('Только POST', 'validation', 405)

  if (!(await isAdmin(req))) return fail('Нужно войти в админку', 'auth', 401)

  const body = (await req.json().catch(() => null)) as Body | null
  if (!body?.action) return fail('Не указано действие', 'validation')

  const db = adminDb()

  try {
    switch (body.action) {
      case 'connect': {
        const token = String(body.token ?? '').trim()
        if (!TOKEN_RE.test(token)) {
          return fail('Токен не похож на токен от @BotFather. Он выглядит так: 123456789:AAH…', 'validation')
        }
        // Сначала проверяем токен в Telegram — неверный токен не сохраняем.
        const me = await tg<{ username: string }>(token, 'getMe')

        // Если меняют бота, старый перестаёт слать сообщения на сайт.
        const previous = await botToken(true)
        if (previous && previous !== token) await tg(previous, 'deleteWebhook').catch(() => undefined)

        const saved = await db.rpc('bot_token_set', { p_token: token })
        if (saved.error) throw saved.error
        forgetBotToken()

        await tg(token, 'setWebhook', {
          url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/telegram-webhook`,
          secret_token: await webhookSecret(token),
          allowed_updates: ['message'],
          drop_pending_updates: false,
        })
        const { error } = await db
          .from('bot_settings')
          .update({ connected: true, token_hint: token.slice(-4), bot_username: me.username })
          .eq('id', true)
        if (error) throw error
        return json({ ok: true, botUsername: me.username })
      }

      case 'disconnect': {
        const token = await botToken(true)
        if (token) await tg(token, 'deleteWebhook', { drop_pending_updates: false }).catch(() => undefined)
        const cleared = await db.rpc('bot_token_clear')
        if (cleared.error) throw cleared.error
        forgetBotToken()
        const { error } = await db.from('bot_settings').update({ connected: false, token_hint: '' }).eq('id', true)
        if (error) throw error
        return json({ ok: true })
      }

      case 'test': {
        const token = await botToken()
        if (!token) return fail(NOT_CONNECTED, 'validation')
        const { data: settings } = await db.from('bot_settings').select('group_id').eq('id', true).single()
        if (!settings?.group_id) return fail('Укажите ID группы менеджеров и сохраните настройки', 'validation')
        await tg(token, 'sendMessage', {
          chat_id: settings.group_id,
          text: '✅ Проверка связи: бот подключён к сайту, уведомления будут приходить сюда.',
        })
        return json({ ok: true })
      }

      case 'send': {
        const text = String(body.text ?? '').trim()
        if (!text) return fail('Введите сообщение', 'validation')
        if (text.length > 4096) return fail('Сообщение — не длиннее 4096 символов', 'validation')
        const { data: chat } = await db
          .from('bot_chats')
          .select('id, channel, telegram_chat_id, whatsapp_chat_id')
          .eq('id', String(body.chatId ?? ''))
          .maybeSingle()
        if (!chat) return fail('Чат не найден', 'not_found', 404)

        if (chat.channel === 'whatsapp') {
          const creds = await wappiCreds()
          if (!creds) return fail(WA_NOT_CONNECTED, 'validation')
          await wappi(creds, 'sync/message/send', { body: { recipient: chat.whatsapp_chat_id, body: text } })
        } else {
          const token = await botToken()
          if (!token) return fail(NOT_CONNECTED, 'validation')
          await tg(token, 'sendMessage', { chat_id: chat.telegram_chat_id, text })
        }
        const { data: message, error } = await db.rpc('bot_record_outgoing', {
          p_chat_id: chat.id,
          p_sender: 'manager',
          p_text: text,
        })
        if (error) throw error
        return json({ ok: true, message })
      }

      case 'wa_connect': {
        const token = String(body.token ?? '').trim()
        const profileId = String(body.profileId ?? '').trim()
        if (!WAPPI_TOKEN_RE.test(token)) {
          return fail('Токен не похож на API-токен Wappi. Скопируйте его в личном кабинете wappi.pro.', 'validation')
        }
        if (!WAPPI_PROFILE_RE.test(profileId)) {
          return fail('ID профиля не похож на profile_id Wappi. Он указан в карточке профиля на wappi.pro.', 'validation')
        }
        const creds = { token, profileId }
        // Сначала проверяем доступ к профилю — неверные данные не сохраняем.
        await wappi(creds, 'sync/get/status')

        const saved = await db.rpc('wappi_token_set', { p_token: token })
        if (saved.error) throw saved.error
        const { error } = await db
          .from('bot_settings')
          .update({ whatsapp_connected: true, whatsapp_profile_id: profileId, whatsapp_token_hint: token.slice(-4) })
          .eq('id', true)
        if (error) throw error
        forgetWappiCreds()

        await wappi(creds, 'webhook/url/set', {
          method: 'POST',
          query: { url: whatsappWebhookUrl(await whatsappWebhookKey(token)) },
        })
        await wappi(creds, 'webhook/types/set', { body: ['incoming_message', 'authorization_status'] })
        return json({ ok: true, ...(await syncWhatsAppStatus(creds)) })
      }

      case 'wa_status': {
        const creds = await wappiCreds(true)
        if (!creds) return fail(WA_NOT_CONNECTED, 'validation')
        return json({ ok: true, ...(await syncWhatsAppStatus(creds)) })
      }

      case 'wa_disconnect': {
        const creds = await wappiCreds(true)
        if (creds) {
          await wappi(creds, 'webhook/url/set', { method: 'POST', query: { url: '' } }).catch(() => undefined)
        }
        const cleared = await db.rpc('wappi_token_clear')
        if (cleared.error) throw cleared.error
        forgetWappiCreds()
        const { error } = await db
          .from('bot_settings')
          .update({
            whatsapp_connected: false,
            whatsapp_token_hint: '',
            whatsapp_status: '',
            whatsapp_phone: '',
            whatsapp_paid_until: null,
          })
          .eq('id', true)
        if (error) throw error
        return json({ ok: true })
      }

      default:
        return fail('Неизвестное действие', 'validation')
    }
  } catch (error) {
    if (error instanceof TelegramError || error instanceof WappiError) return fail(error.message, 'validation', 502)
    console.error(error)
    return fail('Не удалось выполнить действие. Попробуйте ещё раз.', 'storage', 500)
  }
})
