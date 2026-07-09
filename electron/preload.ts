import { ipcRenderer, contextBridge } from 'electron'

export interface SiltflowAPI {
  // Vault
  vaultGetPath: () => Promise<string>
  vaultSelect: () => Promise<string>
  vaultSetPath: (vaultPath: string) => Promise<string>

  // Vault config (stored in vault/.siltflow/config.json)
  vaultConfigGet: () => Promise<Record<string, unknown>>
  vaultConfigSet: (config: Record<string, unknown>) => Promise<void>

  // Documents
  selectPdf: () => Promise<{ id: string; fileName: string; filePath: string; title: string } | null>
  loadFile: (filePath: string) => Promise<ArrayBuffer>
}

const api: SiltflowAPI = {
  vaultGetPath: () => ipcRenderer.invoke('vault:getPath'),
  vaultSelect: () => ipcRenderer.invoke('vault:select'),
  vaultSetPath: (vaultPath: string) => ipcRenderer.invoke('vault:setPath', vaultPath),
  vaultConfigGet: () => ipcRenderer.invoke('vault:config:get'),
  vaultConfigSet: (config) => ipcRenderer.invoke('vault:config:set', config),
  selectPdf: () => ipcRenderer.invoke('dialog:selectPdf'),
  loadFile: (filePath: string) => ipcRenderer.invoke('file:load', filePath),
}

contextBridge.exposeInMainWorld('siltflow', api)
