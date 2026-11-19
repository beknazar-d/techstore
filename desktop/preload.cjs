// Мост между админкой и Windows-приложением. Наружу — только безопасные действия.
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('desktopApp', {
  /** Показать окно поверх остальных (по нажатию на уведомление). */
  focus: () => ipcRenderer.send('app:focus'),
})
