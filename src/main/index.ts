import { app, shell, BrowserWindow, ipcMain, clipboard, globalShortcut, Menu, Tray, nativeImage } from 'electron'
import { join, basename } from 'path'
import { electronApp, is } from '@electron-toolkit/utils'
import Store from 'electron-store'
import { exec, execSync } from 'child_process'

const store = new Store()

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 850,
    height: 550,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    hasShadow: true,
    skipTaskbar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      backgroundThrottling: false
    }
  })
  mainWindow.on('ready-to-show', () => { if (!process.argv.includes('--hidden')) mainWindow?.show() })
  mainWindow.on('blur', () => mainWindow?.hide())
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  else mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
}

function toggleWindow(): void {
  if (mainWindow?.isVisible()) mainWindow.hide()
  else { mainWindow?.show(); mainWindow?.focus() }
}

function getResourcePath(relPath: string): string {
  // 无论开发还是生产环境，resources 文件夹都在 appPath 下
  return join(app.getAppPath(), relPath)
}

function createTray(): void {
  // 优先加载 PNG，因为 nativeImage 对 PNG 的支持在所有平台和环境下最稳健
  const trayPath = getResourcePath('resources/tray.png')
  let trayIcon = nativeImage.createFromPath(trayPath)
  
  // 如果 PNG 找不到或为空，再尝试 SVG
  if (trayIcon.isEmpty()) {
    const svgPath = getResourcePath('resources/tray.svg')
    trayIcon = nativeImage.createFromPath(svgPath)
  }

  // 如果依然失败，回退到主图标
  if (trayIcon.isEmpty()) {
    const iconPath = getResourcePath('resources/icon.png')
    trayIcon = nativeImage.createFromPath(iconPath)
  }

  if (trayIcon.isEmpty()) {
    console.error('Tray icon failed to load from all sources.')
    trayIcon = nativeImage.createEmpty()
  }

  // macOS 专属处理
  if (process.platform === 'darwin') {
    // 调整为标准的 22x22 尺寸
    const resizedIcon = trayIcon.resize({ width: 22, height: 22 })
    // 关键：必须在最终设置给 Tray 的图像上设置 TemplateImage
    resizedIcon.setTemplateImage(true)
    tray = new Tray(resizedIcon)
  } else {
    tray = new Tray(trayIcon)
  }
  
  const contextMenu = Menu.buildFromTemplate([
    { label: '显示主面板', click: () => toggleWindow() },
    { type: 'separator' },
    { label: '开机自启动', type: 'checkbox', checked: app.getLoginItemSettings().openAtLogin, click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked, path: app.getPath('exe'), args: ['--hidden'] }) },
    { type: 'separator' },
    { label: '退出', click: () => app.quit() }
  ])
  tray.setToolTip('极简剪贴板')
  tray.setContextMenu(contextMenu)
  tray.on('click', () => toggleWindow())
}

function getActiveApp(): string {
  try {
    if (process.platform === 'darwin') {
      const script = `tell application "System Events" to get name of first application process whose frontmost is true`
      const result = execSync(`osascript -e '${script}'`, { timeout: 500 }).toString().trim()
      return result || '系统'
    } else if (process.platform === 'win32') {
      const psCommand = `powershell -command "Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class Win32 { [DllImport(\\"user32.dll\\")] public static extern IntPtr GetForegroundWindow(); [DllImport(\\"user32.dll\\")] public static extern int GetWindowThreadProcessId(IntPtr hWnd, out int lpdwProcessId); }'; $hwnd = [Win32]::GetForegroundWindow(); $processId = 0; [Win32]::GetWindowThreadProcessId($hwnd, [ref]$processId); (Get-Process -Id $processId).Name"`
      return execSync(psCommand, { timeout: 1000 }).toString().trim()
    }
  } catch (e) { return '系统' }
  return '未知'
}

function getClipboardFiles(): string[] {
  try {
    if (process.platform === 'darwin') {
      const fileUrls = clipboard.read('public.file-url')
      if (fileUrls) return fileUrls.split('\n').map(url => url.replace('file://', '').trim()).filter(Boolean)
    } else if (process.platform === 'win32') {
      const raw = clipboard.readBuffer('FileNameW').toString('ucs2').replace(RegExp(String.fromCharCode(0), 'g'), '')
      if (raw) return [raw]
    }
  } catch (e) { return [] }
  return []
}

let lastText = clipboard.readText()
let lastImage = clipboard.readImage().toDataURL()
let lastFiles: string[] = []

async function checkClipboard(): Promise<void> {
  try {
    const text = clipboard.readText()
    const image = clipboard.readImage()
    const imageDataUrl = image.toDataURL()
    const files = getClipboardFiles()

    const history: any[] = (store.get('history') as any[]) || []
    const stats: any = (store.get('stats') as any) || { totalCopies: 0, textCopies: 0, imageCopies: 0, appStats: {}, dailyStats: {} }
    let changed = false
    const dateKey = new Date().toISOString().split('T')[0]
    const sourceApp = getActiveApp()

    const updateStats = () => {
      if (!stats.dailyStats) stats.dailyStats = {}
      if (!stats.appStats) stats.appStats = {}
      stats.totalCopies = (stats.totalCopies || 0) + 1
      stats.dailyStats[dateKey] = (stats.dailyStats[dateKey] || 0) + 1
      stats.appStats[sourceApp] = (stats.appStats[sourceApp] || 0) + 1
      store.set('stats', stats)
    }

    if (files.length > 0 && JSON.stringify(files) !== JSON.stringify(lastFiles)) {
      lastFiles = files
      changed = true
      const filePath = files[0]
      const fileName = basename(filePath)
      const fileIcon = await app.getFileIcon(filePath, { size: 'normal' })
      const existingIdx = history.findIndex(h => h.content === filePath && h.type === 'file')
      let isPinned = false, copyCount = 1, collectionId = undefined
      if (existingIdx > -1) { isPinned = history[existingIdx].isPinned; copyCount = (history[existingIdx].copyCount || 0) + 1; collectionId = history[existingIdx].collectionId; history.splice(existingIdx, 1) }
      history.unshift({ id: Date.now().toString(), content: filePath, fileName, iconData: fileIcon.toDataURL(), type: 'file', timestamp: Date.now(), isPinned, sourceApp, copyCount, collectionId })
      updateStats()
    }
    else if (text && text !== lastText && files.length === 0) {
      lastText = text; changed = true
      const existingIdx = history.findIndex(item => item.content === text && item.type === 'text')
      let isPinned = false, copyCount = 1, collectionId = undefined
      if (existingIdx > -1) { isPinned = history[existingIdx].isPinned; copyCount = (history[existingIdx].copyCount || 0) + 1; collectionId = history[existingIdx].collectionId; history.splice(existingIdx, 1) }
      history.unshift({ id: Date.now().toString(), content: text, type: 'text', timestamp: Date.now(), isPinned, sourceApp, copyCount, collectionId })
      updateStats()
    }
    else if (!image.isEmpty() && imageDataUrl !== lastImage && files.length === 0) {
      lastImage = imageDataUrl; changed = true
      const existingIdx = history.findIndex(item => item.content === imageDataUrl && item.type === 'image')
      let isPinned = false, copyCount = 1, collectionId = undefined
      if (existingIdx > -1) { isPinned = history[existingIdx].isPinned; copyCount = (history[existingIdx].copyCount || 0) + 1; collectionId = history[existingIdx].collectionId; history.splice(existingIdx, 1) }
      history.unshift({ id: Date.now().toString(), content: imageDataUrl, type: 'image', timestamp: Date.now(), isPinned, sourceApp, copyCount, collectionId })
      updateStats()
    }

    if (changed) {
      const finalHistory = [...history.filter(h => h.isPinned), ...history.filter(h => !h.isPinned)]
      store.set('history', finalHistory)
      mainWindow?.webContents.send('clipboard-changed', finalHistory)
    }
  } catch (err) { console.error('Clipboard check error:', err) }
}

function simulatePaste() {
  if (process.platform === 'darwin') setTimeout(() => { exec(`osascript -e 'tell application "System Events" to keystroke "v" using command down'`) }, 100)
  else if (process.platform === 'win32') setTimeout(() => { exec(`powershell -command "(New-Object -ComObject WScript.Shell).SendKeys('^v')"`) }, 100)
}

app.whenReady().then(() => {
  if (process.platform === 'darwin') {
    const template = [
      { label: app.name, submenu: [{ label: '关于 KLIP', role: 'about' }, { type: 'separator' }, { label: '退出', accelerator: 'Command+Q', click: () => app.quit() }] },
      { label: '编辑', submenu: [{ label: '撤销', role: 'undo' }, { label: '重做', role: 'redo' }, { type: 'separator' }, { label: '剪切', role: 'cut' }, { label: '复制', role: 'copy' }, { label: '粘贴', role: 'paste' }] }
    ]
    Menu.setApplicationMenu(Menu.buildFromTemplate(template as any))
  } else Menu.setApplicationMenu(null)

  electronApp.setAppUserModelId('com.electron')
  createTray()
  globalShortcut.register('CommandOrControl+Shift+V', () => toggleWindow())

  ipcMain.handle('get-history', () => store.get('history') || [])
  ipcMain.handle('get-stats', () => store.get('stats') || { totalCopies: 0, textCopies: 0, imageCopies: 0, appStats: {}, dailyStats: {} })
  ipcMain.handle('get-collections', () => store.get('collections') || [])

  ipcMain.on('write-to-clipboard', (_, item: any) => {
    if (item.type === 'text') { lastText = item.content; clipboard.writeText(item.content) }
    else if (item.type === 'image') { lastImage = item.content; clipboard.writeImage(nativeImage.createFromDataURL(item.content)) }
    else if (item.type === 'file') { clipboard.writeText(item.content) }
    mainWindow?.hide(); simulatePaste()
  })

  ipcMain.on('toggle-pin', (_, id: string) => {
    const history: any[] = (store.get('history') as any[]) || []
    const idx = history.findIndex(h => h.id === id)
    if (idx > -1) { history[idx].isPinned = !history[idx].isPinned; store.set('history', history); mainWindow?.webContents.send('clipboard-changed', history) }
  })

  ipcMain.on('delete-item', (_, id: string) => {
    const history = ((store.get('history') as any[]) || []).filter(h => h.id !== id)
    store.set('history', history); mainWindow?.webContents.send('clipboard-changed', history)
  })

  ipcMain.on('delete-items', (_, ids: string[]) => {
    const history = ((store.get('history') as any[]) || []).filter(h => !ids.includes(h.id))
    store.set('history', history); mainWindow?.webContents.send('clipboard-changed', history)
  })

  ipcMain.on('show-in-folder', (_, path: string) => { shell.showItemInFolder(path) })
  ipcMain.on('open-external', (_, url: string) => { shell.openExternal(url); mainWindow?.hide() })
  ipcMain.on('search-google', (_, text: string) => { shell.openExternal(`https://www.google.com/search?q=${encodeURIComponent(text)}`); mainWindow?.hide() })
  ipcMain.on('search-baidu', (_, text: string) => { shell.openExternal(`https://www.baidu.com/s?wd=${encodeURIComponent(text)}`); mainWindow?.hide() })
  ipcMain.on('save-collections', (_, collections: any[]) => store.set('collections', collections))
  ipcMain.on('move-to-collection', (_, { itemId, collectionId }) => {
    const history: any[] = (store.get('history') as any[]) || []
    const idx = history.findIndex(h => h.id === itemId)
    if (idx > -1) { history[idx].collectionId = collectionId; store.set('history', history); mainWindow?.webContents.send('clipboard-changed', history) }
  })

  ipcMain.on('clear-history', () => {
    const history = ((store.get('history') as any[]) || []).filter(h => h.isPinned || h.collectionId)
    store.set('history', history); mainWindow?.webContents.send('clipboard-changed', history)
  })

  createWindow()
  setInterval(checkClipboard, 1000)
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})

app.on('window-all-closed', () => {})
app.on('will-quit', () => globalShortcut.unregisterAll())
