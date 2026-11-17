import { Link, NavLink, Outlet } from 'react-router-dom'
import { listChats, listOrders, listTradeIns, logout } from '../api'
import { ThemeToggle } from '../components/ui/ThemeToggle'
import { shop } from '../config/shop'
import { useAdminSession } from '../hooks/useAdminSession'
import { useApiQuery } from '../hooks/useApiQuery'
import { cn } from '../utils/cn'
import styles from './AdminLayout.module.css'

type CounterKey = 'orders' | 'tradeIns' | 'chats'

interface NavItem {
  label: string
  to: string
  icon: string
  counter?: CounterKey
  /** Не показывать в нижней панели на телефоне (там место на 5 пунктов). */
  desktopOnly?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Заказы', to: '/admin/orders', icon: 'receipt_long', counter: 'orders' },
  { label: 'Trade-in', to: '/admin/trade-in', icon: 'swap_horiz', counter: 'tradeIns' },
  { label: 'Чаты', to: '/admin/chats', icon: 'forum', counter: 'chats' },
  { label: 'Товары', to: '/admin/products', icon: 'inventory_2' },
  { label: 'Категории', to: '/admin/categories', icon: 'category' },
  { label: 'Настройки', to: '/admin/settings', icon: 'settings', desktopOnly: true },
]

const BOTTOM_NAV_ITEMS = NAV_ITEMS.filter((item) => !item.desktopOnly)

export function AdminLayout() {
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
          <div className={styles.caption}>Админка</div>
        </div>
        <div className={styles.actions}>
          <ThemeToggle />
          <NavLink
            to="/admin/settings"
            aria-label="Настройки"
            className={({ isActive }) => cn(styles.iconButton, isActive && styles.iconButtonActive)}
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              settings
            </span>
          </NavLink>
          <button type="button" className={styles.iconButton} aria-label="Выйти" onClick={handleLogout}>
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
            <div className={styles.caption}>Админка</div>
          </div>
          <ThemeToggle />
        </div>
        <nav aria-label="Разделы админки" className={styles.sideNav}>
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
                <span>{item.label}</span>
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
            <span>На сайт</span>
          </Link>
          <button type="button" className={cn(styles.sideItem, styles.sideButton)} onClick={handleLogout}>
            <span className={cn('material-symbols-outlined', styles.sideIcon)} aria-hidden="true">
              logout
            </span>
            <span>Выйти</span>
          </button>
        </div>
      </aside>

      <main className={styles.main}>
        <Outlet />
      </main>

      <nav aria-label="Разделы админки" className={styles.bottomNav}>
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
              <span>{item.label}</span>
            </NavLink>
          )
        })}
      </nav>
    </div>
  )
}
