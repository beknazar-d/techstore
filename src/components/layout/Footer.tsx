import { Link } from 'react-router-dom'
import { shop } from '../../config/shop'
import { formatPhone, telHref } from '../../utils/phone'
import { telegramHref, whatsappHref } from '../../utils/links'
import { useT } from '../../i18n'
import styles from './Footer.module.css'

const currentYear = new Date().getFullYear()

export function Footer() {
  const t = useT()
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.grid}>
          <div>
            <p className={styles.brand}>{shop.name}</p>
            <p className={styles.text}>{t.layout.tagline}</p>
            <p className={styles.text}>{t.layout.payOnDelivery}</p>
          </div>
          <div>
            <h2 className={styles.title}>{t.layout.shopTitle}</h2>
            <p className={styles.text}>{shop.city}</p>
            <p className={styles.text}>{shop.pickupAddress}</p>
            <p className={styles.text}>{t.layout.workingHours}</p>
          </div>
          <div>
            <h2 className={styles.title}>{t.layout.contactsTitle}</h2>
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
            <h2 className={styles.title}>{t.layout.customersTitle}</h2>
            <ul className={styles.links}>
              <li><Link to="/catalog" className={styles.link}>{t.layout.catalog}</Link></li>
              <li><Link to="/catalog?condition=used" className={styles.link}>{t.layout.usedDevices}</Link></li>
              <li><Link to="/trade-in" className={styles.link}>{t.layout.tradeIn}</Link></li>
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
