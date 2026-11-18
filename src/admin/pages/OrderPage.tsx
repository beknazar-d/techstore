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
import { msg } from '../../i18n'
import styles from './OrderPage.module.css'
import { useState } from 'react'

export function OrderPage() {
  const t = msg().adminOrders
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
        <p>{t.notFound}</p>
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
        title={t.orderTitle(formatOrderNumber(order.number))}
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

      <Section title={t.info}>
        <div className={styles.infoGrid}>
          <InfoRow label={t.source}>
            {ORDER_SOURCE_LABELS[order.source]}
          </InfoRow>
          <InfoRow label={t.createdAt}>
            {formatDateTime(order.createdAt)}
          </InfoRow>
          <InfoRow label={t.method}>
            {DELIVERY_TYPE_LABELS[order.deliveryType]}
          </InfoRow>
          {order.deliveryType === 'delivery' && (
            <InfoRow label={t.address}>
              <div className={styles.addressRow}>
                <span>{order.address || t.noAddress}</span>
                {hasLocation && (
                  <a
                    href={mapHref(order.location!)}
                    target="_blank"
                    rel="noreferrer"
                    className={styles.mapLink}
                  >
                    <span className="material-symbols-outlined">map</span>
                    {t.openMap}
                  </a>
                )}
              </div>
            </InfoRow>
          )}
          {order.desiredDate && (
            <InfoRow label={t.desiredDate}>
              {formatDate(order.desiredDate)}
            </InfoRow>
          )}
          {order.comment && (
            <InfoRow label={t.customerComment}>
              {order.comment}
            </InfoRow>
          )}
          {order.desiredTime && (
            <InfoRow label={t.desiredTime}>
              {order.desiredTime}
            </InfoRow>
          )}
        </div>
      </Section>

      <Section title={t.customer}>
        <div className={styles.infoGrid}>
          <InfoRow label={t.name}>
            {order.customerName}
          </InfoRow>
          <InfoRow label={t.phone}>
            <a href={`tel:${order.customerPhone}`} className={styles.phoneLink}>
              <span className="material-symbols-outlined">phone</span>
              {formatPhone(order.customerPhone)}
            </a>
          </InfoRow>
        </div>
      </Section>

      <Section title={t.product}>
        <div className={styles.infoGrid}>
          <InfoRow label={t.productName}>
            {order.productName}
          </InfoRow>
          <InfoRow label={msg().adminOrders.quantity}>
            {t.pieces(order.quantity)}
          </InfoRow>
          <InfoRow label={t.price}>
            {formatPrice(order.price)}
          </InfoRow>
          <InfoRow label={t.sum}>
            {formatPrice(order.quantity * order.price)}
          </InfoRow>
          {order.productId && (
            <InfoRow label={t.productInAdmin}>
              <Link to={`/admin/products/${order.productId}`} className={styles.linkButton}>
                {t.go}
              </Link>
            </InfoRow>
          )}
        </div>
      </Section>

      <Section title={t.statusChange} actions={statusActions.length > 0 ? statusActions : undefined}>
        {statusActions.length === 0 && (
          <p className={styles.closedText}>{t.closed}</p>
        )}
      </Section>

      <Section title={t.adminNote}>
        <AdminNote note={order.adminNote} onSave={handleNoteChange} loading={noteLoading} />
      </Section>

      <Section title={t.history}>
        <EventTimeline events={events} />
      </Section>

      <Modal
        open={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        title={t.cancelTitle}
        footer={
          <div className={styles.modalFooter}>
            <Button variant="ghost" onClick={() => setShowCancelModal(false)} disabled={statusLoading.cancelled}>
              {t.cancelKeep}
            </Button>
            <Button variant="danger" onClick={confirmCancel} loading={statusLoading.cancelled}>
              {t.cancelOrder}
            </Button>
          </div>
        }
      >
        <p>{t.cancelText}</p>
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
  const t = msg().adminOrders
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
        label={t.noteLabel}
        value={localNote}
        onChange={(e) => setLocalNote(e.target.value)}
        placeholder={t.notePlaceholder}
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
        {t.saveNote}
      </Button>
    </div>
  )
}