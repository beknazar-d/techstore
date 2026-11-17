// Telegram-бот: настройки и переписка с клиентами. Всё доступно только администратору.
//
//   - Токен бота хранится только в секрете Edge Functions TELEGRAM_BOT_TOKEN.
//     connectBot → Edge Function `telegram-admin`: проверяет токен (getMe), ставит webhook.
//   - Сообщения клиентов принимает Edge Function `telegram-webhook` и пишет в bot_chats / bot_messages.
//   - sendChatMessage → `telegram-admin` (sendMessage в Telegram + запись в переписку).

import { FunctionsHttpError } from '@supabase/supabase-js'
import type { BotChat, BotMessage, BotSettings, BotSettingsInput, ChatFilters, ChatMode } from '../types'
import { emit, supabase, unwrap } from './client'
import { ApiError, type ApiErrorCode } from './errors'

const USERNAME_RE = /^[A-Za-z][A-Za-z0-9_]{3,31}$/
const GROUP_ID_RE = /^-?\d{5,20}$/
const MAX_GREETING = 1000
const MAX_INSTRUCTIONS = 4000
const MAX_MESSAGE = 4096 // предел Telegram на одно сообщение

const SETTINGS_COLUMNS =
  'connected, token_hint, bot_username, is_enabled, group_id, notify, ai_enabled, greeting, ai_instructions, allow_bargaining, allow_orders, handoff_to_manager, updated_at'
const CHAT_COLUMNS =
  'id, telegram_chat_id, customer_name, telegram_username, customer_phone, mode, handoff_reason, order_id, unread_count, last_message_text, last_message_at, created_at'

interface SettingsRow {
  connected: boolean
  token_hint: string
  bot_username: string
  is_enabled: boolean
  group_id: string
  notify: BotSettings['notify']
  ai_enabled: boolean
  greeting: string
  ai_instructions: string
  allow_bargaining: boolean
  allow_orders: boolean
  handoff_to_manager: boolean
  updated_at: string
}

interface ChatRow {
  id: string
  telegram_chat_id: number
  customer_name: string
  telegram_username: string
  customer_phone: string
  mode: ChatMode
  handoff_reason: string
  order_id: string | null
  unread_count: number
  last_message_text: string
  last_message_at: string
  created_at: string
}

interface MessageRow {
  id: string
  chat_id: string
  sender: BotMessage['sender']
  text: string
  created_at: string
}

function settingsFromRow(row: SettingsRow): BotSettings {
  return {
    connected: row.connected,
    tokenHint: row.token_hint,
    botUsername: row.bot_username,
    isEnabled: row.is_enabled,
    groupId: row.group_id,
    notify: row.notify,
    aiEnabled: row.ai_enabled,
    greeting: row.greeting,
    aiInstructions: row.ai_instructions,
    allowBargaining: row.allow_bargaining,
    allowOrders: row.allow_orders,
    handoffToManager: row.handoff_to_manager,
    updatedAt: row.updated_at,
  }
}

function chatFromRow(row: ChatRow): BotChat {
  return {
    id: row.id,
    telegramChatId: row.telegram_chat_id,
    customerName: row.customer_name,
    telegramUsername: row.telegram_username,
    customerPhone: row.customer_phone,
    mode: row.mode,
    handoffReason: row.handoff_reason,
    orderId: row.order_id,
    unreadCount: row.unread_count,
    lastMessageText: row.last_message_text,
    lastMessageAt: row.last_message_at,
    createdAt: row.created_at,
  }
}

function messageFromRow(row: MessageRow): BotMessage {
  return { id: row.id, chatId: row.chat_id, sender: row.sender, text: row.text, createdAt: row.created_at }
}

function cleanUsername(value: string): string {
  const username = value.trim().replace(/^@/, '')
  if (!USERNAME_RE.test(username)) {
    throw new ApiError('validation', 'Имя бота — латиница, цифры и «_», от 4 до 32 символов, например phone_market_bot')
  }
  if (!username.toLowerCase().endsWith('bot')) {
    throw new ApiError('validation', 'Имя Telegram-бота должно заканчиваться на «bot»')
  }
  return username
}

/** Вызов Edge Function telegram-admin. Ошибку функции превращает в ApiError с её текстом. */
async function callBotFunction<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('telegram-admin', { body })
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const payload = (await error.context.json().catch(() => null)) as { error?: string; code?: string } | null
      if (payload?.error) throw new ApiError((payload.code as ApiErrorCode) ?? 'storage', payload.error)
    }
    throw new ApiError('storage', 'Сервер бота не ответил. Проверьте, что Edge Function telegram-admin развёрнута.')
  }
  return data as T
}

// ---------- Настройки ----------

export async function getBotSettings(): Promise<BotSettings> {
  const row = unwrap(
    await supabase.from('bot_settings').select(SETTINGS_COLUMNS).eq('id', true).single(),
    'Не удалось загрузить настройки бота',
  ) as SettingsRow
  return settingsFromRow(row)
}

/** Меняет настройки бота. Токен здесь не задаётся — он в секретах Edge Functions. */
export async function updateBotSettings(input: BotSettingsInput): Promise<BotSettings> {
  const changes: Record<string, unknown> = {}
  if (input.botUsername !== undefined) changes.bot_username = cleanUsername(input.botUsername)
  if (input.groupId !== undefined) {
    const groupId = input.groupId.trim()
    if (groupId && !GROUP_ID_RE.test(groupId)) {
      throw new ApiError('validation', 'ID группы — число, обычно начинается с -100, например -1001234567890')
    }
    changes.group_id = groupId
  }
  if (input.greeting !== undefined) {
    const greeting = input.greeting.trim()
    if (greeting.length > MAX_GREETING) {
      throw new ApiError('validation', `Приветствие — не длиннее ${MAX_GREETING} символов`)
    }
    changes.greeting = greeting
  }
  if (input.aiInstructions !== undefined) {
    const instructions = input.aiInstructions.trim()
    if (instructions.length > MAX_INSTRUCTIONS) {
      throw new ApiError('validation', `Инструкция для ИИ — не длиннее ${MAX_INSTRUCTIONS} символов`)
    }
    changes.ai_instructions = instructions
  }
  if (input.isEnabled !== undefined) changes.is_enabled = input.isEnabled
  if (input.aiEnabled !== undefined) changes.ai_enabled = input.aiEnabled
  if (input.allowBargaining !== undefined) changes.allow_bargaining = input.allowBargaining
  if (input.allowOrders !== undefined) changes.allow_orders = input.allowOrders
  if (input.handoffToManager !== undefined) changes.handoff_to_manager = input.handoffToManager
  if (input.notify !== undefined) {
    const current = await getBotSettings()
    changes.notify = { ...current.notify, ...input.notify }
  }

  const row = unwrap(
    await supabase.from('bot_settings').update(changes).eq('id', true).select(SETTINGS_COLUMNS).single(),
    'Не удалось сохранить настройки бота',
  ) as SettingsRow
  emit(['botSettings'])
  return settingsFromRow(row)
}

/**
 * Подключает бота: сервер берёт токен из секрета TELEGRAM_BOT_TOKEN, проверяет его
 * и направляет сообщения бота на сайт (webhook). Токен во фронтенд не попадает.
 */
export async function connectBot(): Promise<BotSettings> {
  await callBotFunction({ action: 'connect' })
  emit(['botSettings'])
  return getBotSettings()
}

/** Отключает бота: сообщения перестают приходить на сайт. Настройки и переписка остаются. */
export async function disconnectBot(): Promise<BotSettings> {
  await callBotFunction({ action: 'disconnect' })
  emit(['botSettings'])
  return getBotSettings()
}

/** Пробное сообщение в группу менеджеров. Нужны подключённый бот и ID группы. */
export async function sendTestNotification(): Promise<void> {
  await callBotFunction({ action: 'test' })
}

// ---------- Чаты ----------

/** Чаты, свежие сверху. Фильтр — кто отвечает (бот / нужен менеджер / закрыт). */
export async function listChats(filters: ChatFilters = {}): Promise<BotChat[]> {
  let query = supabase.from('bot_chats').select(CHAT_COLUMNS).order('last_message_at', { ascending: false })
  if (filters.mode) query = query.eq('mode', filters.mode)
  const rows = unwrap(await query, 'Не удалось загрузить чаты') as ChatRow[]
  return rows.map(chatFromRow)
}

export async function getChat(id: string): Promise<BotChat> {
  const row = unwrap(await supabase.from('bot_chats').select(CHAT_COLUMNS).eq('id', id).maybeSingle()) as ChatRow | null
  if (!row) throw new ApiError('not_found', 'Чат не найден')
  return chatFromRow(row)
}

/** Сообщения чата по порядку, старые сверху. */
export async function listChatMessages(chatId: string): Promise<BotMessage[]> {
  const rows = unwrap(
    await supabase
      .from('bot_messages')
      .select('id, chat_id, sender, text, created_at')
      .eq('chat_id', chatId)
      .order('created_at'),
    'Не удалось загрузить сообщения',
  ) as MessageRow[]
  return rows.map(messageFromRow)
}

/**
 * Ответ менеджера клиенту в Telegram. Менеджер перехватывает разговор: бот в этом чате
 * замолкает (`mode: 'manager'`), пока его не вернут кнопкой (`setChatMode(id, 'bot')`).
 */
export async function sendChatMessage(chatId: string, text: string): Promise<BotMessage> {
  const clean = text.trim()
  if (!clean) throw new ApiError('validation', 'Введите сообщение')
  if (clean.length > MAX_MESSAGE) throw new ApiError('validation', `Сообщение — не длиннее ${MAX_MESSAGE} символов`)
  const result = await callBotFunction<{ message: MessageRow }>({ action: 'send', chatId, text: clean })
  emit(['chats'])
  return messageFromRow(result.message)
}

/** Кто отвечает в чате: вернуть боту, забрать менеджеру или закрыть разговор. */
export async function setChatMode(chatId: string, mode: ChatMode): Promise<BotChat> {
  const changes: Record<string, unknown> = { mode }
  if (mode !== 'manager') changes.handoff_reason = ''
  const row = unwrap(
    await supabase.from('bot_chats').update(changes).eq('id', chatId).select(CHAT_COLUMNS).maybeSingle(),
  ) as ChatRow | null
  if (!row) throw new ApiError('not_found', 'Чат не найден')
  emit(['chats'])
  return chatFromRow(row)
}

/** Отмечает сообщения чата прочитанными. Ничего не делает, если непрочитанных нет. */
export async function markChatRead(chatId: string): Promise<void> {
  const rows = unwrap(
    await supabase.from('bot_chats').update({ unread_count: 0 }).eq('id', chatId).gt('unread_count', 0).select('id'),
  ) as { id: string }[]
  if (rows.length > 0) emit(['chats'])
}
