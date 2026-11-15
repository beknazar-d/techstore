import { Outlet } from 'react-router-dom'

// ЗАГЛУШКА: каркас админки (меню, выход) сверстает исполнитель. Имя экспорта не менять.
export function AdminLayout() {
  return (
    <main>
      <Outlet />
    </main>
  )
}
