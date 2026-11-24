import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { listChats, getBotSettings } from '../../api'
import { CHAT_CHANNEL_LABELS, CHAT_MODE_LABELS, CHAT_MODES } from '../../config/labels'
import { ToneBadge } from '../../components/ui/StatusBadge'
import { CHAT_MODE_TONES } from '../../config/tones'
import { ToneFilters, type ToneFilterOption } from '../components/ToneFilters'
import type { BotChat, ChatChannel, ChatMode } from '../../types'
import type { Tone } from '../../config/tones'
import { Spinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'
import { useApiQuery } from '../../hooks/useApiQuery'
import { formatDateTime } from '../../utils/date'
import { formatPhone } from '../../utils/phone'
import { cn } from '../../utils/cn'
import { msg } from '../../i18n'
import styles from './ChatsPage.module.css'

type ModeFilter = ChatMode | 'all'
type ChannelFilter = ChatChannel | 'all'

const CHANNELS: ChatChannel[] = ['telegram', 'whatsapp']
const CHANNEL_TONES: Record<ChatChannel, Tone> = { telegram: 'blue', whatsapp: 'green' }

/** Фильтры по каналу (Telegram / WhatsApp) с числом чатов. */
function getChannelFilters(chats: BotChat[]): ToneFilterOption<ChannelFilter>[] {
  return [
    { value: 'all', label: msg().adminChats.allChannels, tone: 'indigo', count: chats.length },
    ...CHANNELS.map((channel) => ({
      value: channel,
      label: CHAT_CHANNEL_LABELS[channel],
      tone: CHANNEL_TONES[channel],
      count: chats.filter((chat) => chat.channel === channel).length,
    })),
  ]
}

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
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>('all')
  const { data: botSettings } = useApiQuery(getBotSettings, [], ['botSettings'])
  // Все чаты одним запросом: фильтр — на месте, а на кнопках видно, сколько чатов в каждом режиме.
  const { data: allChats, loading } = useApiQuery(() => listChats(), [], ['chats'])
  const chatList = useMemo(() => allChats ?? [], [allChats])
  // Сначала канал, потом режим: числа на кнопках режима — внутри выбранного канала.
  const channelChats = useMemo(
    () => (channelFilter === 'all' ? chatList : chatList.filter((chat) => chat.channel === channelFilter)),
    [chatList, channelFilter],
  )
  const chats = useMemo(
    () => (modeFilter === 'all' ? channelChats : channelChats.filter((chat) => chat.mode === modeFilter)),
    [channelChats, modeFilter],
  )
  // Фильтр каналов нужен, только когда есть WhatsApp.
  const showChannels = Boolean(botSettings?.whatsappConnected) || chatList.some((chat) => chat.channel === 'whatsapp')

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

      {botSettings && !botSettings.connected && !botSettings.whatsappConnected && (
        <div className={styles.botNotice}>
          <span className="material-symbols-outlined">smart_toy</span>
          <span>{t.notConnected}</span>
          <Link to="/admin/settings">{t.connect}</Link>
        </div>
      )}

      <div className={styles.filters}>
        {showChannels && (
          <ToneFilters
            options={getChannelFilters(chatList)}
            value={channelFilter}
            onChange={setChannelFilter}
            ariaLabel={t.channelFilterAria}
          />
        )}
        <ToneFilters options={getModeFilters(channelChats)} value={modeFilter} onChange={setModeFilter} ariaLabel={t.filterAria} />
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
                    {(chat.customerName || '#').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h2 className={styles.customerName}>
                      {chat.customerName || formatPhone(chat.customerPhone)}
                    </h2>
                    <p className={styles.username}>
                      <span className={cn(styles.channel, chat.channel === 'whatsapp' && styles.channelWhatsApp)}>
                        {CHAT_CHANNEL_LABELS[chat.channel]}
                      </span>
                      {chat.channel === 'whatsapp'
                        ? chat.customerName && chat.customerPhone && ` ${formatPhone(chat.customerPhone)}`
                        : chat.telegramUsername && ` @${chat.telegramUsername}`}
                    </p>
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