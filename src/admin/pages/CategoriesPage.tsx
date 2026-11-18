import { useMemo, useState } from 'react'
import { listCategories } from '../../api'
import { SPEC_FIELD_TYPE_LABELS } from '../../config/labels'
import type { Category } from '../../types'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import { useApiQuery } from '../../hooks/useApiQuery'
import { CategoryEditor } from '../components/CategoryEditor'
import { msg } from '../../i18n'
import styles from './CategoriesPage.module.css'

export function CategoriesPage() {
  const t = msg().adminCategories
  const { data, reload } = useApiQuery(() => listCategories({ onlyActive: false }), [], ['categories'])
  const [editingCategory, setEditingCategory] = useState<Category | null | 'new'>(null)
  const categories = useMemo(() => data ?? [], [data])

  const summary = useMemo(
    () => ({
      total: categories.length,
      active: categories.filter((category) => category.isActive).length,
    }),
    [categories],
  )

  if (data === undefined) {
    return (
      <div className={styles.page}>
        <div className={styles.loader}><Spinner /></div>
      </div>
    )
  }

  const handleOpenEditor = (category: Category | 'new') => {
    setEditingCategory(category)
  }

  const handleCloseEditor = () => {
    setEditingCategory(null)
  }

  const handleSuccess = () => {
    setEditingCategory(null)
    reload()
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>{t.kicker}</p>
          <h1 className={styles.title}>{t.title}</h1>
        </div>
        <div className={styles.headerActions}>
          <div className={styles.summary}>
            <span>{t.activeCount(summary.active)}</span>
            <strong>{t.totalCount(summary.total)}</strong>
          </div>
          <Button variant="primary" icon="add" onClick={() => handleOpenEditor('new')}>
            {t.add}
          </Button>
        </div>
      </header>

      <div className={styles.grid}>
        {categories.map((category) => (
          <article key={category.id} className={styles.card}>
            <div className={styles.topRow}>
              <div>
                <p className={styles.slug}>/{category.slug}</p>
                <h2 className={styles.name}>{category.name}</h2>
              </div>
              <Badge tone={category.isActive ? 'success' : 'neutral'}>{category.isActive ? t.active : t.hidden}</Badge>
            </div>

            <div className={styles.meta}>
              <span>{t.sort(category.sortOrder)}</span>
              <span>{t.fieldsCount(category.specFields.length)}</span>
            </div>

            {category.specFields.length > 0 ? (
              <ul className={styles.list}>
                {category.specFields.slice(0, 4).map((field) => (
                  <li key={field.key}>
                    <span>{field.label}</span>
                    <em>{SPEC_FIELD_TYPE_LABELS[field.type]}</em>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.empty}>{t.noFields}</p>
            )}

            <div className={styles.cardActions}>
              <Button variant="ghost" size="sm" icon="edit" onClick={() => handleOpenEditor(category)}>
                {t.edit}
              </Button>
            </div>
          </article>
        ))}
      </div>

      {editingCategory !== null && (
        <CategoryEditor
          key={editingCategory === 'new' ? 'new' : editingCategory.id}
          category={editingCategory === 'new' ? null : editingCategory}
          onClose={handleCloseEditor}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  )
}

