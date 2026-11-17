// Корень админки. Загружается лениво из src/App.tsx.
// Правило: код в src/admin/ не импортирует клиентские страницы (src/pages/) —
// позже эта же админка будет упакована в Electron и APK. Общее берём из src/components/.

import { Navigate, Route, Routes } from 'react-router-dom'
import { AdminLayout } from './AdminLayout'
import { CategoriesPage } from './pages/CategoriesPage'
import { ChatPage } from './pages/ChatPage'
import { ChatsPage } from './pages/ChatsPage'
import { LoginPage } from './pages/LoginPage'
import { OrderPage } from './pages/OrderPage'
import { OrdersPage } from './pages/OrdersPage'
import { ProductFormPage } from './pages/ProductFormPage'
import { ProductsPage } from './pages/ProductsPage'
import { SettingsPage } from './pages/SettingsPage'
import { TradeInDetailPage } from './pages/TradeInDetailPage'
import { TradeInsPage } from './pages/TradeInsPage'
import { RequireAdmin } from './RequireAdmin'

/** Маршруты относительно /admin. */
export default function AdminApp() {
  return (
    <Routes>
      <Route path="login" element={<LoginPage />} />
      <Route element={<RequireAdmin />}>
        <Route element={<AdminLayout />}>
          <Route index element={<Navigate to="/admin/orders" replace />} />
          <Route path="orders" element={<OrdersPage />} />
          <Route path="orders/:id" element={<OrderPage />} />
          <Route path="trade-in" element={<TradeInsPage />} />
          <Route path="trade-in/:id" element={<TradeInDetailPage />} />
          <Route path="products" element={<ProductsPage />} />
          <Route path="products/new" element={<ProductFormPage />} />
          <Route path="products/:id" element={<ProductFormPage />} />
          <Route path="categories" element={<CategoriesPage />} />
          <Route path="chats" element={<ChatsPage />} />
          <Route path="chats/:id" element={<ChatPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/admin/orders" replace />} />
        </Route>
      </Route>
    </Routes>
  )
}
