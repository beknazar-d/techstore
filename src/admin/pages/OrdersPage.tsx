import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { listOrders } from '../../api'
import { ORDER_STATUSES, ORDER_STATUS_LABELS } from '../../config/labels'
import type { OrderStatus } from '../../types'
import { formatOrderNumber, formatPrice } from '../../utils/format'
import { formatPhone } from '../../utils/phone'
import { OrderStatusBadge } from '../../components/ui/StatusBadge'
import { Spinner } from '../../components/ui/Spinner'
import { useApiQuery } from '../../hooks/useApiQuery'
import styles from './OrdersPage.module.css'

const STATUS_FILTERS: Array<{ value: OrderStatus | 'all'; label: string }> = [
  { value: 'all', label: 'Все' },
  ...ORDER_STATUSES.map((status) => ({ value: status, label: ORDER_STATUS_LABELS[status] })),
]

export function OrdersPage() {
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
          <p className={styles.kicker}>Заказы</p>
          <h1 className={styles.title}>Список заказов</h1>
        </div>
        <div className={styles.summary}>
          <span>{summary.total} шт.</span>
          <strong>{formatPrice(summary.revenue)}</strong>
        </div>
      </header>

      <div className={styles.filters} aria-label="Фильтр заказов">
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
        {orders.map((order) => (
          <article key={order.id} className={styles.card}>
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
                <span className={styles.label}>Количество</span>
                <strong>{order.quantity} шт.</strong>
              </div>
              <div>
                <span className={styles.label}>Сумма</span>
                <strong>{formatPrice(order.quantity * order.price)}</strong>
              </div>
            </div>

            <div className={styles.metaRow}>
              <span>{order.deliveryType === 'pickup' ? 'Самовывоз' : 'Доставка'}</span>
              <span>{order.desiredDate || 'Дата не указана'}</span>
            </div>

            {order.address && <p className={styles.address}>{order.address}</p>}

            <Link to={`/admin/orders/${order.id}`} className={styles.link}>Открыть заказ</Link>
          </article>
        ))}
      </div>
    </div>
  )
}

