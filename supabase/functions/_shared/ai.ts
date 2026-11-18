// Общий код Edge Functions для ИИ: настройки и ключи провайдеров.
// Ключи админ вводит в «Настройках»; они хранятся зашифрованными в Supabase Vault
// (RPC ai_secret_get/set/clear — только service_role). Во фронтенд ключи не возвращаются.
// Сами запросы к моделям — в llm.ts, голос — в voice.ts.

import { adminDb } from './telegram.ts'
import type { Provider } from './llm.ts'

/** Сервисы, для которых в Vault хранится API-ключ. */
export type SecretProvider = Provider | 'elevenlabs'
export const SECRET_PROVIDERS: SecretProvider[] = ['anthropic', 'openai', 'google', 'elevenlabs']

/** Как выглядит ключ — чтобы сразу подсказать, если вставили не то. */
export const KEY_PATTERNS: Record<SecretProvider, RegExp> = {
  anthropic: /^sk-ant-[A-Za-z0-9_-]{20,}$/,
  openai: /^sk-[A-Za-z0-9_-]{20,}$/,
  google: /^AIza[A-Za-z0-9_-]{30,}$/,
  elevenlabs: /^[A-Za-z0-9_]{20,}$/,
}

export const KEY_NAMES: Record<SecretProvider, string> = {
  anthropic: 'Anthropic (Claude) — начинается с sk-ant-',
  openai: 'OpenAI (ChatGPT) — начинается с sk-',
  google: 'Google AI Studio (Gemini) — начинается с AIza',
  elevenlabs: 'ElevenLabs',
}

export interface AiSettingsRow {
  assistant_provider: Provider
  assistant_model: string
  bot_provider: Provider
  bot_model: string
  assistant_instructions: string
  key_hints: Partial<Record<SecretProvider, string>>
  models: Partial<Record<Provider, string[]>>
  voice_replies: boolean
  voice_provider: 'elevenlabs' | 'openai'
  elevenlabs_voice_id: string
  elevenlabs_model: string
  openai_voice: string
}

export async function aiSettings(): Promise<AiSettingsRow | null> {
  const { data } = await adminDb()
    .from('ai_settings')
    .select(
      'assistant_provider, assistant_model, bot_provider, bot_model, assistant_instructions, key_hints, models, ' +
        'voice_replies, voice_provider, elevenlabs_voice_id, elevenlabs_model, openai_voice',
    )
    .eq('id', true)
    .maybeSingle()
  return (data as AiSettingsRow | null) ?? null
}

/** Кэш ключей в памяти экземпляра функции, чтобы не читать Vault на каждый запрос. */
const cache = new Map<SecretProvider, { value: string | null; until: number }>()
const KEY_TTL_MS = 30_000

export async function aiSecret(provider: SecretProvider, fresh = false): Promise<string | null> {
  const hit = cache.get(provider)
  if (!fresh && hit && hit.until > Date.now()) return hit.value
  const { data, error } = await adminDb().rpc('ai_secret_get', { p_provider: provider })
  if (error) throw error
  const value = typeof data === 'string' && data.trim() ? data.trim() : null
  cache.set(provider, { value, until: Date.now() + KEY_TTL_MS })
  return value
}

export function forgetAiSecret(provider: SecretProvider): void {
  cache.delete(provider)
}

/** Ключ провайдера, выбранного для бота, — или null, если ИИ бота не подключён. */
export async function botAiKey(settings: AiSettingsRow | null): Promise<string | null> {
  if (!settings?.key_hints?.[settings.bot_provider]) return null
  return await aiSecret(settings.bot_provider)
}
