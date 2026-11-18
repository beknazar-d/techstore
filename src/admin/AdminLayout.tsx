import { Link, NavLink, Outlet } from 'react-router-dom'
import { listChats, listOrders, listTradeIns, logout } from '../api'
import { ThemeToggle } from '../components/ui/ThemeToggle'
import { LanguageSwitcher } from '../components/ui/LanguageSwitcher'
import { shop } from '../config/shop'
import { useAdminSession } from '../hooks/useAdminSession'
import { useApiQuery } from '../hooks/useApiQuery'
import { cn } from '../utils/cn'
import { AiAssistant } from './components/AiAssistant'
import { useT } from '../i18n'
import type { AdminLayoutMessages } from '../i18n/ru/adminLayout'
import styles from './AdminLayout.module.css'

type CounterKey = 'orders' | 'tradeIns' | 'chats'

interface NavItem {
  label: keyof AdminLayoutMessages['nav']
  to: string
  icon: string
  counter?: CounterKey
  /** Не показывать в нижней панели на телефоне (там место на 5 пунктов). */
  desktopOnly?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { label: 'orders', to: '/admin/orders', icon: 'receipt_long', counter: 'orders' },
  { label: 'tradeIns', to: '/admin/trade-in', icon: 'swap_horiz', counter: 'tradeIns' },
  { label: 'chats', to: '/admin/chats', icon: 'forum', counter: 'chats' },
  { label: 'products', to: '/admin/products', icon: 'inventory_2' },
  { label: 'categories', to: '/admin/categories', icon: 'category', desktopOnly: true },
  { label: 'banners', to: '/admin/banners', icon: 'campaign', desktopOnly: true },
  { label: 'stats', to: '/admin/stats', icon: 'monitoring' },
  { label: 'settings', to: '/admin/settings', icon: 'settings', desktopOnly: true },
]

const BOTTOM_NAV_ITEMS = NAV_ITEMS.filter((item) => !item.desktopOnly)

export function AdminLayout() {
  const t = useT().adminLayout
  const { session } = useAdminSession()
  const newOrders = useApiQuery(() => listOrders({ status: 'new' }), [], ['orders'])
  const newTradeIns = useApiQuery(() => listTradeIns({ status: 'new' }), [], ['tradeIns'])
  const managerChats = useApiQuery(() => listChats({ mode: 'manager' }), [], ['chats'])
  const counters: Record<CounterKey, number> = {
    orders: newOrders.data?.length ?? 0,
    tradeIns: newTradeIns.data?.length ?? 0,
    // Чаты, где клиент ждёт ответа человека.
    chats: managerChats.data?.length ?? 0,
  }

  function handleLogout() {
    void logout()
  }

  return (
    <div className={styles.layout}>
      <header className={styles.topBar}>
        <div>
          <div className={styles.shopName}>{shop.name}</div>
          <div className={styles.caption}>{t.caption}</div>
        </div>
        <div className={styles.actions}>
          <LanguageSwitcher />
          <ThemeToggle />
          <NavLink
            to="/admin/settings"
            aria-label={t.nav.settings}
            className={({ isActive }) => cn(styles.iconButton, isActive && styles.iconButtonActive)}
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              settings
            </span>
          </NavLink>
          <button type="button" className={styles.iconButton} aria-label={t.logout} onClick={handleLogout}>
            <span className="material-symbols-outlined" aria-hidden="true">
              logout
            </span>
          </button>
        </div>
      </header>

      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <div>
            <div className={styles.shopName}>{shop.name}</div>
            <div className={styles.caption}>{t.caption}</div>
          </div>
          <div className={styles.brandActions}>
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
        </div>
        <nav aria-label={t.navAria} className={styles.sideNav}>
          {NAV_ITEMS.map((item) => {
            const count = item.counter ? counters[item.counter] : 0
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => cn(styles.sideItem, isActive && styles.active)}
              >
                <span className={cn('material-symbols-outlined', styles.sideIcon)} aria-hidden="true">
                  {item.icon}
                </span>
                <span>{t.nav[item.label]}</span>
                {count > 0 && <span className={cn(styles.counter, styles.sideCounter)}>{count}</span>}
              </NavLink>
            )
          })}
        </nav>
        <div className={styles.sideFooter}>
          {session && <div className={styles.email}>{session.email}</div>}
          <Link to="/" className={styles.sideItem}>
            <span className={cn('material-symbols-outlined', styles.sideIcon)} aria-hidden="true">
              storefront
            </span>
            <span>{t.toSite}</span>
          </Link>
          <button type="button" className={cn(styles.sideItem, styles.sideButton)} onClick={handleLogout}>
            <span className={cn('material-symbols-outlined', styles.sideIcon)} aria-hidden="true">
              logout
            </span>
            <span>{t.logout}</span>
          </button>
        </div>
      </aside>

      <main className={styles.main}>
        <Outlet />
      </main>

      <nav aria-label={t.navAria} className={styles.bottomNav}>
        {BOTTOM_NAV_ITEMS.map((item) => {
          const count = item.counter ? counters[item.counter] : 0
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => cn(styles.bottomItem, isActive && styles.bottomActive)}
            >
              <span className={styles.bottomIconWrap}>
                <span className={cn('material-symbols-outlined', styles.bottomIcon)} aria-hidden="true">
                  {item.icon}
                </span>
                {count > 0 && <span className={cn(styles.counter, styles.bottomCounter)}>{count}</span>}
              </span>
              <span>{t.nav[item.label]}</span>
            </NavLink>
          )
        })}
      </nav>
      <AiAssistant />
    </div>
  )
}
