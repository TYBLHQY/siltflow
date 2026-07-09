/// <reference types="vite/client" />

interface SiltflowAPI {
  vaultGetPath: () => Promise<string>
  vaultSelect: () => Promise<string>
  vaultSetPath: (vaultPath: string) => Promise<string>
  selectPdf: () => Promise<{ filePath: string; fileName: string } | null>
  loadFile: (filePath: string) => Promise<ArrayBuffer>
}

interface Window {
  siltflow: SiltflowAPI
}
