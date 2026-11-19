import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { listCategories, listProducts } from '../../api'
import { ProductImage } from '../../components/ui/ProductImage'
import { Select } from '../../components/ui/Select'
import { Spinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'
import { ToneBadge } from '../../components/ui/StatusBadge'
import { useApiQuery } from '../../hooks/useApiQuery'
import { formatPrice } from '../../utils/format'
import { discountPercent } from '../../utils/discount'
import { shop } from '../../config/shop'
import type { Tone } from '../../config/tones'
import { msg } from '../../i18n'
import styles from './ProductsPage.module.css'

function stockTone(stock: number): Tone {
  if (stock <= 0) return 'red'
  if (stock <= shop.lowStockThreshold) return 'amber'
  return 'green'
}

export function ProductsPage() {
  const t = msg().adminProducts
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const { data: products, loading: productsLoading } = useApiQuery(
    () => listProducts({ onlyActive: false, search }),
    [search],
    ['products'],
  )
  const { data: categories = [] } = useApiQuery(() => listCategories({ onlyActive: false }), [], ['categories'])

  const categoryMap = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories])
  const filtered = useMemo(
    () => (products ?? []).filter((product) => !categoryId || product.categoryId === categoryId),
    [products, categoryId],
  )

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.titleRow}>
          <div>
            <p className={styles.kicker}>{t.kicker}</p>
            <h1 className={styles.title}>{t.title}</h1>
          </div>
          <Link to="/admin/products/new" className={styles.primaryAction}>
            <span className="material-symbols-outlined" aria-hidden="true">add</span>
            <span>{t.newProductShort}</span>
          </Link>
        </div>
        {/* На телефоне «Категорий» и «Акций» нет в нижней панели — попадают туда отсюда. */}
        <nav className={styles.links} aria-label={t.sectionsAria}>
          <Link to="/admin/categories" className={styles.linkChip}>
            <span className="material-symbols-outlined" aria-hidden="true">category</span>
            {t.categories}
          </Link>
          <Link to="/admin/banners" className={styles.linkChip}>
            <span className="material-symbols-outlined" aria-hidden="true">campaign</span>
            {t.banners}
          </Link>
        </nav>
      </header>

      <div className={styles.toolbar}>
        <label className={styles.search}>
          <span className="material-symbols-outlined" aria-hidden="true">search</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t.searchPlaceholder}
            aria-label={t.searchAria}
          />
        </label>
        <Select
          className={styles.category}
          aria-label={t.category}
          value={categoryId}
          onChange={(event) => setCategoryId(event.target.value)}
          options={[{ value: '', label: t.allCategories }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
        />
      </div>

      {products === undefined && productsLoading ? (
        <div className={styles.loader}><Spinner /></div>
      ) : filtered.length === 0 ? (
        <EmptyState icon="inventory_2" title={t.noProducts} />
      ) : (
        <>
          <p className={styles.count}>{t.found(filtered.length)}</p>
          <ul className={styles.list}>
            {filtered.map((product) => {
              const category = categoryMap.get(product.categoryId)
              const percent = discountPercent(product)
              return (
                <li key={product.id}>
                  <Link to={`/admin/products/${product.id}`} className={styles.row} data-hidden={!product.isActive}>
                    <ProductImage src={product.images[0]} alt="" className={styles.thumb} />
                    <span className={styles.info}>
                      <span className={styles.name}>{product.name}</span>
                      <span className={styles.meta}>
                        {[product.brand || t.noBrand, category?.name ?? t.categoryDeleted].join(' · ')}
                        {product.condition === 'used' && <span className={styles.used}>{t.conditionUsed}</span>}
                      </span>
                      <span className={styles.badges}>
                        <ToneBadge tone={stockTone(product.stock)}>{t.stockShort(product.stock)}</ToneBadge>
                        {!product.isActive && <ToneBadge tone="gray">{t.hidden}</ToneBadge>}
                        {percent !== null && <ToneBadge tone="red">{`−${percent}%`}</ToneBadge>}
                      </span>
                    </span>
                    <span className={styles.price}>{formatPrice(product.price)}</span>
                    <span className={styles.chevron} aria-hidden="true">
                      <span className="material-symbols-outlined">chevron_right</span>
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}
