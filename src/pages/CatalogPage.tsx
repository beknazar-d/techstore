import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { listCategories, listProducts } from '../api'
import { ProductGrid } from '../components/product/ProductGrid'
import { Chips } from '../components/ui/Chips'
import { EmptyState } from '../components/ui/EmptyState'
import { Spinner } from '../components/ui/Spinner'
import type { Category, Product } from '../types'
import styles from './CatalogPage.module.css'

type ConditionFilter = 'all' | 'new' | 'used'

const conditionOptions: Array<{ value: ConditionFilter; label: string }> = [
  { value: 'all', label: 'Все' },
  { value: 'new', label: 'Новые' },
  { value: 'used', label: 'Б/У' },
]

export function CatalogPage() {
  const { categorySlug } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  const currentCondition = useMemo<ConditionFilter>(() => {
    const value = searchParams.get('condition')
    if (value === 'new' || value === 'used') return value
    return 'all'
  }, [searchParams])

  const selectedCategory = useMemo(
    () => categories.find((category) => category.slug === categorySlug) ?? null,
    [categories, categorySlug],
  )

  useEffect(() => {
    let isMounted = true

    async function load() {
      try {
        const [categoryList, productList] = await Promise.all([
          listCategories({ onlyActive: true }),
          listProducts({
            onlyActive: true,
            categorySlug: categorySlug ?? undefined,
            condition: currentCondition === 'all' ? undefined : currentCondition,
          }),
        ])

        if (!isMounted) return
        setCategories(categoryList)
        setProducts(productList)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    setLoading(true)
    void load()

    return () => {
      isMounted = false
    }
  }, [categorySlug, currentCondition])

  function changeCondition(next: ConditionFilter) {
    const nextParams = new URLSearchParams(searchParams)
    if (next === 'all') {
      nextParams.delete('condition')
    } else {
      nextParams.set('condition', next)
    }
    setSearchParams(nextParams)
  }

  const title = selectedCategory ? selectedCategory.name : 'Каталог товаров'
  const subtitle = selectedCategory
    ? 'Подберите технику по категориям и состоянию.'
    : 'Смартфоны, ноутбуки, аксессуары и техника для дома.'

  if (loading) {
    return (
      <main className={styles.page}>
        <div className={styles.loaderWrap}>
          <Spinner />
        </div>
      </main>
    )
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>Каталог</p>
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.subtitle}>{subtitle}</p>
        </div>
        <Link to="/" className={styles.backLink}>На главную</Link>
      </header>

      <section className={styles.filterBar}>
        <p className={styles.filterLabel}>Состояние</p>
        <Chips
          ariaLabel="Фильтр по состоянию товара"
          options={conditionOptions}
          value={currentCondition}
          onChange={changeCondition}
          className={styles.chips}
        />
      </section>

      <nav className={styles.categoryNav} aria-label="Категории товаров">
        <Link
          to="/catalog"
          className={styles.categoryLink}
          data-active={!categorySlug}
        >
          Все товары
        </Link>
        {categories.map((category) => (
          <Link
            key={category.id}
            to={`/catalog/${category.slug}`}
            className={styles.categoryLink}
            data-active={categorySlug === category.slug}
          >
            {category.name}
          </Link>
        ))}
      </nav>

      {products.length === 0 ? (
        <EmptyState
          icon="search_off"
          title="Товаров по фильтру не найдено"
          text="Попробуйте выбрать другую категорию или состояние товара."
          action={<Link to="/catalog" className={styles.emptyLink}>Показать всё</Link>}
        />
      ) : (
        <ProductGrid products={products} />
      )}
    </main>
  )
}
