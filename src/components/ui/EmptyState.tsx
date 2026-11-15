import type { ReactNode } from 'react'
import { cn } from '../../utils/cn'
import styles from './EmptyState.module.css'

interface EmptyStateProps {
  icon?: string
  title: string
  text?: string
  action?: ReactNode
  tone?: 'neutral' | 'error'
}

export function EmptyState({ icon = 'inbox', title, text, action, tone = 'neutral' }: EmptyStateProps) {
  return (
    <div className={styles.emptyState} role={tone === 'error' ? 'alert' : undefined}>
      <span className={cn(styles.iconWrap, tone === 'error' ? styles.toneError : styles.toneNeutral)}>
        <span className={cn('material-symbols-outlined', styles.icon)} aria-hidden="true">
          {icon}
        </span>
      </span>
      <h3 className={styles.title}>{title}</h3>
      {text && <p className={styles.text}>{text}</p>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  )
}
