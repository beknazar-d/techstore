import type { OrderStatus, TradeInStatus } from '../../types'
import { ORDER_STATUS_LABELS, TRADE_IN_STATUS_LABELS } from '../../config/labels'
import { Badge } from './Badge'

type BadgeTone = 'success' | 'warning' | 'error' | 'info' | 'neutral'

interface StatusConfig {
  tone: BadgeTone
  dot?: boolean
}

const ORDER_STATUS_CONFIG: Record<OrderStatus, StatusConfig> = {
  new: { tone: 'info', dot: true },
  confirmed: { tone: 'warning' },
  completed: { tone: 'success' },
  cancelled: { tone: 'neutral' },
}

const TRADE_IN_STATUS_CONFIG: Record<TradeInStatus, StatusConfig> = {
  new: { tone: 'info', dot: true },
  evaluated: { tone: 'warning' },
  accepted: { tone: 'success' },
  rejected: { tone: 'neutral' },
  completed: { tone: 'success' },
}

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const config = ORDER_STATUS_CONFIG[status]
  return (
    <Badge tone={config.tone} dot={config.dot}>
      {ORDER_STATUS_LABELS[status]}
    </Badge>
  )
}

export function TradeInStatusBadge({ status }: { status: TradeInStatus }) {
  const config = TRADE_IN_STATUS_CONFIG[status]
  return (
    <Badge tone={config.tone} dot={config.dot}>
      {TRADE_IN_STATUS_LABELS[status]}
    </Badge>
  )
}