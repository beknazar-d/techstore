/**
 * Анимация смены темы «звезда» (стили слоёв — design/design/StarThemeToggle.css,
 * у нас — ThemeToggle.module.css).
 *
 * Как работает:
 * 1. Звезда на холсте летит от кнопки к центру экрана, оставляя искристый след.
 * 2. В центре — вспышка, ударная волна и разлёт искр. В этот момент:
 *    - поверх страницы кладём её снимок (клон DOM) с data-theme СТАРОЙ темы;
 *    - саму страницу переключаем на новую тему;
 *    - в снимке от центра растёт круглая «дыра» (mask-image), сквозь неё видна новая тема.
 * 3. Когда дыра закрыла экран и искры погасли — снимок и холст удаляются.
 *
 * Работает только потому, что цвета тем заданы на [data-theme], а не на :root (tokens.css).
 * При prefers-reduced-motion тема меняется сразу, без анимации.
 */

export type ThemeMode = 'light' | 'dark'

interface StarTransitionOptions {
  /** Тема, на которую переключаемся. */
  to: ThemeMode
  /** Откуда вылетает звезда (обычно центр кнопки), в координатах окна. */
  origin: { x: number; y: number }
  /** Переключает тему на живой странице. Вызывается в момент взрыва. */
  applyTheme: (theme: ThemeMode) => void
  /** CSS-классы слоёв из CSS-модуля. */
  classNames: { snapshot: string; canvas: string }
}

const FLY_MS = 620
const REVEAL_MS = 900
const SPARKS_MS = 1150
const FEATHER = 48

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  born: number
  life: number
  size: number
  color: string
}

interface Palette {
  star: string
  glow: string
  core: string
  cool: string
}

function readPalette(): Palette {
  const css = getComputedStyle(document.documentElement)
  const get = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback
  return {
    star: get('--color-star', 'orange'),
    glow: get('--color-star-glow', 'gold'),
    core: get('--color-star-core', 'white'),
    cool: get('--color-star-cool', 'lightblue'),
  }
}

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)
const easeOutCubic = (t: number) => 1 - (1 - t) ** 3
const clamp01 = (t: number) => Math.min(1, Math.max(0, t))

/** Снимок страницы в старой теме: клон содержимого body в фиксированном слое. */
function createSnapshot(theme: ThemeMode, className: string, skip: Set<Element>): HTMLElement {
  const snapshot = document.createElement('div')
  snapshot.className = className
  snapshot.dataset.theme = theme
  snapshot.setAttribute('aria-hidden', 'true')
  snapshot.inert = true

  const inner = document.createElement('div')
  inner.style.top = `${-window.scrollY}px`
  inner.style.left = `${-window.scrollX}px`
  inner.style.width = `${document.documentElement.clientWidth}px`

  // Элементы с прокруткой и полями ввода: клон их состояние не переносит, копируем вручную.
  const fixups: Array<() => void> = []

  for (const child of Array.from(document.body.children)) {
    if (skip.has(child) || child.tagName === 'SCRIPT' || child.tagName === 'NOSCRIPT') continue
    const clone = child.cloneNode(true) as Element
    if (clone.id) clone.removeAttribute('id')

    const origWalker = document.createTreeWalker(child, NodeFilter.SHOW_ELEMENT)
    const cloneWalker = document.createTreeWalker(clone, NodeFilter.SHOW_ELEMENT)
    let orig: Node | null = origWalker.currentNode
    let copy: Node | null = cloneWalker.currentNode
    while (orig && copy) {
      const o = orig as HTMLElement
      const c = copy as HTMLElement
      if (o.scrollTop || o.scrollLeft) {
        const { scrollTop, scrollLeft } = o
        fixups.push(() => {
          c.scrollTop = scrollTop
          c.scrollLeft = scrollLeft
        })
      }
      if (o instanceof HTMLInputElement || o instanceof HTMLTextAreaElement || o instanceof HTMLSelectElement) {
        ;(c as HTMLInputElement).value = o.value
      }
      if (c instanceof HTMLImageElement) c.loading = 'eager'
      orig = origWalker.nextNode()
      copy = cloneWalker.nextNode()
    }
    inner.appendChild(clone)
  }

  snapshot.appendChild(inner)
  // Вызвать после вставки снимка в документ.
  ;(snapshot as HTMLElement & { applyFixups?: () => void }).applyFixups = () => fixups.forEach((fn) => fn())
  return snapshot
}

function setHole(el: HTMLElement, x: number, y: number, radius: number) {
  const mask = `radial-gradient(circle at ${x}px ${y}px, transparent ${radius}px, black ${radius + FEATHER}px)`
  el.style.maskImage = mask
  el.style.setProperty('-webkit-mask-image', mask)
}

function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rotation: number, p: Palette) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rotation)

  // Ореол
  const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 3.2)
  halo.addColorStop(0, p.glow)
  halo.addColorStop(1, 'transparent')
  ctx.globalAlpha = 0.45
  ctx.fillStyle = halo
  ctx.beginPath()
  ctx.arc(0, 0, r * 3.2, 0, Math.PI * 2)
  ctx.fill()

  // Пятиконечная звезда
  ctx.globalAlpha = 1
  ctx.shadowColor = p.star
  ctx.shadowBlur = r * 1.4
  ctx.beginPath()
  for (let i = 0; i < 10; i++) {
    const radius = i % 2 === 0 ? r : r * 0.45
    const angle = (Math.PI / 5) * i - Math.PI / 2
    ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius)
  }
  ctx.closePath()
  const body = ctx.createRadialGradient(0, 0, 0, 0, 0, r)
  body.addColorStop(0, p.core)
  body.addColorStop(0.45, p.glow)
  body.addColorStop(1, p.star)
  ctx.fillStyle = body
  ctx.fill()
  ctx.restore()
}

let running = false

/** Запускает анимацию. Пока она идёт, повторные вызовы игнорируются (возвращают false). */
export function runStarThemeTransition({ to, origin, applyTheme, classNames }: StarTransitionOptions): boolean {
  if (running) return false

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduceMotion) {
    applyTheme(to)
    return true
  }

  running = true
  const from: ThemeMode = to === 'dark' ? 'light' : 'dark'
  const palette = readPalette()
  const sparkColors = to === 'light' ? [palette.core, palette.glow, palette.star] : [palette.core, palette.cool, palette.glow]

  const width = window.innerWidth
  const height = window.innerHeight
  const cx = width / 2
  const cy = height / 2
  const maxRadius = Math.hypot(Math.max(cx, width - cx), Math.max(cy, height - cy)) + FEATHER
  const minSide = Math.min(width, height)

  const canvas = document.createElement('canvas')
  canvas.className = classNames.canvas
  canvas.setAttribute('aria-hidden', 'true')
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  canvas.width = Math.round(width * dpr)
  canvas.height = Math.round(height * dpr)
  document.body.appendChild(canvas)
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    canvas.remove()
    applyTheme(to)
    running = false
    return true
  }
  const g: CanvasRenderingContext2D = ctx
  g.scale(dpr, dpr)

  // Траектория звезды: дуга от кнопки к центру.
  const control = { x: (origin.x + cx) / 2 + (cx - origin.x) * 0.15, y: Math.min(origin.y, cy) - minSide * 0.18 }
  const pointAt = (t: number) => ({
    x: (1 - t) ** 2 * origin.x + 2 * (1 - t) * t * control.x + t ** 2 * cx,
    y: (1 - t) ** 2 * origin.y + 2 * (1 - t) * t * control.y + t ** 2 * cy,
  })

  const trail: Particle[] = []
  const sparks: Particle[] = []
  let snapshot: HTMLElement | null = null
  let exploded = false
  const start = performance.now()
  let last = start

  function explode(now: number) {
    exploded = true
    snapshot = createSnapshot(from, classNames.snapshot, new Set([canvas]))
    setHole(snapshot, cx, cy, 0)
    document.body.appendChild(snapshot)
    ;(snapshot as HTMLElement & { applyFixups?: () => void }).applyFixups?.()
    applyTheme(to)

    const count = width < 768 ? 70 : 110
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2
      const speed = (0.25 + Math.random() * 0.75) * minSide * 0.0016
      sparks.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        born: now,
        life: 600 + Math.random() * (SPARKS_MS - 600),
        size: 1 + Math.random() * 2.2,
        color: sparkColors[i % sparkColors.length],
      })
    }
  }

  function finish() {
    canvas.remove()
    snapshot?.remove()
    running = false
  }

  function frame(now: number) {
    const dt = Math.min(now - last, 40)
    last = now
    const elapsed = now - start
    g.clearRect(0, 0, width, height)

    // 1. Полёт звезды
    if (elapsed < FLY_MS) {
      const t = easeInOutCubic(elapsed / FLY_MS)
      const { x, y } = pointAt(t)
      for (let i = 0; i < 3; i++) {
        trail.push({
          x,
          y,
          vx: (Math.random() - 0.5) * 0.08,
          vy: (Math.random() - 0.5) * 0.08 + 0.02,
          born: now,
          life: 280 + Math.random() * 220,
          size: 1 + Math.random() * 2,
          color: i === 0 ? palette.core : palette.glow,
        })
      }
      drawStar(g, x, y, 9 + t * 13, t * Math.PI * 2.5, palette)
    } else if (!exploded) {
      explode(now)
    }

    // След
    for (let i = trail.length - 1; i >= 0; i--) {
      const p = trail[i]
      const age = (now - p.born) / p.life
      if (age >= 1) {
        trail.splice(i, 1)
        continue
      }
      p.x += p.vx * dt
      p.y += p.vy * dt
      g.globalAlpha = 1 - age
      g.fillStyle = p.color
      g.beginPath()
      g.arc(p.x, p.y, p.size * (1 - age * 0.6), 0, Math.PI * 2)
      g.fill()
    }

    if (exploded) {
      const sinceBoom = elapsed - FLY_MS

      // 2. Раскрытие новой темы
      if (snapshot) {
        const r = easeOutCubic(clamp01(sinceBoom / REVEAL_MS)) * maxRadius
        setHole(snapshot, cx, cy, r)
      }

      // Вспышка
      const flashT = clamp01(sinceBoom / 380)
      if (flashT < 1) {
        const fr = minSide * (0.08 + 0.32 * easeOutCubic(flashT))
        const flash = g.createRadialGradient(cx, cy, 0, cx, cy, fr)
        flash.addColorStop(0, palette.core)
        flash.addColorStop(0.35, to === 'light' ? palette.glow : palette.cool)
        flash.addColorStop(1, 'transparent')
        g.globalAlpha = 1 - flashT
        g.fillStyle = flash
        g.beginPath()
        g.arc(cx, cy, fr, 0, Math.PI * 2)
        g.fill()
      }

      // Ударная волна
      const ringT = clamp01(sinceBoom / 700)
      if (ringT < 1) {
        g.globalAlpha = (1 - ringT) * 0.8
        g.strokeStyle = to === 'light' ? palette.star : palette.cool
        g.lineWidth = 6 * (1 - ringT) + 0.5
        g.beginPath()
        g.arc(cx, cy, easeOutCubic(ringT) * maxRadius * 0.75, 0, Math.PI * 2)
        g.stroke()
      }

      // Искры: короткие штрихи по направлению полёта
      for (let i = sparks.length - 1; i >= 0; i--) {
        const p = sparks[i]
        const age = (now - p.born) / p.life
        if (age >= 1) {
          sparks.splice(i, 1)
          continue
        }
        const drag = 0.985 ** (dt / 16)
        p.vx *= drag
        p.vy = p.vy * drag + 0.00035 * dt
        p.x += p.vx * dt
        p.y += p.vy * dt
        g.globalAlpha = (1 - age) ** 1.4
        g.strokeStyle = p.color
        g.lineWidth = p.size
        g.lineCap = 'round'
        g.beginPath()
        g.moveTo(p.x, p.y)
        g.lineTo(p.x - p.vx * 22, p.y - p.vy * 22)
        g.stroke()
      }
      g.globalAlpha = 1

      if (sinceBoom >= Math.max(REVEAL_MS, SPARKS_MS) && sparks.length === 0 && trail.length === 0) {
        finish()
        return
      }
    }

    requestAnimationFrame(frame)
  }

  requestAnimationFrame(frame)
  return true
}
