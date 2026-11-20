import { useEffect, useState } from 'react'
import { DEFAULT_SHOP_INFO } from '../../api'
import { useShopInfo } from '../../hooks/useShopInfo'
import { useT } from '../../i18n'
import styles from './SiteIntro.module.css'

const SHOWN_KEY = 'phone-market:intro-shown'
const NAME_KEY = 'phone-market:shop-name'
const DURATION_MS = 2300

function readStorage(storage: 'local' | 'session', key: string): string | null {
  try {
    return (storage === 'local' ? localStorage : sessionStorage).getItem(key)
  } catch {
    return null
  }
}

function writeStorage(storage: 'local' | 'session', key: string, value: string): void {
  try {
    ;(storage === 'local' ? localStorage : sessionStorage).setItem(key, value)
  } catch {
    // без хранилища интро просто покажется ещё раз
  }
}

/** Интро — один раз за визит и только если человек не просил убрать анимации. */
function shouldShow(): boolean {
  if (typeof window === 'undefined') return false
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false
  return readStorage('session', SHOWN_KEY) === null
}

/** «A7 Store» → «A7», «Phone Market» → «PM». */
function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return ''
  if (words[0].length <= 3 && /\d/.test(words[0])) return words[0].toUpperCase()
  return words
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

/**
 * Заставка при входе на сайт: телефон с «бухом» падает в центр, расходятся ударные волны,
 * загорается экран с инициалами, по буквам появляется название магазина. Тап — пропустить.
 */
export function SiteIntro() {
  const t = useT().common
  const info = useShopInfo()
  const [visible, setVisible] = useState(shouldShow)
  // Название берём из прошлого визита: настройки ещё грузятся, а менять текст посреди анимации нельзя.
  const [name] = useState(() => readStorage('local', NAME_KEY) ?? info.name)

  // Запоминаем настоящее название магазина для следующих визитов.
  useEffect(() => {
    if (info.name && info.name !== DEFAULT_SHOP_INFO.name) writeStorage('local', NAME_KEY, info.name)
  }, [info.name])

  useEffect(() => {
    if (!visible) return
    writeStorage('session', SHOWN_KEY, '1')
    const timer = setTimeout(() => setVisible(false), DURATION_MS)
    return () => clearTimeout(timer)
  }, [visible])

  if (!visible) return null

  return (
    <div className={styles.overlay} onClick={() => setVisible(false)} aria-hidden="true">
      <div className={styles.stage}>
        <span className={styles.wave} />
        <span className={`${styles.wave} ${styles.waveLate}`} />
        <div className={styles.phone}>
          <span className={styles.notch} />
          <span className={styles.screen}>
            <span className={styles.mark}>{initials(name)}</span>
          </span>
        </div>
      </div>
      <div className={styles.name}>
        {Array.from(name).map((char, index) => (
          <span key={index} className={styles.letter}>
            {char === ' ' ? ' ' : char}
          </span>
        ))}
      </div>
      <p className={styles.tagline}>{t.introTagline}</p>
    </div>
  )
}
