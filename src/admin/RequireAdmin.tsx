import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAdminSession } from '../hooks/useAdminSession'
import { msg } from '../i18n'

/**
 * Охрана маршрутов админки: без сессии отправляет на /admin/login
 * и запоминает, куда человек шёл (location.state.from), чтобы вернуть его после входа.
 */
export function RequireAdmin() {
  const { session, loading } = useAdminSession()
  const location = useLocation()

  if (loading) return <p>{msg().common.loading}</p>
  if (!session) {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname + location.search }} />
  }
  return <Outlet />
}
