import { Component } from 'react'
import { useLocation } from 'react-router-dom'
import type { ErrorInfo, ReactNode } from 'react'
import { msg } from '../i18n'
import styles from './ErrorBoundary.module.css'

interface ErrorBoundaryProps {
  children: ReactNode
  /** Куда ведёт «Назад», если в истории браузера некуда вернуться (например, /admin/orders). */
  homePath: string
  /** Сменился адрес — сбрасываем ошибку, чтобы после «Назад» страница снова работала. */
  resetKey?: string
}

interface ErrorBoundaryState {
  error: Error | null
  /** resetKey, при котором случилась ошибка. */
  key?: string
}

const RELOAD_FLAG = 'phone-market:chunk-reload'

/** Сайт обновился, пока страница была открыта: старого файла с кодом уже нет. */
function isChunkError(error: Error): boolean {
  return /dynamically imported module|Importing a module script failed|Failed to fetch dynamically|error loading dynamically/i.test(
    error.message,
  )
}

/**
 * Ловит ошибку отрисовки и вместо пустого экрана показывает сообщение с кнопками «Назад» и «Перезагрузить».
 * Ошибку загрузки кода после обновления сайта чинит одной автоматической перезагрузкой.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null, key: this.props.resetKey }

  static getDerivedStateFromProps(props: ErrorBoundaryProps, state: ErrorBoundaryState): Partial<ErrorBoundaryState> | null {
    return props.resetKey !== state.key ? { error: null, key: props.resetKey } : null
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack)
    if (isChunkError(error)) {
      try {
        if (!sessionStorage.getItem(RELOAD_FLAG)) {
          sessionStorage.setItem(RELOAD_FLAG, '1')
          window.location.reload()
        }
      } catch {
        // Без sessionStorage не перезагружаем автоматически — останется кнопка.
      }
    }
  }

  private goBack = () => {
    this.setState({ error: null })
    if (window.history.length > 1) window.history.back()
    else if (window.location.hash) window.location.hash = this.props.homePath
    else window.location.assign(this.props.homePath)
  }

  private reload = () => {
    try {
      sessionStorage.removeItem(RELOAD_FLAG)
    } catch {
      // ничего
    }
    window.location.reload()
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    const t = msg().common
    return (
      <div className={styles.wrap} role="alert">
        <div className={styles.card}>
          <span className={styles.icon} aria-hidden="true">
            !
          </span>
          <h1 className={styles.title}>{t.crashTitle}</h1>
          <p className={styles.text}>{t.crashText}</p>
          <div className={styles.actions}>
            <button type="button" className={styles.primary} onClick={this.reload}>
              {t.crashReload}
            </button>
            <button type="button" className={styles.secondary} onClick={this.goBack}>
              {t.crashBack}
            </button>
          </div>
          <details className={styles.details}>
            <summary>{t.crashDetails}</summary>
            <code>{error.message || String(error)}</code>
          </details>
        </div>
      </div>
    )
  }
}

/** ErrorBoundary, который сбрасывается при переходе на другой адрес. */
export function RouteErrorBoundary({ homePath, children }: { homePath: string; children: ReactNode }) {
  const { pathname } = useLocation()
  return (
    <ErrorBoundary homePath={homePath} resetKey={pathname}>
      {children}
    </ErrorBoundary>
  )
}
