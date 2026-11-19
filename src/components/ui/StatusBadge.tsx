import type { OrderStatus, TradeInStatus } from '../../types'
import { ORDER_STATUS_LABELS, TRADE_IN_STATUS_LABELS } from '../../config/labels'
import { ORDER_STATUS_TONES, TRADE_IN_STATUS_TONES, toneClass, type Tone } from '../../config/tones'
import { cn } from '../../utils/cn'
import styles from './StatusBadge.module.css'

/** Бейдж в цвете статуса. Новые — с точкой, чтобы бросались в глаза. */
export function ToneBadge({ tone, dot, children }: { tone: Tone; dot?: boolean; children: React.ReactNode }) {
  return (
    <span className={cn(styles.badge, toneClass(tone))}>
      {dot && <span className={styles.dot} aria-hidden="true" />}
      {children}
    </span>
  )
}

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <ToneBadge tone={ORDER_STATUS_TONES[status]} dot={status === 'new'}>
      {ORDER_STATUS_LABELS[status]}
    </ToneBadge>
  )
}

export function TradeInStatusBadge({ status }: { status: TradeInStatus }) {
  return (
    <ToneBadge tone={TRADE_IN_STATUS_TONES[status]} dot={status === 'new'}>
      {TRADE_IN_STATUS_LABELS[status]}
    </ToneBadge>
  )
}
