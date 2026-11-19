import { useState } from 'react'
import type { FormEvent } from 'react'
import { createOrder, getErrorMessage } from '../../api'
import { useShopInfo } from '../../hooks/useShopInfo'
import type { DeliveryType, GeoPoint, Order, Product } from '../../types'
import { todayISO } from '../../utils/date'
import { formatPrice } from '../../utils/format'
import { isValidPhone } from '../../utils/phone'
import { cn } from '../../utils/cn'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Textarea } from '../ui/Textarea'
import { useT } from '../../i18n'
import styles from './OrderForm.module.css'

interface OrderFormProps {
  product: Product
  onSuccess: (order: Order) => void
}

type GeoState = 'idle' | 'loading' | 'error'

interface Errors {
  name?: string
  phone?: string
  address?: string
}

const IDS = {
  name: 'order-form-name',
  phone: 'order-form-phone',
  address: 'order-form-address',
}

export function OrderForm({ product, onSuccess }: OrderFormProps) {
  const t = useT().order
  const shopInfo = useShopInfo()
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [deliveryType, setDeliveryType] = useState<DeliveryType>('pickup')
  const [address, setAddress] = useState('')
  const [location, setLocation] = useState<GeoPoint | null>(null)
  const [geoState, setGeoState] = useState<GeoState>('idle')
  const [geoError, setGeoError] = useState('')
  const [desiredDate, setDesiredDate] = useState('')
  const [desiredTime, setDesiredTime] = useState('')
  const [comment, setComment] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const [submitError, setSubmitError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (product.stock <= 0) {
    return <p className={styles.empty}>{t.noStock}</p>
  }

  const canGeo = 'geolocation' in navigator

  function requestLocation() {
    setGeoState('loading')
    setGeoError('')
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({ lat: position.coords.latitude, lng: position.coords.longitude })
        setGeoState('idle')
        setErrors((prev) => ({ ...prev, address: undefined }))
      },
      (error) => {
        setGeoState('error')
        setGeoError(
          error.code === 1
            ? t.geoDenied
            : t.geoFailed,
        )
      },
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return

    const next: Errors = {}
    if (!customerName.trim()) next.name = t.errName
    if (!isValidPhone(customerPhone)) next.phone = t.errPhone
    if (deliveryType === 'delivery' && !address.trim() && !location) {
      next.address = t.errAddress
    }
    setErrors(next)
    const firstId = next.name ? IDS.name : next.phone ? IDS.phone : next.address ? IDS.address : null
    if (firstId) {
      document.getElementById(firstId)?.focus()
      return
    }

    setSubmitting(true)
    setSubmitError('')
    try {
      const order = await createOrder({
        productId: product.id,
        quantity,
        customerName,
        customerPhone,
        deliveryType,
        address: deliveryType === 'delivery' ? address : undefined,
        location: deliveryType === 'delivery' ? location : null,
        desiredDate,
        desiredTime,
        comment,
      })
      onSuccess(order)
    } catch (error) {
      setSubmitError(getErrorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className={styles.form} noValidate onSubmit={handleSubmit}>
      <Input
        id={IDS.name}
        label={t.name}
        required
        autoComplete="name"
        placeholder={t.namePlaceholder}
        value={customerName}
        error={errors.name}
        onChange={(e) => {
          setCustomerName(e.target.value)
          setErrors((prev) => ({ ...prev, name: undefined }))
        }}
      />
      <Input
        id={IDS.phone}
        label={t.phone}
        required
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        icon="call"
        placeholder="+7 900 000-00-00"
        hint={t.phoneHint}
        value={customerPhone}
        error={errors.phone}
        onChange={(e) => {
          setCustomerPhone(e.target.value)
          setErrors((prev) => ({ ...prev, phone: undefined }))
        }}
      />

      <div className={styles.quantity}>
        <span className={styles.groupLabel}>{t.quantity}</span>
        <div className={styles.quantityRow}>
          <button
            type="button"
            className={styles.stepper}
            aria-label={t.decrease}
            disabled={quantity <= 1}
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
          >
            −
          </button>
          <span className={styles.quantityValue} aria-live="polite">
            {quantity}
          </span>
          <button
            type="button"
            className={styles.stepper}
            aria-label={t.increase}
            disabled={quantity >= product.stock}
            onClick={() => setQuantity((q) => Math.min(product.stock, q + 1))}
          >
            +
          </button>
          <span className={styles.stockNote}>{t.inStock(product.stock)}</span>
        </div>
      </div>

      <fieldset className={styles.fieldset}>
        <legend className={styles.groupLabel}>{t.method}</legend>
        <div className={styles.options}>
          <label className={cn(styles.option, deliveryType === 'pickup' && styles.optionSelected)}>
            <input
              className={styles.radio}
              type="radio"
              name="deliveryType"
              value="pickup"
              checked={deliveryType === 'pickup'}
              onChange={() => setDeliveryType('pickup')}
            />
            <span className={styles.optionText}>
              <span className={styles.optionTitle}>{t.pickup}</span>
              {shopInfo.addressText && <span className={styles.optionHint}>{shopInfo.addressText}</span>}
              {shopInfo.hoursText && <span className={styles.optionHint}>{shopInfo.hoursText}</span>}
            </span>
          </label>
          <label className={cn(styles.option, deliveryType === 'delivery' && styles.optionSelected)}>
            <input
              className={styles.radio}
              type="radio"
              name="deliveryType"
              value="delivery"
              checked={deliveryType === 'delivery'}
              onChange={() => setDeliveryType('delivery')}
            />
            <span className={styles.optionText}>
              <span className={styles.optionTitle}>{t.delivery}</span>
              <span className={styles.optionHint}>
                {t.deliveryHint}
              </span>
            </span>
          </label>
        </div>
      </fieldset>

      {deliveryType === 'delivery' && (
        <div className={styles.block}>
          <Textarea
            id={IDS.address}
            label={t.address}
            rows={2}
            placeholder={t.addressPlaceholder}
            value={address}
            error={errors.address}
            onChange={(e) => {
              setAddress(e.target.value)
              setErrors((prev) => ({ ...prev, address: undefined }))
            }}
          />
          {canGeo &&
            (location ? (
              <div className={styles.geoOk}>
                <span className={cn('material-symbols-outlined', styles.geoOkIcon)} aria-hidden="true">
                  check_circle
                </span>
                <span>{t.geoAttached}</span>
                <button type="button" className={styles.linkButton} onClick={() => setLocation(null)}>
                  {t.geoRemove}
                </button>
              </div>
            ) : (
              <>
                <Button
                  variant="secondary"
                  icon="my_location"
                  loading={geoState === 'loading'}
                  onClick={requestLocation}
                >
                  {t.geoSend}
                </Button>
                {geoState === 'error' && <p className={styles.geoError}>{geoError}</p>}
              </>
            ))}
        </div>
      )}

      <div className={styles.block}>
        <span className={styles.groupLabel}>
          {deliveryType === 'pickup' ? t.whenPickup : t.whenDelivery}
        </span>
        <div className={styles.dateTime}>
          <Input
            label={t.date}
            type="date"
            min={todayISO()}
            value={desiredDate}
            onChange={(e) => setDesiredDate(e.target.value)}
          />
          <Input
            label={t.time}
            type="time"
            value={desiredTime}
            onChange={(e) => setDesiredTime(e.target.value)}
          />
        </div>
      </div>

      <Textarea
        label={t.comment}
        hint={t.optional}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />

      {submitError && (
        <div className={styles.submitError} role="alert">
          {submitError}
        </div>
      )}

      <Button type="submit" fullWidth loading={submitting}>
        {t.submit(formatPrice(product.price * quantity))}
      </Button>
      <p className={styles.payNote}>
        <span className={cn('material-symbols-outlined', styles.payIcon)} aria-hidden="true">
          payments
        </span>
        {t.payNote}
      </p>
    </form>
  )
}
