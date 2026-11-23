// WhatsApp через Wappi (https://wappi.pro/api-documentation).
// Токен Wappi — в Supabase Vault (RPC wappi_token_get/set/clear, только service_role),
// profile_id и статус номера — в bot_settings. Во фронтенд токен не возвращается.

import { adminDb } from './telegram.ts'

const API = 'https://wappi.pro/api'

export interface WappiCreds {
  token: string
  profileId: string
}

export class WappiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message)
  }
}

/** Вызов Wappi API: Authorization — сам токен (без «Bearer»), profile_id — в каждом запросе. */
export async function wappi<T = Record<string, unknown>>(
  creds: WappiCreds,
  path: string,
  init: { method?: 'GET' | 'POST'; body?: unknown; query?: Record<string, string> } = {},
): Promise<T> {
  const url = new URL(`${API}/${path.replace(/^\//, '')}`)
  url.searchParams.set('profile_id', creds.profileId)
  for (const [key, value] of Object.entries(init.query ?? {})) url.searchParams.set(key, value)
  const response = await fetch(url, {
    method: init.method ?? (init.body === undefined ? 'GET' : 'POST'),
    headers: { Authorization: creds.token, 'content-type': 'application/json' },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  })
  const data = (await response.json().catch(() => null)) as (Record<string, unknown> & { status?: string }) | null
  if (!response.ok || !data || data.status === 'error') {
    const detail = String(data?.detail ?? data?.message ?? data?.error ?? response.status)
    let message = `Wappi: ${detail}`
    if (response.status === 401 || response.status === 403) message = 'Wappi не принял токен. Скопируйте API-токен из личного кабинета wappi.pro ещё раз.'
    else if (response.status === 404 || /profile/i.test(detail)) message = 'Wappi: профиль не найден. Проверьте ID профиля (profile_id).'
    else if (response.status === 402 || /payment|оплат/i.test(detail)) message = 'Wappi: закончилась оплата профиля. Продлите тариф на wappi.pro.'
    throw new WappiError(message, response.status)
  }
  return data as T
}

/** Кэш учётных данных, чтобы вебхук не читал Vault на каждое сообщение. */
let cached: { value: WappiCreds | null; until: number } | null = null
const TTL_MS = 30_000

export async function wappiCreds(fresh = false): Promise<WappiCreds | null> {
  if (!fresh && cached && cached.until > Date.now()) return cached.value
  const db = adminDb()
  const [{ data: token, error }, { data: settings }] = await Promise.all([
    db.rpc('wappi_token_get'),
    db.from('bot_settings').select('whatsapp_profile_id').eq('id', true).maybeSingle(),
  ])
  if (error) throw error
  const profileId = String(settings?.whatsapp_profile_id ?? '')
  const value = typeof token === 'string' && token.trim() && profileId ? { token: token.trim(), profileId } : null
  cached = { value, until: Date.now() + TTL_MS }
  return value
}

export function forgetWappiCreds(): void {
  cached = null
}

/**
 * Ключ в адресе вебхука (?key=...). Как заголовок Wappi передаёт параметр auth, не описано,
 * поэтому секрет — в самом URL. Выводится из токена (HMAC): при смене токена меняется сам.
 */
export async function whatsappWebhookKey(token: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(token),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode('phone-market:whatsapp-webhook'))
  return [...new Uint8Array(signature)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function whatsappWebhookUrl(key: string): string {
  return `${Deno.env.get('SUPABASE_URL')}/functions/v1/whatsapp-webhook?key=${key}`
}

/** Номер из chat_id: «79991234567@c.us» → «79991234567». */
export function phoneFromChatId(chatId: string): string {
  return chatId.split('@')[0].replace(/\D/g, '')
}

export async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  return btoa(binary)
}

export function base64ToBlob(base64: string, type: string): Blob {
  const clean = base64.replace(/^data:[^,]*,/, '')
  const binary = atob(clean)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type })
}
