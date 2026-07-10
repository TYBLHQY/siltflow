import { app, BrowserWindow, Menu, protocol, net, dialog, ipcMain } from 'electron'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

import { initDatabase } from './database'
import { registerDocumentHandlers } from './ipc/documents.ipc'
import { registerAnnotationHandlers } from './ipc/annotations.ipc'
import { registerSummaryHandlers } from './ipc/summaries.ipc'

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
const VAULT_CONFIG_DIR = app.getPath('userData')
const VAULT_POINTER_PATH = path.join(VAULT_CONFIG_DIR, 'vault-path.json')

const SILTFLOW_DIR = '.siltflow'

function getVaultPath(): string {
  try {
    const data = JSON.parse(fs.readFileSync(VAULT_POINTER_PATH, 'utf-8'))
    if (data.vaultPath && fs.existsSync(data.vaultPath)) {
      return data.vaultPath
    }
  } catch {}
  return ''
}

function setVaultPath(vaultPath: string) {
  if (!fs.existsSync(VAULT_CONFIG_DIR)) {
    fs.mkdirSync(VAULT_CONFIG_DIR, { recursive: true })
  }
  fs.writeFileSync(VAULT_POINTER_PATH, JSON.stringify({ vaultPath }, null, 2))
}

function vaultConfigPath(vaultPath: string): string {
  return path.join(vaultPath, SILTFLOW_DIR, 'config.json')
}

function readVaultConfig(vaultPath: string): Record<string, unknown> {
  try {
    return JSON.parse(fs.readFileSync(vaultConfigPath(vaultPath), 'utf-8'))
  } catch {
    return {}
  }
}

function writeVaultConfig(vaultPath: string, config: Record<string, unknown>) {
  const p = vaultConfigPath(vaultPath)
  // Merge with existing config so we don't overwrite other keys
  let existing: Record<string, unknown> = {}
  try {
    existing = JSON.parse(fs.readFileSync(p, 'utf-8'))
  } catch { /* file doesn't exist yet */ }
  if (!fs.existsSync(path.dirname(p))) {
    fs.mkdirSync(path.dirname(p), { recursive: true })
  }
  fs.writeFileSync(p, JSON.stringify({ ...existing, ...config }, null, 2))
}

function ensureVaultStructure(vaultPath: string) {
  const dirs = [
    path.join(vaultPath, SILTFLOW_DIR),
    path.join(vaultPath, 'documents'),
  ]
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
  }
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
  setVaultPath(vaultPath)
  initDatabase(vaultPath)
  registerDocumentHandlers()
  registerAnnotationHandlers()
  registerSummaryHandlers()
  return vaultPath
})

ipcMain.handle('vault:setPath', (_event, vaultPath: string) => {
  ensureVaultStructure(vaultPath)
  setVaultPath(vaultPath)
  initDatabase(vaultPath)
  registerDocumentHandlers()
  registerAnnotationHandlers()
  registerSummaryHandlers()
  return vaultPath
})

// Vault config (all user config lives in vault/.siltflow/config.json)
ipcMain.handle('vault:config:get', () => {
  const vault = getVaultPath()
  if (!vault) return {}
  return readVaultConfig(vault)
})

ipcMain.handle('vault:config:set', (_event, config: Record<string, unknown>) => {
  const vault = getVaultPath()
  if (!vault) return
  writeVaultConfig(vault, config)
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
  const docId = crypto.randomUUID()
  const docDir = path.join(vaultPath, 'documents', docId)
  const dest = path.join(docDir, fileName)

  fs.mkdirSync(docDir, { recursive: true })
  fs.copyFileSync(srcPath, dest)

  return {
    id: docId,
    fileName,
    filePath: `siltflow://documents/${docId}/${fileName}`,
    title: fileName.replace(/\.pdf$/i, ''),
  }
})

// Custom protocol → serve files from vault
ipcMain.handle('file:load', async (_event, filePath: string) => {
  return fs.readFileSync(filePath).buffer
})

// ── App Bootstrap ─────────────────────────────────────────────────
app.whenReady().then(async () => {
  // Initialize database if vault is set
  const vaultPath = getVaultPath()
  if (vaultPath) {
    initDatabase(vaultPath)
    registerDocumentHandlers()
    registerAnnotationHandlers()
  }

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
