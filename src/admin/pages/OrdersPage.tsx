import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { listOrders } from '../../api'
import { ORDER_STATUSES, ORDER_STATUS_LABELS } from '../../config/labels'
import { ORDER_STATUS_TONES, toneClass } from '../../config/tones'
import { cn } from '../../utils/cn'
import { ToneFilters, type ToneFilterOption } from '../components/ToneFilters'
import type { OrderStatus } from '../../types'
import { formatOrderNumber, formatPrice } from '../../utils/format'
import { formatPhone } from '../../utils/phone'
import { OrderStatusBadge } from '../../components/ui/StatusBadge'
import { Spinner } from '../../components/ui/Spinner'
import { useApiQuery } from '../../hooks/useApiQuery'
import { msg } from '../../i18n'
import styles from './OrdersPage.module.css'

function getStatusFilters(): ToneFilterOption<OrderStatus | 'all'>[] {
  return [
    { value: 'all', label: msg().adminOrders.all, tone: 'indigo' },
    ...ORDER_STATUSES.map((status) => ({ value: status, label: ORDER_STATUS_LABELS[status], tone: ORDER_STATUS_TONES[status] })),
  ]
}

export function OrdersPage() {
  const t = msg().adminOrders
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all')
  const { data: orders = [], loading } = useApiQuery(
    () => listOrders(statusFilter === 'all' ? {} : { status: statusFilter }),
    [statusFilter],
    ['orders'],
  )

  const summary = useMemo(() => {
    const total = orders.length
    const revenue = orders.reduce((sum, order) => sum + order.quantity * order.price, 0)
    return { total, revenue }
  }, [orders])

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
          <p className={styles.kicker}>{t.kicker}</p>
          <h1 className={styles.title}>{t.title}</h1>
        </div>
        <div className={styles.summary}>
          <span>{t.pieces(summary.total)}</span>
          <strong>{formatPrice(summary.revenue)}</strong>
        </div>
      </header>

      <ToneFilters options={getStatusFilters()} value={statusFilter} onChange={setStatusFilter} ariaLabel={t.filterAria} />

      <div className={styles.list}>
        {orders.map((order) => (
          <article key={order.id} className={cn(styles.card, toneClass(ORDER_STATUS_TONES[order.status]))}>
            <div className={styles.cardTop}>
              <div>
                <p className={styles.number}>{formatOrderNumber(order.number)}</p>
                <p className={styles.productName}>{order.productName}</p>
              </div>
              <OrderStatusBadge status={order.status} />
            </div>

            <div className={styles.metaRow}>
              <span>{order.customerName}</span>
              <a href={`tel:${order.customerPhone}`} className={styles.phone}>{formatPhone(order.customerPhone)}</a>
            </div>

            <div className={styles.metaGrid}>
              <div>
                <span className={styles.label}>{t.quantity}</span>
                <strong>{t.pieces(order.quantity)}</strong>
              </div>
              <div>
                <span className={styles.label}>{t.sum}</span>
                <strong>{formatPrice(order.quantity * order.price)}</strong>
              </div>
            </div>

            <div className={styles.metaRow}>
              <span>{order.deliveryType === 'pickup' ? t.pickup : t.delivery}</span>
              <span>{order.desiredDate || t.noDate}</span>
            </div>

            {order.address && <p className={styles.address}>{order.address}</p>}

            <Link to={`/admin/orders/${order.id}`} className={styles.link}>{t.open}</Link>
          </article>
        ))}
      </div>
    </div>
  )
}

