import { useState } from 'react'
import { bannerText, listBanners } from '../../api'
import type { PromoBanner } from '../../types'
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

export function BannersPage() {
  const t = msg().adminBanners
  const { data, reload } = useApiQuery(() => listBanners(), [], ['banners'])
  // undefined — редактор закрыт, null — новый баннер.
  const [editing, setEditing] = useState<PromoBanner | null | undefined>(undefined)
  const [now] = useState(() => Date.now())

  return (
    <div className={styles.page}>
      <PageHeader
        title={t.title}
        subtitle={t.subtitle}
        actions={
          <Button icon="add" onClick={() => setEditing(null)}>
            {t.add}
          </Button>
        }
      />

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
                    <span className={styles.title}>{text.title}</span>
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
