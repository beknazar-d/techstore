import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { getErrorMessage, login } from '../../api'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { PageLoader } from '../../components/ui/Spinner'
import { shop } from '../../config/shop'
import { useAdminSession } from '../../hooks/useAdminSession'
import styles from './LoginPage.module.css'

export function LoginPage() {
  const { session, loading } = useAdminSession()
  const location = useLocation()
  const navigate = useNavigate()
  const [email, setEmail] = useState<string>(shop.demoAdminEmail)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const state: unknown = location.state
  const from =
    typeof state === 'object' && state !== null && 'from' in state && typeof state.from === 'string' && state.from.startsWith('/admin')
      ? state.from
      : '/admin/orders'

  if (loading) return <PageLoader />
  if (session) return <Navigate to={from} replace />

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!email.trim() || !password) {
      setError('Введите email и пароль')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await login(email, password)
      navigate(from, { replace: true })
    } catch (err) {
      setError(getErrorMessage(err))
      setSubmitting(false)
    }
  }

  return (
    <div className={styles.screen}>
      <div className={styles.card}>
        <div>
          <div className={styles.shopName}>{shop.name}</div>
          <div className={styles.caption}>Вход для сотрудников</div>
        </div>
        <form className={styles.form} noValidate onSubmit={handleSubmit}>
          <Input
            label="Email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              setError(null)
            }}
          />
          <Input
            label="Пароль"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              setError(null)
            }}
          />
          {error && (
            <div className={styles.error} role="alert">
              {error}
            </div>
          )}
          <Button type="submit" fullWidth loading={submitting}>
            Войти
          </Button>
        </form>
        <div className={styles.demo}>Демо-версия. Пароль: {shop.demoAdminPassword}</div>
        <Link to="/" className={styles.back}>
          ← На сайт
        </Link>
      </div>
    </div>
  )
}
