import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { isAdminApp, SITE_URL } from '../../config/platform'

interface SiteLinkProps {
  className?: string
  children: ReactNode
}

/** Ссылка «На сайт»: на сайте — переход на главную, в приложении — сайт в браузере. */
export function SiteLink({ className, children }: SiteLinkProps) {
  if (isAdminApp) {
    return (
      <a href={SITE_URL} target="_blank" rel="noopener noreferrer" className={className}>
        {children}
      </a>
    )
  }
  return (
    <Link to="/" className={className}>
      {children}
    </Link>
  )
}
