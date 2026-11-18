import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { listCategories, listProducts } from '../../api'
import { Badge } from '../../components/ui/Badge'
import { Spinner } from '../../components/ui/Spinner'
import { useApiQuery } from '../../hooks/useApiQuery'
import { formatPrice } from '../../utils/format'
import { msg } from '../../i18n'
import styles from './ProductsPage.module.css'

export function ProductsPage() {
  const t = msg().adminProducts
  const [search, setSearch] = useState('')
  const { data: products = [], loading: productsLoading } = useApiQuery(() => listProducts({ onlyActive: false, search }), [search], ['products'])
  const { data: categories = [] } = useApiQuery(() => listCategories({ onlyActive: false }), [], ['categories'])

  const categoryMap = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories])

  const filtered = products.filter((product) => {
    if (!search.trim()) return true
    const text = `${product.name} ${product.brand}`.toLowerCase()
    return text.includes(search.trim().toLowerCase())
  })

  if (productsLoading) {
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
          <p className={styles.kicker}>{t.kicker}</p>
          <h1 className={styles.title}>{t.title}</h1>
        </div>
        <div className={styles.headerActions}>
          {/* На телефоне «Категорий» нет в нижней панели — попадают сюда отсюда. */}
          <Link to="/admin/categories" className={styles.secondaryAction}>{t.categories}</Link>
          <Link to="/admin/products/new" className={styles.primaryAction}>{t.newProduct}</Link>
        </div>
      </header>

      <div className={styles.toolbar}>
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className={styles.search}
          placeholder={t.searchPlaceholder}
          aria-label={t.searchAria}
        />
      </div>

      <div className={styles.list}>
        {filtered.map((product) => {
          const category = categoryMap.get(product.categoryId)
          return (
            <article key={product.id} className={styles.card}>
              <div className={styles.top}>
                <div>
                  <p className={styles.brand}>{product.brand || t.noBrand}</p>
                  <h2 className={styles.name}>{product.name}</h2>
                </div>
                <Badge tone={product.isActive ? 'success' : 'neutral'}>{product.isActive ? t.active : t.hidden}</Badge>
              </div>

              <div className={styles.meta}>
                <span>{category?.name ?? t.categoryDeleted}</span>
                <span>{t.stockLeft(product.stock)}</span>
              </div>

              <div className={styles.meta}>
                <span>{product.condition === 'new' ? t.conditionNew : t.conditionUsed}</span>
                <strong>{formatPrice(product.price)}</strong>
              </div>

              <Link to={`/admin/products/${product.id}`} className={styles.link}>{t.edit}</Link>
            </article>
          )
        })}
      </div>
    </div>
  )
}

