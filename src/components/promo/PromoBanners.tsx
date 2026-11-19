import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { bannerText } from '../../api'
import type { PromoBanner } from '../../types'
import { cn } from '../../utils/cn'
import { useT } from '../../i18n'
import styles from './PromoBanners.module.css'

const AUTOPLAY_MS = 6000

interface PromoBannersProps {
  banners: PromoBanner[]
}

/** Карусель баннеров акций на главной: свайп, точки, стрелки на десктопе, автопрокрутка. */
export function PromoBanners({ banners }: PromoBannersProps) {
  const t = useT().home
  const trackRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)
  const count = banners.length

  function scrollTo(index: number) {
    const track = trackRef.current
    if (!track) return
    const next = (index + count) % count
    track.scrollTo({ left: next * track.clientWidth, behavior: 'smooth' })
  }

  // Текущий слайд — по положению прокрутки (так работает и свайп пальцем).
  useEffect(() => {
    const track = trackRef.current
    if (!track) return
    const onScroll = () => {
      const width = track.clientWidth || 1
      setActive(Math.min(count - 1, Math.max(0, Math.round(track.scrollLeft / width))))
    }
    track.addEventListener('scroll', onScroll, { passive: true })
    return () => track.removeEventListener('scroll', onScroll)
  }, [count])

  // Автопрокрутка: не при наведении/фокусе и не при «уменьшить движение».
  useEffect(() => {
    if (count < 2 || paused) return
    if (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const timer = window.setInterval(() => {
      const track = trackRef.current
      if (!track) return
      const width = track.clientWidth || 1
      const current = Math.round(track.scrollLeft / width)
      track.scrollTo({ left: ((current + 1) % count) * width, behavior: 'smooth' })
    }, AUTOPLAY_MS)
    return () => window.clearInterval(timer)
  }, [count, paused])

  if (count === 0) return null

  return (
    <section
      className={styles.promo}
      aria-roledescription="carousel"
      aria-label={t.promoAria}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
    >
      <div ref={trackRef} className={styles.track}>
        {banners.map((banner, index) => (
          <div
            key={banner.id}
            className={styles.slide}
            role="group"
            aria-roledescription="slide"
            aria-label={t.promoSlide(index + 1, count)}
          >
            <BannerSlide banner={banner} />
          </div>
        ))}
      </div>

      {count > 1 && (
        <>
          <button
            type="button"
            className={cn(styles.arrow, styles.prev)}
            aria-label={t.promoPrev}
            onClick={() => scrollTo(active - 1)}
          >
            <span className="material-symbols-outlined" aria-hidden="true">chevron_left</span>
          </button>
          <button
            type="button"
            className={cn(styles.arrow, styles.next)}
            aria-label={t.promoNext}
            onClick={() => scrollTo(active + 1)}
          >
            <span className="material-symbols-outlined" aria-hidden="true">chevron_right</span>
          </button>
          <div className={styles.dots}>
            {banners.map((banner, index) => (
              <button
                key={banner.id}
                type="button"
                className={cn(styles.dot, index === active && styles.dotActive)}
                aria-label={t.promoSlide(index + 1, count)}
                aria-current={index === active}
                onClick={() => scrollTo(index)}
              />
            ))}
          </div>
        </>
      )}
    </section>
  )
}

function BannerSlide({ banner }: { banner: PromoBanner }) {
  const text = bannerText(banner)
  // Фото-слайд: текст уже на картинке — показываем только её, без затемнения.
  if (!text.title && banner.image) {
    return (
      <BannerLink link={banner.link}>
        <img src={banner.image} alt={text.subtitle} className={styles.image} loading="lazy" />
      </BannerLink>
    )
  }
  const content = (
    <>
      {banner.image && <img src={banner.image} alt="" className={styles.image} loading="lazy" />}
      <span className={cn(styles.overlay, banner.image && styles.withImage)} />
      <span className={styles.content}>
        <span className={styles.title}>{text.title}</span>
        {text.subtitle && <span className={styles.subtitle}>{text.subtitle}</span>}
        {text.buttonLabel && banner.link && (
          <span className={styles.button}>
            {text.buttonLabel}
            <span className="material-symbols-outlined" aria-hidden="true">arrow_forward</span>
          </span>
        )}
      </span>
    </>
  )
  return <BannerLink link={banner.link}>{content}</BannerLink>
}

function BannerLink({ link, children }: { link: string; children: ReactNode }) {
  if (link.startsWith('/')) {
    return (
      <Link to={link} className={cn(styles.card, styles.clickable)}>
        {children}
      </Link>
    )
  }
  if (link.startsWith('https://')) {
    return (
      <a href={link} className={cn(styles.card, styles.clickable)} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    )
  }
  return <div className={styles.card}>{children}</div>
}
