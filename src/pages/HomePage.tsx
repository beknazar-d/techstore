import styles from './HomePage.module.css'

export function HomePage() {
  return (
    <main className={styles.page}>
      <span className={styles.badge}>
        <span className={styles.dot} />
        Проект запущен
      </span>
      <h1 className={styles.title}>Phone Market</h1>
      <p className={styles.lead}>Наушники, часы, зарядки и аксессуары. Оплата при получении.</p>
    </main>
  )
}
