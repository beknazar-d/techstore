// Где запущена админка: на сайте или как приложение (Electron / Android), собранное `npm run build:admin`.

/** true — админка собрана как отдельное приложение, клиентского сайта рядом нет. */
export const isAdminApp = import.meta.env.VITE_ADMIN_APP === '1'

/** Адрес сайта для ссылки «На сайт» из приложения (открывается в браузере). */
export const SITE_URL: string = import.meta.env.VITE_SITE_URL || 'https://techstore.sadyrbekov981-ae2.workers.dev'
