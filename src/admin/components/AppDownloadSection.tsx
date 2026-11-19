import { isAdminApp } from '../../config/platform'
import { msg } from '../../i18n'
import { Section } from './AdminBlocks'
import styles from './AppDownloadSection.module.css'

/** Файл лежит в public/downloads и обновляется вместе с сайтом (сборка — docs/APPS.md). */
const ANDROID_APK = '/downloads/phone-market-admin.apk'

/** «Приложение для Android»: ссылка на APK. Показываем только на сайте — в самих приложениях не нужно. */
export function AppDownloadSection() {
  const t = msg().adminSettings
  if (isAdminApp) return null
  return (
    <Section title={t.appTitle}>
      <div className={styles.body}>
        <p className={styles.hint}>{t.appHint}</p>
        <a href={ANDROID_APK} download className={styles.download}>
          <span className="material-symbols-outlined" aria-hidden="true">android</span>
          {t.appDownload}
        </a>
        <ol className={styles.steps}>
          <li>{t.appStep1}</li>
          <li>{t.appStep2}</li>
          <li>{t.appStep3}</li>
        </ol>
      </div>
    </Section>
  )
}
