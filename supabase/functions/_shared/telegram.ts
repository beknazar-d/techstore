// Общий код Edge Functions для Telegram-бота.
// Токен бота админ вводит в «Настройках»; он хранится зашифрованным в Supabase Vault
// (RPC bot_token_get/set/clear — только service_role). Во фронтенд токен не возвращается.

import { createClient } from 'npm:@supabase/supabase-js@2'

/** Клиент с правами service_role — в обход RLS. Только внутри Edge Functions. */
export function adminDb() {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/** Кэш токена в памяти экземпляра функции, чтобы вебхук не читал Vault на каждое сообщение. */
let cachedToken: { value: string | null; until: number } | null = null
const TOKEN_TTL_MS = 30_000

export async function botToken(fresh = false): Promise<string | null> {
  if (!fresh && cachedToken && cachedToken.until > Date.now()) return cachedToken.value
  const { data, error } = await adminDb().rpc('bot_token_get')
  if (error) throw error
  const value = typeof data === 'string' && data.trim() ? data.trim() : null
  cachedToken = { value, until: Date.now() + TOKEN_TTL_MS }
  return value
}

export function forgetBotToken(): void {
  cachedToken = null
}

/**
 * Секрет для заголовка X-Telegram-Bot-Api-Secret-Token. Выводится из токена бота (HMAC),
 * поэтому отдельный секрет хранить не нужно, а при смене токена он меняется сам.
 */
export async function webhookSecret(token: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(token),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode('phone-market:telegram-webhook'))
  return [...new Uint8Array(signature)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Сравнение строк за постоянное время (для секрета вебхука). */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export class TelegramError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message)
  }
}

/** Вызов Bot API. Ошибку Telegram переводит в понятный текст. */
export async function tg<T = unknown>(token: string, method: string, body: Record<string, unknown> = {}): Promise<T> {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = (await response.json().catch(() => null)) as
    | { ok: boolean; result?: T; description?: string; error_code?: number }
    | null
  if (!data?.ok) {
    const code = data?.error_code ?? response.status
    const description = data?.description ?? 'нет ответа'
    let message = `Telegram: ${description}`
    if (code === 401 || code === 404) message = 'Telegram не принял токен бота. Скопируйте токен из @BotFather ещё раз.'
    else if (code === 403) message = 'Telegram: бот заблокирован пользователем или его нет в группе'
    else if (/chat not found/i.test(description)) message = 'Telegram: чат не найден. Проверьте ID группы и что бот в ней есть.'
    throw new TelegramError(message, code)
  }
  return data.result as T
}

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json; charset=utf-8' },
  })
}
