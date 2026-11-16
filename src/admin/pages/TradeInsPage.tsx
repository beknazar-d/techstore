import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { listTradeIns } from '../../api'
import { TRADE_IN_STATUSES, TRADE_IN_STATUS_LABELS } from '../../config/labels'
import type { TradeInStatus } from '../../types'
import { formatPrice, formatTradeInNumber } from '../../utils/format'
import { formatPhone } from '../../utils/phone'
import { Badge } from '../../components/ui/Badge'
import { Spinner } from '../../components/ui/Spinner'
import { useApiQuery } from '../../hooks/useApiQuery'
import styles from './TradeInsPage.module.css'

const STATUS_FILTERS: Array<{ value: TradeInStatus | 'all'; label: string }> = [
  { value: 'all', label: 'Все' },
  ...TRADE_IN_STATUSES.map((status) => ({ value: status, label: TRADE_IN_STATUS_LABELS[status] })),
]

export function TradeInsPage() {
  const [statusFilter, setStatusFilter] = useState<TradeInStatus | 'all'>('all')
  const { data: tradeIns = [], loading } = useApiQuery(
    () => listTradeIns(statusFilter === 'all' ? {} : { status: statusFilter }),
    [statusFilter],
    ['tradeIns'],
  )

  const summary = useMemo(
    () => ({
      total: tradeIns.length,
      estimate: tradeIns.reduce((sum, item) => sum + (item.adminEstimate ?? 0), 0),
    }),
    [tradeIns],
  )

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.loader}><Spinner /></div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>Trade-in</p>
          <h1 className={styles.title}>Заявки на обмен</h1>
        </div>
        <div className={styles.summary}>
          <span>{summary.total} заявок</span>
          <strong>{formatPrice(summary.estimate)}</strong>
        </div>
      </header>

      <div className={styles.filters} aria-label="Фильтр заявок trade-in">
        {STATUS_FILTERS.map((item) => (
          <button
            key={item.value}
            type="button"
            className={styles.filterButton}
            data-active={statusFilter === item.value}
            onClick={() => setStatusFilter(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className={styles.list}>
        {tradeIns.map((item) => (
          <article key={item.id} className={styles.card}>
            <div className={styles.topRow}>
              <div>
                <p className={styles.number}>{formatTradeInNumber(item.number)}</p>
                <h2 className={styles.customer}>{item.customerName}</h2>
              </div>
              <Badge tone={item.status === 'accepted' || item.status === 'completed' ? 'success' : item.status === 'rejected' ? 'neutral' : 'warning'}>
                {TRADE_IN_STATUS_LABELS[item.status]}
              </Badge>
            </div>

            <div className={styles.metaRow}>
              <span>{item.device.brand} {item.device.model}</span>
              <a href={`tel:${item.customerPhone}`} className={styles.phone}>{formatPhone(item.customerPhone)}</a>
            </div>

            <div className={styles.metaGrid}>
              <div>
                <span className={styles.label}>Состояние</span>
                <strong>{item.device.grade}</strong>
              </div>
              <div>
                <span className={styles.label}>Оценка</span>
                <strong>{item.adminEstimate ? formatPrice(item.adminEstimate) : '—'}</strong>
              </div>
            </div>

            {item.desiredProductName && (
              <p className={styles.desired}>Хочет обменять: {item.desiredProductName}</p>
            )}

            <Link to={`/admin/trade-in/${item.id}`} className={styles.link}>Открыть заявку</Link>
          </article>
        ))}
      </div>
    </div>
  )
}

