import { useState, useEffect } from "react"
import { VaultSetup } from "@/components/layout/VaultSetup"
import { ThreeColumnLayout } from "@/components/layout/ThreeColumnLayout"
import { loadFromVault, useAIStore } from "@/stores/ai.store"
import { loadFSRSParams } from "@/stores/fsrs.store"
import { loadSummariesFromVault } from "@/stores/summary.store"
import { loadStyleFromVault, useStyleStore } from "@/stores/style.store"
import { loadTTSConfigFromVault } from "@/stores/tts.store"
import { useToastStore } from "@/stores/toast.store"
import { loadShortcutsFromVault } from "@/stores/shortcuts.store"
import { loadLastPages } from "@/stores/pdf-viewer.store"
import { Toast } from "@/components/Toast"

function App() {
  const [vaultReady, setVaultReady] = useState(false)
  const aiLoaded = useAIStore((s) => s.loaded)
  const showToast = useToastStore((s) => s.show)

  // Load AI profiles and FSRS params when vault is ready
  useEffect(() => {
    if (vaultReady && !aiLoaded) {
      loadFromVault()
      loadFSRSParams()
      loadSummariesFromVault()
      loadStyleFromVault()
      loadTTSConfigFromVault()
      loadShortcutsFromVault()
      loadLastPages()
    }
  }, [vaultReady, aiLoaded])

  // Show toast on mount if no profiles
  useEffect(() => {
    if (aiLoaded && useAIStore.getState().profiles.length === 0) {
      showToast("No AI provider configured — go to Settings > AI Config", "info")
    }
  }, [aiLoaded, showToast])

  // Apply global font size to <html> element
  const globalFontSize = useStyleStore((s) => s.style.globalFontSize)
  useEffect(() => {
    document.documentElement.style.fontSize = `${globalFontSize}px`
  }, [globalFontSize])

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
