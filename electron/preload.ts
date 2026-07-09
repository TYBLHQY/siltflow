import { ipcRenderer, contextBridge } from 'electron'

export interface SiltflowAPI {
  // Vault
  vaultGetPath: () => Promise<string>
  vaultSelect: () => Promise<string>
  vaultSetPath: (vaultPath: string) => Promise<string>

  // Documents
  selectPdf: () => Promise<{ filePath: string; fileName: string } | null>
  loadFile: (filePath: string) => Promise<ArrayBuffer>
}

const api: SiltflowAPI = {
  vaultGetPath: () => ipcRenderer.invoke('vault:getPath'),
  vaultSelect: () => ipcRenderer.invoke('vault:select'),
  vaultSetPath: (vaultPath: string) => ipcRenderer.invoke('vault:setPath', vaultPath),
  selectPdf: () => ipcRenderer.invoke('dialog:selectPdf'),
  loadFile: (filePath: string) => ipcRenderer.invoke('file:load', filePath),
}

contextBridge.exposeInMainWorld('siltflow', api)
