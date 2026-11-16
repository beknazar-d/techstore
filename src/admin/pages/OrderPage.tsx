import { Link, useParams } from 'react-router-dom'
import { getOrder, listOrderEvents, updateOrderStatus } from '../../api'
import { ORDER_STATUS_LABELS, ORDER_STATUSES } from '../../config/labels'
import { Badge } from '../../components/ui/Badge'
import { Spinner } from '../../components/ui/Spinner'
import { useApiQuery } from '../../hooks/useApiQuery'
import { formatOrderNumber, formatPrice } from '../../utils/format'
import { formatPhone } from '../../utils/phone'
import styles from './OrderPage.module.css'

export function OrderPage() {
  const { id } = useParams()
  const { data: order, loading } = useApiQuery(() => getOrder(id ?? ''), [id], ['orders'])
  const { data: events = [] } = useApiQuery(() => listOrderEvents(id ?? ''), [id], ['orders'])

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.loader}><Spinner /></div>
      </div>
    )
  }

  if (!order) {
    return (
      <div className={styles.page}>
        <p>Заказ не найден</p>
      </div>
    )
  }

  const currentOrder = order
  const allowedStatuses = ORDER_STATUSES.filter((status) => status !== currentOrder.status)

  async function handleStatusChange(status: (typeof ORDER_STATUSES)[number]) {
    await updateOrderStatus(currentOrder.id, status)
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>Заказ</p>
          <h1 className={styles.title}>{formatOrderNumber(currentOrder.number)}</h1>
        </div>
        <Badge tone={currentOrder.status === 'completed' ? 'success' : currentOrder.status === 'cancelled' ? 'neutral' : 'warning'}>
          {ORDER_STATUS_LABELS[currentOrder.status]}
        </Badge>
      </header>

      <div className={styles.grid}>
        <section className={styles.card}>
          <h2>Клиент</h2>
          <dl className={styles.infoList}>
            <div><dt>Имя</dt><dd>{currentOrder.customerName}</dd></div>
            <div><dt>Телефон</dt><dd><a href={`tel:${currentOrder.customerPhone}`}>{formatPhone(currentOrder.customerPhone)}</a></dd></div>
            <div><dt>Способ</dt><dd>{currentOrder.deliveryType === 'pickup' ? 'Самовывоз' : 'Доставка'}</dd></div>
            <div><dt>Дата</dt><dd>{currentOrder.desiredDate || '—'}</dd></div>
            <div><dt>Время</dt><dd>{currentOrder.desiredTime || '—'}</dd></div>
          </dl>
        </section>

        <section className={styles.card}>
          <h2>Товар</h2>
          <dl className={styles.infoList}>
            <div><dt>Название</dt><dd>{currentOrder.productName}</dd></div>
            <div><dt>Количество</dt><dd>{currentOrder.quantity} шт.</dd></div>
            <div><dt>Цена</dt><dd>{formatPrice(currentOrder.price)}</dd></div>
            <div><dt>Сумма</dt><dd>{formatPrice(currentOrder.quantity * currentOrder.price)}</dd></div>
            <div><dt>Адрес</dt><dd>{currentOrder.address || 'Не указан'}</dd></div>
          </dl>
        </section>
      </div>

      <section className={styles.card}>
        <h2>Изменение статуса</h2>
        <div className={styles.actions}>
          {allowedStatuses.map((status) => (
            <button key={status} type="button" className={styles.actionButton} onClick={() => void handleStatusChange(status)}>
              {ORDER_STATUS_LABELS[status]}
            </button>
          ))}
        </div>
      </section>

      <section className={styles.card}>
        <h2>История</h2>
        <ul className={styles.timeline}>
          {events.map((event) => (
            <li key={event.id}>
              <time>{event.createdAt.slice(0, 16).replace('T', ' ')}</time>
              <span>{event.message}</span>
            </li>
          ))}
        </ul>
      </section>

      <Link to="/admin/orders" className={styles.backLink}>Назад к заказам</Link>
    </div>
  )
}

