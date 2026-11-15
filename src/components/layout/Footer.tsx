import { Link } from 'react-router-dom'
import { shop } from '../../config/shop'
import { formatPhone, telHref } from '../../utils/phone'
import { telegramHref, whatsappHref } from '../../utils/links'
import styles from './Footer.module.css'

const currentYear = new Date().getFullYear()

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.grid}>
          <div>
            <p className={styles.brand}>{shop.name}</p>
            <p className={styles.text}>{shop.tagline}</p>
            <p className={styles.text}>Оплата при получении. Без предоплаты.</p>
          </div>
          <div>
            <h2 className={styles.title}>Магазин</h2>
            <p className={styles.text}>{shop.city}</p>
            <p className={styles.text}>{shop.pickupAddress}</p>
            <p className={styles.text}>{shop.workingHours}</p>
          </div>
          <div>
            <h2 className={styles.title}>Связь</h2>
            <a href={telHref(shop.phone)} className={styles.phone}>
              {formatPhone(shop.phone)}
            </a>
            <div className={styles.messengers}>
              <a href={whatsappHref()} target="_blank" rel="noopener noreferrer" className={styles.messenger}>
                WhatsApp
              </a>
              <a href={telegramHref()} target="_blank" rel="noopener noreferrer" className={styles.messenger}>
                Telegram
              </a>
            </div>
          </div>
          <div>
            <h2 className={styles.title}>Покупателям</h2>
            <ul className={styles.links}>
              <li><Link to="/catalog" className={styles.link}>Каталог</Link></li>
              <li><Link to="/catalog?condition=used" className={styles.link}>Б/У техника</Link></li>
              <li><Link to="/trade-in" className={styles.link}>Trade-in</Link></li>
            </ul>
          </div>
        </div>
        <div className={styles.bottom}>
          <span>© {currentYear} {shop.name}</span>
        </div>
      </div>
    </footer>
  )
}
