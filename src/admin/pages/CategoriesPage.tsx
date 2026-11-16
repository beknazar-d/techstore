import { useMemo } from 'react'
import { listCategories } from '../../api'
import { Badge } from '../../components/ui/Badge'
import { Spinner } from '../../components/ui/Spinner'
import { useApiQuery } from '../../hooks/useApiQuery'
import styles from './CategoriesPage.module.css'

export function CategoriesPage() {
  const { data: categories = [], loading } = useApiQuery(() => listCategories({ onlyActive: false }), [], ['categories'])

  const summary = useMemo(
    () => ({
      total: categories.length,
      active: categories.filter((category) => category.isActive).length,
    }),
    [categories],
  )

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.loader}><Spinner /></div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>Категории</p>
          <h1 className={styles.title}>Шаблоны характеристик</h1>
        </div>
        <div className={styles.summary}>
          <span>{summary.active} активных</span>
          <strong>{summary.total} всего</strong>
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
              <Badge tone={category.isActive ? 'success' : 'neutral'}>{category.isActive ? 'Активна' : 'Скрыта'}</Badge>
            </div>

            <div className={styles.meta}>
              <span>Сорт: {category.sortOrder}</span>
              <span>{category.specFields.length} полей</span>
            </div>

            {category.specFields.length > 0 ? (
              <ul className={styles.list}>
                {category.specFields.slice(0, 4).map((field) => (
                  <li key={field.key}>
                    <span>{field.label}</span>
                    <em>{field.type}</em>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.empty}>Поля характеристик пока не добавлены</p>
            )}
          </article>
        ))}
      </div>
    </div>
  )
}

