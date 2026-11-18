import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listActiveBanners, listCategories, listProducts } from '../api'
import { PromoBanners } from '../components/promo/PromoBanners'
import { LinkButton } from '../components/ui/Button'
import { ProductGrid } from '../components/product/ProductGrid'
import { Spinner } from '../components/ui/Spinner'
import { getCategoryIcon } from '../utils/categoryIcon'
import type { Category, Product, PromoBanner } from '../types'
import { useT } from '../i18n'
import styles from './HomePage.module.css'

export function HomePage() {
  const t = useT()
  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [usedSmartphones, setUsedSmartphones] = useState<Product[]>([])
  const [saleProducts, setSaleProducts] = useState<Product[]>([])
  const [banners, setBanners] = useState<PromoBanner[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    async function load() {
      try {
        // «Популярные» — только новые товары, Б/У идут своим блоком ниже, без повторов.
        // Баннеры и скидки — дополнение: если не загрузились, главная всё равно открывается.
        const [categoryList, productList, usedList, saleList, bannerList] = await Promise.all([
          listCategories({ onlyActive: true }),
          listProducts({ onlyActive: true, condition: 'new', limit: 8 }),
          listProducts({ onlyActive: true, condition: 'used', categorySlug: 'smartfony', limit: 4 }),
          listProducts({ onlyActive: true, onSale: true, limit: 8 }).catch(() => []),
          listActiveBanners().catch(() => []),
        ])

        if (!isMounted) return
        setCategories(categoryList)
        setProducts(productList)
        setUsedSmartphones(usedList)
        setSaleProducts(saleList)
        setBanners(bannerList)
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
      <PromoBanners banners={banners} />

      <section className={styles.hero}>
        <div className={styles.heroIntro}>
          <span className={styles.badge}>
            <span className={styles.dot} />
            {t.home.badge}
          </span>
          <h1 className={styles.title}>{t.home.title}</h1>
          <p className={styles.lead}>
            {t.home.lead}
          </p>
          <div className={styles.actions}>
            <LinkButton to="/catalog" icon="grid_view">{t.home.toCatalog}</LinkButton>
            <LinkButton to="/trade-in" variant="secondary" icon="swap_horiz">{t.home.tradeIn}</LinkButton>
          </div>
        </div>
        <div className={styles.heroCard}>
          <p className={styles.heroLabel}>{t.home.whyUs}</p>
          <ul className={styles.featureList}>
            {t.home.features.map((feature) => (
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
          <h2>{t.home.categories}</h2>
          <Link to="/catalog" className={styles.sectionLink}>{t.home.seeAll}</Link>
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

      {saleProducts.length > 0 && (
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2>{t.home.sales}</h2>
          </div>
          <ProductGrid products={saleProducts} />
        </section>
      )}

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2>{t.home.popular}</h2>
          <Link to="/catalog" className={styles.sectionLink}>{t.home.allProducts}</Link>
        </div>
        <ProductGrid products={products} />
      </section>

      {usedSmartphones.length > 0 && (
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2>{t.home.usedPhones}</h2>
            <Link to="/catalog/smartfony?condition=used" className={styles.sectionLink}>{t.home.allOffers}</Link>
          </div>
          <ProductGrid products={usedSmartphones.slice(0, 4)} />
        </section>
      )}
    </main>
  )
}
