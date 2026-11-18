import type { ProductSpecs, SpecField, SpecValue } from '../../types'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { msg } from '../../i18n'
import styles from './ProductSpecsFields.module.css'

interface ProductSpecsFieldsProps {
  fields: SpecField[]
  value: ProductSpecs
  onChange: (value: ProductSpecs) => void
  disabled?: boolean
}

function getBooleanOptions() {
  return [
    { value: 'yes', label: msg().common.yes },
    { value: 'no', label: msg().common.no },
  ]
}

export function ProductSpecsFields({ fields, value, onChange, disabled = false }: ProductSpecsFieldsProps) {
  function setValue(key: string, next: SpecValue | undefined) {
    const copy = { ...value }
    if (next === undefined || next === '') delete copy[key]
    else copy[key] = next
    onChange(copy)
  }

  if (fields.length === 0) {
    return (
      <p className={styles.empty}>
        {msg().adminProducts.noSpecs}
      </p>
    )
  }

  return (
    <div className={styles.grid}>
      {fields.map((field) => {
        const label = field.unit ? `${field.label}, ${field.unit}` : field.label
        const current = value[field.key]

        if (field.type === 'number') {
          return (
            <Input
              key={field.key}
              label={label}
              type="number"
              inputMode="decimal"
              step="any"
              value={typeof current === 'number' ? String(current) : ''}
              disabled={disabled}
              onChange={(e) => {
                const text = e.target.value
                if (text.trim() === '') {
                  setValue(field.key, undefined)
                  return
                }
                const num = Number(text)
                if (Number.isFinite(num)) setValue(field.key, num)
              }}
            />
          )
        }

        if (field.type === 'select') {
          const selected = typeof current === 'string' ? current : ''
          const variants = field.options ?? []
          const all = selected !== '' && !variants.includes(selected) ? [...variants, selected] : variants
          return (
            <Select
              key={field.key}
              label={label}
              placeholder={msg().adminProducts.notSet}
              options={all.map((o) => ({ value: o, label: o }))}
              value={selected}
              disabled={disabled}
              onChange={(e) => setValue(field.key, e.target.value)}
            />
          )
        }

        if (field.type === 'boolean') {
          return (
            <Select
              key={field.key}
              label={label}
              placeholder={msg().adminProducts.notSet}
              options={getBooleanOptions()}
              value={current === true ? 'yes' : current === false ? 'no' : ''}
              disabled={disabled}
              onChange={(e) => {
                const v = e.target.value
                setValue(field.key, v === 'yes' ? true : v === 'no' ? false : undefined)
              }}
            />
          )
        }

        return (
          <Input
            key={field.key}
            label={label}
            value={typeof current === 'string' ? current : ''}
            disabled={disabled}
            onChange={(e) => setValue(field.key, e.target.value)}
          />
        )
      })}
    </div>
  )
}
