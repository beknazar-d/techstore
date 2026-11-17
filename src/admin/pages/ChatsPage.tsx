import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { listChats, getBotSettings } from '../../api'
import { CHAT_MODE_LABELS, CHAT_MODES } from '../../config/labels'
import { Badge } from '../../components/ui/Badge'
import { Spinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'
import { useApiQuery } from '../../hooks/useApiQuery'
import { formatDateTime } from '../../utils/date'
import styles from './ChatsPage.module.css'

const MODE_FILTERS: Array<{ value: 'all' | 'bot' | 'manager' | 'closed'; label: string }> = [
  { value: 'all', label: 'Все' },
  ...CHAT_MODES.map((mode) => ({ value: mode, label: CHAT_MODE_LABELS[mode] })),
]

export function ChatsPage() {
  const [modeFilter, setModeFilter] = useState<'all' | 'bot' | 'manager' | 'closed'>('all')
  const { data: botSettings } = useApiQuery(getBotSettings, [], ['botSettings'])
  const { data: chats = [], loading } = useApiQuery(
    () => listChats(modeFilter === 'all' ? {} : { mode: modeFilter }),
    [modeFilter],
    ['chats'],
  )

  const summary = useMemo(
    () => ({
      total: chats.length,
      unread: chats.reduce((sum, chat) => sum + chat.unreadCount, 0),
    }),
    [chats],
  )

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.loader}><Spinner /></div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>Переписка с клиентами</p>
          <h1 className={styles.title}>Чаты</h1>
        </div>
        <div className={styles.summary}>
          <span>{summary.total} чатов</span>
          {summary.unread > 0 && (
            <strong>{summary.unread} непрочитанных</strong>
          )}
        </div>
      </header>

      {botSettings && !botSettings.connected && (
        <div className={styles.botNotice}>
          <span className="material-symbols-outlined">smart_toy</span>
          <span>Бот ещё не подключён. Ниже — демо-переписка.</span>
          <Link to="/admin/settings">Подключить бота</Link>
        </div>
      )}

      <div className={styles.filters} aria-label="Фильтр чатов">
        {MODE_FILTERS.map((item) => (
          <button
            key={item.value}
            type="button"
            className={styles.filterButton}
            data-active={modeFilter === item.value}
            onClick={() => setModeFilter(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className={styles.list}>
        {chats.length === 0 ? (
          <EmptyState
            icon="forum"
            title="Чатов пока нет"
            text="Здесь появятся разговоры клиентов с ботом в Telegram"
          />
        ) : (
          chats.map((chat) => (
            <Link
              key={chat.id}
              to={`/admin/chats/${chat.id}`}
              className={styles.card}
            >
              <div className={styles.topRow}>
                <div className={styles.customerInfo}>
                  <div className={styles.avatar}>
                    {chat.customerName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h2 className={styles.customerName}>{chat.customerName}</h2>
                    {chat.telegramUsername && (
                      <p className={styles.username}>
                        @{chat.telegramUsername}
                      </p>
                    )}
                  </div>
                </div>
                <div className={styles.metadata}>
                  <time className={styles.time}>
                    {formatDateTime(chat.lastMessageAt)}
                  </time>
                  {chat.unreadCount > 0 && (
                    <div className={styles.unreadBadge}>
                      {chat.unreadCount}
                    </div>
                  )}
                </div>
              </div>

              <div className={styles.lastMessage}>
                <p className={styles.messageText}>
                  {chat.lastMessageText}
                </p>
                <Badge tone={chat.mode === 'manager' ? 'warning' : chat.mode === 'bot' ? 'info' : 'neutral'}>
                  {CHAT_MODE_LABELS[chat.mode]}
                </Badge>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  )
}