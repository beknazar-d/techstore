import { shop } from '../../config/shop'
import { Badge } from './Badge'

export function StockBadge({ stock }: { stock: number }) {
  if (stock <= 0) {
    return <Badge tone="neutral">Нет в наличии</Badge>
  }
  if (stock <= shop.lowStockThreshold) {
    return <Badge tone="warning" dot>Осталось {stock} шт.</Badge>
  }
  return <Badge tone="success" dot>В наличии</Badge>
}