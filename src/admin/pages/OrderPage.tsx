import { Link, useParams } from 'react-router-dom'
import { getOrder, listOrderEvents, updateOrderStatus, cancelOrder, setOrderAdminNote, getAllowedOrderStatuses, getErrorMessage } from '../../api'
import { ORDER_STATUS_LABELS, DELIVERY_TYPE_LABELS, ORDER_SOURCE_LABELS } from '../../config/labels'
import { OrderStatusBadge } from '../../components/ui/StatusBadge'
import { PageHeader } from '../components/AdminBlocks'
import { Section, InfoRow, EventTimeline } from '../components/AdminBlocks'
import { Spinner } from '../../components/ui/Spinner'
import { Modal } from '../../components/ui/Modal'
import { Textarea } from '../../components/ui/Textarea'
import { Button } from '../../components/ui/Button'
import { formatDate, formatDateTime } from '../../utils/date'
import { formatOrderNumber, formatPrice } from '../../utils/format'
import type { OrderStatus } from '../../types'
import { mapHref } from '../../utils/links'
import { formatPhone } from '../../utils/phone'
import { useApiQuery } from '../../hooks/useApiQuery'
import styles from './OrderPage.module.css'
import { useState } from 'react'

export function OrderPage() {
  const { id } = useParams()
  const { data: order, reload } = useApiQuery(() => getOrder(id ?? ''), [id], ['orders'])
  const { data: events = [] } = useApiQuery(() => listOrderEvents(id ?? ''), [id], ['orders'])

  const [error, setError] = useState('')
  const [statusLoading, setStatusLoading] = useState<Record<string, boolean>>({})
  const [noteLoading, setNoteLoading] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)

  if (order === undefined) {
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

  const allowedStatuses = getAllowedOrderStatuses(order.status)

  async function handleStatusChange(status: OrderStatus) {
    if (status === 'cancelled') {
      setShowCancelModal(true)
      return
    }

    setStatusLoading(prev => ({ ...prev, [status]: true }))
    setError('')

    try {
      await updateOrderStatus(order!.id, status)
      await reload()
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setStatusLoading(prev => ({ ...prev, [status]: false }))
    }
  }

  async function confirmCancel() {
    setShowCancelModal(false)
    setStatusLoading(prev => ({ ...prev, cancelled: true }))
    setError('')

    try {
      await cancelOrder(order!.id)
      await reload()
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setStatusLoading(prev => ({ ...prev, cancelled: false }))
    }
  }

  async function handleNoteChange(newNote: string) {
    setNoteLoading(true)
    setError('')

    try {
      await setOrderAdminNote(order!.id, newNote)
      await reload()
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setNoteLoading(false)
    }
  }

  const statusActions = allowedStatuses.map((status) => {
    const isCancel = status === 'cancelled'
    const isDisabled = Object.values(statusLoading).some(Boolean)

    return (
      <Button
        key={status}
        variant={isCancel ? 'danger' : 'primary'}
        size="sm"
        loading={statusLoading[status]}
        disabled={isDisabled}
        onClick={() => void handleStatusChange(status)}
        icon={isCancel ? 'delete' : undefined}
      >
        {ORDER_STATUS_LABELS[status]}
      </Button>
    )
  })

  const hasLocation = order.location?.lat && order.location?.lng

  return (
    <div className={styles.page}>
      <PageHeader
        title={`Заказ ${formatOrderNumber(order.number)}`}
        backTo="/admin/orders"
        actions={[
          <OrderStatusBadge key="status-badge" status={order.status} />,
        ]}
      />

      {error && (
        <div className={styles.error} role="alert">
          {error}
        </div>
      )}

      <Section title="Информация о заказе">
        <div className={styles.infoGrid}>
          <InfoRow label="Источник">
            {ORDER_SOURCE_LABELS[order.source]}
          </InfoRow>
          <InfoRow label="Дата создания">
            {formatDateTime(order.createdAt)}
          </InfoRow>
          <InfoRow label="Способ получения">
            {DELIVERY_TYPE_LABELS[order.deliveryType]}
          </InfoRow>
          {order.deliveryType === 'delivery' && (
            <InfoRow label="Адрес доставки">
              <div className={styles.addressRow}>
                <span>{order.address || 'Не указан'}</span>
                {hasLocation && (
                  <a
                    href={mapHref(order.location!)}
                    target="_blank"
                    rel="noreferrer"
                    className={styles.mapLink}
                  >
                    <span className="material-symbols-outlined">map</span>
                    Открыть на карте
                  </a>
                )}
              </div>
            </InfoRow>
          )}
          {order.desiredDate && (
            <InfoRow label="Желаемая дата">
              {formatDate(order.desiredDate)}
            </InfoRow>
          )}
          {order.comment && (
            <InfoRow label="Комментарий клиента">
              {order.comment}
            </InfoRow>
          )}
          {order.desiredTime && (
            <InfoRow label="Желаемое время">
              {order.desiredTime}
            </InfoRow>
          )}
        </div>
      </Section>

      <Section title="Клиент">
        <div className={styles.infoGrid}>
          <InfoRow label="Имя">
            {order.customerName}
          </InfoRow>
          <InfoRow label="Телефон">
            <a href={`tel:${order.customerPhone}`} className={styles.phoneLink}>
              <span className="material-symbols-outlined">phone</span>
              {formatPhone(order.customerPhone)}
            </a>
          </InfoRow>
        </div>
      </Section>

      <Section title="Товар">
        <div className={styles.infoGrid}>
          <InfoRow label="Название">
            {order.productName}
          </InfoRow>
          <InfoRow label="Количество">
            {order.quantity} шт.
          </InfoRow>
          <InfoRow label="Цена">
            {formatPrice(order.price)}
          </InfoRow>
          <InfoRow label="Сумма">
            {formatPrice(order.quantity * order.price)}
          </InfoRow>
          {order.productId && (
            <InfoRow label="Товар в админке">
              <Link to={`/admin/products/${order.productId}`} className={styles.linkButton}>
                Перейти
              </Link>
            </InfoRow>
          )}
        </div>
      </Section>

      <Section title="Изменение статуса" actions={statusActions.length > 0 ? statusActions : undefined}>
        {statusActions.length === 0 && (
          <p className={styles.closedText}>Заказ закрыт</p>
        )}
      </Section>

      <Section title="Заметка администратора">
        <AdminNote note={order.adminNote} onSave={handleNoteChange} loading={noteLoading} />
      </Section>

      <Section title="История">
        <EventTimeline events={events} />
      </Section>

      <Modal
        open={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        title="Подтверждение отмены заказа"
        footer={
          <div className={styles.modalFooter}>
            <Button variant="ghost" onClick={() => setShowCancelModal(false)} disabled={statusLoading.cancelled}>
              Отмена
            </Button>
            <Button variant="danger" onClick={confirmCancel} loading={statusLoading.cancelled}>
              Отменить заказ
            </Button>
          </div>
        }
      >
        <p>Товар вернётся на склад. Продолжить?</p>
      </Modal>
    </div>
  )
}

interface AdminNoteProps {
  note: string
  onSave: (note: string) => Promise<void>
  loading: boolean
}

function AdminNote({ note, onSave, loading }: AdminNoteProps) {
  const [localNote, setLocalNote] = useState(note)
  const [error, setError] = useState('')

  const handleSave = async () => {
    setError('')
    await onSave(localNote)
    setLocalNote(localNote)
  }

  return (
    <div className={styles.adminNote}>
      <Textarea
        label="Заметка администратора (только для вас)"
        value={localNote}
        onChange={(e) => setLocalNote(e.target.value)}
        placeholder="Добавьте заметку..."
        rows={3}
        error={error}
      />
      <Button
        variant="primary"
        size="sm"
        onClick={handleSave}
        loading={loading}
        className={styles.saveNoteButton}
      >
        Сохранить заметку
      </Button>
    </div>
  )
}