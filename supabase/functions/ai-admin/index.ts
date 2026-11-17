// ИИ для админки. Только для администратора (JWT + таблица admins).
//
// POST { action: 'connect', key }        — проверить API-ключ Anthropic и сохранить в Vault
// POST { action: 'disconnect' }          — удалить ключ
// POST { action: 'chat', messages }      — один шаг ИИ-ассистента
//
// Ассистент работает так: функция отправляет переписку в Claude вместе с фиксированным
// набором инструментов и возвращает ответ модели. Вызовы инструментов (создать категорию,
// товар, поменять остаток…) выполняет браузер через слой src/api — с теми же проверками
// и правами (RLS), что и обычные формы админки, — и присылает результаты следующим шагом.

import { adminDb, corsHeaders, json } from '../_shared/telegram.ts'
import { isAdmin } from '../_shared/auth.ts'
import { aiClient, aiErrorMessage, aiKey, aiSettings, Anthropic, ask, forgetAiKey, KEY_RE } from '../_shared/ai.ts'
import { ASSISTANT_TOOLS, assistantSystem } from './tools.ts'

type Body =
  | { action: 'connect'; key: string }
  | { action: 'disconnect' }
  | { action: 'chat'; messages: Anthropic.Beta.BetaMessageParam[] }

const MAX_MESSAGES = 300
const MAX_BODY_CHARS = 600_000

function fail(message: string, code: string, status = 400): Response {
  return json({ error: message, code }, status)
}

const NOT_CONNECTED = 'ИИ не подключён: вставьте API-ключ Anthropic в «Настройках» → «Искусственный интеллект»'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return fail('Только POST', 'validation', 405)

  if (!(await isAdmin(req))) return fail('Нужно войти в админку', 'auth', 401)

  const raw = await req.text()
  if (raw.length > MAX_BODY_CHARS) {
    return fail('Переписка слишком длинная. Нажмите «Новый разговор».', 'validation', 413)
  }
  let body: Body | null = null
  try {
    body = JSON.parse(raw) as Body
  } catch {
    body = null
  }
  if (!body?.action) return fail('Не указано действие', 'validation')

  const db = adminDb()

  try {
    switch (body.action) {
      case 'connect': {
        const key = String(body.key ?? '').trim()
        if (!KEY_RE.test(key)) {
          return fail('Ключ не похож на API-ключ Anthropic. Он начинается с sk-ant-…', 'validation')
        }
        const settings = await aiSettings()
        // Проверяем ключ бесплатным запросом — неверный ключ не сохраняем.
        await aiClient(key).models.retrieve(settings?.assistant_model ?? 'claude-opus-5-5')

        const saved = await db.rpc('ai_key_set', { p_key: key })
        if (saved.error) throw saved.error
        forgetAiKey()
        const updated = await db
          .from('ai_settings')
          .update({ connected: true, key_hint: key.slice(-4) })
          .eq('id', true)
        if (updated.error) throw updated.error
        return json({ ok: true })
      }

      case 'disconnect': {
        const cleared = await db.rpc('ai_key_clear')
        if (cleared.error) throw cleared.error
        forgetAiKey()
        const updated = await db.from('ai_settings').update({ connected: false, key_hint: '' }).eq('id', true)
        if (updated.error) throw updated.error
        return json({ ok: true })
      }

      case 'chat': {
        const messages = body.messages
        if (!Array.isArray(messages) || messages.length === 0 || messages.length > MAX_MESSAGES) {
          return fail('Пустая или слишком длинная переписка', 'validation')
        }
        if (messages[0]?.role !== 'user') return fail('Переписка должна начинаться с сообщения', 'validation')

        const key = await aiKey()
        const settings = await aiSettings()
        if (!key || !settings?.connected) return fail(NOT_CONNECTED, 'not_found', 409)

        const response = await ask(aiClient(key), {
          model: settings.assistant_model,
          system: assistantSystem(settings.assistant_instructions),
          tools: ASSISTANT_TOOLS,
          messages,
          effort: 'medium',
        })
        return json({ content: response.content, stopReason: response.stop_reason })
      }

      default:
        return fail('Неизвестное действие', 'validation')
    }
  } catch (error) {
    console.error('ai-admin failed', error)
    if (error instanceof Anthropic.APIError) return fail(aiErrorMessage(error), 'storage', 502)
    return fail('Не удалось выполнить действие на сервере. Повторите через минуту.', 'storage', 500)
  }
})
