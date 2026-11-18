import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { compressImage } from '../../utils/compressImage'
import { cn } from '../../utils/cn'
import { msg } from '../../i18n'
import styles from './ImagePicker.module.css'

interface ImagePickerProps {
  value: string[]
  onChange: (images: string[]) => void
  max?: number
  label?: string
  hint?: string
  markFirst?: boolean
  disabled?: boolean
}

export function ImagePicker({
  value,
  onChange,
  max = 5,
  label,
  hint,
  markFirst,
  disabled,
}: ImagePickerProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  async function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const input = event.target
    const files = Array.from(input.files ?? [])
    input.value = ''
    setError(null)
    if (files.length === 0) return

    const free = Math.max(0, max - value.length)
    const accepted = files.slice(0, free)
    let message: string | null = files.length > free ? msg().ui.photosLimit(max) : null

    setBusy(true)
    const added: string[] = []
    for (const file of accepted) {
      try {
        added.push(await compressImage(file))
      } catch (e) {
        message = e instanceof Error ? e.message : msg().ui.photoFailed
      }
    }
    if (!mountedRef.current) return
    setBusy(false)
    setError(message)
    if (added.length > 0) onChange([...value, ...added])
  }

  function remove(index: number) {
    onChange(value.filter((_, i) => i !== index))
  }

  function move(index: number, delta: -1 | 1) {
    const target = index + delta
    if (target < 0 || target >= value.length) return
    const next = [...value]
    const moved = next[index]
    next[index] = next[target]
    next[target] = moved
    onChange(next)
  }

  const canAdd = value.length < max

  return (
    <div className={styles.picker}>
      <div className={styles.header}>
        {label && <span className={styles.label}>{label}</span>}
        <span className={styles.counter}>
          {value.length} / {max}
        </span>
      </div>

      <div className={styles.grid}>
        {value.map((src, index) => (
          <div key={`${index}-${src.slice(-24)}`} className={styles.tile}>
            <img className={styles.img} src={src} alt={msg().ui.photoAlt(index + 1)} />
            {markFirst && index === 0 && <span className={styles.mark}>{msg().ui.photoMain}</span>}
            <button
              type="button"
              className={cn(styles.iconButton, styles.remove)}
              aria-label={msg().ui.photoRemove(index + 1)}
              disabled={disabled}
              onClick={() => remove(index)}
            >
              <span className={cn('material-symbols-outlined', styles.buttonIcon)} aria-hidden="true">
                close
              </span>
            </button>
            {value.length > 1 && index > 0 && (
              <button
                type="button"
                className={cn(styles.iconButton, styles.left)}
                aria-label={msg().ui.photoLeft(index + 1)}
                disabled={disabled}
                onClick={() => move(index, -1)}
              >
                <span className={cn('material-symbols-outlined', styles.buttonIcon)} aria-hidden="true">
                  chevron_left
                </span>
              </button>
            )}
            {value.length > 1 && index < value.length - 1 && (
              <button
                type="button"
                className={cn(styles.iconButton, styles.right)}
                aria-label={msg().ui.photoRight(index + 1)}
                disabled={disabled}
                onClick={() => move(index, 1)}
              >
                <span className={cn('material-symbols-outlined', styles.buttonIcon)} aria-hidden="true">
                  chevron_right
                </span>
              </button>
            )}
          </div>
        ))}

        {canAdd && (
          <label className={cn(styles.tile, styles.add, disabled && styles.disabled)}>
            {busy ? (
              <>
                <span className={styles.spinner} aria-hidden="true" />
                <span className={styles.addText}>{msg().ui.compressing}</span>
              </>
            ) : (
              <>
                <span className={cn('material-symbols-outlined', styles.addIcon)} aria-hidden="true">
                  add_a_photo
                </span>
                <span className={styles.addText}>{msg().ui.add}</span>
              </>
            )}
            <input
              className={styles.input}
              type="file"
              accept="image/*"
              multiple
              disabled={disabled || busy}
              onChange={handleFiles}
            />
          </label>
        )}
      </div>

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : (
        hint && <p className={styles.hint}>{hint}</p>
      )}
    </div>
  )
}
