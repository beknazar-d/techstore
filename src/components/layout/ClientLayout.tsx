import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import styles from './ClientLayout.module.css'
import { Footer } from './Footer'
import { Header } from './Header'
import { SiteIntro } from './SiteIntro'

/** Каркас клиентских страниц: шапка, содержимое, подвал. Страницы сами задают свои отступы и ширину. */
export function ClientLayout() {
  const { pathname } = useLocation()

  // При переходе на другую страницу начинаем с её верха.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <div className={styles.layout}>
      <Header />
      <main className={styles.main}>
        <Outlet />
      </main>
      <Footer />
      <SiteIntro />
    </div>
  )
}
