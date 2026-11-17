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
  const [groupId, setGroupId] = useState(initial.groupId)
  const [notify, setNotify] = useState(initial.notify)
  const [aiEnabled, setAiEnabled] = useState(initial.aiEnabled)
  const [greeting, setGreeting] = useState(initial.greeting)
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
      setTestResult({ ok: true, text: 'Тестовое сообщение отправлено' })
    } catch (err) {
      setTestResult({ ok: false, text: getErrorMessage(err) })
    } finally {
      setTestLoading(false)
    }
  }

  return (
    <div className={styles.behaviorForm}>
      <Section title="Уведомления менеджерам">
        <div className={styles.behaviorBody}>
          <Input
            label="ID группы менеджеров"
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
            hint="Добавьте бота в группу и узнайте ID через @getmyid_bot. Обычно начинается с -100"
          />

          <div className={styles.checkboxGroup}>
            <Checkbox
              label="Новая заявка на товар"
              checked={notify.newOrder}
              onChange={(e) => setNotify((p) => ({ ...p, newOrder: e.target.checked }))}
            />
          </div>
          <div className={styles.checkboxGroup}>
            <Checkbox
              label="Смена статуса заказа"
              checked={notify.orderStatus}
              onChange={(e) => setNotify((p) => ({ ...p, orderStatus: e.target.checked }))}
            />
          </div>
          <div className={styles.checkboxGroup}>
            <Checkbox
              label="Новая заявка на trade-in"
              checked={notify.newTradeIn}
              onChange={(e) => setNotify((p) => ({ ...p, newTradeIn: e.target.checked }))}
            />
          </div>
          <div className={styles.checkboxGroup}>
            <Checkbox
              label="Товар заканчивается"
              checked={notify.lowStock}
              onChange={(e) => setNotify((p) => ({ ...p, lowStock: e.target.checked }))}
            />
          </div>

          <div className={styles.testRow}>
            <Button variant="secondary" icon="send" onClick={handleTest} loading={testLoading}>
              Отправить тестовое сообщение
            </Button>
            {testResult && (
              <span className={testResult.ok ? styles.successText : styles.testError} role={testResult.ok ? undefined : 'alert'}>
                {testResult.text}
              </span>
            )}
          </div>
        </div>
      </Section>

      <Section title="Ответы с помощью ИИ">
        <div className={styles.behaviorBody}>
          <div className={styles.checkboxGroup}>
            <Checkbox
              label="Бот отвечает клиентам с помощью ИИ"
              checked={aiEnabled}
              onChange={(e) => setAiEnabled(e.target.checked)}
            />
            <p className={styles.checkboxHint}>
              Бот берёт цены и наличие из каталога сайта. Если выключить, бот будет только пересылать
              сообщения менеджерам.
            </p>
          </div>

          <Textarea label="Приветствие" rows={3} value={greeting} onChange={(e) => setGreeting(e.target.value)} />

          <Textarea
            label="Инструкция для ИИ"
            rows={6}
            hint="Как общаться с клиентами: тон, что можно обещать, о чём не говорить"
            value={aiInstructions}
            onChange={(e) => setAiInstructions(e.target.value)}
          />

          <div className={styles.checkboxGroup}>
            <Checkbox
              label="Разрешить торг"
              checked={allowBargaining}
              onChange={(e) => setAllowBargaining(e.target.checked)}
            />
            <p className={styles.checkboxHint}>
              Бот не опустит цену ниже минимальной цены, указанной в карточке товара.
            </p>
          </div>

          <div className={styles.checkboxGroup}>
            <Checkbox
              label="Бот может оформлять заявки на товар"
              checked={allowOrders}
              onChange={(e) => setAllowOrders(e.target.checked)}
            />
            <p className={styles.checkboxHint}>Остаток на складе проверяется так же, как на сайте.</p>
          </div>

          <div className={styles.checkboxGroup}>
            <Checkbox
              label="Передавать сложные вопросы менеджеру"
              checked={handoffToManager}
              onChange={(e) => setHandoffToManager(e.target.checked)}
            />
            <p className={styles.checkboxHint}>
              Такие чаты появятся в разделе «Чаты» с пометкой «Нужен менеджер».
            </p>
          </div>

          <div className={styles.formFooter}>
            {error && (
              <span className={styles.errorText} role="alert">
                {error}
              </span>
            )}
            <Button onClick={handleSave} loading={saving}>
              Сохранить настройки
            </Button>
            {saved && <span className={styles.successText}>Сохранено</span>}
          </div>
        </div>
      </Section>
    </div>
  )
}

export function SettingsPage() {
  const { data, reload } = useApiQuery(() => getBotSettings(), [], ['botSettings'])

  const [connectToken, setConnectToken] = useState('')
  const [connectUsername, setConnectUsername] = useState('')
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
      await connectBot({ token: connectToken, botUsername: connectUsername })
      setConnectToken('')
      setConnectUsername('')
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
      <PageHeader title="Настройки" subtitle="Telegram-бот и уведомления" />

      <Section title="Telegram-бот">
        {!data.connected ? (
          <div className={styles.connectBlock}>
            <ol className={styles.stepsList}>
              <li>Откройте @BotFather в Telegram и отправьте /newbot</li>
              <li>Придумайте имя бота — оно должно заканчиваться на bot</li>
              <li>Скопируйте токен и вставьте ниже</li>
            </ol>

            <div className={styles.connectForm}>
              <Input
                label="Токен бота"
                type="password"
                autoComplete="off"
                placeholder="123456789:AAH…"
                hint="Токен хранится на сервере, в браузере он не сохраняется"
                value={connectToken}
                onChange={(e) => setConnectToken(e.target.value)}
              />
              <Input
                label="Имя бота"
                placeholder="phone_market_bot"
                hint="Без @"
                value={connectUsername}
                onChange={(e) => setConnectUsername(e.target.value)}
              />

              {connectError && (
                <p className={styles.connectError} role="alert">
                  {connectError}
                </p>
              )}

              <div>
                <Button icon="link" onClick={handleConnect} loading={connectLoading}>
                  Подключить бота
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className={styles.connectedBlock}>
            <div className={styles.connectedHeader}>
              <Badge tone="success" dot>
                Подключён
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

            <InfoRow label="Токен">••••{data.tokenHint}</InfoRow>

            <div className={styles.checkboxGroup}>
              <Checkbox
                label="Бот включён"
                checked={data.isEnabled}
                disabled={enabledLoading}
                onChange={(e) => handleToggleEnabled(e.target.checked)}
              />
            </div>

            <div className={styles.connectedActions}>
              <Button variant="secondary" onClick={() => setShowDisconnectModal(true)}>
                Отключить бота
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
        title="Отключить бота?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowDisconnectModal(false)}>
              Отмена
            </Button>
            <Button variant="danger" onClick={handleDisconnect} loading={disconnectLoading}>
              Отключить
            </Button>
          </>
        }
      >
        <p className={styles.modalText}>
          Бот перестанет отвечать клиентам и присылать уведомления. Настройки сохранятся.
        </p>
      </Modal>
    </div>
  )
}
