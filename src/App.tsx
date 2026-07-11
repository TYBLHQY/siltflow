import { useState, useEffect, useCallback } from "react"
import { VaultSetup } from "@/components/layout/VaultSetup"
import { ThreeColumnLayout } from "@/components/layout/ThreeColumnLayout"
import { loadFromVault, useAIStore } from "@/stores/ai.store"
import { loadFSRSParams } from "@/stores/fsrs.store"
import { loadSummariesFromVault } from "@/stores/summary.store"
import { loadStyleFromVault, useStyleStore, buildFontStack } from "@/stores/style.store"
import { loadTTSConfigFromVault } from "@/stores/tts.store"
import { useToastStore } from "@/stores/toast.store"
import { loadShortcutsFromVault } from "@/stores/shortcuts.store"
import { loadLastPages } from "@/stores/pdf-viewer.store"
import { loadThemeFromVault, useThemeStore } from "@/stores/theme.store"
import { loadAppSettingsFromVault, useAppSettingsStore } from "@/stores/app.store"
import { Toast } from "@/components/Toast"
import { Download } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"

function App() {
  const [vaultReady, setVaultReady] = useState(false)
  const aiLoaded = useAIStore((s) => s.loaded)
  const showToast = useToastStore((s) => s.show)
  const appSettingsLoaded = useAppSettingsStore((s) => s.loaded)
  const checkUpdateOnStartup = useAppSettingsStore((s) => s.checkUpdateOnStartup)
  const setCheckUpdateOnStartup = useAppSettingsStore((s) => s.setCheckUpdateOnStartup)

  const [updateDialog, setUpdateDialog] = useState<
    { latestVersion: string } | "checking" | "latest" | "error" | null
  >(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [downloading, setDownloading] = useState(false)
  const [downloaded, setDownloaded] = useState(false)

  useEffect(() => {
    if (vaultReady && !aiLoaded) {
      loadFromVault()
      loadFSRSParams()
      loadSummariesFromVault()
      loadStyleFromVault()
      loadTTSConfigFromVault()
      loadShortcutsFromVault()
      loadLastPages()
      loadThemeFromVault()
      loadAppSettingsFromVault()
    }
  }, [vaultReady, aiLoaded])

  // Intercept <a target="_blank"> clicks → open in system browser
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const anchor = target.closest?.("a")
      if (!anchor?.href || anchor.target !== "_blank") return
      // Skip blob: and javascript: URLs
      if (anchor.href.startsWith("blob:") || anchor.href.startsWith("javascript:")) return
      e.preventDefault()
      window.siltflow.openExternal(anchor.href)
    }
    document.addEventListener("click", handler)
    return () => document.removeEventListener("click", handler)
  }, [])

  // Check for updates on startup if enabled
  useEffect(() => {
    if (!vaultReady || !appSettingsLoaded || !checkUpdateOnStartup) return

    const timer = setTimeout(() => {
      setUpdateDialog("checking")

      const unsubAvailable = window.siltflow.update.onAvailable((info: any) => {
        const tag = info?.version || info?.tag_name || ""
        setUpdateDialog({ latestVersion: tag.startsWith("v") ? tag.slice(1) : tag })
      })
      const unsubNotAvail = window.siltflow.update.onNotAvailable(() => {
        setUpdateDialog("latest")
      })
      const unsubProgress = window.siltflow.update.onDownloadProgress((p) => {
        setProgress(p.percent)
      })
      const unsubDownloaded = window.siltflow.update.onDownloaded(() => {
        setDownloaded(true)
        setDownloading(false)
      })
      const unsubError = window.siltflow.update.onError((msg) => {
        setErrorMsg(msg)
        setUpdateDialog("error")
      })

      window.siltflow.update.check()

      return () => {
        unsubAvailable()
        unsubNotAvail()
        unsubProgress()
        unsubDownloaded()
        unsubError()
      }
    }, 1500)

    return () => clearTimeout(timer)
  }, [vaultReady, appSettingsLoaded, checkUpdateOnStartup])

  // Show toast on mount if no profiles
  useEffect(() => {
    if (aiLoaded && useAIStore.getState().profiles.length === 0) {
      showToast("No AI provider configured — go to Settings > AI Config", "info")
    }
  }, [aiLoaded, showToast])

  // Apply global font size and system font to <html> element
  const globalFontSize = useStyleStore((s) => s.style.globalFontSize)
  const systemFontFamilies = useStyleStore((s) => s.style.systemFontFamilies)
  const systemFontStack = buildFontStack(systemFontFamilies)
  useEffect(() => {
    document.documentElement.style.fontSize = `${globalFontSize}px`
  }, [globalFontSize])
  useEffect(() => {
    document.documentElement.style.fontFamily = systemFontStack
  }, [systemFontStack])

  // ── Theme application ────────────────────────────────────────────────
  const themeConfig = useThemeStore((s) => s.config)
  const resolveTheme = useThemeStore((s) => s.resolveTheme)

  const applyTheme = useCallback(() => {
    const resolved = resolveTheme()
    const html = document.documentElement

    // Remove all flavor classes
    html.classList.remove("catppuccin-latte", "catppuccin-frappe", "catppuccin-macchiato", "catppuccin-mocha")

    // Add the resolved flavor class
    html.classList.add(`catppuccin-${resolved.flavor}`)

    // Sync .dark class for shadcn compatibility
    html.classList.toggle("dark", resolved.isDark)

    // Apply PDF dark invert
    html.dataset.pdfDarkInvert = themeConfig.pdfDarkInvert ? "true" : "false"
  }, [resolveTheme, themeConfig.pdfDarkInvert])

  // Apply on config change
  useEffect(() => {
    applyTheme()
  }, [applyTheme, themeConfig.themeMode, themeConfig.lightTheme, themeConfig.darkTheme])

  // Listen for OS color scheme changes in auto mode
  useEffect(() => {
    if (themeConfig.themeMode !== "auto") return
    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    const handler = () => applyTheme()
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [themeConfig.themeMode, applyTheme])

  const handleReady = () => {
    setVaultReady(true)
  }

  if (!vaultReady) {
    return <VaultSetup onReady={handleReady} />
  }

  return (
    <>
      <Toast />
      <ThreeColumnLayout />

      {/* ── Update dialog (startup check) ── */}
      <Dialog
        open={
          updateDialog !== null &&
          updateDialog !== "checking" &&
          updateDialog !== "latest"
        }
        onOpenChange={() => setUpdateDialog(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Update Available</DialogTitle>
            <DialogDescription>
              {downloaded
                ? `Version ${(updateDialog as any)?.latestVersion} has been downloaded and is ready to install.`
                : `Version ${(updateDialog as any)?.latestVersion} is available.`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 px-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Current version</span>
              <span className="font-medium">{__APP_VERSION__}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">New version</span>
              <span className="font-medium text-green-600">v{(updateDialog as any)?.latestVersion}</span>
            </div>
            <button
              onClick={() => window.siltflow.openExternal(`https://github.com/TYBLHQY/siltflow/releases/tag/v${(updateDialog as any)?.latestVersion}`)}
              className="block text-xs text-primary hover:underline mt-1"
            >
              View release notes →
            </button>
          </div>

          {downloading && (
            <div className="space-y-1 px-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Downloading…</span>
                <span className="text-xs text-muted-foreground">{Math.round(progress)}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          <DialogFooter className="flex-col items-start gap-3">
            <div className="flex items-center gap-2 w-full">
              <input
                type="checkbox"
                id="autoCheckToggle"
                className="rounded"
                checked={checkUpdateOnStartup}
                onChange={() => setCheckUpdateOnStartup(!checkUpdateOnStartup)}
              />
              <label htmlFor="autoCheckToggle" className="text-xs text-muted-foreground">
                Check for updates on startup
              </label>
            </div>
            {downloaded ? (
              <button
                className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                onClick={() => window.siltflow.update.install()}
              >
                Restart &amp; Install
              </button>
            ) : downloading ? (
              <span className="text-xs text-muted-foreground">Downloading…</span>
            ) : (
              <div className="flex gap-2 w-full">
                <button
                  className="flex-1 rounded-md border border-border/50 px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-accent transition-colors"
                  onClick={() => { setUpdateDialog(null); setDownloaded(false); setDownloading(false); setProgress(0) }}
                >
                  Later
                </button>
                <button
                  className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                  onClick={() => {
                    setDownloading(true)
                    window.siltflow.update.download()
                  }}
                >
                  <Download className="h-4 w-4 inline mr-1" />
                  Download
                </button>
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default App
