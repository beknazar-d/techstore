import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listCategories, listProducts } from '../api'
import { LinkButton } from '../components/ui/Button'
import { ProductGrid } from '../components/product/ProductGrid'
import { Spinner } from '../components/ui/Spinner'
import { getCategoryIcon } from '../utils/categoryIcon'
import type { Category, Product } from '../types'
import styles from './HomePage.module.css'

const FEATURES = [
  { icon: 'local_shipping', title: 'Доставка по Москве', text: 'Или самовывоз — как удобнее' },
  { icon: 'payments', title: 'Оплата при получении', text: 'Без предоплаты и онлайн-оплаты' },
  { icon: 'verified', title: 'Проверка устройств', text: 'Б/У — с указанием состояния и аккумулятора' },
  { icon: 'swap_horiz', title: 'Trade-in', text: 'Сдайте старое устройство в счёт нового' },
]

export function HomePage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [usedSmartphones, setUsedSmartphones] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    async function load() {
      try {
        // «Популярные» — только новые товары, Б/У идут своим блоком ниже, без повторов.
        const [categoryList, productList, usedList] = await Promise.all([
          listCategories({ onlyActive: true }),
          listProducts({ onlyActive: true, condition: 'new', limit: 8 }),
          listProducts({ onlyActive: true, condition: 'used', categorySlug: 'smartfony', limit: 4 }),
        ])

        if (!isMounted) return
        setCategories(categoryList)
        setProducts(productList)
        setUsedSmartphones(usedList)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    void load()
    return () => {
      isMounted = false
    }
  }, [])

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
            Смартфоны, ноутбуки, аксессуары и техника для дома — всё в наличии, оплата при получении.
          </p>
          <div className={styles.actions}>
            <LinkButton to="/catalog" icon="grid_view">В каталог</LinkButton>
            <LinkButton to="/trade-in" variant="secondary" icon="swap_horiz">Обменять старый</LinkButton>
          </div>
        </div>
        <div className={styles.heroCard}>
          <p className={styles.heroLabel}>Почему у нас</p>
          <ul className={styles.featureList}>
            {FEATURES.map((feature) => (
              <li key={feature.title} className={styles.feature}>
                <span className={styles.featureIcon} aria-hidden="true">
                  <span className="material-symbols-outlined">{feature.icon}</span>
                </span>
                <span>
                  <span className={styles.featureTitle}>{feature.title}</span>
                  <span className={styles.featureText}>{feature.text}</span>
                </span>
              </li>
            ))}
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
