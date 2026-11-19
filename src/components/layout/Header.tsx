import { Link, NavLink } from 'react-router-dom'
import { ThemeToggle } from '../ui/ThemeToggle'
import { LanguageSwitcher } from '../ui/LanguageSwitcher'
import { useShopInfo } from '../../hooks/useShopInfo'
import { formatPhone, telHref } from '../../utils/phone'
import { cn } from '../../utils/cn'
import { useT } from '../../i18n'
import styles from './Header.module.css'

export function Header() {
  const t = useT()
  const info = useShopInfo()
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link to="/" className={styles.logo}>
          <span className={styles.logoName}>{info.name}</span>
          {info.cityText && <span className={styles.logoCity}>{info.cityText}</span>}
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
        {info.mainPhone && (
          <div className={styles.contacts}>
            <a href={telHref(info.mainPhone)} className={styles.phone}>
              {formatPhone(info.mainPhone)}
            </a>
            {info.hoursText && <span className={styles.hours}>{info.hoursText}</span>}
          </div>
        )}
        <LanguageSwitcher className={cn(styles.themeToggle, styles.langFull)} />
        <LanguageSwitcher compact className={cn(styles.themeToggle, styles.langCompact)} />
        <ThemeToggle />
        {info.mainPhone && (
          <a href={telHref(info.mainPhone)} className={styles.callButton} aria-label={t.layout.callShop}>
            <span className="material-symbols-outlined" aria-hidden="true">call</span>
          </a>
        )}
      </div>
    </header>
  )
}
