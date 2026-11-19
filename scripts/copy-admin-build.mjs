// Собирает админку (`npm run build:admin`) и копирует dist-admin в папку приложения.
// Запуск: node scripts/copy-admin-build.mjs <папка относительно корня проекта>
import { execSync } from 'node:child_process'
import { cpSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const root = fileURLToPath(new URL('..', import.meta.url))
const target = process.argv[2]
if (!target) throw new Error('Укажите папку, например desktop/web')

execSync('npm run build:admin', { cwd: root, stdio: 'inherit' })
rmSync(join(root, target), { recursive: true, force: true })
cpSync(join(root, 'dist-admin'), join(root, target), { recursive: true })
console.log(`Админка скопирована в ${target}`)
