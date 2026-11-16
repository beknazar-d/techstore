import { useState } from 'react'
import { createCategory, updateCategory, deleteCategory, getErrorMessage } from '../../api'
import type { Category, SpecField } from '../../types'
import { SpecFieldsEditor } from './SpecFieldsEditor'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Checkbox } from '../../components/ui/Checkbox'
import { Modal } from '../../components/ui/Modal'
import styles from './CategoryEditor.module.css'

interface CategoryEditorProps {
  category: Category | null
  onClose: () => void
  onSuccess: () => void
}

const initialFields: SpecField[] = []

export function CategoryEditor({ category, onClose, onSuccess }: CategoryEditorProps) {
  const isNew = category === null

  // Инициализация state напрямую из props — компонент пересоздаётся при смене key
  const [name, setName] = useState(category?.name ?? '')
  const [slug, setSlug] = useState(category?.slug ?? '')
  const [sortOrder, setSortOrder] = useState(category?.sortOrder ?? 0)
  const [isActive, setIsActive] = useState(category?.isActive ?? true)
  const [specFields, setSpecFields] = useState<SpecField[]>(category?.specFields.map((f) => ({ ...f })) ?? initialFields)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  async function handleSave() {
    if (!name.trim()) {
      setError('Укажите название категории')
      return
    }

    setSaving(true)
    setError('')

    try {
      const input = {
        name: name.trim(),
        slug: slug.trim() || undefined,
        sortOrder,
        isActive,
        specFields,
      }

      if (isNew) {
        await createCategory(input)
      } else {
        await updateCategory(category!.id, input)
      }
      onSuccess()
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!category) return

    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }

    setDeleting(true)
    setError('')

    try {
      await deleteCategory(category.id)
      onSuccess()
    } catch (err) {
      setError(getErrorMessage(err))
      setConfirmDelete(false)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Modal
      open={true}
      onClose={onClose}
      title={isNew ? 'Новая категория' : `Редактирование: ${category?.name}`}
      size="lg"
      closeOnOverlay={!saving && !deleting}
    >
      <form className={styles.form} onSubmit={(e) => e.preventDefault()}>
        <div className={styles.fieldRow}>
          <Input
            label="Название *"
            placeholder="Например, Смартфоны"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            disabled={saving || deleting}
          />
          <Input
            label="Slug"
            placeholder="если пусто — создаётся из названия"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            disabled={saving || deleting}
          />
        </div>

        <div className={styles.fieldRow}>
          <Input
            type="number"
            label="Порядок сортировки"
            placeholder="0"
            value={sortOrder}
            onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)}
            min={0}
            disabled={saving || deleting}
          />
          <div className={styles.checkboxWrapper}>
            <Checkbox
              label="Показывать на сайте"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              disabled={saving || deleting}
            />
          </div>
        </div>

        <SpecFieldsEditor value={specFields} onChange={setSpecFields} disabled={saving || deleting} />

        {error && <p className={styles.error} role="alert">{error}</p>}

        <div className={styles.actions}>
          <Button variant="ghost" onClick={onClose} disabled={saving || deleting}>
            Отмена
          </Button>
          {category && !confirmDelete && (
            <Button variant="danger" onClick={handleDelete} disabled={saving}>
              Удалить категорию
            </Button>
          )}
          {category && confirmDelete && (
            <>
              <p className={styles.confirmText}>
                Удалить «{category.name}»? Это действие нельзя отменить.
              </p>
              <Button variant="danger" onClick={handleDelete} loading={deleting}>
                Да, удалить
              </Button>
              <Button variant="ghost" onClick={() => setConfirmDelete(false)} disabled={deleting}>
                Нет, оставить
              </Button>
            </>
          )}
          <Button variant="primary" onClick={handleSave} loading={saving} fullWidth>
            {isNew ? 'Создать' : 'Сохранить'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}