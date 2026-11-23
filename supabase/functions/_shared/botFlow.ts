// Общий ход ответа клиенту для вебхуков Telegram и WhatsApp:
// настройки бота → (голосовое → расшифровка) → пауза на «пишет ещё» → ответ ИИ через канал.

import { adminDb } from './telegram.ts'
import { aiSettings, botAiKey } from './ai.ts'
import type { Channel } from './channels.ts'
import { replyWithAi, type BotAi, type BotBehavior, type ChatInfo } from './botAi.ts'
import { transcribe } from './voice.ts'

export const HANDOFF_NO_AI = 'Новое сообщение — ответьте клиенту'
/** Менеджер писал в чат за это время — считаем, что он ведёт разговор, и бот не вмешивается. */
const MANAGER_ACTIVE_MS = 2 * 60 * 60 * 1000
/** Клиент часто пишет несколькими сообщениями подряд — ждём и отвечаем один раз на все. */
const BURST_MS = 3500

export interface BotSettingsRow extends BotBehavior {
  is_enabled: boolean
  ai_enabled: boolean
  greeting: string
  greeting_ky: string
}

export interface BotRuntime {
  settings: BotSettingsRow | null
  /** null — ИИ выключен или ключ не подключён: сообщения уходят менеджеру. */
  ai: BotAi | null
}

export async function loadBotRuntime(extraColumns = ''): Promise<BotRuntime & { raw: Record<string, unknown> | null }> {
  const { data } = await adminDb()
    .from('bot_settings')
    .select(
      'is_enabled, greeting, greeting_ky, ai_enabled, ai_instructions, allow_bargaining, allow_orders, handoff_to_manager' +
        (extraColumns ? `, ${extraColumns}` : ''),
    )
    .eq('id', true)
    .maybeSingle()
  const settings = (data as unknown as BotSettingsRow | null) ?? null
  let ai: BotAi | null = null
  if (settings?.is_enabled && settings.ai_enabled) {
    const aiRow = await aiSettings().catch(() => null)
    const key = await botAiKey(aiRow).catch(() => null)
    if (aiRow && key) ai = { settings: aiRow, key }
  }
  return { settings, ai, raw: (data as Record<string, unknown> | null) ?? null }
}

interface ChatRow extends ChatInfo {
  mode: string
  handoff_reason: string
}

/**
 * Чат ушёл менеджеру только потому, что ИИ тогда не был подключён. Теперь ИИ готов,
 * а менеджер в чате давно не писал — бот забирает чат обратно. Меняет chat.mode.
 */
export async function reclaimFromManager(chat: ChatRow): Promise<void> {
  if (chat.mode !== 'manager' || chat.handoff_reason !== HANDOFF_NO_AI) return
  const db = adminDb()
  const since = new Date(Date.now() - MANAGER_ACTIVE_MS).toISOString()
  const { count } = await db
    .from('bot_messages')
    .select('id', { count: 'exact', head: true })
    .eq('chat_id', chat.id)
    .eq('sender', 'manager')
    .gte('created_at', since)
  if (count === 0) {
    await db.from('bot_chats').update({ mode: 'bot', handoff_reason: '' }).eq('id', chat.id)
    chat.mode = 'bot'
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Голосовое → расшифровка (видна менеджеру в «Чатах») → ответ ИИ, на голосовое — голосом.
 * Если за время паузы клиент дописал ещё сообщение — отвечать будет обработчик того сообщения
 * (он увидит всю переписку), а этот молчит.
 */
export async function answerAfterPause(
  channel: Channel,
  chat: ChatInfo,
  behavior: BotBehavior,
  ai: BotAi,
  getVoice?: () => Promise<Blob | null>,
): Promise<void> {
  const db = adminDb()
  const receivedAt = Date.now()
  const { data: own } = await db
    .from('bot_messages')
    .select('id, created_at')
    .eq('chat_id', chat.id)
    .eq('sender', 'customer')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  let voice = false
  if (getVoice) {
    const stopTyping = channel.typing(false)
    try {
      const audio = await getVoice()
      const transcript = audio ? await transcribe(ai.settings, audio) : ''
      if (transcript) {
        const text = `[Голосовое] ${transcript}`.slice(0, 4096)
        if (own) await db.from('bot_messages').update({ text }).eq('id', own.id)
        await db.from('bot_chats').update({ last_message_text: text }).eq('id', chat.id)
        voice = true
      }
    } catch (error) {
      console.error('voice transcription failed', error) // ИИ попросит повторить или написать
    } finally {
      stopTyping()
    }
  }

  await sleep(Math.max(0, BURST_MS - (Date.now() - receivedAt)))
  if (own) {
    const { count } = await db
      .from('bot_messages')
      .select('id', { count: 'exact', head: true })
      .eq('chat_id', chat.id)
      .eq('sender', 'customer')
      .gt('created_at', own.created_at)
    if ((count ?? 0) > 0) return
    // Пока ждали, менеджер мог взять чат себе.
    const { data: current } = await db.from('bot_chats').select('mode').eq('id', chat.id).maybeSingle()
    if (current?.mode === 'manager') return
  }
  await replyWithAi(channel, chat, behavior, ai, { voice })
}
