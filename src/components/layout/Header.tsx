import { Link, NavLink } from 'react-router-dom'
import { ThemeToggle } from '../ui/ThemeToggle'
import { LanguageSwitcher } from '../ui/LanguageSwitcher'
import { shop } from '../../config/shop'
import { formatPhone, telHref } from '../../utils/phone'
import { cn } from '../../utils/cn'
import { useT } from '../../i18n'
import styles from './Header.module.css'

export function Header() {
  const t = useT()
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link to="/" className={styles.logo}>
          <span className={styles.logoName}>{shop.name}</span>
          <span className={styles.logoCity}>{shop.city}</span>
        </Link>
        <nav className={styles.nav} aria-label={t.layout.mainNav}>
          <NavLink to="/catalog" title={t.layout.catalog} className={({ isActive }) => cn(styles.navLink, isActive && styles.active)}>
            <span className={cn('material-symbols-outlined', styles.navIcon)} aria-hidden="true">grid_view</span>
            <span className={styles.navText}>{t.layout.catalog}</span>
          </NavLink>
          <NavLink to="/trade-in" title={t.layout.tradeIn} className={({ isActive }) => cn(styles.navLink, isActive && styles.active)}>
            <span className={cn('material-symbols-outlined', styles.navIcon)} aria-hidden="true">swap_horiz</span>
            <span className={styles.navText}>{t.layout.tradeIn}</span>
          </NavLink>
        </nav>
        <div className={styles.contacts}>
          <a href={telHref(shop.phone)} className={styles.phone}>
            {formatPhone(shop.phone)}
          </a>
          <span className={styles.hours}>{t.layout.workingHours}</span>
        </div>
        <LanguageSwitcher className={cn(styles.themeToggle, styles.langFull)} />
        <LanguageSwitcher compact className={cn(styles.themeToggle, styles.langCompact)} />
        <ThemeToggle />
        <a href={telHref(shop.phone)} className={styles.callButton} aria-label={t.layout.callShop}>
          <span className="material-symbols-outlined" aria-hidden="true">call</span>
        </a>
      </div>
    </header>
  )
}
