import { useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  getBotSettings,
  updateBotSettings,
  connectBot,
  disconnectBot,
  sendTestNotification,
  connectWhatsApp,
  getWhatsAppStatus,
  disconnectWhatsApp,
  getErrorMessage,
} from '../../api'
import type { BotSettings, WhatsAppLiveStatus } from '../../types'
import { msg } from '../../i18n'
import { AiKeysSection, AssistantSection, BotAiSection } from '../components/AiSettingsSection'
import { ShopSettingsSection } from '../components/ShopSettingsSection'
import { DeviceNotificationsSection } from '../components/DeviceNotificationsSection'
import { AppDownloadSection } from '../components/AppDownloadSection'
import { useApiQuery } from '../../hooks/useApiQuery'
import { PageHeader, Section, InfoRow } from '../components/AdminBlocks'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Textarea } from '../../components/ui/Textarea'
import { Checkbox } from '../../components/ui/Checkbox'
import { Badge } from '../../components/ui/Badge'
import { Spinner } from '../../components/ui/Spinner'
import { Modal } from '../../components/ui/Modal'
import { Chips } from '../../components/ui/Chips'
import styles from './SettingsPage.module.css'

type SettingsTab = 'bot' | 'whatsapp' | 'ai' | 'shop' | 'device'
const TABS: SettingsTab[] = ['bot', 'whatsapp', 'ai', 'shop', 'device']
const DAY_MS = 24 * 60 * 60 * 1000
/** За сколько дней до конца оплаты Wappi предупреждать. */
const PAY_WARN_DAYS = 5

/**
 * Как бот отвечает клиентам и какие уведомления шлёт менеджерам. Обе части сохраняются одной кнопкой
 * (она есть в каждой части); между ними — блоки модели и голоса (`between`).
 */
function BotBehaviorForm({ initial, between }: { initial: BotSettings; between: ReactNode }) {
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

      {between}

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
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get('tab') as SettingsTab | null
  const tab: SettingsTab = tabParam && TABS.includes(tabParam) ? tabParam : 'bot'

  return (
    <div className={styles.page}>
      <PageHeader title={t.title} subtitle={t.subtitle} />

      <Chips
        ariaLabel={t.tabsAria}
        options={TABS.map((value) => ({ value, label: t.tabs[value] }))}
        value={tab}
        onChange={(next) => setSearchParams(next === 'bot' ? {} : { tab: next }, { replace: true })}
        className={styles.tabs}
      />
      <p className={styles.tabIntro}>{t.tabIntro[tab]}</p>

      {tab === 'bot' && <BotTab />}
      {tab === 'whatsapp' && <WhatsAppTab />}
      {tab === 'ai' && (
        <>
          <AiKeysSection />
          <AssistantSection />
        </>
      )}
      {tab === 'shop' && <ShopSettingsSection />}
      {tab === 'device' && (
        <>
          <DeviceNotificationsSection />
          <AppDownloadSection />
        </>
      )}
    </div>
  )
}

/** Вкладка «Telegram-бот»: подключение, как отвечает (ИИ, модель, голос), уведомления менеджерам. */
function BotTab() {
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
      <div className={styles.loader}>
        <Spinner />
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
    <>
      <Section title={t.botConnection}>
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

      <BotBehaviorForm initial={data} between={<BotAiSection />} />

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
    </>
  )
}

/** Вкладка «WhatsApp»: номер магазина через Wappi. ИИ и правила ответа — общие с Telegram-ботом. */
function WhatsAppTab() {
  const t = msg().adminSettings
  const { data, reload } = useApiQuery(() => getBotSettings(), [], ['botSettings'])

  const [token, setToken] = useState('')
  const [profileId, setProfileId] = useState('')
  const [busy, setBusy] = useState<'connect' | 'check' | 'disconnect' | 'toggle' | null>(null)
  const [error, setError] = useState('')
  const [live, setLive] = useState<WhatsAppLiveStatus | null>(null)
  // «Сейчас» — один раз при открытии вкладки: для подсчёта дней до конца оплаты этого хватает.
  const [now] = useState(() => Date.now())
  const [showDisconnectModal, setShowDisconnectModal] = useState(false)

  if (data === undefined) {
    return (
      <div className={styles.loader}>
        <Spinner />
      </div>
    )
  }

  async function run(kind: NonNullable<typeof busy>, action: () => Promise<unknown>) {
    setBusy(kind)
    setError('')
    try {
      await action()
      await reload()
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  const handleConnect = () =>
    run('connect', async () => {
      setLive(await connectWhatsApp({ token, profileId }))
      setToken('')
    })
  const handleCheck = () => run('check', async () => setLive(await getWhatsAppStatus()))
  const handleDisconnect = () => {
    setShowDisconnectModal(false)
    return run('disconnect', async () => {
      await disconnectWhatsApp()
      setLive(null)
    })
  }
  const handleToggle = (checked: boolean) => run('toggle', () => updateBotSettings({ whatsappEnabled: checked }))

  const online = live ? live.authorized : data.whatsappStatus === 'online'
  const known = Boolean(live) || data.whatsappStatus !== ''
  const phone = live?.phone || data.whatsappPhone
  const paidUntil = live?.paidUntil ?? data.whatsappPaidUntil
  const daysLeft = paidUntil ? Math.ceil((new Date(paidUntil).getTime() - now) / DAY_MS) : null

  return (
    <>
      <Section title={t.waConnection}>
        {!data.whatsappConnected ? (
          <div className={styles.connectBlock}>
            <ol className={styles.stepsList}>
              <li>{t.waStep1}</li>
              <li>{t.waStep2}</li>
              <li>{t.waStep3}</li>
            </ol>
            <p className={styles.waRisk}>{t.waRisk}</p>

            <div className={styles.connectForm}>
              <Input
                label={t.waToken}
                type="password"
                autoComplete="off"
                hint={t.waTokenHint}
                value={token}
                onChange={(e) => setToken(e.target.value)}
              />
              <Input
                label={t.waProfileId}
                autoComplete="off"
                hint={t.waProfileHint}
                value={profileId}
                onChange={(e) => setProfileId(e.target.value)}
              />

              {error && (
                <p className={styles.connectError} role="alert">
                  {error}
                </p>
              )}

              <div>
                <Button
                  icon="link"
                  onClick={handleConnect}
                  loading={busy === 'connect'}
                  disabled={!token.trim() || !profileId.trim()}
                >
                  {t.waConnect}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className={styles.connectedBlock}>
            <div className={styles.connectedHeader}>
              <Badge tone={!known ? 'neutral' : online ? 'success' : 'warning'} dot>
                {!known ? t.waUnknown : online ? t.waOnline : t.waOffline}
              </Badge>
              <Button variant="secondary" size="sm" icon="refresh" onClick={handleCheck} loading={busy === 'check'}>
                {t.waCheck}
              </Button>
            </div>

            {phone && <InfoRow label={t.waPhone}>+{phone}</InfoRow>}
            <InfoRow label={t.waProfileShort}>{data.whatsappProfileId}</InfoRow>
            <InfoRow label={t.tokenShort}>••••{data.whatsappTokenHint}</InfoRow>
            {paidUntil && (
              <InfoRow label={t.waPaidUntil}>{new Date(paidUntil).toLocaleDateString('ru-RU')}</InfoRow>
            )}
            {daysLeft !== null && daysLeft <= PAY_WARN_DAYS && (
              <p className={styles.waWarning} role="alert">
                {t.waPaySoon(daysLeft)}
              </p>
            )}

            {live?.qr && !live.authorized && (
              <div className={styles.waQr}>
                <img src={live.qr} alt={t.waQrAlt} className={styles.waQrImage} />
                <p className={styles.checkboxHint}>{t.waQr}</p>
              </div>
            )}

            <div className={styles.checkboxGroup}>
              <Checkbox
                label={t.waEnabled}
                checked={data.whatsappEnabled}
                disabled={busy === 'toggle'}
                onChange={(e) => handleToggle(e.target.checked)}
              />
              <p className={styles.checkboxHint}>{t.waEnabledHint}</p>
            </div>
            <p className={styles.checkboxHint}>{t.waShared}</p>

            <div className={styles.connectedActions}>
              <Button variant="secondary" onClick={() => setShowDisconnectModal(true)} loading={busy === 'disconnect'}>
                {t.waDisconnect}
              </Button>
              {error && (
                <span className={styles.connectError} role="alert">
                  {error}
                </span>
              )}
            </div>
          </div>
        )}
      </Section>

      <Modal
        open={showDisconnectModal}
        onClose={() => setShowDisconnectModal(false)}
        title={t.waDisconnectTitle}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowDisconnectModal(false)}>
              {t.cancel}
            </Button>
            <Button variant="danger" onClick={handleDisconnect}>
              {t.disconnect}
            </Button>
          </>
        }
      >
        <p className={styles.modalText}>{t.waDisconnectText}</p>
      </Modal>
    </>
  )
}
