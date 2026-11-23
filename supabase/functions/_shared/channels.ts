// Канал переписки с клиентом: Telegram или WhatsApp (Wappi).
// ИИ-бот (botAi.ts) и ответ менеджера пишут через этот интерфейс и не знают, куда уходит сообщение.

import { tg } from './telegram.ts'
import { sendTelegramVoice } from './voice.ts'
import { blobToBase64, wappi, type WappiCreds } from './wappi.ts'

export type ChannelKind = 'telegram' | 'whatsapp'

export interface Channel {
  kind: ChannelKind
  sendText(text: string): Promise<void>
  /** Голосовое сообщение; caption — ссылки, которые нельзя озвучить. */
  sendVoice(audio: Blob, caption?: string): Promise<void>
  /** Показать «печатает…» / «записывает голосовое…», пока бот думает. Возвращает «стоп». */
  typing(voice: boolean): () => void
}

export function telegramChannel(token: string, chatId: number): Channel {
  return {
    kind: 'telegram',
    async sendText(text) {
      await tg(token, 'sendMessage', { chat_id: chatId, text: text.slice(0, 4096) })
    },
    sendVoice: (audio, caption) => sendTelegramVoice(token, chatId, audio, caption),
    typing(voice) {
      return repeat(4500, () => tg(token, 'sendChatAction', { chat_id: chatId, action: voice ? 'record_voice' : 'typing' }))
    },
  }
}

export function whatsappChannel(creds: WappiCreds, chatId: string): Channel {
  return {
    kind: 'whatsapp',
    async sendText(text) {
      await wappi(creds, 'sync/message/send', { body: { recipient: chatId, body: text.slice(0, 4096) } })
    },
    async sendVoice(audio, caption) {
      await wappi(creds, 'sync/message/audio/send', {
        body: { recipient: chatId, b64_file: await blobToBase64(audio) },
      })
      // У голосовых в WhatsApp нет подписи — ссылки отдельным сообщением.
      if (caption) await wappi(creds, 'sync/message/send', { body: { recipient: chatId, body: caption } })
    },
    typing() {
      // WhatsApp сам гасит статус через ~25 с — обновляем реже, чем в Telegram.
      return repeat(20_000, () => wappi(creds, 'sync/chat/typing/start', { body: { recipient: chatId } }))
    },
  }
}

function repeat(everyMs: number, action: () => Promise<unknown>): () => void {
  let stopped = false
  const run = () => {
    if (!stopped) void action().catch(() => undefined)
  }
  run()
  const timer = setInterval(run, everyMs)
  return () => {
    stopped = true
    clearInterval(timer)
  }
}
