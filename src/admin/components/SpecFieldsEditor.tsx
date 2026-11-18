import type { SpecField, SpecFieldType } from '../../types'
import { SPEC_FIELD_TYPE_LABELS } from '../../config/labels'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { Textarea } from '../../components/ui/Textarea'
import { msg } from '../../i18n'
import styles from './SpecFieldsEditor.module.css'

interface SpecFieldsEditorProps {
  value: SpecField[]
  onChange: (fields: SpecField[]) => void
  disabled?: boolean
}

function getTypeOptions() {
  return (Object.keys(SPEC_FIELD_TYPE_LABELS) as SpecFieldType[]).map((type) => ({
    value: type,
    label: SPEC_FIELD_TYPE_LABELS[type],
  }))
}

export function SpecFieldsEditor({ value, onChange, disabled = false }: SpecFieldsEditorProps) {
  const t = msg().adminCategories
  function replaceAt(index: number, field: SpecField) {
    onChange(value.map((item, i) => (i === index ? field : { ...item })))
  }

  function changeLabel(index: number, label: string) {
    replaceAt(index, { ...value[index], label })
  }

  function changeUnit(index: number, unit: string) {
    const rest: SpecField = { ...value[index] }
    delete rest.unit
    replaceAt(index, unit === '' ? rest : { ...rest, unit })
  }

  function changeOptions(index: number, text: string) {
    replaceAt(index, { ...value[index], options: text.split('\n') })
  }

  function changeType(index: number, type: SpecFieldType) {
    const current = value[index]
    const next: SpecField = { ...current, type }
    if (type === 'select') {
      next.options = current.options ?? []
    } else {
      delete next.options
    }
    if (type === 'select' || type === 'boolean') delete next.unit
    replaceAt(index, next)
  }

  function move(index: number, delta: -1 | 1) {
    const target = index + delta
    if (target < 0 || target >= value.length) return
    const copy = value.map((item) => ({ ...item }))
    const [item] = copy.splice(index, 1)
    copy.splice(target, 0, item)
    onChange(copy)
  }

  function remove(index: number) {
    onChange(value.filter((_, i) => i !== index).map((item) => ({ ...item })))
  }

  function add() {
    onChange([...value.map((item) => ({ ...item })), { key: '', label: '', type: 'text' }])
  }

  return (
    <div className={styles.editor}>
      {value.length === 0 ? (
        <p className={styles.empty}>{t.noSpecs}</p>
      ) : (
        <ul className={styles.list}>
          {value.map((field, index) => {
            const showUnit = field.type === 'text' || field.type === 'number'
            return (
              <li key={index} className={styles.row}>
                <div className={styles.fields}>
                  <Input
                    label={t.specName}
                    placeholder={t.specNamePlaceholder}
                    value={field.label}
                    disabled={disabled}
                    onChange={(e) => changeLabel(index, e.target.value)}
                  />
                  <Select
                    label={t.specType}
                    value={field.type}
                    options={getTypeOptions()}
                    disabled={disabled}
                    onChange={(e) => changeType(index, e.target.value as SpecFieldType)}
                  />
                  {showUnit ? (
                    <Input
                      label={t.unit}
                      placeholder={t.unitPlaceholder}
                      value={field.unit ?? ''}
                      disabled={disabled}
                      onChange={(e) => changeUnit(index, e.target.value)}
                    />
                  ) : (
                    <div className={styles.unitPlaceholder} aria-hidden="true" />
                  )}
                  <div className={styles.actions}>
                    <Button
                      variant="secondary"
                      size="sm"
                      icon="arrow_upward"
                      aria-label={t.moveUp}
                      disabled={disabled || index === 0}
                      onClick={() => move(index, -1)}
                    />
                    <Button
                      variant="secondary"
                      size="sm"
                      icon="arrow_downward"
                      aria-label={t.moveDown}
                      disabled={disabled || index === value.length - 1}
                      onClick={() => move(index, 1)}
                    />
                    <Button
                      variant="danger"
                      size="sm"
                      icon="delete"
                      aria-label={t.remove}
                      disabled={disabled}
                      onClick={() => remove(index)}
                    />
                  </div>
                </div>
                {field.type === 'select' && (
                  <Textarea
                    label={t.options}
                    rows={3}
                    hint={t.optionsHint}
                    value={(field.options ?? []).join('\n')}
                    disabled={disabled}
                    onChange={(e) => changeOptions(index, e.target.value)}
                  />
                )}
                <p className={styles.keyInfo}>
                  {field.key ? t.key(field.key) : t.keyLater}
                </p>
              </li>
            )
          })}
        </ul>
      )}
      <Button variant="secondary" icon="add" disabled={disabled} onClick={add}>
        {t.addSpec}
      </Button>
    </div>
  )
}
