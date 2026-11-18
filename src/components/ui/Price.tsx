import type { Product } from '../../types'
import { formatPrice } from '../../utils/format'
import { discountPercent } from '../../utils/discount'
import { cn } from '../../utils/cn'
import { useT } from '../../i18n'
import styles from './Price.module.css'

interface PriceProps {
  product: Pick<Product, 'price' | 'oldPrice'>
  size?: 'md' | 'lg'
  dimmed?: boolean
  className?: string
}

/** Цена товара. Со скидкой — зачёркнутая старая цена и бейдж «−15%». */
export function Price({ product, size = 'md', dimmed, className }: PriceProps) {
  const t = useT().product
  const percent = discountPercent(product)

  return (
    <div className={cn(styles.price, styles[size], dimmed && styles.dimmed, className)}>
      <span className={cn(styles.current, percent !== null && styles.sale)}>{formatPrice(product.price)}</span>
      {percent !== null && product.oldPrice !== null && (
        <span className={styles.old}>
          <s aria-label={t.oldPrice(formatPrice(product.oldPrice))}>{formatPrice(product.oldPrice)}</s>
          <span className={styles.badge}>{t.discount(percent)}</span>
        </span>
      )}
    </div>
  )
}
