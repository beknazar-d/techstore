import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { listCategories, listProducts } from '../api'
import { Button, LinkButton } from '../components/ui/Button'
import { ProductGrid } from '../components/product/ProductGrid'
import { Spinner } from '../components/ui/Spinner'
import { getCategoryIcon } from '../utils/categoryIcon'
import type { Category, Product } from '../types'
import styles from './HomePage.module.css'

export function HomePage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    async function load() {
      try {
        const [categoryList, productList] = await Promise.all([
          listCategories({ onlyActive: true }),
          listProducts({ onlyActive: true, limit: 8 }),
        ])

        if (!isMounted) return
        setCategories(categoryList)
        setProducts(productList)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    void load()
    return () => {
      isMounted = false
    }
  }, [])

  const usedSmartphones = useMemo(() => {
    const smartphoneCategory = categories.find((category) => category.slug === 'smartfony')
    return products.filter(
      (product) => product.condition === 'used' && smartphoneCategory && product.categoryId === smartphoneCategory.id,
    )
  }, [categories, products])

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
      <section className={styles.hero}>
        <div className={styles.heroIntro}>
          <span className={styles.badge}>
            <span className={styles.dot} />
            Новые поступления
          </span>
          <h1 className={styles.title}>Гаджеты и техника для каждого дня</h1>
          <p className={styles.lead}>
            Выбирайте смартфоны, ноутбуки, аксессуары и техники для дома — всё в наличии, оплата при получении.
          </p>
          <div className={styles.actions}>
            <LinkButton to="/catalog" icon="grid_view">В каталог</LinkButton>
            <Button variant="secondary" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>К подборке</Button>
          </div>
        </div>
        <div className={styles.heroCard}>
          <p className={styles.heroLabel}>Проверка и гарантия</p>
          <h2>Быстрая доставка по Москве</h2>
          <ul className={styles.featureList}>
            <li>На складе 7 категорий товара</li>
            <li>Проверка каждого устройства</li>
            <li>Обмен старого устройства на новое</li>
          </ul>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2>Категории</h2>
          <Link to="/catalog" className={styles.sectionLink}>Смотреть всё</Link>
        </div>

        <div className={styles.categoryGrid}>
          {categories.map((category) => (
            <Link key={category.id} to={`/catalog/${category.slug}`} className={styles.categoryCard}>
              <span className={styles.categoryIcon} aria-hidden="true">
                <span className="material-symbols-outlined">{getCategoryIcon(category.slug)}</span>
              </span>
              <span className={styles.categoryName}>{category.name}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2>Популярные товары</h2>
          <Link to="/catalog" className={styles.sectionLink}>Все товары</Link>
        </div>
        <ProductGrid products={products} />
      </section>

      {usedSmartphones.length > 0 && (
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2>Б/У смартфоны</h2>
            <Link to="/catalog/smartfony?condition=used" className={styles.sectionLink}>Все предложения</Link>
          </div>
          <ProductGrid products={usedSmartphones.slice(0, 4)} />
        </section>
      )}
    </main>
  )
}
