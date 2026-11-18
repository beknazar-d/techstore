import { LANGS, setLang, useLang, useT } from '../../i18n'
import { cn } from '../../utils/cn'
import styles from './LanguageSwitcher.module.css'

interface LanguageSwitcherProps {
  className?: string
  /** Одна круглая кнопка (для узкой шапки на телефоне): показывает текущий язык, нажатие — следующий. */
  compact?: boolean
}

/** Переключатель РУ / КЫ. Выбор запоминается в браузере. */
export function LanguageSwitcher({ className, compact = false }: LanguageSwitcherProps) {
  const lang = useLang()
  const t = useT()

  if (compact) {
    const index = LANGS.findIndex((item) => item.value === lang)
    const current = LANGS[index] ?? LANGS[0]
    const next = LANGS[(index + 1) % LANGS.length]
    return (
      <button
        type="button"
        className={cn(styles.compact, className)}
        lang={current.value}
        aria-label={`${t.common.switchLanguage}: ${next.label}`}
        title={next.label}
        onClick={() => setLang(next.value)}
      >
        {current.short}
      </button>
    )
  }

  return (
    <div className={cn(styles.switcher, className)} role="group" aria-label={t.common.language}>
      {LANGS.map((item) => (
        <button
          key={item.value}
          type="button"
          lang={item.value}
          title={item.label}
          aria-pressed={lang === item.value}
          className={cn(styles.option, lang === item.value && styles.active)}
          onClick={() => setLang(item.value)}
        >
          {item.short}
        </button>
      ))}
    </div>
  )
}
