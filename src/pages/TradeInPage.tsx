import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listProducts } from '../api'
import { TradeInForm } from '../components/tradein/TradeInForm'
import type { Product, TradeInRequest } from '../types'
import { formatPrice } from '../utils/format'
import styles from './TradeInPage.module.css'

export function TradeInPage() {
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
          <h1 className={styles.title}>Обменяйте старое устройство на новое</h1>
          <p className={styles.subtitle}>
            Быстро оценим вашу технику и поможем с доплатой. Условия простые: без предоплаты, без сложных формальностей.
          </p>
        </div>
        <Link to="/catalog" className={styles.backLink}>В каталог</Link>
      </header>

      <section className={styles.steps} aria-label="Как работает трейд-ин">
        <article className={styles.stepCard}>
          <span className="material-symbols-outlined" aria-hidden="true">photo_camera</span>
          <h2>1. Пришлите фото</h2>
          <p>Сфотографируйте устройство, укажите состояние и комплект.</p>
        </article>
        <article className={styles.stepCard}>
          <span className="material-symbols-outlined" aria-hidden="true">sell</span>
          <h2>2. Оценим</h2>
          <p>Менеджер назовёт цену выкупа и предложит подходящий вариант обмена.</p>
        </article>
        <article className={styles.stepCard}>
          <span className="material-symbols-outlined" aria-hidden="true">sync</span>
          <h2>3. Обменяйте</h2>
          <p>Сдадите старое устройство и доплатите разницу при получении.</p>
        </article>
      </section>

      <div className={styles.layout}>
        <section className={styles.infoCard}>
          <h2>На что можно обменять</h2>
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
              <span className={styles.previewLabel}>Выбрано для обмена</span>
              <strong>{selectedProduct.name}</strong>
              <span>{formatPrice(selectedProduct.price)}</span>
            </div>
          )}
        </section>

        <section className={styles.formCard}>
          {submittedTradeIn ? (
            <div className={styles.successState}>
              <span className="material-symbols-outlined" aria-hidden="true">check_circle</span>
              <h2>Заявка №{submittedTradeIn.number} принята</h2>
              <p>Мы проверим ваше устройство и свяжемся с вами для уточнения оценки.</p>
              <Link to="/catalog" className={styles.successLink}>Вернуться в каталог</Link>
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
