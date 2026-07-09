import { app, BrowserWindow, Menu, protocol, net, dialog, ipcMain } from 'electron'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import path from 'node:path'

// Register siltflow:// as a privileged scheme BEFORE app.whenReady
protocol.registerSchemesAsPrivileged([
  { scheme: 'siltflow', privileges: { standard: true, supportFetchAPI: true, bypassCSP: true } },
])

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '..')

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

// ── Vault Management ──────────────────────────────────────────────
const APP_CONFIG_DIR = app.getPath('userData')
const APP_CONFIG_PATH = path.join(APP_CONFIG_DIR, 'config.json')

interface AppConfig {
  vaultPath: string
}

function readConfig(): AppConfig {
  try {
    return JSON.parse(fs.readFileSync(APP_CONFIG_PATH, 'utf-8'))
  } catch {
    return { vaultPath: '' }
  }
}

function writeConfig(config: AppConfig) {
  if (!fs.existsSync(APP_CONFIG_DIR)) {
    fs.mkdirSync(APP_CONFIG_DIR, { recursive: true })
  }
  fs.writeFileSync(APP_CONFIG_PATH, JSON.stringify(config, null, 2))
}

function ensureVaultStructure(vaultPath: string) {
  const dirs = [
    path.join(vaultPath, '.siltflow'),
    path.join(vaultPath, 'documents'),
  ]
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
  }
}

function getVaultPath(): string {
  const config = readConfig()
  if (config.vaultPath && fs.existsSync(config.vaultPath)) {
    return config.vaultPath
  }
  return ''
}

// ── Window Management ─────────────────────────────────────────────
let win: BrowserWindow | null

async function installDevTools() {
  try {
    const { default: installExtension, REACT_DEVELOPER_TOOLS } = await import('electron-devtools-installer')
    await installExtension(REACT_DEVELOPER_TOOLS)
    console.log('[DevTools] React Developer Tools installed')
  } catch (e) {
    console.log('[DevTools] Could not install React DevTools:', (e as Error).message)
  }
}

function createWindow() {
  Menu.setApplicationMenu(null)

  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
  })

  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', new Date().toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
    win.webContents.openDevTools({ mode: 'bottom' })
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

// ── IPC Handlers ──────────────────────────────────────────────────

// Vault operations
ipcMain.handle('vault:getPath', () => {
  return getVaultPath()
})

ipcMain.handle('vault:select', async () => {
  if (!win) return ''
  const result = await dialog.showOpenDialog(win, {
    title: 'Select Vault Directory',
    properties: ['openDirectory', 'createDirectory'],
  })
  if (result.canceled || result.filePaths.length === 0) return ''
  const vaultPath = result.filePaths[0]
  ensureVaultStructure(vaultPath)
  writeConfig({ vaultPath })
  return vaultPath
})

ipcMain.handle('vault:setPath', (_event, vaultPath: string) => {
  ensureVaultStructure(vaultPath)
  writeConfig({ vaultPath })
  return vaultPath
})

// Document import
ipcMain.handle('dialog:selectPdf', async () => {
  if (!win) return null
  const vaultPath = getVaultPath()
  if (!vaultPath) return null

  const result = await dialog.showOpenDialog(win, {
    title: 'Select PDF',
    filters: [{ name: 'PDF Documents', extensions: ['pdf'] }],
    properties: ['openFile'],
  })
  if (result.canceled || result.filePaths.length === 0) return null

  const srcPath = result.filePaths[0]
  const fileName = path.basename(srcPath)
  const dest = path.join(vaultPath, 'documents', fileName)
  fs.copyFileSync(srcPath, dest)
  return { filePath: `siltflow://documents/${fileName}`, fileName }
})

// Custom protocol → serve files from vault
ipcMain.handle('file:load', async (_event, filePath: string) => {
  return fs.readFileSync(filePath).buffer
})

// ── App Bootstrap ─────────────────────────────────────────────────
app.whenReady().then(async () => {
  // Register siltflow:// protocol → vault path
  protocol.handle('siltflow', (request) => {
    let relativePath = decodeURIComponent(request.url.slice('siltflow://'.length))
    if (relativePath.startsWith('/')) relativePath = relativePath.slice(1)
    const vault = getVaultPath()
    if (!vault) return new Response('Vault not set', { status: 404 })
    const fullPath = path.resolve(vault, relativePath)
    return net.fetch(new URL(fullPath, 'file:///').href)
  })

  if (VITE_DEV_SERVER_URL) {
    await installDevTools()
  }
  createWindow()
})
