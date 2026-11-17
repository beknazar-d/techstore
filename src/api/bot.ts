// Telegram-бот: настройки и переписка с клиентами. Всё доступно только администратору.
//
// Сейчас (локальная версия) бот не работает по-настоящему: переписка — демо-данные,
// ответ менеджера пишется в консоль. В Supabase-версии:
//   - connectBot → Edge Function `telegram-setup`: сохраняет токен в секреты, вызывает
//     getMe и setWebhook. Токен во фронтенд не возвращается никогда.
//   - сообщения клиентов принимает Edge Function `telegram-webhook`, отвечает ИИ
//     (данные о товарах берёт из базы), пишет всё в bot_chats / bot_messages.
//   - sendChatMessage → Edge Function `telegram-send` (sendMessage в Telegram).

import type {
  BotChat,
  BotMessage,
  BotSettings,
  BotSettingsInput,
  ChatFilters,
  ChatMode,
  ConnectBotInput,
} from '../types'
import { requireAdmin } from './auth'
import { clone, createId, delay, mutate, nowISO, readDb, type Db } from './db'
import { ApiError } from './errors'

const TOKEN_RE = /^\d{5,15}:[A-Za-z0-9_-]{30,}$/
const USERNAME_RE = /^[A-Za-z][A-Za-z0-9_]{3,31}$/
const GROUP_ID_RE = /^-?\d{5,20}$/
const MAX_GREETING = 1000
const MAX_INSTRUCTIONS = 4000
const MAX_MESSAGE = 4096 // предел Telegram на одно сообщение

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

// ---------- Настройки ----------

export async function getBotSettings(): Promise<BotSettings> {
  requireAdmin()
  await delay()
  return clone(readDb().botSettings)
}

/** Меняет настройки бота. Токен здесь не задаётся — для него `connectBot`. */
export async function updateBotSettings(input: BotSettingsInput): Promise<BotSettings> {
  requireAdmin()
  await delay(250)

  const patch: BotSettingsInput = { ...input }
  if (patch.botUsername !== undefined) patch.botUsername = cleanUsername(patch.botUsername)
  if (patch.groupId !== undefined) {
    patch.groupId = patch.groupId.trim()
    if (patch.groupId && !GROUP_ID_RE.test(patch.groupId)) {
      throw new ApiError('validation', 'ID группы — число, обычно начинается с -100, например -1001234567890')
    }
  }
  if (patch.greeting !== undefined) {
    patch.greeting = patch.greeting.trim()
    if (patch.greeting.length > MAX_GREETING) {
      throw new ApiError('validation', `Приветствие — не длиннее ${MAX_GREETING} символов`)
    }
  }
  if (patch.aiInstructions !== undefined) {
    patch.aiInstructions = patch.aiInstructions.trim()
    if (patch.aiInstructions.length > MAX_INSTRUCTIONS) {
      throw new ApiError('validation', `Инструкция для ИИ — не длиннее ${MAX_INSTRUCTIONS} символов`)
    }
  }

  return mutate(['botSettings'], (db) => {
    const current = db.botSettings
    db.botSettings = {
      ...current,
      ...patch,
      notify: { ...current.notify, ...patch.notify },
      updatedAt: nowISO(),
    }
    return clone(db.botSettings)
  })
}

/**
 * Подключает бота по токену от @BotFather.
 * Локально токен НЕ сохраняется (секреты во фронтенде не храним) — запоминаем только
 * последние 4 символа, чтобы админ видел, какой токен подключён.
 */
export async function connectBot(input: ConnectBotInput): Promise<BotSettings> {
  requireAdmin()
  await delay(600)

  const token = input.token.trim()
  if (!TOKEN_RE.test(token)) {
    throw new ApiError('validation', 'Токен не похож на токен от @BotFather. Он выглядит так: 123456789:AAH…')
  }
  const botUsername = cleanUsername(input.botUsername)

  return mutate(['botSettings'], (db) => {
    db.botSettings = {
      ...db.botSettings,
      connected: true,
      tokenHint: token.slice(-4),
      botUsername,
      updatedAt: nowISO(),
    }
    return clone(db.botSettings)
  })
}

/** Отключает бота: токен удаляется, настройки (приветствие, инструкция) остаются. */
export async function disconnectBot(): Promise<BotSettings> {
  requireAdmin()
  await delay(300)
  return mutate(['botSettings'], (db) => {
    db.botSettings = { ...db.botSettings, connected: false, tokenHint: '', updatedAt: nowISO() }
    return clone(db.botSettings)
  })
}

/** Пробное сообщение в группу менеджеров. Нужны подключённый бот и ID группы. */
export async function sendTestNotification(): Promise<void> {
  requireAdmin()
  await delay(400)
  const settings = readDb().botSettings
  if (!settings.connected) throw new ApiError('validation', 'Сначала подключите бота')
  if (!settings.groupId) throw new ApiError('validation', 'Укажите ID группы менеджеров')
  console.info('[Telegram → группа]', settings.groupId, 'Проверка связи: бот подключён к сайту')
}

// ---------- Чаты ----------

function findChat(db: Db, id: string): BotChat {
  const chat = db.chats.find((item) => item.id === id)
  if (!chat) throw new ApiError('not_found', 'Чат не найден')
  return chat
}

/** Чаты, свежие сверху. Фильтр — кто отвечает (бот / нужен менеджер / закрыт). */
export async function listChats(filters: ChatFilters = {}): Promise<BotChat[]> {
  requireAdmin()
  await delay()
  const chats = readDb().chats.filter((chat) => !filters.mode || chat.mode === filters.mode)
  chats.sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt))
  return clone(chats)
}

export async function getChat(id: string): Promise<BotChat> {
  requireAdmin()
  await delay()
  return clone(findChat(readDb(), id))
}

/** Сообщения чата по порядку, старые сверху. */
export async function listChatMessages(chatId: string): Promise<BotMessage[]> {
  requireAdmin()
  await delay()
  const db = readDb()
  findChat(db, chatId)
  const messages = db.chatMessages.filter((message) => message.chatId === chatId)
  messages.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  return clone(messages)
}

/**
 * Ответ менеджера клиенту. Менеджер перехватывает разговор: бот в этом чате
 * замолкает (`mode: 'manager'`), пока его не вернут кнопкой (`setChatMode(id, 'bot')`).
 */
export async function sendChatMessage(chatId: string, text: string): Promise<BotMessage> {
  requireAdmin()
  await delay(250)

  const clean = text.trim()
  if (!clean) throw new ApiError('validation', 'Введите сообщение')
  if (clean.length > MAX_MESSAGE) throw new ApiError('validation', `Сообщение — не длиннее ${MAX_MESSAGE} символов`)

  const message = mutate(['chats'], (db) => {
    const chat = findChat(db, chatId)
    const now = nowISO()
    const created: BotMessage = { id: createId(), chatId, sender: 'manager', text: clean, createdAt: now }
    db.chatMessages.push(created)
    chat.mode = 'manager'
    chat.unreadCount = 0
    chat.lastMessageText = clean
    chat.lastMessageAt = now
    return created
  })

  console.info('[Telegram → клиент]', chatId, clean)
  return clone(message)
}

/** Кто отвечает в чате: вернуть боту, забрать менеджеру или закрыть разговор. */
export async function setChatMode(chatId: string, mode: ChatMode): Promise<BotChat> {
  requireAdmin()
  await delay(200)
  return mutate(['chats'], (db) => {
    const chat = findChat(db, chatId)
    chat.mode = mode
    if (mode !== 'manager') chat.handoffReason = ''
    return clone(chat)
  })
}

/** Отмечает сообщения чата прочитанными. Ничего не делает, если непрочитанных нет. */
export async function markChatRead(chatId: string): Promise<void> {
  requireAdmin()
  const db = readDb()
  if (findChat(db, chatId).unreadCount === 0) return
  mutate(['chats'], (fresh) => {
    findChat(fresh, chatId).unreadCount = 0
  })
}
