import { useEffect, useState } from 'react'
import { getSession, onAuthChange } from '../api'
import type { AdminSession } from '../types'

export interface AdminSessionState {
  session: AdminSession | null
  /** true, пока сессия ещё не проверена. */
  loading: boolean
}

/** Текущая сессия администратора. Обновляется при входе и выходе, в том числе в другой вкладке. */
export function useAdminSession(): AdminSessionState {
  const [state, setState] = useState<AdminSessionState>({ session: null, loading: true })

  useEffect(() => {
    let cancelled = false
    getSession().then(
      (session) => {
        if (!cancelled) setState({ session, loading: false })
      },
      () => {
        if (!cancelled) setState({ session: null, loading: false })
      },
    )
    const unsubscribe = onAuthChange((session) => setState({ session, loading: false }))
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  return state
}
