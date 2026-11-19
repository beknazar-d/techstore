import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { subscribeAdminEvents, type AdminEvent } from '../../api'
import { msg } from '../../i18n'
import { formatPrice } from '../../utils/format'
import {
  getNotifyPermission,
  isNotifyEnabled,
  onNativeNotificationOpen,
  onNotifyPrefChange,
  showDeviceNotification,
  type DeviceNotification,
} from './deviceNotifier'

function toNotification(event: AdminEvent): DeviceNotification {
  const t = msg().adminLayout
  switch (event.kind) {
    case 'order':
      return {
        title: t.notifyOrderTitle(event.number),
        body: t.notifyOrderBody(event.productName, event.quantity, formatPrice(event.total), event.customerName),
        path: `/admin/orders/${event.id}`,
      }
    case 'tradeIn':
      return {
        title: t.notifyTradeInTitle(event.number),
        body: t.notifyTradeInBody(event.device, event.customerName),
        path: `/admin/trade-in/${event.id}`,
      }
    case 'handoff':
      return {
        title: t.notifyHandoffTitle,
        body: t.notifyHandoffBody(event.customerName, event.reason),
        path: `/admin/chats/${event.chatId}`,
      }
    case 'message':
      return {
        title: t.notifyMessageTitle(event.customerName),
        body: event.text.length > 160 ? `${event.text.slice(0, 157)}…` : event.text,
        path: `/admin/chats/${event.chatId}`,
      }
  }
}

/**
 * Уведомления о новых заявках и сообщениях, пока открыта админка (сайт, Windows, Android).
 * Работает, только если уведомления включены на этом устройстве и система их разрешила.
 */
export function useAdminNotifications(): void {
  const navigate = useNavigate()
  // navigate меняется при переходах — берём свежий через ref, чтобы не переподписываться на каждой странице.
  const navigateRef = useRef(navigate)
  useEffect(() => {
    navigateRef.current = navigate
  }, [navigate])
  // Меняется при включении/выключении в «Настройках» и после выдачи разрешения — переподписываемся.
  const [prefVersion, setPrefVersion] = useState(0)

  useEffect(() => onNotifyPrefChange(() => setPrefVersion((v) => v + 1)), [])
  useEffect(() => onNativeNotificationOpen((path) => navigateRef.current(path)), [])

  useEffect(() => {
    if (!isNotifyEnabled()) return
    let unsubscribe: (() => void) | null = null
    let cancelled = false
    void getNotifyPermission().then((permission) => {
      if (cancelled || permission !== 'granted') return
      unsubscribe = subscribeAdminEvents((event) => {
        void showDeviceNotification(toNotification(event), (path) => navigateRef.current(path)).catch((error: unknown) =>
          console.error(error),
        )
      })
    })
    return () => {
      cancelled = true
      unsubscribe?.()
    }
  }, [prefVersion])
}
