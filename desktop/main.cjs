// Electron-оболочка админки Phone Market (Windows). Показывает ту же админку из src/admin,
// собранную отдельно (`npm run build:admin` → dist-admin → desktop/web). Данные — Supabase.
const { app, BrowserWindow, Menu, ipcMain, session, shell } = require('electron')
const path = require('node:path')

// Внешние ссылки (карта, Telegram, звонок, почта) открываем в системе, а не внутри окна.
const EXTERNAL = /^(https?:|tel:|mailto:)/i
const ALLOWED_PERMISSIONS = new Set(['media', 'notifications', 'clipboard-sanitized-write'])

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 380,
    minHeight: 600,
    title: 'Phone Market — админка',
    icon: path.join(__dirname, 'build', 'icon.png'),
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
      preload: path.join(__dirname, 'preload.cjs'),
      // Свёрнутое окно не «засыпает»: подписка на новые заявки и уведомления продолжают работать.
      backgroundThrottling: false,
    },
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (EXTERNAL.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  // Переходы со страницы приложения на чужие адреса тоже уводим в браузер.
  win.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith('file://')) return
    event.preventDefault()
    if (EXTERNAL.test(url)) void shell.openExternal(url)
  })

  win.once('ready-to-show', () => win.show())
  void win.loadFile(path.join(__dirname, 'web', 'index.html'), { hash: '/admin/orders' })
}

// Одно окно: повторный запуск поднимает уже открытое.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const [win] = BrowserWindow.getAllWindows()
    if (win) {
      if (win.isMinimized()) win.restore()
      win.focus()
    }
  })

  app.whenReady().then(() => {
    // Микрофон и уведомления — разрешаем; остальное (геолокация, камера экрана и т.п.) — нет.
    session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
      callback(ALLOWED_PERMISSIONS.has(permission))
    })
    session.defaultSession.setPermissionCheckHandler((_wc, permission) => ALLOWED_PERMISSIONS.has(permission))
    // Нажатие на уведомление: развернуть и показать окно.
    ipcMain.on('app:focus', () => {
      const [win] = BrowserWindow.getAllWindows()
      if (!win) return
      if (win.isMinimized()) win.restore()
      win.show()
      win.focus()
    })
    Menu.setApplicationMenu(null)
    app.setAppUserModelId('market.phone.admin')
    createWindow()
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
