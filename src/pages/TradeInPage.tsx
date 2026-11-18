import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listProducts } from '../api'
import { TradeInForm } from '../components/tradein/TradeInForm'
import type { Product, TradeInRequest } from '../types'
import { formatPrice } from '../utils/format'
import { useT } from '../i18n'
import styles from './TradeInPage.module.css'

export function TradeInPage() {
  const t = useT().tradeIn
  const [popularProducts, setPopularProducts] = useState<Product[]>([])
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null)
  const [submittedTradeIn, setSubmittedTradeIn] = useState<TradeInRequest | null>(null)

  useEffect(() => {
    let isMounted = true

    async function load() {
      const products = await listProducts({ onlyActive: true, limit: 4 })
      if (isMounted) setPopularProducts(products)
    }

    void load()
    return () => {
      isMounted = false
    }
  }, [])

  const selectedProduct = popularProducts.find((product) => product.id === selectedProductId) ?? null

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>Trade-in</p>
          <h1 className={styles.title}>{t.title}</h1>
          <p className={styles.subtitle}>
            {t.lead}
          </p>
        </div>
        <Link to="/catalog" className={styles.backLink}>{t.toCatalog}</Link>
      </header>

      <section className={styles.steps} aria-label={t.stepsAria}>
        <article className={styles.stepCard}>
          <span className="material-symbols-outlined" aria-hidden="true">photo_camera</span>
          <h2>{t.step1Title}</h2>
          <p>{t.step1Text}</p>
        </article>
        <article className={styles.stepCard}>
          <span className="material-symbols-outlined" aria-hidden="true">sell</span>
          <h2>{t.step2Title}</h2>
          <p>{t.step2Text}</p>
        </article>
        <article className={styles.stepCard}>
          <span className="material-symbols-outlined" aria-hidden="true">sync</span>
          <h2>{t.step3Title}</h2>
          <p>{t.step3Text}</p>
        </article>
      </section>

      <div className={styles.layout}>
        <section className={styles.infoCard}>
          <h2>{t.whatFor}</h2>
          <div className={styles.productList}>
            {popularProducts.map((product) => (
              <button
                key={product.id}
                type="button"
                className={styles.productChoice}
                data-active={selectedProductId === product.id}
                onClick={() => setSelectedProductId((current) => current === product.id ? null : product.id)}
              >
                <span className={styles.productName}>{product.name}</span>
                <span className={styles.productPrice}>{formatPrice(product.price)}</span>
              </button>
            ))}
          </div>
          {selectedProduct && (
            <div className={styles.preview}>
              <span className={styles.previewLabel}>{t.selected}</span>
              <strong>{selectedProduct.name}</strong>
              <span>{formatPrice(selectedProduct.price)}</span>
            </div>
          )}
        </section>

        <section className={styles.formCard}>
          {submittedTradeIn ? (
            <div className={styles.successState}>
              <span className="material-symbols-outlined" aria-hidden="true">check_circle</span>
              <h2>{t.accepted(submittedTradeIn.number)}</h2>
              <p>{t.acceptedText}</p>
              <Link to="/catalog" className={styles.successLink}>{t.backToCatalog}</Link>
            </div>
          ) : (
            <TradeInForm
              desiredProduct={selectedProduct}
              onClearDesiredProduct={() => setSelectedProductId(null)}
              onSuccess={(tradeIn) => setSubmittedTradeIn(tradeIn)}
            />
          )}
        </section>
      </div>
    </main>
  )
}
