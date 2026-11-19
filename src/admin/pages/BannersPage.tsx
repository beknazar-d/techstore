import { useRef, useState } from 'react'
import { bannerText, createBanners, getErrorMessage, listBanners } from '../../api'
import type { PromoBanner, PromoBannerInput } from '../../types'
import { compressImage } from '../../utils/compressImage'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import { useApiQuery } from '../../hooks/useApiQuery'
import { formatDate } from '../../utils/date'
import { BannerEditor } from '../components/BannerEditor'
import { PageHeader } from '../components/AdminBlocks'
import { msg } from '../../i18n'
import styles from './BannersPage.module.css'

type BannerState = 'active' | 'hidden' | 'scheduled' | 'finished'

function bannerState(banner: PromoBanner, now: number): BannerState {
  if (!banner.isActive) return 'hidden'
  if (banner.startsAt && Date.parse(banner.startsAt) > now) return 'scheduled'
  if (banner.endsAt && Date.parse(banner.endsAt) <= now) return 'finished'
  return 'active'
}

const STATE_TONE = { active: 'success', hidden: 'neutral', scheduled: 'info', finished: 'warning' } as const

/** Фото баннеров крупнее фото товаров — на десктопе слайд во всю ширину. */
const BANNER_MAX_SIDE = 2400

/** Новый фото-слайд: только картинка, включён, без срока. */
function photoSlide(image: string, sortOrder: number): PromoBannerInput {
  return {
    title: '',
    subtitle: '',
    titleKy: '',
    subtitleKy: '',
    buttonLabel: '',
    buttonLabelKy: '',
    link: '',
    image,
    isActive: true,
    sortOrder,
    startsAt: null,
    endsAt: null,
  }
}

export function BannersPage() {
  const t = msg().adminBanners
  const { data, reload } = useApiQuery(() => listBanners(), [], ['banners'])
  // undefined — редактор закрыт, null — новый баннер.
  const [editing, setEditing] = useState<PromoBanner | null | undefined>(undefined)
  const [now] = useState(() => Date.now())
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null)

  async function handlePhotos(files: File[]) {
    if (files.length === 0) return
    setNotice(null)
    try {
      const images: string[] = []
      for (const [index, file] of files.entries()) {
        setUploading(t.photosProgress(index + 1, files.length))
        images.push(await compressImage(file, { maxSide: BANNER_MAX_SIDE }))
      }
      // Новые слайды — в конец карусели, в порядке выбора файлов.
      const last = Math.max(0, ...(data ?? []).map((banner) => banner.sortOrder))
      const created = await createBanners(images.map((image, index) => photoSlide(image, last + index + 1)))
      setNotice({ text: t.photosAdded(created.length) })
      reload()
    } catch (err) {
      setNotice({ text: getErrorMessage(err), error: true })
    } finally {
      setUploading(null)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className={styles.page}>
      <PageHeader
        title={t.title}
        subtitle={t.subtitle}
        actions={
          <>
            <Button
              variant="secondary"
              icon="photo_library"
              aria-label={t.addPhotosAria}
              loading={uploading !== null}
              onClick={() => fileRef.current?.click()}
            >
              {t.addPhotos}
            </Button>
            <Button icon="add" onClick={() => setEditing(null)}>
              {t.add}
            </Button>
          </>
        }
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => void handlePhotos(Array.from(e.target.files ?? []))}
      />
      <p className={styles.hint}>{t.photosHint}</p>
      {(uploading || notice) && (
        <p className={notice?.error ? styles.error : styles.notice} role={notice?.error ? 'alert' : 'status'}>
          {uploading ?? notice?.text}
        </p>
      )}

      {data === undefined ? (
        <div className={styles.loader}>
          <Spinner />
        </div>
      ) : data.length === 0 ? (
        <div className={styles.empty}>
          <span className="material-symbols-outlined" aria-hidden="true">campaign</span>
          <p className={styles.emptyTitle}>{t.empty}</p>
          <p className={styles.emptyText}>{t.emptyText}</p>
        </div>
      ) : (
        <ul className={styles.list}>
          {data.map((banner) => {
            const state = bannerState(banner, now)
            const text = bannerText(banner)
            const period =
              banner.startsAt || banner.endsAt
                ? t.period(
                    banner.startsAt ? formatDate(banner.startsAt) : '…',
                    banner.endsAt ? formatDate(new Date(Date.parse(banner.endsAt) - 1).toISOString()) : '…',
                  )
                : t.noLimit
            return (
              <li key={banner.id}>
                <button type="button" className={styles.card} onClick={() => setEditing(banner)}>
                  <span className={styles.thumb}>
                    {banner.image && <img src={banner.image} alt="" className={styles.thumbImage} />}
                  </span>
                  <span className={styles.info}>
                    <span className={styles.title}>{text.title || t.photoSlide}</span>
                    {text.subtitle && <span className={styles.subtitle}>{text.subtitle}</span>}
                    <span className={styles.meta}>
                      <Badge tone={STATE_TONE[state]} dot>
                        {t[state]}
                      </Badge>
                      <span>{period}</span>
                      {banner.link && <span className={styles.link}>{banner.link}</span>}
                    </span>
                  </span>
                  <span className={styles.edit} aria-hidden="true">
                    <span className="material-symbols-outlined">edit</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {editing !== undefined && (
        <BannerEditor
          banner={editing}
          onClose={() => setEditing(undefined)}
          onSaved={() => {
            setEditing(undefined)
            reload()
          }}
        />
      )}
    </div>
  )
}
