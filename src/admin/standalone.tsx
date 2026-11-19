// Вход для приложений администратора (Electron и Android/Capacitor): только админка, без клиентских страниц.
// HashRouter — приложение открывается из файла (file://) или из встроенного сервера, где нет
// «запасного» index.html для любых путей. Пути те же, что на сайте: #/admin/orders и т.д.

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import '../index.css'
import AdminApp from './AdminApp'
import { LanguageRoot } from '../i18n/LanguageRoot'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <LanguageRoot>
        <Routes>
          <Route path="/admin/*" element={<AdminApp />} />
          <Route path="*" element={<Navigate to="/admin/orders" replace />} />
        </Routes>
      </LanguageRoot>
    </HashRouter>
  </StrictMode>,
)
