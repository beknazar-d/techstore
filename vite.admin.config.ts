// Сборка только админки для Electron и Android: `npm run build:admin` → dist-admin/.
// Переменные VITE_* берутся из корня проекта (.env.production — публичные URL и anon-ключ).
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const root = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  root: `${root}app`,
  envDir: root,
  publicDir: false,
  base: './',
  plugins: [react()],
  define: {
    // Признак приложения: ссылка «На сайт» открывает сайт в браузере (src/config/platform.ts).
    'import.meta.env.VITE_ADMIN_APP': JSON.stringify('1'),
  },
  build: {
    outDir: `${root}dist-admin`,
    emptyOutDir: true,
    // Файл открывается локально, размер чанка не важен.
    chunkSizeWarningLimit: 2000,
  },
})
