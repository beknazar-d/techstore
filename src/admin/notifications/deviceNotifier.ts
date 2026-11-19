// Системные уведомления на устройстве администратора.
// - Сайт и Windows-приложение (Electron): стандартный Notification API.
// - Android (Capacitor): плагин LocalNotifications. Берём его из моста Capacitor (window.Capacitor.Plugins),
//   поэтому сайт не зависит от пакетов Capacitor — они только в mobile/.

import { isAdminApp } from '../../config/platform'
import { msg } from '../../i18n'

export type NotifyPermission = 'granted' | 'denied' | 'prompt' | 'unsupported'

export interface DeviceNotification {
  title: string
  body: string
  /** Путь админки, куда перейти по нажатию: /admin/orders/<id>. */
  path: string
}

/** Через мост Capacitor addListener возвращает подписку сразу, через пакет @capacitor — Promise. Поддерживаем оба. */
interface ListenerHandle {
  remove(): unknown
}

interface LocalNotificationsPlugin {
  checkPermissions(): Promise<{ display: string }>
  requestPermissions(): Promise<{ display: string }>
  createChannel(channel: { id: string; name: string; importance: number; vibration?: boolean }): Promise<void>
  schedule(options: {
    notifications: { id: number; title: string; body: string; channelId?: string; smallIcon?: string; extra?: unknown }[]
  }): Promise<unknown>
  addListener(
    event: 'localNotificationActionPerformed',
    listener: (action: { notification: { extra?: { path?: string } } }) => void,
  ): ListenerHandle | Promise<ListenerHandle>
}

declare global {
  interface Window {
    Capacitor?: { isNativePlatform?: () => boolean; Plugins?: Record<string, unknown> }
    /** Мост Windows-приложения (desktop/preload.cjs). */
    desktopApp?: { focus: () => void }
  }
}

const CHANNEL_ID = 'admin-events'
const PREF_KEY = 'phone-market:notify'
const PREF_EVENT = 'phone-market:notify-change'

function nativePlugin(): LocalNotificationsPlugin | null {
  if (!window.Capacitor?.isNativePlatform?.()) return null
  return (window.Capacitor.Plugins?.LocalNotifications as LocalNotificationsPlugin | undefined) ?? null
}

function toPermission(value: string): NotifyPermission {
  if (value === 'granted') return 'granted'
  if (value === 'denied') return 'denied'
  return 'prompt'
}

export function notificationsSupported(): boolean {
  return nativePlugin() !== null || typeof window.Notification === 'function'
}

export async function getNotifyPermission(): Promise<NotifyPermission> {
  const plugin = nativePlugin()
  if (plugin) return toPermission((await plugin.checkPermissions()).display)
  if (typeof window.Notification !== 'function') return 'unsupported'
  return Notification.permission === 'default' ? 'prompt' : toPermission(Notification.permission)
}

export async function requestNotifyPermission(): Promise<NotifyPermission> {
  const plugin = nativePlugin()
  let result: NotifyPermission
  if (plugin) result = toPermission((await plugin.requestPermissions()).display)
  else if (typeof window.Notification !== 'function') result = 'unsupported'
  else {
    const answer = await Notification.requestPermission()
    result = answer === 'default' ? 'prompt' : toPermission(answer)
  }
  // Разрешение могло появиться — пусть подписка перезапустится.
  window.dispatchEvent(new Event(PREF_EVENT))
  return result
}

/** Включены ли уведомления на этом устройстве. В приложениях — по умолчанию да, на сайте — нет. */
export function isNotifyEnabled(): boolean {
  try {
    const saved = localStorage.getItem(PREF_KEY)
    if (saved === 'on') return true
    if (saved === 'off') return false
  } catch {
    // Хранилище недоступно — берём значение по умолчанию.
  }
  return isAdminApp
}

export function setNotifyEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(PREF_KEY, enabled ? 'on' : 'off')
  } catch {
    // Не сохранится между запусками — не страшно.
  }
  window.dispatchEvent(new Event(PREF_EVENT))
}

/** Подписка на включение/выключение уведомлений в «Настройках». */
export function onNotifyPrefChange(listener: () => void): () => void {
  window.addEventListener(PREF_EVENT, listener)
  return () => window.removeEventListener(PREF_EVENT, listener)
}

let channelReady: Promise<void> | null = null
let nextId = Math.floor(Date.now() / 1000) % 1_000_000

/** Показывает уведомление. `onOpen` — переход в админке по нажатию (для сайта и Windows). */
export async function showDeviceNotification(note: DeviceNotification, onOpen: (path: string) => void): Promise<void> {
  const plugin = nativePlugin()
  if (plugin) {
    channelReady ??= plugin.createChannel({ id: CHANNEL_ID, name: msg().adminLayout.notifyChannel, importance: 5, vibration: true })
    await channelReady
    nextId += 1
    await plugin.schedule({
      notifications: [
        { id: nextId, title: note.title, body: note.body, channelId: CHANNEL_ID, smallIcon: 'ic_stat_notify', extra: { path: note.path } },
      ],
    })
    return
  }
  if (typeof window.Notification !== 'function' || Notification.permission !== 'granted') return
  const notification = new Notification(note.title, { body: note.body, tag: note.path, icon: './favicon.svg' })
  notification.onclick = () => {
    window.desktopApp?.focus()
    window.focus()
    onOpen(note.path)
    notification.close()
  }
}

/** Android: нажатие на уведомление открывает нужный экран. Возвращает отписку. */
export function onNativeNotificationOpen(onOpen: (path: string) => void): () => void {
  const plugin = nativePlugin()
  if (!plugin) return () => {}
  const handle = plugin.addListener('localNotificationActionPerformed', (action) => {
    const path = action.notification.extra?.path
    if (path) onOpen(path)
  })
  return () => {
    void Promise.resolve(handle)
      .then((h) => h.remove())
      .catch((error: unknown) => console.error(error))
  }
}
