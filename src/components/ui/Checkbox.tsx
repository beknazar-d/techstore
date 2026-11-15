import type { ComponentProps } from 'react'
import { cn } from '../../utils/cn'
import styles from './Checkbox.module.css'

export interface CheckboxProps extends Omit<ComponentProps<'input'>, 'type'> {
  label: string
}

export function Checkbox({ label, className, disabled, ...rest }: CheckboxProps) {
  return (
    <label className={cn(styles.label, disabled && styles.disabled, className)}>
      <input
        type="checkbox"
        disabled={disabled}
        className={styles.input}
        {...rest}
      />
      <span className={styles.text}>{label}</span>
    </label>
  )
}