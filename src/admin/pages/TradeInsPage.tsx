import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { listTradeIns } from '../../api'
import { TRADE_IN_STATUSES, TRADE_IN_STATUS_LABELS } from '../../config/labels'
import { TRADE_IN_STATUS_TONES, toneClass } from '../../config/tones'
import { cn } from '../../utils/cn'
import { ToneFilters, type ToneFilterOption } from '../components/ToneFilters'
import type { TradeInStatus } from '../../types'
import { formatPrice, formatTradeInNumber } from '../../utils/format'
import { formatPhone } from '../../utils/phone'
import { TradeInStatusBadge } from '../../components/ui/StatusBadge'
import { Spinner } from '../../components/ui/Spinner'
import { useApiQuery } from '../../hooks/useApiQuery'
import { msg } from '../../i18n'
import styles from './TradeInsPage.module.css'

function getStatusFilters(): ToneFilterOption<TradeInStatus | 'all'>[] {
  return [
    { value: 'all', label: msg().adminTradeIns.all, tone: 'indigo' },
    ...TRADE_IN_STATUSES.map((status) => ({ value: status, label: TRADE_IN_STATUS_LABELS[status], tone: TRADE_IN_STATUS_TONES[status] })),
  ]
}

export function TradeInsPage() {
  const t = msg().adminTradeIns
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
          <h1 className={styles.title}>{t.title}</h1>
        </div>
        <div className={styles.summary}>
          <span>{t.count(summary.total)}</span>
          <strong>{formatPrice(summary.estimate)}</strong>
        </div>
      </header>

      <ToneFilters options={getStatusFilters()} value={statusFilter} onChange={setStatusFilter} ariaLabel={t.filterAria} />

      <div className={styles.list}>
        {tradeIns.map((item) => (
          <article key={item.id} className={cn(styles.card, toneClass(TRADE_IN_STATUS_TONES[item.status]))}>
            <div className={styles.topRow}>
              <div>
                <p className={styles.number}>{formatTradeInNumber(item.number)}</p>
                <h2 className={styles.customer}>{item.customerName}</h2>
              </div>
              <TradeInStatusBadge status={item.status} />
            </div>

            <div className={styles.metaRow}>
              <span>{item.device.brand} {item.device.model}</span>
              <a href={`tel:${item.customerPhone}`} className={styles.phone}>{formatPhone(item.customerPhone)}</a>
            </div>

            <div className={styles.metaGrid}>
              <div>
                <span className={styles.label}>{t.grade}</span>
                <strong>{item.device.grade}</strong>
              </div>
              <div>
                <span className={styles.label}>{t.estimate}</span>
                <strong>{item.adminEstimate ? formatPrice(item.adminEstimate) : '—'}</strong>
              </div>
            </div>

            {item.desiredProductName && (
              <p className={styles.desired}>{t.wantsFor(item.desiredProductName)}</p>
            )}

            <Link to={`/admin/trade-in/${item.id}`} className={styles.link}>{t.open}</Link>
          </article>
        ))}
      </div>
    </div>
  )
}

