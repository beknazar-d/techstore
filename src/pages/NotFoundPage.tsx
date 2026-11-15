import { LinkButton } from '../components/ui/Button'
import styles from './NotFoundPage.module.css'

export function NotFoundPage() {
  return (
    <div className={styles.page}>
      <p className={styles.code}>404</p>
      <h1 className={styles.title}>Страница не найдена</h1>
      <p className={styles.text}>Возможно, товар сняли с продажи или ссылка устарела.</p>
      <div className={styles.actions}>
        <LinkButton to="/catalog" icon="grid_view">Перейти в каталог</LinkButton>
        <LinkButton to="/" variant="secondary">На главную</LinkButton>
      </div>
    </div>
  )
}
