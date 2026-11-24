// Голос Telegram-бота: распознать голосовое клиента и озвучить ответ.
// Провайдер голоса выбирает админ: ElevenLabs (свой голос / аватар по ID, хорошо для кыргызского)
// или ChatGPT (OpenAI). Если у выбранного провайдера нет ключа — пробуем второй.

import { aiSecret, type AiSettingsRow } from './ai.ts'

type VoiceProvider = 'elevenlabs' | 'openai'

const MAX_AUDIO_BYTES = 20 * 1024 * 1024 // предел Telegram на скачивание файла ботом
const MAX_TTS_CHARS = 2500 // длинный ответ озвучивать не стоит: клиент получит и текст

async function voiceKey(settings: AiSettingsRow): Promise<{ provider: VoiceProvider; key: string } | null> {
  const order: VoiceProvider[] =
    settings.voice_provider === 'openai' ? ['openai', 'elevenlabs'] : ['elevenlabs', 'openai']
  for (const provider of order) {
    if (!settings.key_hints?.[provider]) continue
    const key = await aiSecret(provider)
    if (key) return { provider, key }
  }
  return null
}

/** Скачать голосовое сообщение из Telegram. */
export async function downloadTelegramFile(token: string, fileId: string): Promise<Blob> {
  const info = await fetch(`https://api.telegram.org/bot${token}/getFile`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ file_id: fileId }),
  }).then((r) => r.json() as Promise<{ ok: boolean; result?: { file_path?: string; file_size?: number } }>)
  const path = info.ok ? info.result?.file_path : undefined
  if (!path) throw new Error('telegram getFile failed')
  if ((info.result?.file_size ?? 0) > MAX_AUDIO_BYTES) throw new Error('voice file is too large')
  const file = await fetch(`https://api.telegram.org/file/bot${token}/${path}`, { signal: AbortSignal.timeout(60_000) })
  if (!file.ok) throw new Error(`telegram file download failed: ${file.status}`)
  return await file.blob()
}

/** Клиенты говорят по-кыргызски или по-русски (часто вперемешку). Остальное — ошибка распознавания. */
const EXPECTED_LANGS = ['kir', 'ky', 'rus', 'ru']

/** Имя файла с расширением по формату: по нему сервисы распознавания определяют кодек. */
function audioFileName(audio: Blob): string {
  const type = audio.type.toLowerCase()
  if (type.includes('webm')) return 'voice.webm'
  if (type.includes('mp4') || type.includes('m4a') || type.includes('aac')) return 'voice.m4a'
  if (type.includes('mpeg') || type.includes('mp3')) return 'voice.mp3'
  if (type.includes('wav')) return 'voice.wav'
  return 'voice.ogg'
}

async function elevenLabsStt(key: string, audio: Blob, language?: string): Promise<{ text: string; lang: string }> {
  const form = new FormData()
  form.append('file', audio, audioFileName(audio))
  form.append('model_id', 'scribe_v1')
  form.append('tag_audio_events', 'false')
  if (language) form.append('language_code', language)
  const response = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
    method: 'POST',
    headers: { 'xi-api-key': key },
    body: form,
    signal: AbortSignal.timeout(120_000),
  })
  if (!response.ok) throw new Error(`elevenlabs speech-to-text failed: ${response.status} ${await response.text()}`)
  const data = (await response.json()) as { text?: string; language_code?: string }
  return { text: String(data.text ?? '').trim(), lang: String(data.language_code ?? '').toLowerCase() }
}

/**
 * Текст голосового сообщения. null — голос не подключён.
 * Кыргызскую речь распознаватель путает с казахской и другими языками («Қандай», арабская вязь) —
 * тогда распознаём ещё раз, явно указав кыргызский.
 */
export async function transcribe(settings: AiSettingsRow, audio: Blob): Promise<string | null> {
  const voice = await voiceKey(settings)
  if (!voice) return null

  if (voice.provider === 'elevenlabs') {
    const first = await elevenLabsStt(voice.key, audio)
    // Арабская вязь или казахские буквы (в кыргызском их нет) — значит, язык определён неверно.
    const suspicious = /[؀-ۿҚқҒғӘәҰұҺһІі]/.test(first.text)
    if (!suspicious && (!first.lang || EXPECTED_LANGS.includes(first.lang))) return first.text
    const retry = await elevenLabsStt(voice.key, audio, 'kir')
    return retry.text || first.text
  }

  const form = new FormData()
  form.append('file', audio, audioFileName(audio))
  form.append('model', 'gpt-4o-transcribe')
  // Подсказка о языках: без неё кыргызскую речь иногда пишет казахскими буквами.
  form.append('prompt', 'Разговор с магазином электроники на кыргызском или русском языке (кириллица). Саламатсызбы, телефон, айфон, баасы канча.')
  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { authorization: `Bearer ${voice.key}` },
    body: form,
    signal: AbortSignal.timeout(120_000),
  })
  if (!response.ok) throw new Error(`openai speech-to-text failed: ${response.status} ${await response.text()}`)
  const data = (await response.json()) as { text?: string }
  return String(data.text ?? '').trim()
}

/** Модели ElevenLabs, которые умеют кыргызский и принимают language_code. */
const KY_MODELS = ['eleven_v4', 'eleven_v4_turbo', 'eleven_v3', 'eleven_v3_conversational']
const FALLBACK_MODEL = 'eleven_v3'

function elevenLabsTts(key: string, voiceId: string, model: string, text: string, lang: 'ru' | 'ky'): Promise<Response> {
  return fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': key, 'content-type': 'application/json' },
    body: JSON.stringify({
      text,
      model_id: model,
      // Без кода языка модель угадывает его сама и читает кыргызский с казахским/русским произношением.
      // multilingual_v2 этот параметр не принимает.
      ...(model === 'eleven_multilingual_v2' ? {} : { language_code: lang }),
      // Числа и сокращения — словами на языке ответа.
      apply_text_normalization: 'on',
    }),
    signal: AbortSignal.timeout(120_000),
  })
}

/**
 * Озвучить ответ (MP3) на языке lang. null — голос не подключён или для ElevenLabs не указан голос.
 * Кыргызский ответ модели без кыргызского (multilingual, flash) озвучиваем через Eleven v3.
 */
export async function synthesize(settings: AiSettingsRow, text: string, lang: 'ru' | 'ky' = 'ru'): Promise<Blob | null> {
  const voice = await voiceKey(settings)
  if (!voice) return null
  const input = text.slice(0, MAX_TTS_CHARS)

  let response: Response
  if (voice.provider === 'elevenlabs') {
    const voiceId = settings.elevenlabs_voice_id
    if (!voiceId) return null
    let model = settings.elevenlabs_model || FALLBACK_MODEL
    if (lang === 'ky' && !KY_MODELS.includes(model)) model = FALLBACK_MODEL
    response = await elevenLabsTts(voice.key, voiceId, model, input, lang)
    // Модель недоступна на тарифе или ещё не выпущена для ключа — пробуем проверенную v3.
    if (!response.ok && response.status < 500 && model !== FALLBACK_MODEL) {
      console.error('elevenlabs tts failed, retry with v3', model, response.status, await response.text())
      response = await elevenLabsTts(voice.key, voiceId, FALLBACK_MODEL, input, lang)
    }
  } else {
    response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: { authorization: `Bearer ${voice.key}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini-tts',
        voice: settings.openai_voice || 'alloy',
        input,
        response_format: 'mp3',
      }),
      signal: AbortSignal.timeout(120_000),
    })
  }
  if (!response.ok) throw new Error(`${voice.provider} text-to-speech failed: ${response.status} ${await response.text()}`)
  return new Blob([await response.arrayBuffer()], { type: 'audio/mpeg' })
}

/** Отправить голосовое сообщение (Telegram принимает MP3). caption — подпись под ним (ссылки). */
export async function sendTelegramVoice(token: string, chatId: number, audio: Blob, caption?: string): Promise<void> {
  const form = new FormData()
  form.append('chat_id', String(chatId))
  if (caption) form.append('caption', caption)
  form.append('voice', audio, 'reply.mp3')
  const response = await fetch(`https://api.telegram.org/bot${token}/sendVoice`, { method: 'POST', body: form })
  const data = (await response.json().catch(() => null)) as { ok?: boolean; description?: string } | null
  if (!data?.ok) throw new Error(`telegram sendVoice failed: ${data?.description ?? response.status}`)
}
