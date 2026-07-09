import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable"
import { LeftPanel } from "./LeftPanel"
import { CenterPanel } from "./CenterPanel"
import { RightPanel } from "./RightPanel"
import { useDocumentStore } from "@/stores/document.store"
import { usePanelLayout } from "@/hooks/usePanelLayout"

export function ThreeColumnLayout() {
  const currentDocument = useDocumentStore((s) => s.currentDocument)
  const { layout, loaded, saveLayout } = usePanelLayout()

  // Wait for layout to restore before rendering
  if (!loaded) return null

  return (
    <div className="h-screen w-screen overflow-hidden">
      <ResizablePanelGroup
        direction="horizontal"
        className="h-full"
        onLayout={saveLayout}
      >
        <ResizablePanel
          defaultSize={layout?.[0] ?? 25}
          minSize={18}
          maxSize={40}
        >
          <LeftPanel />
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel defaultSize={layout?.[1] ?? 50} minSize={30}>
          <CenterPanel documentPath={currentDocument?.filePath} />
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel
          defaultSize={layout?.[2] ?? 25}
          minSize={18}
          maxSize={40}
        >
          <RightPanel />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}
