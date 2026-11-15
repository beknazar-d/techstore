// Вход администратора. Сейчас — локальная заглушка с демо-паролем из src/config/shop.ts.
// Позже: Supabase Auth (signInWithPassword / signOut / getSession / onAuthStateChange)
// плюс проверка по таблице admins. Сигнатуры останутся такими же.

import { shop } from '../config/shop'
import type { AdminSession } from '../types'
import { delay } from './db'
import { ApiError } from './errors'

const SESSION_KEY = 'phone-market:admin-session:v1'

type AuthListener = (session: AdminSession | null) => void

const listeners = new Set<AuthListener>()

function readSession(): AdminSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed === 'object' && parsed !== null && 'email' in parsed && 'loggedInAt' in parsed) {
      return parsed as AdminSession
    }
  } catch {
    // Нет доступа к хранилищу или битые данные — считаем, что входа нет.
  }
  return null
}

function emit(session: AdminSession | null): void {
  for (const listener of listeners) listener(session)
}

/** Вход. Неверные данные → `ApiError('auth')`. */
export async function login(email: string, password: string): Promise<AdminSession> {
  await delay(300)
  if (!email.trim() || password !== shop.demoAdminPassword) {
    throw new ApiError('auth', 'Неверный email или пароль')
  }
  const session: AdminSession = { email: email.trim(), loggedInAt: new Date().toISOString() }
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  } catch {
    throw new ApiError('storage', 'Не удалось сохранить вход: хранилище браузера недоступно')
  }
  emit(session)
  return session
}

export async function logout(): Promise<void> {
  try {
    localStorage.removeItem(SESSION_KEY)
  } catch {
    // Нечего удалять.
  }
  emit(null)
}

/** Текущая сессия администратора или null. */
export async function getSession(): Promise<AdminSession | null> {
  return readSession()
}

/** Подписка на вход и выход (в том числе в другой вкладке). Возвращает функцию отписки. */
export function onAuthChange(listener: AuthListener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === SESSION_KEY || event.key === null) emit(readSession())
  })
}

/**
 * Для функций слоя данных, доступных только администратору.
 * Имитация будущих RLS-правил: без входа — ошибка.
 */
export function requireAdmin(): void {
  if (!readSession()) {
    throw new ApiError('auth', 'Нужно войти в админку')
  }
}
