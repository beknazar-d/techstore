import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { formatPrice } from '../../utils/format'
import type { StatsDay } from '../../types'
import styles from './StatsChart.module.css'

interface StatsChartProps {
  days: StatsDay[]
}

interface Point {
  x: number
  y: number
}

const PAD = { left: 56, right: 16, top: 12, bottom: 28 }
const X_LABELS = 6

const shortDate = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' })
const longDate = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', weekday: 'short' })

/** 'YYYY-MM-DD' → локальная дата (без сдвига по часовому поясу). */
function parseDay(value: string): Date {
  const [y, m, d] = value.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** «Круглый» шаг сетки: 1, 2 или 5 × 10^k. */
function niceStep(max: number, count: number): number {
  const raw = max / count
  const pow = 10 ** Math.floor(Math.log10(raw))
  const unit = raw / pow
  return (unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 5 ? 5 : 10) * pow
}

function formatCompactRub(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} млн`
  if (value >= 1000) return `${Math.round(value / 1000)} тыс.`
  return String(value)
}

/** Монотонная кубическая кривая (Fritsch–Carlson): не выходит за значения соседних точек, ниже нуля не уходит. */
function monotonePath(points: Point[]): string {
  const n = points.length
  if (n === 0) return ''
  if (n === 1) return `M${points[0].x},${points[0].y}`

  const dx: number[] = []
  const slope: number[] = []
  for (let i = 0; i < n - 1; i++) {
    dx.push(points[i + 1].x - points[i].x)
    slope.push((points[i + 1].y - points[i].y) / dx[i])
  }

  const tangent: number[] = [slope[0]]
  for (let i = 1; i < n - 1; i++) {
    tangent.push(slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2)
  }
  tangent.push(slope[n - 2])

  for (let i = 0; i < n - 1; i++) {
    if (slope[i] === 0) {
      tangent[i] = 0
      tangent[i + 1] = 0
      continue
    }
    const a = tangent[i] / slope[i]
    const b = tangent[i + 1] / slope[i]
    const h = a * a + b * b
    if (h > 9) {
      const t = 3 / Math.sqrt(h)
      tangent[i] = t * a * slope[i]
      tangent[i + 1] = t * b * slope[i]
    }
  }

  let d = `M${points[0].x},${points[0].y}`
  for (let i = 0; i < n - 1; i++) {
    const p = points[i]
    const q = points[i + 1]
    const h = dx[i] / 3
    d += ` C${p.x + h},${p.y + tangent[i] * h} ${q.x - h},${q.y - tangent[i + 1] * h} ${q.x},${q.y}`
  }
  return d
}

export function StatsChart({ days }: StatsChartProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 0, height: 260 })
  const [active, setActive] = useState<number | null>(null)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const update = () => setSize({ width: el.clientWidth, height: el.clientWidth >= 640 ? 300 : 240 })
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const isEmpty = days.length === 0 || days.every((d) => d.revenue === 0 && d.profit === 0)

  const plotW = Math.max(0, size.width - PAD.left - PAD.right)
  const plotH = size.height - PAD.top - PAD.bottom
  const baseY = PAD.top + plotH

  const peak = Math.max(1, ...days.map((d) => Math.max(d.revenue, d.profit)))
  const step = niceStep(peak, 4)
  const max = Math.ceil(peak / step) * step
  const yTicks: number[] = []
  for (let v = 0; v <= max; v += step) yTicks.push(v)

  const xAt = (i: number) => PAD.left + (days.length > 1 ? (i / (days.length - 1)) * plotW : plotW / 2)
  const yAt = (v: number) => baseY - (v / max) * plotH

  const revenuePoints = days.map((d, i) => ({ x: xAt(i), y: yAt(d.revenue) }))
  const profitPoints = days.map((d, i) => ({ x: xAt(i), y: yAt(d.profit) }))
  const revenuePath = monotonePath(revenuePoints)
  const profitPath = monotonePath(profitPoints)

  // Подписи оси X: равномерно, первая и последняя — всегда.
  const labelCount = Math.min(days.length, size.width < 480 ? 4 : X_LABELS)
  const labelIndexes =
    labelCount <= 1
      ? [0]
      : Array.from({ length: labelCount }, (_, k) => Math.round((k * (days.length - 1)) / (labelCount - 1)))

  const handlePointer = (e: PointerEvent<SVGSVGElement>) => {
    if (days.length === 0 || plotW <= 0) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const i = days.length > 1 ? Math.round(((x - PAD.left) / plotW) * (days.length - 1)) : 0
    setActive(Math.max(0, Math.min(days.length - 1, i)))
  }

  const activeDay = active !== null ? days[active] : null
  const activeX = active !== null ? xAt(active) : 0
  const tooltipOnLeft = activeX > PAD.left + plotW / 2

  return (
    <div className={styles.chartContainer}>
      <div className={styles.legend}>
        <span className={styles.legendItem}>
          <span className={`${styles.legendDot} ${styles.revenue}`} />
          Выручка
        </span>
        <span className={styles.legendItem}>
          <span className={`${styles.legendDot} ${styles.profit}`} />
          Прибыль
        </span>
      </div>

      <div ref={wrapRef} className={styles.plot}>
        {isEmpty ? (
          <div className={styles.emptyState}>За период нет выполненных заказов</div>
        ) : (
          size.width > 0 && (
            <svg
              width={size.width}
              height={size.height}
              className={styles.chart}
              onPointerMove={handlePointer}
              onPointerDown={handlePointer}
              onPointerLeave={() => setActive(null)}
              role="img"
              aria-label="График выручки и прибыли по дням"
            >
              {yTicks.map((v) => (
                <g key={v}>
                  <line x1={PAD.left} x2={PAD.left + plotW} y1={yAt(v)} y2={yAt(v)} className={styles.gridLine} />
                  <text x={PAD.left - 8} y={yAt(v) + 4} textAnchor="end" className={styles.axisLabel}>
                    {formatCompactRub(v)}
                  </text>
                </g>
              ))}

              {labelIndexes.map((i, k) => (
                <text
                  key={i}
                  x={xAt(i)}
                  y={baseY + 18}
                  textAnchor={k === 0 ? 'start' : k === labelIndexes.length - 1 ? 'end' : 'middle'}
                  className={styles.axisLabel}
                >
                  {shortDate.format(parseDay(days[i].date))}
                </text>
              ))}

              <path
                d={`${revenuePath} L${xAt(days.length - 1)},${baseY} L${xAt(0)},${baseY} Z`}
                className={styles.area}
              />
              <path d={revenuePath} className={`${styles.line} ${styles.revenueLine}`} />
              <path d={profitPath} className={`${styles.line} ${styles.profitLine}`} />

              {activeDay && (
                <g>
                  <line x1={activeX} x2={activeX} y1={PAD.top} y2={baseY} className={styles.cursor} />
                  <circle cx={activeX} cy={yAt(activeDay.revenue)} r={5} className={`${styles.marker} ${styles.revenue}`} />
                  <circle cx={activeX} cy={yAt(activeDay.profit)} r={5} className={`${styles.marker} ${styles.profit}`} />
                </g>
              )}
            </svg>
          )
        )}

        {activeDay && (
          <div
            className={`${styles.tooltip} ${tooltipOnLeft ? styles.tooltipLeft : ''}`}
            style={{ left: tooltipOnLeft ? activeX - 12 : activeX + 12 }}
          >
            <div className={styles.tooltipDate}>{longDate.format(parseDay(activeDay.date))}</div>
            <div className={styles.tooltipRow}>
              <span className={`${styles.legendDot} ${styles.revenue}`} />
              <span>Выручка</span>
              <strong>{formatPrice(activeDay.revenue)}</strong>
            </div>
            <div className={styles.tooltipRow}>
              <span className={`${styles.legendDot} ${styles.profit}`} />
              <span>Прибыль</span>
              <strong>{formatPrice(activeDay.profit)}</strong>
            </div>
            <div className={styles.tooltipMeta}>Заявок: {activeDay.orders}</div>
          </div>
        )}
      </div>

      <details className={styles.tableDetails}>
        <summary>Показать таблицей</summary>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Дата</th>
              <th>Выручка</th>
              <th>Прибыль</th>
              <th>Заявок</th>
            </tr>
          </thead>
          <tbody>
            {days.map((day) => (
              <tr key={day.date}>
                <td>{shortDate.format(parseDay(day.date))}</td>
                <td>{formatPrice(day.revenue)}</td>
                <td>{formatPrice(day.profit)}</td>
                <td>{day.orders}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  )
}
