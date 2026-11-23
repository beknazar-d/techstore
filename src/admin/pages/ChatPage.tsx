import { useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getChat, listChatMessages, sendChatMessage, setChatMode, markChatRead, getErrorMessage } from '../../api'
import { CHAT_CHANNEL_LABELS, CHAT_MODE_LABELS, CHAT_SENDER_LABELS } from '../../config/labels'
import { PageHeader } from '../components/AdminBlocks'
import { Button } from '../../components/ui/Button'
import { Textarea } from '../../components/ui/Textarea'
import { Badge } from '../../components/ui/Badge'
import { Spinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'
import { formatDateTime } from '../../utils/date'
import { formatPhone } from '../../utils/phone'
import { cn } from '../../utils/cn'
import { useApiQuery } from '../../hooks/useApiQuery'
import { msg } from '../../i18n'
import styles from './ChatPage.module.css'

export function ChatPage() {
  const t = msg().adminChats
  const { id } = useParams()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const { data: chat, error: chatError, reload: reloadChat } = useApiQuery(
    () => getChat(id ?? ''),
    [id],
    ['chats']
  )
  const { data: messages } = useApiQuery(
    () => listChatMessages(id ?? ''),
    [id],
    ['chats']
  )

  useEffect(() => {
    if (id) {
      markChatRead(id).catch(() => {})
    }
  }, [id])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: 'end' })
  }, [messages])

  const handleSendMessage = async () => {
    if (!message.trim() || loading) return

    setLoading(true)
    setError('')

    try {
      await sendChatMessage(id!, message.trim())
      setMessage('')
      await reloadChat()
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleModeChange = async (newMode: 'bot' | 'manager' | 'closed') => {
    try {
      await setChatMode(id!, newMode)
      await reloadChat()
    } catch (err) {
      setError(getErrorMessage(err))
    }
  }

  // Ошибку проверяем раньше загрузки: при ошибке data так и остаётся undefined.
  if (chatError && chat === undefined) {
    return (
      <div className={styles.page}>
        <EmptyState
          icon="forum"
          title={t.notFound}
          text={t.notFoundText}
          action={<Link to="/admin/chats">{t.allChats}</Link>}
        />
      </div>
    )
  }

  if (chat === undefined || messages === undefined) {
    return (
      <div className={styles.page}>
        <div className={styles.loader}><Spinner /></div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <PageHeader
        backTo="/admin/chats"
        backLabel={t.allChats}
        title={chat.customerName || formatPhone(chat.customerPhone)}
        subtitle={
          <>
            <Badge tone={chat.channel === 'whatsapp' ? 'success' : 'info'}>{CHAT_CHANNEL_LABELS[chat.channel]}</Badge>{' '}
            {chat.channel === 'whatsapp' && chat.customerPhone && (
              <a
                href={`https://wa.me/${chat.customerPhone.replace(/\D/g, '')}`}
                target="_blank"
                rel="noreferrer"
                className={styles.telegramLink}
              >
                WhatsApp
              </a>
            )}
            {chat.channel === 'telegram' && chat.telegramUsername && (
              <a
                href={`https://t.me/${chat.telegramUsername}`}
                target="_blank"
                rel="noreferrer"
                className={styles.telegramLink}
              >
                @{chat.telegramUsername}
              </a>
            )}
            {chat.customerPhone && (
              <a href={`tel:${chat.customerPhone}`} className={styles.phoneLink}>
                {formatPhone(chat.customerPhone)}
              </a>
            )}
            <Badge tone={chat.mode === 'manager' ? 'warning' : chat.mode === 'bot' ? 'info' : 'neutral'}>
              {CHAT_MODE_LABELS[chat.mode]}
            </Badge>
          </>
        }
      />

      {chat.mode === 'manager' && chat.handoffReason && (
        <div className={styles.handoffNotice}>
          <span className="material-symbols-outlined">support_agent</span>
          <span>{t.handoff(chat.handoffReason)}</span>
        </div>
      )}

      {chat.orderId && (
        <Link to={`/admin/orders/${chat.orderId}`} className={styles.orderLink}>
          {t.order}
        </Link>
      )}

      <div className={styles.modeButtons}>
        {chat.mode === 'bot' && (
          <Button
            variant="secondary"
            size="sm"
            icon="pan_tool"
            onClick={() => handleModeChange('manager')}
          >
            {t.takeOver}
          </Button>
        )}
        {chat.mode === 'manager' && (
          <Button
            variant="secondary"
            size="sm"
            icon="smart_toy"
            onClick={() => handleModeChange('bot')}
          >
            {t.backToBot}
          </Button>
        )}
        {chat.mode !== 'closed' && (
          <Button
            variant="ghost"
            size="sm"
            icon="check_circle"
            onClick={() => handleModeChange('closed')}
          >
            {t.close}
          </Button>
        )}
        {chat.mode === 'closed' && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => handleModeChange('manager')}
          >
            {t.reopen}
          </Button>
        )}
      </div>

      <div className={styles.messagesContainer}>
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(styles.message, styles[msg.sender])}
          >
            <div className={styles.bubble}>
              <div className={styles.sender}>
                {msg.sender === 'bot' && (
                  <span className="material-symbols-outlined" aria-hidden="true">
                    smart_toy
                  </span>
                )}
                {CHAT_SENDER_LABELS[msg.sender]}
              </div>
              <div>{msg.text}</div>
              <div className={styles.time}>{formatDateTime(msg.createdAt)}</div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {chat.mode === 'bot' && (
        <div className={styles.formHint}>
          {t.botActive}
        </div>
      )}

      <div className={styles.formContainer}>
        <div className={styles.form}>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={2}
            placeholder={t.replyPlaceholder}
            aria-label={t.replyAria}
          />
          <Button
            variant="primary"
            size="sm"
            icon="send"
            loading={loading}
            onClick={handleSendMessage}
            disabled={!message.trim()}
          >
            {t.send}
          </Button>
        </div>
        {error && (
          <div className={styles.errorMessage} role="alert">
            {error}
          </div>
        )}
      </div>
    </div>
  )
}