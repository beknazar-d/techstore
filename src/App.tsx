import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import { ClientLayout } from './components/layout/ClientLayout'
import { CatalogPage } from './pages/CatalogPage'
import { HomePage } from './pages/HomePage'
import { NotFoundPage } from './pages/NotFoundPage'
import { ProductPage } from './pages/ProductPage'
import { TradeInPage } from './pages/TradeInPage'
import { msg } from './i18n'

// Админка — отдельный чанк: клиенты её код не скачивают.
const AdminApp = lazy(() => import('./admin/AdminApp'))

export default function App() {
  return (
    <Routes>
      <Route element={<ClientLayout />}>
        <Route index element={<HomePage />} />
        <Route path="catalog" element={<CatalogPage />} />
        <Route path="catalog/:categorySlug" element={<CatalogPage />} />
        <Route path="product/:slug" element={<ProductPage />} />
        <Route path="trade-in" element={<TradeInPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
      <Route
        path="admin/*"
        element={
          <Suspense fallback={<p>{msg().common.loading}</p>}>
            <AdminApp />
          </Suspense>
        }
      />
    </Routes>
  )
}
