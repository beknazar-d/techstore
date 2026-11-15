import { useCallback, useEffect, useRef, useState, type DependencyList } from 'react'
import { getErrorMessage } from '../api'

export interface AsyncState<T> {
  /** Данные. `undefined`, пока первая загрузка не завершилась. */
  data: T | undefined
  /** Идёт загрузка (первая или повторная). */
  loading: boolean
  /** Русский текст ошибки или null. */
  error: string | null
  /** Перезагрузить данные, не пряча уже показанные. */
  reload: () => void
}

/**
 * Загружает данные асинхронной функцией.
 *
 *   const { data, loading, error, reload } = useAsync(() => getProductBySlug(slug), [slug])
 *
 * - `deps` — как у useEffect: при их смене данные сбрасываются и грузятся заново.
 * - `reload()` перезагружает «тихо»: старые данные остаются на экране, пока не придут новые.
 * - Ответы устаревших запросов игнорируются.
 */
export function useAsync<T>(fn: () => Promise<T>, deps: DependencyList): AsyncState<T> {
  const [state, setState] = useState<{ data: T | undefined; loading: boolean; error: string | null }>({
    data: undefined,
    loading: true,
    error: null,
  })
  const [reloadCount, setReloadCount] = useState(0)

  // Всегда вызываем самую свежую функцию, не требуя от вызывающего useCallback.
  const fnRef = useRef(fn)
  useEffect(() => {
    fnRef.current = fn
  })

  // Чтобы отличить reload() (данные оставляем) от смены deps (данные сбрасываем).
  const lastReloadCount = useRef(0)

  useEffect(() => {
    let cancelled = false
    const isReload = reloadCount !== lastReloadCount.current
    lastReloadCount.current = reloadCount

    setState((prev) => ({ data: isReload ? prev.data : undefined, loading: true, error: null }))

    fnRef.current().then(
      (data) => {
        if (!cancelled) setState({ data, loading: false, error: null })
      },
      (error: unknown) => {
        if (!cancelled) setState((prev) => ({ data: prev.data, loading: false, error: getErrorMessage(error) }))
      },
    )

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, reloadCount])

  const reload = useCallback(() => setReloadCount((n) => n + 1), [])

  return { ...state, reload }
}
