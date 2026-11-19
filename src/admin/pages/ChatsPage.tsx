import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { listChats, getBotSettings } from '../../api'
import { CHAT_MODE_LABELS, CHAT_MODES } from '../../config/labels'
import { ToneBadge } from '../../components/ui/StatusBadge'
import { CHAT_MODE_TONES } from '../../config/tones'
import { ToneFilters, type ToneFilterOption } from '../components/ToneFilters'
import type { BotChat, ChatMode } from '../../types'
import { Spinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'
import { useApiQuery } from '../../hooks/useApiQuery'
import { formatDateTime } from '../../utils/date'
import { msg } from '../../i18n'
import styles from './ChatsPage.module.css'

type ModeFilter = ChatMode | 'all'

/** Фильтры с числом чатов в каждом режиме. */
function getModeFilters(chats: BotChat[]): ToneFilterOption<ModeFilter>[] {
  return [
    { value: 'all', label: msg().adminChats.all, tone: 'indigo', count: chats.length },
    ...CHAT_MODES.map((mode) => ({
      value: mode,
      label: CHAT_MODE_LABELS[mode],
      tone: CHAT_MODE_TONES[mode],
      count: chats.filter((chat) => chat.mode === mode).length,
    })),
  ]
}

export function ChatsPage() {
  const t = msg().adminChats
  const [modeFilter, setModeFilter] = useState<ModeFilter>('all')
  const { data: botSettings } = useApiQuery(getBotSettings, [], ['botSettings'])
  // Все чаты одним запросом: фильтр — на месте, а на кнопках видно, сколько чатов в каждом режиме.
  const { data: allChats, loading } = useApiQuery(() => listChats(), [], ['chats'])
  const chatList = useMemo(() => allChats ?? [], [allChats])
  const chats = useMemo(
    () => (modeFilter === 'all' ? chatList : chatList.filter((chat) => chat.mode === modeFilter)),
    [chatList, modeFilter],
  )

  const summary = useMemo(
    () => ({
      total: chatList.length,
      unread: chatList.reduce((sum, chat) => sum + chat.unreadCount, 0),
    }),
    [chatList],
  )

  if (loading && allChats === undefined) {
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
          <p className={styles.kicker}>{t.kicker}</p>
          <h1 className={styles.title}>{t.title}</h1>
        </div>
        <div className={styles.summary}>
          <span>{t.count(summary.total)}</span>
          {summary.unread > 0 && (
            <strong>{t.unread(summary.unread)}</strong>
          )}
        </div>
      </header>

      {botSettings && !botSettings.connected && (
        <div className={styles.botNotice}>
          <span className="material-symbols-outlined">smart_toy</span>
          <span>{t.notConnected}</span>
          <Link to="/admin/settings">{t.connect}</Link>
        </div>
      )}

      <div className={styles.filters}>
        <ToneFilters options={getModeFilters(chatList)} value={modeFilter} onChange={setModeFilter} ariaLabel={t.filterAria} />
      </div>

      <div className={styles.list}>
        {chats.length === 0 ? (
          <EmptyState
            icon="forum"
            title={t.emptyTitle}
            text={t.emptyText}
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
                <ToneBadge tone={CHAT_MODE_TONES[chat.mode]}>{CHAT_MODE_LABELS[chat.mode]}</ToneBadge>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  )
}