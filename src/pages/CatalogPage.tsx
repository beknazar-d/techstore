import { useMemo } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { listCategories, listProducts } from '../api'
import { ProductGrid } from '../components/product/ProductGrid'
import { Button } from '../components/ui/Button'
import { Chips } from '../components/ui/Chips'
import { EmptyState } from '../components/ui/EmptyState'
import { Spinner } from '../components/ui/Spinner'
import { useApiQuery } from '../hooks/useApiQuery'
import { msg, useT } from '../i18n'
import styles from './CatalogPage.module.css'

type ConditionFilter = 'all' | 'new' | 'used'

function getConditionOptions(): Array<{ value: ConditionFilter; label: string }> {
  const t = msg().catalog
  return [
    { value: 'all', label: t.conditionAll },
    { value: 'new', label: t.conditionNew },
    { value: 'used', label: t.conditionUsed },
  ]
}

export function CatalogPage() {
  const t = useT()
  const { categorySlug } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const currentCondition = useMemo<ConditionFilter>(() => {
    const value = searchParams.get('condition')
    if (value === 'new' || value === 'used') return value
    return 'all'
  }, [searchParams])

  const categoriesQuery = useApiQuery(() => listCategories({ onlyActive: true }), [], ['categories'])
  const productsQuery = useApiQuery(
    () =>
      listProducts({
        onlyActive: true,
        categorySlug: categorySlug ?? undefined,
        condition: currentCondition === 'all' ? undefined : currentCondition,
      }),
    [categorySlug, currentCondition],
    ['products', 'categories'],
  )
  const categories = categoriesQuery.data
  const products = productsQuery.data
  const loadError = categoriesQuery.error ?? productsQuery.error
  const loading = categories === undefined || products === undefined

  const selectedCategory = useMemo(
    () => categories?.find((category) => category.slug === categorySlug) ?? null,
    [categories, categorySlug],
  )

  function changeCondition(next: ConditionFilter) {
    const nextParams = new URLSearchParams(searchParams)
    if (next === 'all') {
      nextParams.delete('condition')
    } else {
      nextParams.set('condition', next)
    }
    setSearchParams(nextParams)
  }

  const title = selectedCategory ? selectedCategory.name : t.catalog.title
  const subtitle = selectedCategory
    ? t.catalog.leadCategory
    : t.catalog.lead

  // Ошибка загрузки — показываем её, а не бесконечный спиннер.
  if (loading && loadError) {
    return (
      <main className={styles.page}>
        <EmptyState
          tone="error"
          icon="cloud_off"
          title={t.catalog.loadErrorTitle}
          text={t.catalog.loadErrorText}
          action={
            <Button
              type="button"
              variant="secondary"
              icon="refresh"
              onClick={() => {
                categoriesQuery.reload()
                productsQuery.reload()
              }}
            >
              {t.common.retry}
            </Button>
          }
        />
      </main>
    )
  }

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
          <p className={styles.kicker}>{t.catalog.kicker}</p>
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.subtitle}>{subtitle}</p>
        </div>
        <Link to="/" className={styles.backLink}>{t.catalog.toHome}</Link>
      </header>

      <section className={styles.filterBar}>
        <p className={styles.filterLabel}>{t.catalog.conditionLabel}</p>
        <Chips
          ariaLabel={t.catalog.conditionFilterAria}
          options={getConditionOptions()}
          value={currentCondition}
          onChange={changeCondition}
          className={styles.chips}
        />
      </section>

      <nav className={styles.categoryNav} aria-label={t.catalog.categoriesAria}>
        <Link
          to="/catalog"
          className={styles.categoryLink}
          data-active={!categorySlug}
        >
          {t.catalog.allProducts}
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
          title={t.catalog.emptyTitle}
          text={t.catalog.emptyText}
          action={<Link to="/catalog" className={styles.emptyLink}>{t.catalog.showAll}</Link>}
        />
      ) : (
        <ProductGrid products={products} />
      )}
    </main>
  )
}
