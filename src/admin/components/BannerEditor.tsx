import { useState } from 'react'
import { createBanner, deleteBanner, getErrorMessage, updateBanner } from '../../api'
import type { PromoBanner, PromoBannerInput } from '../../types'
import { Button } from '../../components/ui/Button'
import { Checkbox } from '../../components/ui/Checkbox'
import { ImagePicker } from '../../components/ui/ImagePicker'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { Textarea } from '../../components/ui/Textarea'
import { PromoBanners } from '../../components/promo/PromoBanners'
import { msg } from '../../i18n'
import styles from './BannerEditor.module.css'

interface BannerEditorProps {
  /** null — новый баннер. */
  banner: PromoBanner | null
  onClose: () => void
  onSaved: () => void
}

/** ISO → значение для <input type="date"> (по местному времени). */
function toDateInput(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Начало дня по местному времени. `endOfDay` — начало следующего дня (показ включает весь день). */
function fromDateInput(value: string, endOfDay = false): string | null {
  if (!value) return null
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day + (endOfDay ? 1 : 0)).toISOString()
}

/** Дата «до» в форме — последний день показа, а в базе хранится начало следующего дня. */
function toEndDateInput(iso: string | null): string {
  if (!iso) return ''
  return toDateInput(new Date(Date.parse(iso) - 1).toISOString())
}

export function BannerEditor({ banner, onClose, onSaved }: BannerEditorProps) {
  const t = msg().adminBanners
  const [title, setTitle] = useState(banner?.title ?? '')
  const [subtitle, setSubtitle] = useState(banner?.subtitle ?? '')
  const [buttonLabel, setButtonLabel] = useState(banner?.buttonLabel ?? '')
  const [titleKy, setTitleKy] = useState(banner?.titleKy ?? '')
  const [subtitleKy, setSubtitleKy] = useState(banner?.subtitleKy ?? '')
  const [buttonLabelKy, setButtonLabelKy] = useState(banner?.buttonLabelKy ?? '')
  const [link, setLink] = useState(banner?.link ?? '')
  const [images, setImages] = useState<string[]>(banner?.image ? [banner.image] : [])
  const [startsAt, setStartsAt] = useState(toDateInput(banner?.startsAt ?? null))
  const [endsAt, setEndsAt] = useState(toEndDateInput(banner?.endsAt ?? null))
  const [sortOrder, setSortOrder] = useState<number | ''>(banner?.sortOrder ?? 0)
  const [isActive, setIsActive] = useState(banner?.isActive ?? true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const input: PromoBannerInput = {
    title,
    subtitle,
    titleKy,
    subtitleKy,
    buttonLabel,
    buttonLabelKy,
    link,
    image: images[0] ?? null,
    isActive,
    sortOrder: sortOrder === '' ? 0 : sortOrder,
    startsAt: fromDateInput(startsAt),
    endsAt: fromDateInput(endsAt, true),
  }

  // Предпросмотр — тот же компонент, что на главной.
  const preview: PromoBanner = {
    ...input,
    title: title.trim() || (images[0] ? '' : t.titleRu),
    id: banner?.id ?? 'preview',
    createdAt: '',
    updatedAt: '',
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      if (banner) await updateBanner(banner.id, input)
      else await createBanner(input)
      onSaved()
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!banner) return
    setDeleting(true)
    setError(null)
    try {
      await deleteBanner(banner.id)
      onSaved()
    } catch (err) {
      setError(getErrorMessage(err))
      setDeleting(false)
    }
  }

  const busy = saving || deleting

  return (
    <Modal open onClose={onClose} title={banner ? t.editTitle : t.newTitle} size="lg" closeOnOverlay={!busy}>
      <form
        className={styles.form}
        onSubmit={(e) => {
          e.preventDefault()
          void handleSave()
        }}
      >
        <div className={styles.preview}>
          <p className={styles.label}>{t.preview}</p>
          <PromoBanners banners={[preview]} />
        </div>

        <Input
          label={t.titleRu}
          hint={t.titleHint}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          required={images.length === 0}
        />
        <Textarea label={t.subtitleRu} rows={2} value={subtitle} onChange={(e) => setSubtitle(e.target.value)} maxLength={300} />
        <Input
          label={t.buttonRu}
          hint={t.buttonHint}
          value={buttonLabel}
          onChange={(e) => setButtonLabel(e.target.value)}
          maxLength={40}
        />

        <fieldset className={styles.group}>
          <legend>{t.kyGroup}</legend>
          <p className={styles.hint}>{t.kyHint}</p>
          <Input label={t.titleKy} lang="ky" value={titleKy} onChange={(e) => setTitleKy(e.target.value)} maxLength={120} />
          <Textarea
            label={t.subtitleKy}
            lang="ky"
            rows={2}
            value={subtitleKy}
            onChange={(e) => setSubtitleKy(e.target.value)}
            maxLength={300}
          />
          <Input
            label={t.buttonKy}
            lang="ky"
            value={buttonLabelKy}
            onChange={(e) => setButtonLabelKy(e.target.value)}
            maxLength={40}
          />
        </fieldset>

        <Input
          label={t.link}
          hint={t.linkHint}
          placeholder="/catalog/smartfony"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          inputMode="url"
        />

        <ImagePicker label={t.image} hint={t.imageHint} value={images} onChange={setImages} max={1} maxSide={2400} />

        <div className={styles.row}>
          <Input label={t.startsAt} type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
          <Input label={t.endsAt} type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
        </div>
        <p className={styles.hint}>{t.periodHint}</p>

        <div className={styles.row}>
          <Input
            label={t.sortOrder}
            hint={t.sortOrderHint}
            type="number"
            inputMode="numeric"
            step="1"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value === '' ? '' : Number(e.target.value))}
          />
          <div className={styles.checkbox}>
            <Checkbox label={t.isActive} checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          </div>
        </div>

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        {confirmDelete ? (
          <div className={styles.confirm}>
            <p className={styles.confirmTitle}>{t.deleteTitle}</p>
            <p className={styles.hint}>{t.deleteText}</p>
            <div className={styles.actions}>
              <Button type="button" variant="danger" onClick={() => void handleDelete()} loading={deleting}>
                {t.delete}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setConfirmDelete(false)} disabled={deleting}>
                {t.cancel}
              </Button>
            </div>
          </div>
        ) : (
          <div className={styles.actions}>
            <Button type="submit" loading={saving} disabled={deleting}>
              {t.save}
            </Button>
            <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
              {t.cancel}
            </Button>
            {banner && (
              <Button
                type="button"
                variant="danger"
                icon="delete"
                className={styles.deleteButton}
                onClick={() => setConfirmDelete(true)}
                disabled={busy}
              >
                {t.delete}
              </Button>
            )}
          </div>
        )}
      </form>
    </Modal>
  )
}
