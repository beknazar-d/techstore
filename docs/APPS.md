# Приложения администратора: Windows (Electron) и Android (Capacitor)

Оба приложения показывают **ту же админку** из `src/admin/`, без клиентского сайта.
Данные — боевой Supabase (URL и anon-ключ из `.env.production`). Вход — тот же email и пароль.

## Как устроено

- `app/index.html` + `src/admin/standalone.tsx` — отдельный вход только для админки (HashRouter: `#/admin/orders`).
- `vite.admin.config.ts` → `npm run build:admin` → `dist-admin/` (относительные пути, открывается из файла).
- `scripts/copy-admin-build.mjs` собирает админку и копирует её в `desktop/web` или `mobile/web`.
- `src/config/platform.ts`: `isAdminApp` — в приложении ссылка «На сайт» открывает сайт в браузере.
- `desktop/` и `mobile/` — свои `package.json` и `node_modules`, чтобы сборка сайта на Cloudflare их не качала.
- Иконка — `resources/icon.svg` (и `icon-foreground.svg` для адаптивной иконки Android).

## Windows (Electron) — `desktop/`

```
cd desktop && npm install        # один раз
npm run desktop:start            # запустить из исходников (из корня проекта)
npm run desktop:dist             # установщик → desktop/release/PhoneMarketAdmin-Setup-<версия>.exe
```

- Внешние ссылки (карта, Telegram, `tel:`, `mailto:`) открываются в системе.
- Разрешены микрофон и уведомления; остальные запросы браузера отклоняются.
- Одно окно: повторный запуск поднимает открытое.
- Установщик не подписан — Windows SmartScreen покажет предупреждение («Подробнее» → «Выполнить в любом случае»).
- Если запускаете из терминала VS Code, сбросьте `ELECTRON_RUN_AS_NODE` (VS Code его ставит, и Electron стартует как Node).

## Android (Capacitor) — `mobile/`

Нужны JDK 21 и Android SDK (platform 36). На этом компьютере: JDK — `%LOCALAPPDATA%\Programs\jdk-21.0.12.1+1`,
SDK — `%LOCALAPPDATA%\Android\Sdk` (путь в `mobile/android/local.properties`, файл не в git).

```
cd mobile && npm install         # один раз
set JAVA_HOME=%LOCALAPPDATA%\Programs\jdk-21.0.12.1+1
npm run android:apk              # из корня → mobile/android/app/build/outputs/apk/debug/app-debug.apk
npm --prefix mobile run open     # открыть в Android Studio
```

- При первом запуске приложение само просит разрешения на уведомления (Android 13+) и микрофон (`MainActivity.java`).
- `gradle.properties`: `android.overridePathCheck=true` — путь проекта содержит кириллицу.
- Сейчас собирается debug-APK (для установки вручную). Для Google Play нужен release с ключом подписи —
  ключ создаёт и хранит владелец, в репозиторий не кладём.

## Уведомления о новых заявках

- Новый заказ, заявка trade-in, клиент ждёт менеджера, сообщение клиента в чате менеджера →
  системное уведомление; нажатие открывает заказ / заявку / чат.
- Источник — Supabase Realtime (`subscribeAdminEvents` в `src/api/notifications.ts`), показ —
  `src/admin/notifications/` (хук `useAdminNotifications` в `AdminLayout`).
- Windows и сайт — Notification API; Android — плагин `@capacitor/local-notifications`
  (из моста `window.Capacitor.Plugins`, в корневом `package.json` его нет), значок `ic_stat_notify`.
- Включается в «Настройках» → «Уведомления на этом устройстве» (в приложениях включено по умолчанию,
  на сайте — выключено). Выбор хранится в браузере устройства (`phone-market:notify`).
- Ограничение: уведомления приходят, пока приложение запущено (можно свёрнутым). Если приложение закрыто
  или Android выгрузил его из памяти — уведомлений нет. Для этого нужен push через Firebase (FCM):
  проект Firebase создаёт владелец, ключ — в секретах Edge Functions.

## После изменений в админке

Пересоберите приложения (`desktop:dist`, `android:apk`) — они содержат копию админки на момент сборки.
