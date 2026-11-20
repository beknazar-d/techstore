import { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useApiQuery } from '../../hooks/useApiQuery'
import {
  askAssistant,
  getAiSettings,
  EMPTY_CONVERSATION,
  getErrorMessage,
  isAssistantConversation,
  isAssistantReady,
  type AssistantConversation,
} from '../../api'
import { msg } from '../../i18n'
import { Spinner } from '../../components/ui/Spinner'
import { cn } from '../../utils/cn'
import styles from './AiAssistant.module.css'

const STORAGE_POS_KEY = 'phone-market:assistant-pos'
const STORAGE_CHAT_KEY = 'phone-market:assistant-chat'
const DRAG_THRESHOLD = 5
const EDGE_OFFSET = 8
const DEFAULT_BOTTOM = 96 // above bottom nav on phone
const DEFAULT_RIGHT = 16

export function AiAssistant() {
  const t = msg().assistant
  const { data: ai } = useApiQuery(() => getAiSettings(), [], ['aiSettings'])
  const isLoading = ai === undefined
  const connected = isAssistantReady(ai)

  const [isOpen, setIsOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [position, setPosition] = useState<{ x: number; y: number }>(() => clampToWindow(readPosition()))
  const [pendingText, setPendingText] = useState('')
  /** Сколько сообщений было в разговоре, когда отправили поручение (чтобы не задвоить его). */
  const [sentAt, setSentAt] = useState(0)
  const [inputValue, setInputValue] = useState('')
  const drag = useRef<{ pointerId: number; startX: number; startY: number; startPosX: number; startPosY: number; moved: boolean } | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // Load conversation from sessionStorage
  const [conversation, setConversation] = useState<AssistantConversation>(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_CHAT_KEY)
      if (stored) {
        const parsed: unknown = JSON.parse(stored)
        // Разговор в старом формате (до выбора провайдера) продолжить нельзя — начинаем новый.
        if (isAssistantConversation(parsed)) return parsed
      }
    } catch {
      // ignore
    }
    return EMPTY_CONVERSATION
  })

  // Save conversation to sessionStorage
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_CHAT_KEY, JSON.stringify(conversation))
    } catch {
      // ignore
    }
  }, [conversation])

  // Save position to localStorage
  const savePosition = useCallback((pos: { x: number; y: number }) => {
    try {
      localStorage.setItem(STORAGE_POS_KEY, JSON.stringify(pos))
    } catch {
      // ignore
    }
  }, [])

  const constrainPosition = useCallback((x: number, y: number) => clampToWindow({ x, y }), [])

  // Update position on window resize
  useEffect(() => {
    const handleResize = () => {
      setPosition((prev) => constrainPosition(prev.x, prev.y))
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [constrainPosition])

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [conversation.items, busy, pendingText])

  // Close panel with Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  // Перетаскивание: сдвиг больше DRAG_THRESHOLD — перенос, иначе это нажатие (открыть панель).
  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return
    drag.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startPosX: position.x,
      startPosY: position.y,
      moved: false,
    }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = drag.current
    if (!d || d.pointerId !== e.pointerId) return
    const dx = e.clientX - d.startX
    const dy = e.clientY - d.startY
    if (!d.moved && Math.hypot(dx, dy) <= DRAG_THRESHOLD) return
    d.moved = true
    setPosition(constrainPosition(d.startPosX + dx, d.startPosY + dy))
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = drag.current
    if (!d || d.pointerId !== e.pointerId) return
    drag.current = null
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
    if (d.moved) savePosition(position)
    else setIsOpen(true)
  }

  // Клавиатура: Enter/Пробел на кнопке дают click без pointer-событий с button 0 — открываем по detail === 0.
  const handleClick = (e: React.MouseEvent) => {
    if (e.detail === 0) setIsOpen(true)
  }

  // Example prompt click
  const handleExampleClick = (text: string) => {
    setInputValue(text)
    ;(panelRef.current?.querySelector('textarea') as HTMLTextAreaElement)?.focus()
  }

  // Send message
  const handleSend = async () => {
    const text = inputValue.trim()
    if (!text || busy) return

    // Add user message locally immediately
    setPendingText(text)
    setSentAt(conversation.items.length)
    setInputValue('')
    setBusy(true)

    try {
      const next = await askAssistant(conversation, text, (progress) => setConversation(progress))
      setConversation(next)
      setPendingText('')
    } catch (err) {
      setConversation((c) => ({
        ...c,
        items: [...c.items, { role: 'assistant', text: getErrorMessage(err), error: true }],
      }))
      setPendingText('')
    } finally {
      setBusy(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // New conversation
  const handleNewConversation = () => {
    if (busy) return
    setConversation(EMPTY_CONVERSATION)
    setPendingText('')
  }

  // Don't render if not in admin (shouldn't happen as it's only in AdminLayout)
  if (isLoading) {
    return (
      <button
        type="button"
        className={styles.fab}
        style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
        aria-label={t.loadingAria}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onClick={handleClick}
      >
        <Spinner size="sm" />
      </button>
    )
  }

  const allItems = [...conversation.items]
  if (busy && pendingText && conversation.items.length === sentAt) {
    allItems.push({ role: 'user', text: pendingText })
  }

  return (
    <>
      {/* FAB Button */}
      {!isOpen && (
        <button
          type="button"
          className={styles.fab}
          style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
          aria-label={t.openAria}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onClick={handleClick}
        >
          <span className={cn('material-symbols-outlined', styles.fabIcon)} aria-hidden="true">auto_awesome</span>
        </button>
      )}

      {/* На телефоне панель занимает почти весь экран: тап по затемнению сверху закрывает её. */}
      {isOpen && <div className={styles.backdrop} aria-hidden="true" onClick={() => setIsOpen(false)} />}

      {/* Chat Panel */}
      {isOpen && (
        <div
          className={styles.panel}
          role="dialog"
          aria-label={t.title}
          ref={panelRef}
        >
          <header className={styles.header}>
            <span className={cn('material-symbols-outlined', styles.headerIcon)} aria-hidden="true">auto_awesome</span>
            <h2 className={styles.headerTitle}>{t.title}</h2>
            <div className={styles.headerActions}>
              <button
                type="button"
                className={styles.iconButton}
                aria-label={t.newChat}
                onClick={handleNewConversation}
                disabled={busy}
              >
                <span className="material-symbols-outlined" aria-hidden="true">restart_alt</span>
              </button>
              <button
                type="button"
                className={styles.iconButton}
                aria-label={t.close}
                onClick={() => setIsOpen(false)}
              >
                <span className="material-symbols-outlined" aria-hidden="true">close</span>
              </button>
            </div>
          </header>

          <div className={styles.messages}>
            {!connected ? (
              <div className={styles.notConnected}>
                <p>{t.notConnected}</p>
                <Link to="/admin/settings?tab=ai" onClick={() => setIsOpen(false)}>{t.openSettings}</Link>
              </div>
            ) : allItems.length === 0 && !busy && !pendingText ? (
              <div className={styles.empty}>
                <p>{t.examplesTitle}</p>
                <div className={styles.examples}>
                  {t.examples.map((prompt, i) => (
                    <button
                      key={i}
                      type="button"
                      className={styles.exampleBtn}
                      onClick={() => handleExampleClick(prompt)}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {allItems.map((item, idx) => (
                  <div key={idx} className={styles.messageWrap}>
                    <div className={cn(styles.bubble, item.role === 'user' ? styles.user : styles.assistant, item.error && styles.error)}>
                      <div className={styles.bubbleText}>{item.text}</div>
                      {item.actions && item.actions.length > 0 && (
                        <ul className={styles.actionsList}>
                          {item.actions.map((action, aIdx) => (
                            <li key={aIdx} className={styles.actionItem}>
                              <span
                                className={cn('material-symbols-outlined', styles.actionIcon, action.ok ? styles.actionOk : styles.actionError)}
                                aria-hidden="true"
                              >
                                {action.ok ? 'check_circle' : 'error'}
                              </span>
                              <span className={styles.actionSummary}>{action.summary}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                ))}
                {busy && (
                  <div key="thinking" className={styles.messageWrap}>
                    <div className={cn(styles.bubble, styles.assistant)}>
                      <div className={styles.thinking}>
                        <Spinner size="sm" />
                        <span>{t.thinking}</span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {connected && (
            <form className={styles.form} onSubmit={(e) => { e.preventDefault(); handleSend(); }}>
              <textarea
                className={styles.input}
                placeholder={t.placeholder}
                rows={2}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={busy}
                aria-label={t.inputAria}
              />
              <button
                type="submit"
                className={styles.sendBtn}
                disabled={busy || !inputValue.trim()}
                aria-label={t.send}
              >
                <span className="material-symbols-outlined" aria-hidden="true">send</span>
              </button>
            </form>
          )}
        </div>
      )}
    </>
  )
}
const FAB_SIZE = 56

function readPosition(): { x: number; y: number } {
  try {
    const stored = localStorage.getItem(STORAGE_POS_KEY)
    if (stored) {
      const pos = JSON.parse(stored) as { x?: unknown; y?: unknown } | null
      if (pos && typeof pos.x === 'number' && typeof pos.y === 'number') return { x: pos.x, y: pos.y }
    }
  } catch {
    // нет доступа к localStorage — позиция по умолчанию
  }
  // По умолчанию — правый нижний угол, над нижней навигацией телефона.
  return { x: window.innerWidth - FAB_SIZE - DEFAULT_RIGHT, y: window.innerHeight - FAB_SIZE - DEFAULT_BOTTOM }
}

/** Не даёт кружку уйти за край окна (например, после поворота телефона). */
function clampToWindow({ x, y }: { x: number; y: number }): { x: number; y: number } {
  return {
    x: Math.max(EDGE_OFFSET, Math.min(x, window.innerWidth - FAB_SIZE - EDGE_OFFSET)),
    y: Math.max(EDGE_OFFSET, Math.min(y, window.innerHeight - FAB_SIZE - EDGE_OFFSET)),
  }
}
