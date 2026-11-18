import { useRef, useState } from 'react'
import { runStarThemeTransition, type ThemeMode } from '../../utils/starThemeTransition'
import { msg } from '../../i18n'
import styles from './ThemeToggle.module.css'

const STORAGE_KEY = 'theme'

/** Текущая тема берётся с <html>: её ставит скрипт в index.html ещё до запуска React. */
function readTheme(): ThemeMode {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
}

function saveTheme(theme: ThemeMode) {
  document.documentElement.dataset.theme = theme
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // Хранилище недоступно (приватный режим) — тема просто не запомнится.
  }
}

export function ThemeToggle({ className }: { className?: string }) {
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const [theme, setTheme] = useState<ThemeMode>(readTheme)
  const [busy, setBusy] = useState(false)

  function handleToggle() {
    if (busy) return
    const next: ThemeMode = readTheme() === 'dark' ? 'light' : 'dark'
    const rect = buttonRef.current?.getBoundingClientRect()
    const origin = rect
      ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
      : { x: window.innerWidth / 2, y: 0 }

    const started = runStarThemeTransition({
      to: next,
      origin,
      classNames: { snapshot: styles.snapshot, canvas: styles.canvas },
      applyTheme: (value) => {
        saveTheme(value)
        setTheme(value)
        // Кнопка снова доступна, как только тема сменилась; хвост анимации ей не мешает.
        setBusy(false)
      },
    })
    if (started) setBusy(true)
  }

  const label = theme === 'dark' ? msg().ui.themeLight : msg().ui.themeDark

  return (
    <button
      ref={buttonRef}
      type="button"
      className={[styles.toggle, className].filter(Boolean).join(' ')}
      onClick={handleToggle}
      aria-label={label}
      aria-busy={busy}
      title={label}
    >
      <span className="material-symbols-outlined" aria-hidden="true">
        {theme === 'dark' ? 'light_mode' : 'dark_mode'}
      </span>
    </button>
  )
}
