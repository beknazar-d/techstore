import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getCategory, getProductBySlug } from '../api'
import { OrderForm } from '../components/order/OrderForm'
import { Button, LinkButton } from '../components/ui/Button'
import { ConditionBadge } from '../components/ui/ConditionBadge'
import { Modal } from '../components/ui/Modal'
import { ProductImage } from '../components/ui/ProductImage'
import { Spinner } from '../components/ui/Spinner'
import { StockBadge } from '../components/ui/StockBadge'
import type { Category, Order, Product } from '../types'
import { formatPrice } from '../utils/format'
import styles from './ProductPage.module.css'

export function ProductPage() {
  const { slug } = useParams()
  const [product, setProduct] = useState<Product | null>(null)
  const [category, setCategory] = useState<Category | null>(null)
  const [loading, setLoading] = useState(true)
  const [showOrderModal, setShowOrderModal] = useState(false)
  const [submittedOrder, setSubmittedOrder] = useState<Order | null>(null)

  useEffect(() => {
    if (typeof slug !== 'string' || slug.trim() === '') {
      setProduct(null)
      setCategory(null)
      setLoading(false)
      return
    }

    const productSlug = slug
    let isMounted = true

    async function load() {
      try {
        const currentProduct = await getProductBySlug(productSlug)
        if (!isMounted) return

        if (!currentProduct) {
          setProduct(null)
          setCategory(null)
          return
        }

        setProduct(currentProduct)
        const currentCategory = await getCategory(currentProduct.categoryId)
        if (isMounted) {
          setCategory(currentCategory)
        }
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    setLoading(true)
    void load()

    return () => {
      isMounted = false
    }
  }, [slug])

  const specEntries = useMemo(() => {
    if (!product || !category) return []

    return category.specFields
      .map((field) => {
        const value = product.specs[field.key]
        if (value === undefined || value === null || value === '') return null

        const displayValue =
          typeof value === 'boolean'
            ? value
              ? 'Есть'
              : 'Нет'
            : typeof value === 'number' && field.unit
              ? `${value} ${field.unit}`
              : String(value)

        return {
          label: field.label,
          value: displayValue,
        }
      })
      .filter(Boolean) as Array<{ label: string; value: string }>
  }, [category, product])

  if (loading) {
    return (
      <main className={styles.page}>
        <div className={styles.loaderWrap}>
          <Spinner />
        </div>
      </main>
    )
  }

  if (!product) {
    return (
      <main className={styles.page}>
        <div className={styles.emptyWrap}>
          <h1 className={styles.title}>Товар не найден</h1>
          <p className={styles.emptyText}>Возможно, он был удалён или временно недоступен.</p>
          <LinkButton to="/catalog" icon="grid_view">Вернуться в каталог</LinkButton>
        </div>
      </main>
    )
  }

  const batteryHealth = product.usedInfo?.batteryHealth
  const usedInfo = product.usedInfo

  return (
    <main className={styles.page}>
      <Link to={category ? `/catalog/${category.slug}` : '/catalog'} className={styles.backLink}>
        ← Назад в каталог
      </Link>

      <article className={styles.productCard}>
        <div className={styles.gallery}>
          <div className={styles.mainImageWrap}>
            <ProductImage src={product.images[0]} alt={product.name} className={styles.mainImage} />
          </div>
          {product.images.length > 1 && (
            <div className={styles.thumbRow}>
              {product.images.map((image, index) => (
                <div key={`${image}-${index}`} className={styles.thumbWrap}>
                  <ProductImage src={image} alt={`${product.name} фото ${index + 1}`} className={styles.thumbImage} />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={styles.info}>
          <div className={styles.badges}>
            <StockBadge stock={product.stock} />
            <ConditionBadge condition={product.condition} grade={product.usedInfo?.grade} showNew />
          </div>

          {product.brand && <p className={styles.brand}>{product.brand}</p>}
          <h1 className={styles.title}>{product.name}</h1>
          <p className={styles.description}>{product.description}</p>

          <div className={styles.priceRow}>
            <p className={styles.price}>{formatPrice(product.price)}</p>
            <p className={styles.stockText}>{product.stock > 0 ? 'В наличии' : 'Нет в наличии'}</p>
          </div>

          <div className={styles.actions}>
            <Button type="button" onClick={() => setShowOrderModal(true)}>
              Заказать
            </Button>
            {product.condition === 'new' && (
              <LinkButton to="/trade-in" variant="secondary">Обменять старый</LinkButton>
            )}
          </div>

          {submittedOrder && (
            <div className={styles.successMessage} role="status">
              <span className="material-symbols-outlined" aria-hidden="true">check_circle</span>
              <div>
                <strong>Заявка №{submittedOrder.number} принята</strong>
                <p>Мы свяжемся с вами, чтобы подтвердить заказ.</p>
              </div>
            </div>
          )}

          {usedInfo && (
            <div className={styles.usedBlock}>
              {usedInfo.grade && <p>Состояние: {usedInfo.grade}</p>}
              {batteryHealth != null && <p>Аккумулятор: {batteryHealth}%</p>}
              {usedInfo.defects && <p>Дефекты: {usedInfo.defects}</p>}
              {usedInfo.kit && <p>Комплект: {usedInfo.kit}</p>}
              {usedInfo.warrantyMonths != null && <p>Гарантия: {usedInfo.warrantyMonths} мес.</p>}
            </div>
          )}
        </div>
      </article>

      {specEntries.length > 0 && (
        <section className={styles.specSection}>
          <h2 className={styles.specTitle}>Характеристики</h2>
          <dl className={styles.specList}>
            {specEntries.map((entry) => (
              <div key={entry.label} className={styles.specRow}>
                <dt>{entry.label}</dt>
                <dd>{entry.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <Modal
        open={showOrderModal}
        onClose={() => setShowOrderModal(false)}
        title="Оформить заказ"
        size="lg"
      >
        <OrderForm
          product={product}
          onSuccess={(order) => {
            setSubmittedOrder(order)
            setShowOrderModal(false)
          }}
        />
      </Modal>
    </main>
  )
}
