import { useEffect, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Checkbox } from '../../components/ui/Checkbox'
import { msg } from '../../i18n'
import { useAsync } from '../../hooks/useAsync'
import {
  getNotifyPermission,
  isNotifyEnabled,
  notificationsSupported,
  onNotifyPrefChange,
  requestNotifyPermission,
  setNotifyEnabled,
  showDeviceNotification,
  type NotifyPermission,
} from '../notifications/deviceNotifier'
import { Section } from './AdminBlocks'
import styles from './DeviceNotificationsSection.module.css'

/** «Уведомления на этом устройстве»: включить, выдать разрешение системе, проверить. */
export function DeviceNotificationsSection() {
  const t = msg().adminSettings
  const [enabled, setEnabled] = useState(isNotifyEnabled)
  const [permission, setPermission] = useState<NotifyPermission | null>(null)
  const [busy, setBusy] = useState(false)
  const [tested, setTested] = useState(false)
  const supported = notificationsSupported()

  const initial = useAsync(() => getNotifyPermission(), [])
  const current = permission ?? initial.data ?? null

  useEffect(() => onNotifyPrefChange(() => setEnabled(isNotifyEnabled())), [])

  async function handleToggle(next: boolean) {
    setTested(false)
    if (next && current !== 'granted') {
      setBusy(true)
      try {
        setPermission(await requestNotifyPermission())
      } finally {
        setBusy(false)
      }
    }
    setNotifyEnabled(next)
  }

  async function handleTest() {
    await showDeviceNotification({ title: t.deviceNotifyTestTitle, body: t.deviceNotifyTestBody, path: '/admin/orders' }, () => {})
    setTested(true)
  }

  return (
    <Section title={t.deviceNotifyTitle}>
      <div className={styles.body}>
        <p className={styles.hint}>{t.deviceNotifyHint}</p>
        {!supported || current === 'unsupported' ? (
          <p className={styles.warning}>{t.deviceNotifyUnsupported}</p>
        ) : (
          <>
            <Checkbox
              label={t.deviceNotifyEnable}
              checked={enabled}
              disabled={busy}
              onChange={(e) => void handleToggle(e.target.checked)}
            />
            {enabled && current === 'denied' && <p className={styles.warning}>{t.deviceNotifyDenied}</p>}
            {enabled && current === 'prompt' && (
              <Button variant="secondary" icon="notifications" loading={busy} onClick={() => void handleToggle(true)}>
                {t.deviceNotifyAllow}
              </Button>
            )}
            {enabled && current === 'granted' && (
              <div className={styles.row}>
                <Button variant="secondary" icon="notifications_active" onClick={() => void handleTest()}>
                  {t.deviceNotifyTest}
                </Button>
                {tested && <span className={styles.success}>{t.deviceNotifyTestSent}</span>}
              </div>
            )}
          </>
        )}
      </div>
    </Section>
  )
}
