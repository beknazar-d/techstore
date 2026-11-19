import { Link } from 'react-router-dom'
import { useShopInfo } from '../../hooks/useShopInfo'
import { formatPhone, telHref } from '../../utils/phone'
import { instagramHref, telegramHref, whatsappHref } from '../../utils/links'
import { useT } from '../../i18n'
import styles from './Footer.module.css'

const currentYear = new Date().getFullYear()

export function Footer() {
  const t = useT()
  const info = useShopInfo()
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.grid}>
          <div>
            <p className={styles.brand}>{info.name}</p>
            <p className={styles.text}>{t.layout.tagline}</p>
            <p className={styles.text}>{t.layout.payOnDelivery}</p>
          </div>
          <div>
            <h2 className={styles.title}>{t.layout.shopTitle}</h2>
            {info.cityText && <p className={styles.text}>{info.cityText}</p>}
            {info.addressText && <p className={styles.text}>{info.addressText}</p>}
            {info.hoursText && <p className={styles.text}>{info.hoursText}</p>}
            {info.mapUrl && (
              <a href={info.mapUrl} target="_blank" rel="noopener noreferrer" className={styles.link}>
                {t.layout.onMap}
              </a>
            )}
          </div>
          <div>
            <h2 className={styles.title}>{t.layout.contactsTitle}</h2>
            {info.phones.map((phone) => (
              <a key={phone} href={telHref(phone)} className={styles.phone}>
                {formatPhone(phone)}
              </a>
            ))}
            {info.email && (
              <a href={`mailto:${info.email}`} className={styles.link}>
                {info.email}
              </a>
            )}
            {(info.whatsapp || info.telegram || info.instagram) && (
              <div className={styles.messengers}>
                {info.whatsapp && (
                  <a href={whatsappHref(info.whatsapp)} target="_blank" rel="noopener noreferrer" className={styles.messenger}>
                    WhatsApp
                  </a>
                )}
                {info.telegram && (
                  <a href={telegramHref(info.telegram)} target="_blank" rel="noopener noreferrer" className={styles.messenger}>
                    Telegram
                  </a>
                )}
                {info.instagram && (
                  <a href={instagramHref(info.instagram)} target="_blank" rel="noopener noreferrer" className={styles.messenger}>
                    Instagram
                  </a>
                )}
              </div>
            )}
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
          <span>© {currentYear} {info.name}</span>
        </div>
      </div>
    </footer>
  )
}
