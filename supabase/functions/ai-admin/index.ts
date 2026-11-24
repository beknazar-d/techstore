// ИИ для админки. Только для администратора (JWT + таблица admins).
//
// POST { action: 'connect', provider, key } — проверить ключ (anthropic | openai | google | elevenlabs)
//                                             и сохранить в Vault; для ИИ — запомнить список моделей
// POST { action: 'disconnect', provider }   — удалить ключ
// POST { action: 'voices' }                 — голоса ElevenLabs по сохранённому ключу
// POST { action: 'chat', messages }         — один шаг ИИ-ассистента
// POST { action: 'research', query, specHint } — найти товар в интернете (веб-поиск выбранного провайдера)
// POST { action: 'images', query, pages }    — подобрать фото товара (страницы-источники + Wikimedia Commons)
// POST { action: 'fetch_image', url }        — скачать одну картинку (base64) — браузер сожмёт и прикрепит
// POST { action: 'transcribe', audio, mimeType } — голосовое поручение ассистенту → текст (ElevenLabs или OpenAI)
//
// Ассистент работает так: функция отправляет переписку выбранной модели вместе с фиксированным
// набором инструментов и возвращает ответ. Вызовы инструментов (создать категорию, товар,
// поменять остаток…) выполняет браузер через слой src/api — с теми же проверками и правами
// (RLS), что и обычные формы админки, — и присылает результаты следующим шагом.

import { adminDb, corsHeaders, json } from '../_shared/telegram.ts'
import { isAdmin } from '../_shared/auth.ts'
import {
  aiSecret,
  aiSettings,
  forgetAiSecret,
  KEY_NAMES,
  KEY_PATTERNS,
  SECRET_PROVIDERS,
  type AiSettingsRow,
  type SecretProvider,
} from '../_shared/ai.ts'
import {
  chatStep,
  listElevenLabsVoices,
  listModels,
  LlmError,
  PROVIDERS,
  type ChatMessage,
  type Provider,
} from '../_shared/llm.ts'
import { ASSISTANT_TOOLS, assistantSystem } from './tools.ts'
import { fetchImage, findImages, researchProduct } from './research.ts'
import { transcribe } from '../_shared/voice.ts'

type Body =
  | { action: 'connect'; provider: SecretProvider; key: string }
  | { action: 'disconnect'; provider: SecretProvider }
  | { action: 'voices' }
  | { action: 'chat'; messages: ChatMessage[] }
  | { action: 'research'; query: string; specHint?: string }
  | { action: 'images'; query: string; pages?: string[] }
  | { action: 'fetch_image'; url: string }
  | { action: 'transcribe'; audio: string; mimeType?: string }

const MAX_MESSAGES = 300
const MAX_BODY_CHARS = 600_000
const MAX_MODELS = 40

function fail(message: string, code: string, status = 400): Response {
  return json({ error: message, code }, status)
}

/** ~2 минуты речи в webm/opus с запасом. */
const MAX_AUDIO_BASE64 = 8_000_000
const NO_VOICE_KEY = 'Для голоса нужен ключ ElevenLabs или OpenAI: «Настройки» → «ИИ: ключи и ассистент»'
const NOT_CONNECTED = 'ИИ не подключён: вставьте API-ключ в «Настройках» → «Искусственный интеллект»'

/** Провайдер, модель и ключ ассистента; null — ИИ для ассистента не подключён. */
async function assistantKey(): Promise<{ settings: AiSettingsRow; provider: Provider; key: string } | null> {
  const settings = await aiSettings()
  const provider = settings?.assistant_provider
  if (!settings || !provider || !PROVIDERS.includes(provider) || !settings.key_hints?.[provider]) return null
  const key = await aiSecret(provider)
  return key ? { settings, provider, key } : null
}

function isSecretProvider(value: unknown): value is SecretProvider {
  return SECRET_PROVIDERS.includes(value as SecretProvider)
}

function validMessages(messages: unknown): messages is ChatMessage[] {
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > MAX_MESSAGES) return false
  if ((messages[0] as ChatMessage)?.role !== 'user') return false
  return messages.every((m: ChatMessage) => {
    if (m?.role === 'user') return typeof m.text === 'string'
    if (m?.role === 'assistant') return typeof m.text === 'string' && (!m.toolCalls || Array.isArray(m.toolCalls))
    if (m?.role === 'tool') return Array.isArray(m.results)
    return false
  })
}

/**
 * После подключения ключа: если у ассистента или бота ещё нет рабочего провайдера —
 * переключаем их на этот; если модель пропала из списка — берём первую.
 */
function rolesAfterConnect(settings: AiSettingsRow, provider: Provider, models: string[]) {
  const patch: Partial<AiSettingsRow> = {}
  const hints = settings.key_hints ?? {}
  for (const role of ['assistant', 'bot'] as const) {
    const current = settings[`${role}_provider`]
    const model = settings[`${role}_model`]
    if (!hints[current] || (current === provider && !models.includes(model))) {
      patch[`${role}_provider`] = provider
      patch[`${role}_model`] = models[0]
    }
  }
  return patch
}

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
        const provider = body.provider
        if (!isSecretProvider(provider)) return fail('Неизвестный провайдер', 'validation')
        const key = String(body.key ?? '').trim()
        if (!KEY_PATTERNS[provider].test(key)) {
          return fail(`Ключ не похож на API-ключ ${KEY_NAMES[provider]}`, 'validation')
        }
        const settings = await aiSettings()
        if (!settings) return fail('Нет строки настроек ИИ', 'storage', 500)

        // Проверяем ключ бесплатным запросом (список моделей / голосов) — неверный ключ не сохраняем.
        let models: string[] = []
        let voices: { id: string; name: string }[] = []
        if (provider === 'elevenlabs') {
          voices = await listElevenLabsVoices(key)
        } else {
          models = (await listModels(provider, key)).slice(0, MAX_MODELS)
          if (models.length === 0) return fail('По этому ключу нет доступных моделей для чата', 'validation')
        }

        const saved = await db.rpc('ai_secret_set', { p_provider: provider, p_key: key })
        if (saved.error) throw saved.error
        forgetAiSecret(provider)

        const patch: Record<string, unknown> = { key_hints: { ...settings.key_hints, [provider]: key.slice(-4) } }
        if (provider !== 'elevenlabs') {
          patch.models = { ...settings.models, [provider]: models }
          Object.assign(patch, rolesAfterConnect(settings, provider, models))
        }
        const updated = await db.from('ai_settings').update(patch).eq('id', true)
        if (updated.error) throw updated.error
        return json({ ok: true, models, voices })
      }

      case 'disconnect': {
        const provider = body.provider
        if (!isSecretProvider(provider)) return fail('Неизвестный провайдер', 'validation')
        const settings = await aiSettings()
        const cleared = await db.rpc('ai_secret_clear', { p_provider: provider })
        if (cleared.error) throw cleared.error
        forgetAiSecret(provider)
        const hints = { ...(settings?.key_hints ?? {}) }
        const models = { ...(settings?.models ?? {}) }
        delete hints[provider]
        if (provider !== 'elevenlabs') delete models[provider]
        const updated = await db.from('ai_settings').update({ key_hints: hints, models }).eq('id', true)
        if (updated.error) throw updated.error
        return json({ ok: true })
      }

      case 'voices': {
        const key = await aiSecret('elevenlabs')
        if (!key) return fail('Сначала подключите ключ ElevenLabs', 'not_found', 409)
        return json({ voices: await listElevenLabsVoices(key) })
      }

      case 'research': {
        const query = String(body.query ?? '').trim().slice(0, 300)
        if (query.length < 2) return fail('Укажите, какой товар искать', 'validation')
        const ready = await assistantKey()
        if (!ready) return fail(NOT_CONNECTED, 'not_found', 409)
        const result = await researchProduct(
          ready.provider,
          ready.key,
          ready.settings.assistant_model,
          query,
          String(body.specHint ?? '').slice(0, 3000),
        )
        return json(result)
      }

      case 'images': {
        const query = String(body.query ?? '').trim().slice(0, 300)
        if (query.length < 2) return fail('Укажите, для какого товара искать фото', 'validation')
        const pages = Array.isArray(body.pages) ? body.pages.filter((p): p is string => typeof p === 'string') : []
        return json({ images: await findImages(query, pages) })
      }

      case 'transcribe': {
        const audio = String(body.audio ?? '')
        if (!audio) return fail('Пустая запись', 'validation')
        if (audio.length > MAX_AUDIO_BASE64) return fail('Запись слишком длинная — не больше двух минут', 'validation')
        const settings = await aiSettings()
        if (!settings) return fail(NOT_CONNECTED, 'not_found', 409)
        const mimeType = /^audio\/[a-z0-9.+-]+$/i.test(String(body.mimeType ?? '')) ? String(body.mimeType) : 'audio/webm'
        const bytes = Uint8Array.from(atob(audio), (c) => c.charCodeAt(0))
        const text = await transcribe(settings, new Blob([bytes], { type: mimeType }))
        if (text === null) return fail(NO_VOICE_KEY, 'not_found', 409)
        return json({ text })
      }

      case 'fetch_image': {
        return json(await fetchImage(String(body.url ?? '')))
      }

      case 'chat': {
        if (!validMessages(body.messages)) return fail('Пустая или неверная переписка', 'validation')

        const ready = await assistantKey()
        if (!ready) return fail(NOT_CONNECTED, 'not_found', 409)
        const { settings, provider, key } = ready

        const step = await chatStep({
          provider,
          apiKey: key,
          model: settings.assistant_model,
          system: assistantSystem(settings.assistant_instructions),
          tools: ASSISTANT_TOOLS,
          messages: body.messages,
          effort: 'medium',
        })
        return json(step)
      }

      default:
        return fail('Неизвестное действие', 'validation')
    }
  } catch (error) {
    console.error('ai-admin failed', error)
    if (error instanceof LlmError) return fail(error.message, 'storage', 502)
    return fail('Не удалось выполнить действие на сервере. Повторите через минуту.', 'storage', 500)
  }
})
