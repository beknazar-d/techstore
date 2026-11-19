import { useState } from 'react'
import {
  getBotSettings,
  updateBotSettings,
  connectBot,
  disconnectBot,
  sendTestNotification,
  getErrorMessage,
} from '../../api'
import type { BotSettings } from '../../types'
import { msg } from '../../i18n'
import { AiSettingsSection } from '../components/AiSettingsSection'
import { ShopSettingsSection } from '../components/ShopSettingsSection'
import { DeviceNotificationsSection } from '../components/DeviceNotificationsSection'
import { useApiQuery } from '../../hooks/useApiQuery'
import { PageHeader, Section, InfoRow } from '../components/AdminBlocks'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Textarea } from '../../components/ui/Textarea'
import { Checkbox } from '../../components/ui/Checkbox'
import { Badge } from '../../components/ui/Badge'
import { Spinner } from '../../components/ui/Spinner'
import { Modal } from '../../components/ui/Modal'
import styles from './SettingsPage.module.css'

function BotBehaviorForm({ initial }: { initial: BotSettings }) {
  const t = msg().adminSettings
  const [groupId, setGroupId] = useState(initial.groupId)
  const [notify, setNotify] = useState(initial.notify)
  const [aiEnabled, setAiEnabled] = useState(initial.aiEnabled)
  const [greeting, setGreeting] = useState(initial.greeting)
  const [greetingKy, setGreetingKy] = useState(initial.greetingKy)
  const [aiInstructions, setAiInstructions] = useState(initial.aiInstructions)
  const [allowBargaining, setAllowBargaining] = useState(initial.allowBargaining)
  const [allowOrders, setAllowOrders] = useState(initial.allowOrders)
  const [handoffToManager, setHandoffToManager] = useState(initial.handoffToManager)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  const [testLoading, setTestLoading] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null)

  async function handleSave() {
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      await updateBotSettings({
        groupId,
        notify,
        aiEnabled,
        greeting,
        greetingKy,
        aiInstructions,
        allowBargaining,
        allowOrders,
        handoffToManager,
      })
      setSaved(true)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  async function handleTest() {
    setTestLoading(true)
    setTestResult(null)
    try {
      await sendTestNotification()
      setTestResult({ ok: true, text: t.testSent })
    } catch (err) {
      setTestResult({ ok: false, text: getErrorMessage(err) })
    } finally {
      setTestLoading(false)
    }
  }

  return (
    <div className={styles.behaviorForm}>
      <Section title={t.notifications}>
        <div className={styles.behaviorBody}>
          <Input
            label={t.groupId}
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
            hint={t.groupIdHint}
          />

          <div className={styles.checkboxGroup}>
            <Checkbox
              label={t.notifyNewOrder}
              checked={notify.newOrder}
              onChange={(e) => setNotify((p) => ({ ...p, newOrder: e.target.checked }))}
            />
          </div>
          <div className={styles.checkboxGroup}>
            <Checkbox
              label={t.notifyOrderStatus}
              checked={notify.orderStatus}
              onChange={(e) => setNotify((p) => ({ ...p, orderStatus: e.target.checked }))}
            />
          </div>
          <div className={styles.checkboxGroup}>
            <Checkbox
              label={t.notifyNewTradeIn}
              checked={notify.newTradeIn}
              onChange={(e) => setNotify((p) => ({ ...p, newTradeIn: e.target.checked }))}
            />
          </div>
          <div className={styles.checkboxGroup}>
            <Checkbox
              label={t.notifyLowStock}
              checked={notify.lowStock}
              onChange={(e) => setNotify((p) => ({ ...p, lowStock: e.target.checked }))}
            />
          </div>

          <div className={styles.testRow}>
            <Button variant="secondary" icon="send" onClick={handleTest} loading={testLoading}>
              {t.sendTest}
            </Button>
            {testResult && (
              <span className={testResult.ok ? styles.successText : styles.testError} role={testResult.ok ? undefined : 'alert'}>
                {testResult.text}
              </span>
            )}
          </div>
        </div>
      </Section>

      <Section title={t.aiReplies}>
        <div className={styles.behaviorBody}>
          <div className={styles.checkboxGroup}>
            <Checkbox
              label={t.aiEnabled}
              checked={aiEnabled}
              onChange={(e) => setAiEnabled(e.target.checked)}
            />
            <p className={styles.checkboxHint}>
              {t.aiEnabledHint}
            </p>
          </div>

          <Textarea label={t.greeting} rows={3} value={greeting} onChange={(e) => setGreeting(e.target.value)} />

          <Textarea
            label={t.greetingKy}
            rows={3}
            lang="ky"
            hint={t.greetingKyHint}
            value={greetingKy}
            onChange={(e) => setGreetingKy(e.target.value)}
          />

          <Textarea
            label={t.aiInstructions}
            rows={6}
            hint={t.aiInstructionsHint}
            value={aiInstructions}
            onChange={(e) => setAiInstructions(e.target.value)}
          />

          <div className={styles.checkboxGroup}>
            <Checkbox
              label={t.allowBargaining}
              checked={allowBargaining}
              onChange={(e) => setAllowBargaining(e.target.checked)}
            />
            <p className={styles.checkboxHint}>
              {t.allowBargainingHint}
            </p>
          </div>

          <div className={styles.checkboxGroup}>
            <Checkbox
              label={t.allowOrders}
              checked={allowOrders}
              onChange={(e) => setAllowOrders(e.target.checked)}
            />
            <p className={styles.checkboxHint}>{t.allowOrdersHint}</p>
          </div>

          <div className={styles.checkboxGroup}>
            <Checkbox
              label={t.handoff}
              checked={handoffToManager}
              onChange={(e) => setHandoffToManager(e.target.checked)}
            />
            <p className={styles.checkboxHint}>
              {t.handoffHint}
            </p>
          </div>

          <div className={styles.formFooter}>
            {error && (
              <span className={styles.errorText} role="alert">
                {error}
              </span>
            )}
            <Button onClick={handleSave} loading={saving}>
              {t.saveSettings}
            </Button>
            {saved && <span className={styles.successText}>{t.saved}</span>}
          </div>
        </div>
      </Section>
    </div>
  )
}

export function SettingsPage() {
  const t = msg().adminSettings
  const { data, reload } = useApiQuery(() => getBotSettings(), [], ['botSettings'])

  const [connectToken, setConnectToken] = useState('')
  const [connectLoading, setConnectLoading] = useState(false)
  const [connectError, setConnectError] = useState('')

  const [disconnectLoading, setDisconnectLoading] = useState(false)
  const [showDisconnectModal, setShowDisconnectModal] = useState(false)
  const [enabledLoading, setEnabledLoading] = useState(false)

  if (data === undefined) {
    return (
      <div className={styles.page}>
        <div className={styles.loader}>
          <Spinner />
        </div>
      </div>
    )
  }

  async function handleConnect() {
    setConnectLoading(true)
    setConnectError('')
    try {
      await connectBot({ token: connectToken })
      setConnectToken('')
      await reload()
    } catch (err) {
      setConnectError(getErrorMessage(err))
    } finally {
      setConnectLoading(false)
    }
  }

  async function handleDisconnect() {
    setShowDisconnectModal(false)
    setDisconnectLoading(true)
    try {
      await disconnectBot()
      await reload()
    } catch (err) {
      // ошибку покажем рядом с кнопкой отключения
      setConnectError(getErrorMessage(err))
    } finally {
      setDisconnectLoading(false)
    }
  }

  async function handleToggleEnabled(checked: boolean) {
    setEnabledLoading(true)
    try {
      await updateBotSettings({ isEnabled: checked })
      await reload()
    } catch {
      // игнорируем — при следующей загрузке состояние вернётся
    } finally {
      setEnabledLoading(false)
    }
  }

  return (
    <div className={styles.page}>
      <PageHeader title={t.title} subtitle={t.subtitle} />

      <DeviceNotificationsSection />

      <ShopSettingsSection />

      <AiSettingsSection />

      <Section title={t.bot}>
        {!data.connected ? (
          <div className={styles.connectBlock}>
            <ol className={styles.stepsList}>
              <li>{t.botStep1}</li>
              <li>{t.botStep2}</li>
              <li>{t.botStep3}</li>
            </ol>

            <div className={styles.connectForm}>
              <Input
                label={t.token}
                type="password"
                autoComplete="off"
                placeholder="123456789:AAH…"
                hint={t.tokenHint}
                value={connectToken}
                onChange={(e) => setConnectToken(e.target.value)}
              />

              {connectError && (
                <p className={styles.connectError} role="alert">
                  {connectError}
                </p>
              )}

              <div>
                <Button
                  icon="link"
                  onClick={handleConnect}
                  loading={connectLoading}
                  disabled={!connectToken.trim()}
                >
                  {t.connectBot}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className={styles.connectedBlock}>
            <div className={styles.connectedHeader}>
              <Badge tone="success" dot>
                {t.connected}
              </Badge>
              <a
                href={`https://t.me/${data.botUsername}`}
                target="_blank"
                rel="noreferrer"
                className={styles.botLink}
              >
                @{data.botUsername}
              </a>
            </div>

            <InfoRow label={t.tokenShort}>••••{data.tokenHint}</InfoRow>

            <div className={styles.checkboxGroup}>
              <Checkbox
                label={t.botEnabled}
                checked={data.isEnabled}
                disabled={enabledLoading}
                onChange={(e) => handleToggleEnabled(e.target.checked)}
              />
            </div>

            <div className={styles.connectedActions}>
              <Button variant="secondary" onClick={() => setShowDisconnectModal(true)}>
                {t.disconnectBot}
              </Button>
              {connectError && (
                <span className={styles.connectError} role="alert">
                  {connectError}
                </span>
              )}
            </div>
          </div>
        )}
      </Section>

      <BotBehaviorForm initial={data} />

      <Modal
        open={showDisconnectModal}
        onClose={() => setShowDisconnectModal(false)}
        title={t.disconnectBotTitle}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowDisconnectModal(false)}>
              {t.cancel}
            </Button>
            <Button variant="danger" onClick={handleDisconnect} loading={disconnectLoading}>
              {t.disconnect}
            </Button>
          </>
        }
      >
        <p className={styles.modalText}>
          {t.disconnectBotText}
        </p>
      </Modal>

    </div>
  )
}
