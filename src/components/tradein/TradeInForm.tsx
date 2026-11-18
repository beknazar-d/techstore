import { useState } from 'react'
import type { FormEvent } from 'react'
import { createTradeIn, getErrorMessage } from '../../api'
import {
  DEVICE_GRADES,
  DEVICE_GRADE_LABELS,
  TRADE_IN_DEVICE_CATEGORIES,
  TRADE_IN_DEVICE_CATEGORY_LABELS,
} from '../../config/labels'
import { shop } from '../../config/shop'
import type { DeviceGrade, Product, TradeInDeviceCategory, TradeInRequest } from '../../types'
import { cn } from '../../utils/cn'
import { formatPrice } from '../../utils/format'
import { isValidPhone } from '../../utils/phone'
import { Button } from '../ui/Button'
import { ImagePicker } from '../ui/ImagePicker'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { Textarea } from '../ui/Textarea'
import { useT } from '../../i18n'
import styles from './TradeInForm.module.css'

interface TradeInFormProps {
  desiredProduct?: Product | null
  onClearDesiredProduct?: () => void
  onSuccess: (tradeIn: TradeInRequest) => void
}

interface Errors {
  brand?: string
  model?: string
  battery?: string
  name?: string
  phone?: string
}

const IDS = {
  brand: 'trade-in-brand',
  model: 'trade-in-model',
  battery: 'trade-in-battery',
  name: 'trade-in-name',
  phone: 'trade-in-phone',
}

function getCategoryOptions() {
  return TRADE_IN_DEVICE_CATEGORIES.map((value) => ({
    value,
    label: TRADE_IN_DEVICE_CATEGORY_LABELS[value],
  }))
}

export function TradeInForm({ desiredProduct, onClearDesiredProduct, onSuccess }: TradeInFormProps) {
  const t = useT().tradeIn
  const [category, setCategory] = useState<TradeInDeviceCategory>('smartphone')
  const [brand, setBrand] = useState('')
  const [model, setModel] = useState('')
  const [memory, setMemory] = useState('')
  const [grade, setGrade] = useState<DeviceGrade>('good')
  const [battery, setBattery] = useState('')
  const [defects, setDefects] = useState('')
  const [kit, setKit] = useState('')
  const [photos, setPhotos] = useState<string[]>([])
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [comment, setComment] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const [submitError, setSubmitError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function clearError(key: keyof Errors) {
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return

    const next: Errors = {}
    if (!brand.trim()) next.brand = t.errBrand
    if (!model.trim()) next.model = t.errModel
    if (battery.trim() !== '') {
      const value = Number(battery)
      if (!Number.isInteger(value) || value < 1 || value > 100) {
        next.battery = t.errBattery
      }
    }
    if (!customerName.trim()) next.name = t.errName
    if (!isValidPhone(customerPhone)) next.phone = t.errPhone
    setErrors(next)

    const order: (keyof Errors)[] = ['brand', 'model', 'battery', 'name', 'phone']
    const first = order.find((key) => next[key])
    if (first) {
      document.getElementById(IDS[first])?.focus()
      return
    }

    setSubmitting(true)
    setSubmitError('')
    try {
      const tradeIn = await createTradeIn({
        customerName,
        customerPhone,
        device: {
          category,
          brand,
          model,
          memory: memory || undefined,
          grade,
          batteryHealth: battery.trim() === '' ? undefined : Number(battery),
          defects: defects || undefined,
          kit: kit || undefined,
        },
        photos,
        desiredProductId: desiredProduct?.id ?? null,
        comment,
      })
      onSuccess(tradeIn)
    } catch (error) {
      setSubmitError(getErrorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className={styles.form} noValidate onSubmit={handleSubmit}>
      {desiredProduct && (
        <div className={styles.desired}>
          <div className={styles.desiredText}>
            <span className={styles.desiredLabel}>{t.wantFor}</span>
            <span className={styles.desiredName}>{desiredProduct.name}</span>
            <span className={styles.desiredPrice}>{formatPrice(desiredProduct.price)}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => onClearDesiredProduct?.()}>
            {t.remove}
          </Button>
        </div>
      )}

      <section className={styles.card}>
        <h3 className={styles.title}>{t.device}</h3>
        <Select
          label={t.deviceType}
          options={getCategoryOptions()}
          value={category}
          onChange={(e) => setCategory(e.target.value as TradeInDeviceCategory)}
        />
        <div className={styles.row}>
          <Input
            id={IDS.brand}
            label={t.brand}
            required
            placeholder="Apple, Samsung, Xiaomi…"
            value={brand}
            error={errors.brand}
            onChange={(e) => {
              setBrand(e.target.value)
              clearError('brand')
            }}
          />
          <Input
            id={IDS.model}
            label={t.model}
            required
            placeholder="iPhone 12"
            value={model}
            error={errors.model}
            onChange={(e) => {
              setModel(e.target.value)
              clearError('model')
            }}
          />
        </div>
        <Input
          label={t.memory}
          placeholder={t.memoryPlaceholder}
          value={memory}
          onChange={(e) => setMemory(e.target.value)}
        />

        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>{t.grade}</legend>
          <div className={styles.grades}>
            {DEVICE_GRADES.map((value) => (
              <label
                key={value}
                className={cn(styles.option, grade === value && styles.optionSelected)}
              >
                <input
                  className={styles.radio}
                  type="radio"
                  name="grade"
                  value={value}
                  checked={grade === value}
                  onChange={() => setGrade(value)}
                />
                <span className={styles.optionText}>
                  <span className={styles.optionTitle}>{DEVICE_GRADE_LABELS[value]}</span>
                  <span className={styles.optionHint}>{t.gradeHints[value]}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <Input
          id={IDS.battery}
          label={t.battery}
          type="number"
          inputMode="numeric"
          min={1}
          max={100}
          hint={t.batteryHint}
          value={battery}
          error={errors.battery}
          onChange={(e) => {
            setBattery(e.target.value)
            clearError('battery')
          }}
        />
        <Textarea
          label={t.defects}
          rows={2}
          placeholder={t.defectsPlaceholder}
          value={defects}
          onChange={(e) => setDefects(e.target.value)}
        />
        <Input
          label={t.kit}
          placeholder={t.kitPlaceholder}
          value={kit}
          onChange={(e) => setKit(e.target.value)}
        />
      </section>

      <section className={styles.card}>
        <h3 className={styles.title}>{t.photos}</h3>
        <ImagePicker
          value={photos}
          onChange={setPhotos}
          max={shop.maxTradeInPhotos}
          hint={t.photosHint}
        />
      </section>

      <section className={styles.card}>
        <h3 className={styles.title}>{t.contacts}</h3>
        <Input
          id={IDS.name}
          label={t.name}
          required
          autoComplete="name"
          value={customerName}
          error={errors.name}
          onChange={(e) => {
            setCustomerName(e.target.value)
            clearError('name')
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
          value={customerPhone}
          error={errors.phone}
          onChange={(e) => {
            setCustomerPhone(e.target.value)
            clearError('phone')
          }}
        />
        <Textarea
          label={t.comment}
          hint={t.optional}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
      </section>

      {submitError && (
        <div className={styles.submitError} role="alert">
          {submitError}
        </div>
      )}

      <Button type="submit" fullWidth loading={submitting}>
        {t.submit}
      </Button>
      <p className={styles.note}>
        {t.note}
      </p>
    </form>
  )
}
