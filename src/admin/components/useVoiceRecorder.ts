import { useCallback, useEffect, useRef, useState } from 'react'
import { msg } from '../../i18n'

/** Дольше — не нужно для поручения, и файл станет тяжёлым. */
const MAX_SECONDS = 120

/** Формат записи, который понимает браузер (Chrome/Electron — webm, Android WebView — webm или mp4, Safari — mp4). */
function pickMimeType(): string {
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']
  return types.find((t) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) ?? ''
}

export function isVoiceInputSupported(): boolean {
  return typeof window !== 'undefined' && typeof MediaRecorder !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia)
}

/**
 * Запись с микрофона: start() → stop() отдаёт запись в onDone. Через MAX_SECONDS запись
 * останавливается сама. cancel() — выбросить запись.
 */
export function useVoiceRecorder(onDone: (audio: Blob) => void, onError: (message: string) => void) {
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const recorder = useRef<MediaRecorder | null>(null)
  const cancelled = useRef(false)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  const cleanup = useCallback(() => {
    if (timer.current) clearInterval(timer.current)
    timer.current = null
    recorder.current?.stream.getTracks().forEach((track) => track.stop())
    recorder.current = null
    setRecording(false)
  }, [])

  const stop = useCallback(() => {
    if (recorder.current?.state === 'recording') recorder.current.stop()
  }, [])

  const cancel = useCallback(() => {
    cancelled.current = true
    stop()
  }, [stop])

  const start = useCallback(async () => {
    if (recorder.current) return
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      onError(msg().assistant.micDenied)
      return
    }
    const mimeType = pickMimeType()
    const media = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
    const chunks: Blob[] = []
    cancelled.current = false
    media.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data)
    }
    media.onstop = () => {
      const type = media.mimeType || mimeType || 'audio/webm'
      cleanup()
      if (cancelled.current || chunks.length === 0) return
      onDone(new Blob(chunks, { type: type.split(';')[0] }))
    }
    recorder.current = media
    media.start()
    setSeconds(0)
    setRecording(true)
    timer.current = setInterval(() => {
      setSeconds((s) => {
        if (s + 1 >= MAX_SECONDS) stop()
        return s + 1
      })
    }, 1000)
  }, [cleanup, onDone, onError, stop])

  // Закрыли панель или ушли со страницы — микрофон отпускаем.
  useEffect(
    () => () => {
      cancelled.current = true
      if (recorder.current?.state === 'recording') recorder.current.stop()
      else cleanup()
    },
    [cleanup],
  )

  return { recording, seconds, start, stop, cancel }
}
