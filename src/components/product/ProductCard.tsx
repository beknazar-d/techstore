import { Link } from 'react-router-dom'
import type { Product } from '../../types'
import { formatPrice } from '../../utils/format'
import { cn } from '../../utils/cn'
import { ProductImage } from '../ui/ProductImage'
import { StockBadge } from '../ui/StockBadge'
import { ConditionBadge } from '../ui/ConditionBadge'
import styles from './ProductCard.module.css'

interface ProductCardProps {
  product: Product
}

export function ProductCard({ product }: ProductCardProps) {
  const soldOut = product.stock <= 0
  const batteryHealth = product.usedInfo?.batteryHealth

  return (
    <Link to={`/product/${product.slug}`} className={styles.productCard}>
      <div className={styles.badges}>
        <StockBadge stock={product.stock} />
        <ConditionBadge condition={product.condition} grade={product.usedInfo?.grade} />
      </div>
      <div className={cn(soldOut && styles.dimmed)}>
        <ProductImage src={product.images[0]} alt={product.name} />
      </div>
      {product.brand && <p className={styles.brand}>{product.brand}</p>}
      <h3 className={styles.name}>{product.name}</h3>
      {product.condition === 'used' && batteryHealth != null && (
        <p className={styles.battery}>
          <span className={cn('material-symbols-outlined', styles.batteryIcon)} aria-hidden="true">battery_full</span>
          Аккумулятор {batteryHealth}%
        </p>
      )}
      <p className={cn(styles.price, soldOut && styles.dimmed)}>{formatPrice(product.price)}</p>
    </Link>
  )
}
