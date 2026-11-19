// Сборка debug-APK: gradlew assembleDebug в папке android.
// Если JAVA_HOME не задан, ищем JDK 21 в %LOCALAPPDATA%\Programs (как на компьютере владельца).
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const androidDir = fileURLToPath(new URL('./android', import.meta.url))
const env = { ...process.env }
if (!env.JAVA_HOME && env.LOCALAPPDATA) {
  const programs = join(env.LOCALAPPDATA, 'Programs')
  const jdk = existsSync(programs) ? readdirSync(programs).find((name) => /^jdk-2[1-9]/.test(name)) : undefined
  if (jdk) env.JAVA_HOME = join(programs, jdk)
}
if (!env.JAVA_HOME) {
  console.error('Не найден JDK 21: установите его и задайте JAVA_HOME.')
  process.exit(1)
}

const isWindows = process.platform === 'win32'
// На Windows .bat запускаем через cmd с полным путём в кавычках (в пути есть пробел и кириллица).
const result = isWindows
  ? spawnSync('cmd.exe', ['/d', '/s', '/c', `""${join(androidDir, 'gradlew.bat')}" assembleDebug --console=plain"`], {
      cwd: androidDir,
      env,
      stdio: 'inherit',
      windowsVerbatimArguments: true,
    })
  : spawnSync('./gradlew', ['assembleDebug', '--console=plain'], { cwd: androidDir, env, stdio: 'inherit' })
if (result.status === 0) console.log('APK: mobile/android/app/build/outputs/apk/debug/app-debug.apk')
process.exit(result.status ?? 1)
