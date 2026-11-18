import { LinkButton } from '../components/ui/Button'
import { useT } from '../i18n'
import styles from './NotFoundPage.module.css'

export function NotFoundPage() {
  const t = useT()
  return (
    <div className={styles.page}>
      <p className={styles.code}>404</p>
      <h1 className={styles.title}>{t.layout.notFoundTitle}</h1>
      <p className={styles.text}>{t.layout.notFoundText}</p>
      <div className={styles.actions}>
        <LinkButton to="/catalog" icon="grid_view">{t.layout.toCatalog}</LinkButton>
        <LinkButton to="/" variant="secondary">{t.layout.toHome}</LinkButton>
      </div>
    </div>
  )
}
