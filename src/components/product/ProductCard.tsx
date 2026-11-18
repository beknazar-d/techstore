import { Link } from 'react-router-dom'
import type { Product } from '../../types'
import { formatPrice } from '../../utils/format'
import { cn } from '../../utils/cn'
import { ProductImage } from '../ui/ProductImage'
import { StockBadge } from '../ui/StockBadge'
import { ConditionBadge } from '../ui/ConditionBadge'
import { useT } from '../../i18n'
import styles from './ProductCard.module.css'

interface ProductCardProps {
  product: Product
}

export function ProductCard({ product }: ProductCardProps) {
  const t = useT()
  const soldOut = product.stock <= 0
  const batteryHealth = product.usedInfo?.batteryHealth

  return (
    <Link to={`/product/${product.slug}`} className={styles.productCard}>
      {/* Фото во всю ширину карточки, без своей рамки. Бейджи — под фото, чтобы их перенос
          на вторую строку не сдвигал картинку и фото в ряду стояли ровно. */}
      <div className={cn(styles.media, soldOut && styles.dimmed)}>
        <ProductImage src={product.images[0]} alt={product.name} className={styles.image} />
      </div>
      <div className={styles.body}>
        <div className={styles.badges}>
          <StockBadge stock={product.stock} />
          <ConditionBadge condition={product.condition} grade={product.usedInfo?.grade} />
        </div>
        {product.brand && <p className={styles.brand}>{product.brand}</p>}
        <h3 className={styles.name}>{product.name}</h3>
        {product.condition === 'used' && batteryHealth != null && (
          <p className={styles.battery}>
            <span className={cn('material-symbols-outlined', styles.batteryIcon)} aria-hidden="true">battery_full</span>
            {t.product.batteryShort(batteryHealth)}
          </p>
        )}
        <p className={cn(styles.price, soldOut && styles.dimmed)}>{formatPrice(product.price)}</p>
      </div>
    </Link>
  )
}
