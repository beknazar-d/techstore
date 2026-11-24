import { useEffect, useRef } from 'react'
import styles from './VoiceWave.module.css'

const BARS = 28
const GAP = 3

interface VoiceWaveProps {
  /** Анализатор звука микрофона; null — рисуем тихую волну. */
  analyser: AnalyserNode | null
}

/**
 * Полоски, которые прыгают в такт голосу, пока идёт запись.
 * Canvas, а не DOM-полоски: высоты меняются 60 раз в секунду, без инлайн-стилей.
 * Цвет — токен --color-primary из CSS (через getComputedStyle), поэтому тёмная тема работает сама.
 */
export function VoiceWave({ analyser }: VoiceWaveProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const data = analyser ? new Uint8Array(analyser.frequencyBinCount) : null
    const levels = new Array<number>(BARS).fill(0)
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    let frame = 0

    const draw = () => {
      const dpr = window.devicePixelRatio || 1
      const width = canvas.clientWidth
      const height = canvas.clientHeight
      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr
        canvas.height = height * dpr
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, width, height)
      ctx.fillStyle = getComputedStyle(canvas).color

      if (analyser && data) analyser.getByteFrequencyData(data)
      const barWidth = (width - GAP * (BARS - 1)) / BARS
      const half = BARS / 2
      for (let i = 0; i < BARS; i++) {
        // Голос — в нижней части спектра: зеркалим её от центра к краям.
        const fromCenter = Math.abs(i - half + 0.5) / half
        const bin = data ? Math.floor(fromCenter * data.length * 0.45) : 0
        const target = data ? data[bin] / 255 : 0
        // Плавно: вверх быстро, вниз медленно.
        levels[i] = target > levels[i] ? target : levels[i] * 0.85 + target * 0.15
        const level = reduced ? Math.min(levels[i], 0.4) : levels[i]
        const barHeight = Math.max(4, level * height * (1 - fromCenter * 0.35))
        const x = i * (barWidth + GAP)
        const y = (height - barHeight) / 2
        // roundRect нет в старых Android WebView — там просто прямоугольники.
        if (typeof ctx.roundRect === 'function') {
          ctx.beginPath()
          ctx.roundRect(x, y, barWidth, barHeight, barWidth / 2)
          ctx.fill()
        } else {
          ctx.fillRect(x, y, barWidth, barHeight)
        }
      }
      frame = requestAnimationFrame(draw)
    }
    frame = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frame)
  }, [analyser])

  return <canvas ref={canvasRef} className={styles.wave} aria-hidden="true" />
}
