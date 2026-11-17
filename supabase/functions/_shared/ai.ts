// Общий код Edge Functions для ИИ (Claude, Anthropic).
// API-ключ админ вводит в «Настройках»; он хранится зашифрованным в Supabase Vault
// (RPC ai_key_get/set/clear — только service_role). Во фронтенд ключ не возвращается.

import Anthropic from 'npm:@anthropic-ai/sdk@1'
import { adminDb } from './telegram.ts'

export { Anthropic }

export const AI_MODELS = ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5'] as const
export type AiModel = (typeof AI_MODELS)[number]

export const KEY_RE = /^sk-ant-[A-Za-z0-9_-]{20,}$/

export interface AiSettingsRow {
  connected: boolean
  assistant_model: AiModel
  bot_model: AiModel
  assistant_instructions: string
}

export async function aiSettings(): Promise<AiSettingsRow | null> {
  const { data } = await adminDb()
    .from('ai_settings')
    .select('connected, assistant_model, bot_model, assistant_instructions')
    .eq('id', true)
    .maybeSingle()
  return (data as AiSettingsRow | null) ?? null
}

/** Кэш ключа в памяти экземпляра функции, чтобы не читать Vault на каждый запрос. */
let cachedKey: { value: string | null; until: number } | null = null
const KEY_TTL_MS = 30_000

export async function aiKey(fresh = false): Promise<string | null> {
  if (!fresh && cachedKey && cachedKey.until > Date.now()) return cachedKey.value
  const { data, error } = await adminDb().rpc('ai_key_get')
  if (error) throw error
  const value = typeof data === 'string' && data.trim() ? data.trim() : null
  cachedKey = { value, until: Date.now() + KEY_TTL_MS }
  return value
}

export function forgetAiKey(): void {
  cachedKey = null
}

export function aiClient(apiKey: string): Anthropic {
  return new Anthropic({ apiKey, maxRetries: 2, timeout: 120_000 })
}

interface AskParams {
  model: AiModel
  system: string
  tools: Anthropic.Beta.BetaToolUnion[]
  messages: Anthropic.Beta.BetaMessageParam[]
  effort: 'low' | 'medium' | 'high'
  maxTokens?: number
}

/**
 * Один запрос к Claude. Для Opus/Sonnet включён серверный fallback: если модель откажется
 * по правилам безопасности, тот же запрос выполнит запасная модель.
 */
export function ask(client: Anthropic, params: AskParams): Promise<Anthropic.Beta.BetaMessage> {
  const withFallback = params.model !== 'claude-haiku-5-5'
  return client.beta.messages.create({
    ...(withFallback ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
    model: params.model,
    max_tokens: params.maxTokens ?? 16000,
    cache_control: { type: 'ephemeral' },
    output_config: { effort: params.effort },
    system: params.system,
    tools: params.tools,
    messages: params.messages,
  })
}

/** Понятный текст ошибки Anthropic для админки. */
export function aiErrorMessage(error: unknown): string {
  if (error instanceof Anthropic.AuthenticationError) {
    return 'Anthropic не принял API-ключ. Проверьте ключ в «Настройках» → «Искусственный интеллект».'
  }
  if (error instanceof Anthropic.PermissionDeniedError) {
    return 'У ключа нет доступа к этой модели. Выберите другую модель в «Настройках».'
  }
  if (error instanceof Anthropic.RateLimitError) {
    return 'Слишком много запросов к ИИ. Подождите минуту и повторите.'
  }
  if (error instanceof Anthropic.BadRequestError) {
    const text = error.message.toLowerCase()
    if (text.includes('credit') || text.includes('balance') || text.includes('billing')) {
      return 'На счёте Anthropic закончились средства. Пополните баланс на console.anthropic.com.'
    }
    return `ИИ не принял запрос: ${error.message}`
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return 'Не удалось связаться с Anthropic. Повторите через минуту.'
  }
  if (error instanceof Anthropic.APIError) {
    return `Сервис ИИ временно недоступен (${error.status ?? 'ошибка'}). Повторите через минуту.`
  }
  return 'Ошибка ИИ. Повторите запрос.'
}

/** Текст ответа модели (без блоков размышлений и вызовов инструментов). */
export function replyText(message: Anthropic.Beta.BetaMessage): string {
  return message.content
    .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim()
}
