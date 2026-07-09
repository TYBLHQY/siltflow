import { useState, useCallback } from "react"
import { VaultSetup } from "@/components/layout/VaultSetup"
import { ThreeColumnLayout } from "@/components/layout/ThreeColumnLayout"

function App() {
  const [vaultReady, setVaultReady] = useState(false)

  const handleReady = useCallback(() => {
    setVaultReady(true)
  }, [])

  if (!vaultReady) {
    return <VaultSetup onReady={handleReady} />
  }

  return <ThreeColumnLayout />
}

export default App
