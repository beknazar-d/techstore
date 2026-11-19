import { toneClass, type Tone } from '../../config/tones'
import { cn } from '../../utils/cn'
import styles from './ToneFilters.module.css'

export interface ToneFilterOption<T extends string> {
  value: T
  label: string
  tone: Tone
  /** Число на кнопке (например, сколько чатов в этом режиме). */
  count?: number
}

interface ToneFiltersProps<T extends string> {
  options: ToneFilterOption<T>[]
  value: T
  onChange: (value: T) => void
  ariaLabel: string
}

/** Фильтры-кнопки, у каждой свой цвет (цвет статуса). Выбранная — залита цветом. */
export function ToneFilters<T extends string>({ options, value, onChange, ariaLabel }: ToneFiltersProps<T>) {
  return (
    <div className={styles.filters} role="group" aria-label={ariaLabel}>
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            className={cn(styles.filter, toneClass(option.tone), active && styles.active)}
            aria-pressed={active}
            onClick={() => onChange(option.value)}
          >
            <span className={styles.dot} aria-hidden="true" />
            {option.label}
            {option.count !== undefined && <span className={styles.count}>{option.count}</span>}
          </button>
        )
      })}
    </div>
  )
}
