/** Склеивает имена классов, пропуская пустые: `cn(styles.btn, active && styles.active)`. */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ')
}
