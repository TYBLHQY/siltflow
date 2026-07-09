/// <reference types="vite/client" />

interface SiltflowAPI {
  vaultGetPath: () => Promise<string>
  vaultSelect: () => Promise<string>
  vaultSetPath: (vaultPath: string) => Promise<string>
  vaultConfigGet: () => Promise<Record<string, unknown>>
  vaultConfigSet: (config: Record<string, unknown>) => Promise<void>
  selectPdf: () => Promise<{ id: string; fileName: string; filePath: string; title: string } | null>
  loadFile: (filePath: string) => Promise<ArrayBuffer>
}

interface Window {
  siltflow: SiltflowAPI
}
