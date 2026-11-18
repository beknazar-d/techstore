import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getCategory, getProductBySlug } from '../api'
import { OrderForm } from '../components/order/OrderForm'
import { Button, LinkButton } from '../components/ui/Button'
import { ConditionBadge } from '../components/ui/ConditionBadge'
import { Modal } from '../components/ui/Modal'
import { ProductImage } from '../components/ui/ProductImage'
import { Spinner } from '../components/ui/Spinner'
import { StockBadge } from '../components/ui/StockBadge'
import { Price } from '../components/ui/Price'
import { useApiQuery } from '../hooks/useApiQuery'
import type { Order } from '../types'
import { DEVICE_GRADE_LABELS } from '../config/labels'
import { useT } from '../i18n'
import styles from './ProductPage.module.css'

export function ProductPage() {
  const t = useT()
  const { slug } = useParams()
  const [showOrderModal, setShowOrderModal] = useState(false)
  const [submittedOrder, setSubmittedOrder] = useState<Order | null>(null)

  // Товар и его категория одним запросом. Склад обновляется сам, когда меняется таблица products.
  const { data } = useApiQuery(
    async () => {
      if (!slug?.trim()) return { product: null, category: null }
      const product = await getProductBySlug(slug)
      const category = product ? await getCategory(product.categoryId) : null
      return { product, category }
    },
    [slug],
    ['products', 'categories'],
  )
  const loading = data === undefined
  const product = data?.product ?? null
  const category = data?.category ?? null

  const specEntries = useMemo(() => {
    if (!product || !category) return []

    return category.specFields
      .map((field) => {
        const value = product.specs[field.key]
        if (value === undefined || value === null || value === '') return null

        const displayValue =
          typeof value === 'boolean'
            ? value
              ? t.product.specYes
              : t.product.specNo
            : typeof value === 'number' && field.unit
              ? `${value} ${field.unit}`
              : String(value)

        return {
          label: field.label,
          value: displayValue,
        }
      })
      .filter(Boolean) as Array<{ label: string; value: string }>
  }, [category, product, t])

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
          <h1 className={styles.title}>{t.product.notFoundTitle}</h1>
          <p className={styles.emptyText}>{t.product.notFoundText}</p>
          <LinkButton to="/catalog" icon="grid_view">{t.product.backToCatalog}</LinkButton>
        </div>
      </main>
    )
  }

  const batteryHealth = product.usedInfo?.batteryHealth
  const usedInfo = product.usedInfo

  return (
    <main className={styles.page}>
      <Link to={category ? `/catalog/${category.slug}` : '/catalog'} className={styles.backLink}>
        {t.product.back}
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
                  <ProductImage src={image} alt={t.product.photoAlt(product.name, index + 1)} className={styles.thumbImage} />
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
            <Price product={product} size="lg" />
            <p className={styles.stockText}>{product.stock > 0 ? t.product.inStock : t.product.outOfStock}</p>
          </div>

          <div className={styles.actions}>
            <Button type="button" onClick={() => setShowOrderModal(true)}>
              {t.product.order}
            </Button>
            {product.condition === 'new' && (
              <LinkButton to="/trade-in" variant="secondary">{t.product.tradeIn}</LinkButton>
            )}
          </div>

          {submittedOrder && (
            <div className={styles.successMessage} role="status">
              <span className="material-symbols-outlined" aria-hidden="true">check_circle</span>
              <div>
                <strong>{t.product.orderAccepted(submittedOrder.number)}</strong>
                <p>{t.product.orderAcceptedText}</p>
              </div>
            </div>
          )}

          {usedInfo && (
            <div className={styles.usedBlock}>
              {usedInfo.grade && <p>{t.product.grade(DEVICE_GRADE_LABELS[usedInfo.grade])}</p>}
              {batteryHealth != null && <p>{t.product.battery(batteryHealth)}</p>}
              {usedInfo.defects && <p>{t.product.defects(usedInfo.defects)}</p>}
              {usedInfo.kit && <p>{t.product.kit(usedInfo.kit)}</p>}
              {usedInfo.warrantyMonths != null && <p>{t.product.warranty(usedInfo.warrantyMonths)}</p>}
            </div>
          )}
        </div>
      </article>

      {specEntries.length > 0 && (
        <section className={styles.specSection}>
          <h2 className={styles.specTitle}>{t.product.specs}</h2>
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
        title={t.product.orderTitle}
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
