import { useEffect, useRef, useState } from 'react'
import styles from './ThemeToggle.module.css'

type ThemeMode = 'light' | 'dark'

function getPreferredTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'light'

  const saved = window.localStorage.getItem('theme')
  if (saved === 'light' || saved === 'dark') return saved

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function ThemeToggle({ className }: { className?: string }) {
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const [theme, setTheme] = useState<ThemeMode>(() => getPreferredTheme())
  const [burstMode, setBurstMode] = useState<ThemeMode | null>(null)
  const [isBursting, setIsBursting] = useState(false)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('theme', theme)
    }
  }, [theme])

  function handleToggle() {
    const nextTheme: ThemeMode = theme === 'dark' ? 'light' : 'dark'
    const rect = buttonRef.current?.getBoundingClientRect()

    if (rect) {
      const x = rect.left + rect.width / 2
      const y = rect.top + rect.height / 2
      document.documentElement.style.setProperty('--theme-burst-x', `${x}px`)
      document.documentElement.style.setProperty('--theme-burst-y', `${y}px`)
    }

    document.documentElement.style.setProperty('--theme-burst-center-x', `${window.innerWidth / 2}px`)
    document.documentElement.style.setProperty('--theme-burst-center-y', `${window.innerHeight / 2}px`)

    setBurstMode(nextTheme)
    setIsBursting(true)

    window.setTimeout(() => {
      setTheme(nextTheme)
    }, 900)

    window.setTimeout(() => {
      setIsBursting(false)
      setBurstMode(null)
    }, 2200)
  }

  return (
    <>
      <div
        className={[styles.themeBurst, isBursting ? styles.active : '', burstMode ? styles[burstMode] : '']
          .filter(Boolean)
          .join(' ')}
        aria-hidden="true"
      >
        <span className={styles.spark} />
      </div>
      <div
        className={[styles.themeReveal, isBursting ? styles.revealActive : '', burstMode ? styles[burstMode] : '']
          .filter(Boolean)
          .join(' ')}
        aria-hidden="true"
      />
      <button
        ref={buttonRef}
        type="button"
        className={[styles.toggle, className].filter(Boolean).join(' ')}
        onClick={handleToggle}
        aria-label={theme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему'}
        title={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
      >
        <span className="material-symbols-outlined" aria-hidden="true">
          {theme === 'dark' ? 'light_mode' : 'dark_mode'}
        </span>
      </button>
    </>
  )
}
