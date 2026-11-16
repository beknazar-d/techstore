import { Link, useParams } from 'react-router-dom'
import { getTradeIn, listTradeInEvents, updateTradeInStatus } from '../../api'
import { TRADE_IN_STATUS_LABELS, TRADE_IN_STATUSES } from '../../config/labels'
import { Badge } from '../../components/ui/Badge'
import { Spinner } from '../../components/ui/Spinner'
import { useApiQuery } from '../../hooks/useApiQuery'
import { formatPrice, formatTradeInNumber } from '../../utils/format'
import { formatPhone } from '../../utils/phone'
import styles from './TradeInDetailPage.module.css'

export function TradeInDetailPage() {
  const { id } = useParams()
  const { data: tradeIn, loading } = useApiQuery(() => getTradeIn(id ?? ''), [id], ['tradeIns'])
  const { data: events = [] } = useApiQuery(() => listTradeInEvents(id ?? ''), [id], ['tradeIns'])

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.loader}><Spinner /></div>
      </div>
    )
  }

  if (!tradeIn) {
    return (
      <div className={styles.page}>
        <p>Заявка не найдена</p>
      </div>
    )
  }

  const currentTradeIn = tradeIn
  const allowedStatuses = TRADE_IN_STATUSES.filter((status) => status !== currentTradeIn.status)

  async function handleStatusChange(status: (typeof TRADE_IN_STATUSES)[number]) {
    await updateTradeInStatus(currentTradeIn.id, status)
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>Trade-in</p>
          <h1 className={styles.title}>{formatTradeInNumber(currentTradeIn.number)}</h1>
        </div>
        <Badge tone={currentTradeIn.status === 'completed' || currentTradeIn.status === 'accepted' ? 'success' : currentTradeIn.status === 'rejected' ? 'neutral' : 'warning'}>
          {TRADE_IN_STATUS_LABELS[currentTradeIn.status]}
        </Badge>
      </header>

      <div className={styles.grid}>
        <section className={styles.card}>
          <h2>Клиент</h2>
          <dl className={styles.infoList}>
            <div><dt>Имя</dt><dd>{currentTradeIn.customerName}</dd></div>
            <div><dt>Телефон</dt><dd><a href={`tel:${currentTradeIn.customerPhone}`}>{formatPhone(currentTradeIn.customerPhone)}</a></dd></div>
            <div><dt>Оценка</dt><dd>{currentTradeIn.adminEstimate ? formatPrice(currentTradeIn.adminEstimate) : '—'}</dd></div>
          </dl>
        </section>

        <section className={styles.card}>
          <h2>Устройство</h2>
          <dl className={styles.infoList}>
            <div><dt>Категория</dt><dd>{currentTradeIn.device.category}</dd></div>
            <div><dt>Бренд</dt><dd>{currentTradeIn.device.brand}</dd></div>
            <div><dt>Модель</dt><dd>{currentTradeIn.device.model}</dd></div>
            <div><dt>Состояние</dt><dd>{currentTradeIn.device.grade}</dd></div>
            <div><dt>Аккумулятор</dt><dd>{currentTradeIn.device.batteryHealth ? `${currentTradeIn.device.batteryHealth}%` : '—'}</dd></div>
          </dl>
        </section>
      </div>

      <section className={styles.card}>
        <h2>Изменение статуса</h2>
        <div className={styles.actions}>
          {allowedStatuses.map((status) => (
            <button key={status} type="button" className={styles.actionButton} onClick={() => void handleStatusChange(status)}>
              {TRADE_IN_STATUS_LABELS[status]}
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

      <Link to="/admin/trade-in" className={styles.backLink}>Назад к заявкам</Link>
    </div>
  )
}

