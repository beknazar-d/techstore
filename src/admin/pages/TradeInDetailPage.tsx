import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  getTradeIn,
  listTradeInEvents,
  updateTradeInStatus,
  evaluateTradeIn,
  setTradeInAdminNote,
  getAllowedTradeInStatuses,
  canEvaluateTradeIn,
  getErrorMessage,
} from '../../api'
import {
  TRADE_IN_STATUS_LABELS,
  DEVICE_GRADE_LABELS,
  TRADE_IN_DEVICE_CATEGORY_LABELS,
} from '../../config/labels'
import type { TradeInRequest, TradeInStatus } from '../../types'
import { PageHeader, Section, InfoRow, EventTimeline } from '../components/AdminBlocks'
import { TradeInStatusBadge } from '../../components/ui/StatusBadge'
import { ProductImage } from '../../components/ui/ProductImage'
import { Modal } from '../../components/ui/Modal'
import { Spinner } from '../../components/ui/Spinner'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Textarea } from '../../components/ui/Textarea'
import { useApiQuery } from '../../hooks/useApiQuery'
import { formatPrice, formatTradeInNumber } from '../../utils/format'
import { formatPhone } from '../../utils/phone'
import { formatDate } from '../../utils/date'
import { msg } from '../../i18n'
import styles from './TradeInDetailPage.module.css'

export function TradeInDetailPage() {
  const t = msg().adminTradeIns
  const { id } = useParams()
  const { data: tradeIn, reload } = useApiQuery(
    () => getTradeIn(id ?? ''),
    [id],
    ['tradeIns']
  )
  const { data: events = [] } = useApiQuery(
    () => listTradeInEvents(id ?? ''),
    [id],
    ['tradeIns']
  )
  const [error, setError] = useState<string | null>(null)
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null)
  const [statusUpdating, setStatusUpdating] = useState(false)

  if (tradeIn === undefined) {
    return (
      <div className={styles.page}>
        <div className={styles.loader}><Spinner /></div>
      </div>
    )
  }

  if (!tradeIn) {
    return (
      <div className={styles.page}>
        <PageHeader title={t.notFound} backTo="/admin/trade-in" />
      </div>
    )
  }

  const currentTradeIn = tradeIn
  const allowedStatuses = getAllowedTradeInStatuses(currentTradeIn.status)
  const canEvaluate = canEvaluateTradeIn(currentTradeIn.status)
  const desiredProductPrice = currentTradeIn.desiredProductPrice ?? 0
  const adminEstimate = currentTradeIn.adminEstimate ?? 0
  const extraPayment = desiredProductPrice && adminEstimate && desiredProductPrice > adminEstimate
    ? desiredProductPrice - adminEstimate
    : 0

  async function handleStatusChange(status: TradeInStatus) {
    setError(null)
    setStatusUpdating(true)
    try {
      await updateTradeInStatus(currentTradeIn.id, status)
      reload()
    } catch (e) {
      setError(getErrorMessage(e))
    } finally {
      setStatusUpdating(false)
    }
  }

  async function handleEvaluate(estimate: number) {
    await evaluateTradeIn(currentTradeIn.id, estimate)
    reload()
  }

  async function handleAdminNoteSave(note: string) {
    await setTradeInAdminNote(currentTradeIn.id, note)
    reload()
  }

  return (
    <div className={styles.page}>
      <PageHeader
        title={formatTradeInNumber(currentTradeIn.number)}
        subtitle={
          <div className={styles.subtitleRow}>
            <TradeInStatusBadge status={currentTradeIn.status} />
            <span className={styles.createdAt}>{formatDate(currentTradeIn.createdAt)}</span>
          </div>
        }
        backTo="/admin/trade-in"
        backLabel={t.backToList}
      />

      {error && <div className={styles.errorBanner}>{error}</div>}

      <Section title={t.customer}>
        <InfoRow label={t.name}>{currentTradeIn.customerName}</InfoRow>
        <InfoRow label={t.phone}>
          <a href={`tel:${currentTradeIn.customerPhone}`} className={styles.phoneLink}>
            <span className="material-symbols-outlined" aria-hidden="true">call</span>
            {t.call(formatPhone(currentTradeIn.customerPhone))}
          </a>
        </InfoRow>
        <InfoRow label={t.createdAt}>{formatDate(currentTradeIn.createdAt)}</InfoRow>
        <InfoRow label={t.comment}>{currentTradeIn.comment || '—'}</InfoRow>
      </Section>

      <Section title={t.device}>
        <InfoRow label={t.category}>
          {TRADE_IN_DEVICE_CATEGORY_LABELS[currentTradeIn.device.category]}
        </InfoRow>
        <InfoRow label={t.brand}>{currentTradeIn.device.brand}</InfoRow>
        <InfoRow label={t.model}>{currentTradeIn.device.model}</InfoRow>
        <InfoRow label={t.memory}>{currentTradeIn.device.memory || '—'}</InfoRow>
        <InfoRow label={t.grade}>
          {DEVICE_GRADE_LABELS[currentTradeIn.device.grade]}
        </InfoRow>
        <InfoRow label={t.battery}>
          {currentTradeIn.device.batteryHealth !== undefined ? `${currentTradeIn.device.batteryHealth}%` : '—'}
        </InfoRow>
        <InfoRow label={t.defects}>{currentTradeIn.device.defects || '—'}</InfoRow>
        <InfoRow label={t.kit}>{currentTradeIn.device.kit || '—'}</InfoRow>
      </Section>

      <Section title={t.photos}>
        {currentTradeIn.photos.length > 0 ? (
          <div className={styles.photoGrid}>
            {currentTradeIn.photos.map((photo, index) => (
              <button
                key={index}
                type="button"
                className={styles.photoThumb}
                onClick={() => setSelectedPhoto(photo)}
                aria-label={t.openPhoto(index + 1)}
              >
                <ProductImage src={photo} alt={t.photoAlt(index + 1)} className={styles.thumbImage} />
              </button>
            ))}
          </div>
        ) : (
          <p className={styles.noPhotos}>{t.noPhotos}</p>
        )}
      </Section>

      {(currentTradeIn.desiredProductId || currentTradeIn.desiredProductName) && (
        <Section title={t.desired}>
          <InfoRow label={t.product}>
            {currentTradeIn.desiredProductId ? (
              <Link to={`/admin/products/${currentTradeIn.desiredProductId}`} className={styles.productLink}>
                {currentTradeIn.desiredProductName}
              </Link>
            ) : (
              currentTradeIn.desiredProductName
            )}
          </InfoRow>
          {currentTradeIn.desiredProductPrice !== null && (
            <InfoRow label={t.productPrice}>{formatPrice(currentTradeIn.desiredProductPrice)}</InfoRow>
          )}
          {currentTradeIn.adminEstimate !== null && (
            <InfoRow label={t.buyoutEstimate}>{formatPrice(currentTradeIn.adminEstimate)}</InfoRow>
          )}
          {extraPayment > 0 && (
            <InfoRow label={t.extraPayment}>
              <span className={styles.extraPayment}>{formatPrice(extraPayment)}</span>
            </InfoRow>
          )}
        </Section>
      )}

      <Section title={t.estimateStatus}>
        {canEvaluate && (
          <EvaluateForm key={currentTradeIn.id} tradeIn={currentTradeIn} onEvaluate={handleEvaluate} />
        )}
        {!canEvaluate && (
          <InfoRow label={t.buyoutEstimate}>
            {currentTradeIn.adminEstimate !== null ? formatPrice(currentTradeIn.adminEstimate) : '—'}
          </InfoRow>
        )}

        <AdminNoteForm key={currentTradeIn.id} tradeIn={currentTradeIn} onSave={handleAdminNoteSave} />

        <div className={styles.statusSection}>
          <h3 className={styles.statusTitle}>{t.statusChange}</h3>
          {allowedStatuses.length > 0 ? (
            <div className={styles.statusActions}>
              {allowedStatuses.map((status) => (
                <Button
                  key={status}
                  variant="secondary"
                  onClick={() => void handleStatusChange(status)}
                  disabled={statusUpdating}
                >
                  {TRADE_IN_STATUS_LABELS[status]}
                </Button>
              ))}
            </div>
          ) : (
            <p className={styles.closedNotice}>{t.closed}</p>
          )}
        </div>
      </Section>

      <Section title={t.history}>
        <EventTimeline
          events={events.map((e) => ({
            id: e.id,
            message: e.message,
            createdAt: e.createdAt,
          }))}
        />
      </Section>

      <Modal open={selectedPhoto !== null} onClose={() => setSelectedPhoto(null)} size="lg" title={t.photos}>
        {selectedPhoto && (
          <div className={styles.fullscreenPhoto}>
            <ProductImage src={selectedPhoto} alt={t.photoLarge} className={styles.fullImage} />
          </div>
        )}
      </Modal>
    </div>
  )
}

function EvaluateForm({
  tradeIn,
  onEvaluate,
}: {
  tradeIn: TradeInRequest
  onEvaluate: (estimate: number) => Promise<void>
}) {
  const t = msg().adminTradeIns
  const [estimate, setEstimate] = useState<string>(
    tradeIn.adminEstimate !== null ? String(tradeIn.adminEstimate) : ''
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const value = Number(estimate)
    if (!Number.isInteger(value) || value <= 0) {
      setError(t.estimateError)
      return
    }
    setSaving(true)
    try {
      await onEvaluate(value)
    } catch (e) {
      setError(getErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className={styles.evaluateForm}>
      <div className={styles.formRow}>
        <Input
          label={t.estimateLabel}
          name="estimate"
          type="number"
          min="1"
          step="1"
          value={estimate}
          onChange={(e) => setEstimate(e.target.value)}
          placeholder={t.estimatePlaceholder}
          required
          disabled={saving}
          error={error ?? undefined}
        />
      </div>
      <Button type="submit" disabled={saving} className={styles.submitButton}>
        {saving ? t.saving : t.saveEstimate}
      </Button>
    </form>
  )
}

function AdminNoteForm({
  tradeIn,
  onSave,
}: {
  tradeIn: TradeInRequest
  onSave: (note: string) => Promise<void>
}) {
  const t = msg().adminTradeIns
  const [note, setNote] = useState<string>(tradeIn.adminNote ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      await onSave(note)
    } catch (e) {
      setError(getErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className={styles.adminNoteForm}>
      <Textarea
        label={t.adminNote}
        name="adminNote"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={t.notePlaceholder}
        rows={3}
        disabled={saving}
        error={error ?? undefined}
      />
      <Button type="submit" disabled={saving} className={styles.submitButton}>
        {saving ? t.saving : t.saveNote}
      </Button>
    </form>
  )
}