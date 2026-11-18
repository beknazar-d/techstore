// Вход администратора через Supabase Auth.
// Админ = пользователь Supabase Auth, который есть в таблице public.admins
// (её читает только сам пользователь — свою строку). Остальное проверяют RLS и функции базы.

import type { Session } from '@supabase/supabase-js'
import type { AdminSession } from '../types'
import { supabase } from './client'
import { ApiError } from './errors'
import { msg } from '../i18n'

type AuthListener = (session: AdminSession | null) => void

/** Кэш проверки «этот пользователь — админ», чтобы не спрашивать базу на каждое событие. */
const adminCheck = new Map<string, Promise<boolean>>()

function isAdminUser(userId: string): Promise<boolean> {
  let check = adminCheck.get(userId)
  if (!check) {
    check = Promise.resolve(
      supabase
        .from('admins')
        .select('user_id')
        .eq('user_id', userId)
        .maybeSingle()
        .then(({ data, error }) => !error && data !== null),
    )
    adminCheck.set(userId, check)
  }
  return check
}

async function toAdminSession(session: Session | null): Promise<AdminSession | null> {
  if (!session) return null
  if (!(await isAdminUser(session.user.id))) return null
  return {
    email: session.user.email ?? '',
    loggedInAt: session.user.last_sign_in_at ?? new Date().toISOString(),
  }
}

/** Вход. Неверные данные или пользователь не админ → `ApiError('auth')`. */
export async function login(email: string, password: string): Promise<AdminSession> {
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
  if (error || !data.session) {
    if (error && /fetch|network/i.test(error.message)) {
      throw new ApiError('storage', msg().errors.offline)
    }
    throw new ApiError('auth', msg().errors.wrongLogin)
  }
  adminCheck.delete(data.session.user.id)
  const session = await toAdminSession(data.session)
  if (!session) {
    await supabase.auth.signOut()
    throw new ApiError('auth', msg().errors.notAdmin)
  }
  return session
}

export async function logout(): Promise<void> {
  await supabase.auth.signOut()
}

/** Текущая сессия администратора или null. */
export async function getSession(): Promise<AdminSession | null> {
  const { data } = await supabase.auth.getSession()
  return toAdminSession(data.session)
}

/** Подписка на вход и выход (в том числе в другой вкладке). Возвращает функцию отписки. */
export function onAuthChange(listener: AuthListener): () => void {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    // Запросы к базе внутри колбэка onAuthStateChange могут зависнуть — выносим из него.
    setTimeout(() => {
      void toAdminSession(session).then(listener, () => listener(null))
    }, 0)
  })
  return () => data.subscription.unsubscribe()
}
