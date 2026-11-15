import { Link } from 'react-router-dom'
import { shop } from '../../config/shop'

// ЗАГЛУШКА: шапку сверстает исполнитель. Имя экспорта не менять.
export function Header() {
  return (
    <header>
      <Link to="/">{shop.name}</Link> · <Link to="/catalog">Каталог</Link> · <Link to="/trade-in">Trade-in</Link>
    </header>
  )
}
