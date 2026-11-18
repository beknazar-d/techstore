import type { Product } from '../types'

/** Процент скидки (целый, округлён) или null, если скидки нет. */
export function discountPercent(product: Pick<Product, 'price' | 'oldPrice'>): number | null {
  const { price, oldPrice } = product
  if (oldPrice === null || oldPrice <= price || oldPrice <= 0) return null
  return Math.max(1, Math.round(((oldPrice - price) / oldPrice) * 100))
}
