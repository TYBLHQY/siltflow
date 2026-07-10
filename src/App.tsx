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
import { Toast } from "@/components/Toast"

function App() {
  const [vaultReady, setVaultReady] = useState(false)
  const aiLoaded = useAIStore((s) => s.loaded)
  const showToast = useToastStore((s) => s.show)

  // Load persisted state when vault is ready
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
    }
  }, [vaultReady, aiLoaded])

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
    </>
  )
}

export default App
