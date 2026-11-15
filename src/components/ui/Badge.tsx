import { cn } from '../../utils/cn'
import styles from './Badge.module.css'

type BadgeTone = 'success' | 'warning' | 'error' | 'info' | 'neutral'

interface BadgeProps {
  tone?: BadgeTone
  dot?: boolean
  className?: string
  children: React.ReactNode
}

const toneClasses: Record<BadgeTone, string> = {
  success: styles.toneSuccess,
  warning: styles.toneWarning,
  error: styles.toneError,
  info: styles.toneInfo,
  neutral: styles.toneNeutral,
}

const dotClasses: Record<BadgeTone, string> = {
  success: styles.dotSuccess,
  warning: styles.dotWarning,
  error: styles.dotError,
  info: styles.dotInfo,
  neutral: styles.dotNeutral,
}

export function Badge({ tone = 'neutral', dot, className, children }: BadgeProps) {
  return (
    <span className={cn(styles.badge, toneClasses[tone], className)}>
      {dot && <span className={cn(styles.dot, dotClasses[tone])} aria-hidden="true" />}
      {children}
    </span>
  )
}