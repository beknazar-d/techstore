import { cn } from '../../utils/cn'
import { msg } from '../../i18n'
import styles from './Spinner.module.css'

interface SpinnerProps {
  /** sm — в строке, md — в блоке, lg — на всю страницу. */
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

/**
 * Индикатор загрузки в духе магазина: смартфон «заряжается» — экран наполняется, мигает молния.
 * Один на весь сайт, админку и приложения.
 */
export function Spinner({ size = 'md', className }: SpinnerProps) {
  return (
    <span role="status" aria-label={msg().common.loading} className={cn(styles.spinner, styles[size], className)}>
      <span className={styles.phone} aria-hidden="true">
        <span className={styles.notch} />
        <span className={styles.screen}>
          <span className={styles.charge} />
          <svg className={styles.bolt} viewBox="0 0 24 24">
            <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z" />
          </svg>
        </span>
      </span>
    </span>
  )
}

interface PageLoaderProps {
  label?: string
}

/** Загрузка страницы целиком: крупный телефон и подпись. */
export function PageLoader({ label = msg().common.loading }: PageLoaderProps) {
  return (
    <div className={styles.pageLoader}>
      <Spinner size="lg" />
      <span className={styles.label}>{label}</span>
    </div>
  )
}
