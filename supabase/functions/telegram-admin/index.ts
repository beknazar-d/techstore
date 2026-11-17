// Управление Telegram-ботом из админки. Только для администратора (JWT + таблица admins).
//
// POST { action: 'connect' }                 — проверить токен (getMe), поставить webhook, отметить «подключён»
// POST { action: 'disconnect' }              — снять webhook, отметить «отключён»
// POST { action: 'test' }                    — тестовое сообщение в группу менеджеров
// POST { action: 'send', chatId, text }      — ответ менеджера клиенту
//
// Токен берётся из секрета TELEGRAM_BOT_TOKEN (Supabase → Edge Functions → Secrets).

import { createClient } from 'npm:@supabase/supabase-js@2'
import { adminDb, botToken, corsHeaders, json, TelegramError, tg, webhookSecret } from '../_shared/telegram.ts'

type Body =
  | { action: 'connect' }
  | { action: 'disconnect' }
  | { action: 'test' }
  | { action: 'send'; chatId: string; text: string }

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return fail('Только POST', 'validation', 405)

  if (!(await isAdmin(req))) return fail('Нужно войти в админку', 'auth', 401)

  const body = (await req.json().catch(() => null)) as Body | null
  if (!body?.action) return fail('Не указано действие', 'validation')

  const token = botToken()
  if (!token) {
    return fail(
      'Токен бота не задан. Добавьте секрет TELEGRAM_BOT_TOKEN в Supabase (Edge Functions → Secrets).',
      'validation',
    )
  }

  const db = adminDb()

  try {
    switch (body.action) {
      case 'connect': {
        const me = await tg<{ username: string }>(token, 'getMe')
        const url = `${Deno.env.get('SUPABASE_URL')}/functions/v1/telegram-webhook`
        await tg(token, 'setWebhook', {
          url,
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
        await tg(token, 'deleteWebhook', { drop_pending_updates: false })
        const { error } = await db.from('bot_settings').update({ connected: false, token_hint: '' }).eq('id', true)
        if (error) throw error
        return json({ ok: true })
      }

      case 'test': {
        const { data: settings } = await db.from('bot_settings').select('connected, group_id').eq('id', true).single()
        if (!settings?.connected) return fail('Сначала подключите бота', 'validation')
        if (!settings.group_id) return fail('Укажите ID группы менеджеров и сохраните настройки', 'validation')
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
          .select('id, telegram_chat_id')
          .eq('id', String(body.chatId ?? ''))
          .maybeSingle()
        if (!chat) return fail('Чат не найден', 'not_found', 404)

        await tg(token, 'sendMessage', { chat_id: chat.telegram_chat_id, text })
        const { data: message, error } = await db.rpc('bot_record_outgoing', {
          p_chat_id: chat.id,
          p_sender: 'manager',
          p_text: text,
        })
        if (error) throw error
        return json({ ok: true, message })
      }

      default:
        return fail('Неизвестное действие', 'validation')
    }
  } catch (error) {
    if (error instanceof TelegramError) return fail(error.message, 'validation', 502)
    console.error(error)
    return fail('Не удалось выполнить действие. Попробуйте ещё раз.', 'storage', 500)
  }
})
