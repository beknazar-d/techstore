import { LANGS, setLang, useLang, useT } from '../../i18n'
import { cn } from '../../utils/cn'
import styles from './LanguageSwitcher.module.css'

/** Переключатель РУ / КЫ. Выбор запоминается в браузере. */
export function LanguageSwitcher({ className }: { className?: string }) {
  const lang = useLang()
  const t = useT()
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
