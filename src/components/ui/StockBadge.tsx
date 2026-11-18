import { shop } from '../../config/shop'
import { Badge } from './Badge'
import { msg } from '../../i18n'

export function StockBadge({ stock }: { stock: number }) {
  const t = msg().product
  if (stock <= 0) {
    return <Badge tone="neutral">{t.outOfStock}</Badge>
  }
  if (stock <= shop.lowStockThreshold) {
    return <Badge tone="warning" dot>{t.lowStock(stock)}</Badge>
  }
  return <Badge tone="success" dot>{t.inStock}</Badge>
}