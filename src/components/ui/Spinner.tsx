import { cn } from '../../utils/cn'
import styles from './Spinner.module.css'

interface SpinnerProps {
  size?: 'sm' | 'md'
  className?: string
}

export function Spinner({ size = 'md', className }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label="Загрузка"
      className={cn(styles.spinner, size === 'sm' ? styles.sm : styles.md, className)}
    />
  )
}

interface PageLoaderProps {
  label?: string
}

export function PageLoader({ label = 'Загрузка…' }: PageLoaderProps) {
  return (
    <div className={styles.pageLoader}>
      <Spinner />
      <span className={styles.label}>{label}</span>
    </div>
  )
}
