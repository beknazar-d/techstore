import { Link, NavLink } from 'react-router-dom'
import { ThemeToggle } from '../ui/ThemeToggle'
import { shop } from '../../config/shop'
import { formatPhone, telHref } from '../../utils/phone'
import { cn } from '../../utils/cn'
import styles from './Header.module.css'

export function Header() {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link to="/" className={styles.logo}>
          <span className={styles.logoName}>{shop.name}</span>
          <span className={styles.logoCity}>{shop.city}</span>
        </Link>
        <nav className={styles.nav} aria-label="Основная навигация">
          <NavLink to="/catalog" className={({ isActive }) => cn(styles.navLink, isActive && styles.active)}>
            <span className={cn('material-symbols-outlined', styles.navIcon)} aria-hidden="true">grid_view</span>
            Каталог
          </NavLink>
          <NavLink to="/trade-in" className={({ isActive }) => cn(styles.navLink, isActive && styles.active)}>
            <span className={cn('material-symbols-outlined', styles.navIcon)} aria-hidden="true">swap_horiz</span>
            Trade-in
          </NavLink>
        </nav>
        <div className={styles.contacts}>
          <a href={telHref(shop.phone)} className={styles.phone}>
            {formatPhone(shop.phone)}
          </a>
          <span className={styles.hours}>{shop.workingHours}</span>
        </div>
        <ThemeToggle className={styles.themeToggle} />
        <a href={telHref(shop.phone)} className={styles.callButton} aria-label="Позвонить в магазин">
          <span className="material-symbols-outlined" aria-hidden="true">call</span>
        </a>
      </div>
    </header>
  )
}
