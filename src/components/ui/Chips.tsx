import { cn } from '../../utils/cn'
import styles from './Chips.module.css'

interface ChipOption<T extends string> {
  value: T
  label: string
  count?: number
}

interface ChipsProps<T extends string> {
  options: ChipOption<T>[]
  value: T
  onChange: (value: T) => void
  ariaLabel: string
  className?: string
}

export function Chips<T extends string>({ options, value, onChange, ariaLabel, className }: ChipsProps<T>) {
  return (
    <div role="group" aria-label={ariaLabel} className={cn(styles.chips, className)}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={styles.chip}
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
          {option.count !== undefined && <span className={styles.count}>{option.count}</span>}
        </button>
      ))}
    </div>
  )
}
