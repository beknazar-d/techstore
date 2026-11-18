import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { formatDateTime } from '../../utils/date'
import { msg } from '../../i18n'
import styles from './AdminBlocks.module.css'

interface PageHeaderProps {
  title: string
  subtitle?: ReactNode
  backTo?: string
  backLabel?: string
  actions?: ReactNode
}

export function PageHeader({ title, subtitle, backTo, backLabel = msg().adminLayout.back, actions }: PageHeaderProps) {
  return (
    <header className={styles.pageHeader}>
      {backTo && (
        <Link to={backTo} className={styles.back}>
          <span className="material-symbols-outlined" aria-hidden="true">
            arrow_back
          </span>
          {backLabel}
        </Link>
      )}
      <div className={styles.headerRow}>
        <h1 className={styles.title}>{title}</h1>
        {actions && <div className={styles.actions}>{actions}</div>}
      </div>
      {subtitle && <div className={styles.subtitle}>{subtitle}</div>}
    </header>
  )
}

interface SectionProps {
  title?: string
  actions?: ReactNode
  children: ReactNode
}

export function Section({ title, actions, children }: SectionProps) {
  return (
    <section className={styles.section}>
      {(title || actions) && (
        <div className={styles.sectionHead}>
          {title && <h2 className={styles.sectionTitle}>{title}</h2>}
          {actions && <div className={styles.actions}>{actions}</div>}
        </div>
      )}
      <div className={styles.sectionBody}>{children}</div>
    </section>
  )
}

interface InfoRowProps {
  label: string
  children: ReactNode
}

export function InfoRow({ label, children }: InfoRowProps) {
  return (
    <div className={styles.infoRow}>
      <span className={styles.infoLabel}>{label}</span>
      <span className={styles.infoValue}>{children}</span>
    </div>
  )
}

interface TimelineEvent {
  id: string
  message: string
  createdAt: string
}

interface EventTimelineProps {
  events: TimelineEvent[]
}

export function EventTimeline({ events }: EventTimelineProps) {
  if (events.length === 0) return <p className={styles.timelineEmpty}>{msg().adminLayout.noEvents}</p>
  return (
    <ol className={styles.timeline}>
      {events.map((event) => (
        <li key={event.id} className={styles.timelineItem}>
          <span className={styles.dot} aria-hidden="true" />
          <div className={styles.timelineMessage}>{event.message}</div>
          <div className={styles.timelineTime}>{formatDateTime(event.createdAt)}</div>
        </li>
      ))}
    </ol>
  )
}
