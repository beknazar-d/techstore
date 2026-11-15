import type { Product } from '../../types'
import { ProductCard } from './ProductCard'
import styles from './ProductGrid.module.css'

interface ProductGridProps {
  products: Product[]
}

export function ProductGrid({ products }: ProductGridProps) {
  if (products.length === 0) return null

  return (
    <ul className={styles.grid}>
      {products.map((product) => (
        <li key={product.id} className={styles.item}>
          <ProductCard product={product} />
        </li>
      ))}
    </ul>
  )
}
