import { useState, useCallback, useRef } from "react"
import { Allotment } from "allotment"
import "allotment/dist/style.css"
import { LeftPanel } from "./LeftPanel"
import { CenterPanel } from "./CenterPanel"
import { RightPanel } from "./RightPanel"
import { useDocumentStore } from "@/stores/document.store"
import { usePanelLayout } from "@/hooks/usePanelLayout"

const MIN_PANEL_PX = 250
const MAX_PANEL_PX = 600

export function ThreeColumnLayout() {
  const currentDocument = useDocumentStore((s) => s.currentDocument)
  const { layout, loaded, saveLayout } = usePanelLayout()

  const [leftCollapsed, setLeftCollapsed] = useState(false)
  const [rightCollapsed, setRightCollapsed] = useState(false)

  const leftPanelRef = useRef<HTMLDivElement>(null)
  const rightPanelRef = useRef<HTMLDivElement>(null)

  const handleToggleLeft = useCallback(() => {
    if (!leftPanelRef.current) return
    const parent = leftPanelRef.current.parentElement
    if (!parent) return
    // allotment collapses by setting the pane to 0
    // we toggle via a CSS class and the pane collapses
    setLeftCollapsed((c) => !c)
  }, [])

  const handleToggleRight = useCallback(() => {
    setRightCollapsed((c) => !c)
  }, [])

  // Wait for layout to restore before rendering
  if (!loaded) return null

  // Convert saved percentages to pixel sizes based on a typical window.
  // If saved layout exists, weight left/right as initial sizes in pixels.
  const leftSize = layout?.[0] ? Math.round((layout[0] / 100) * window.innerWidth) : 250
  const rightSize = layout?.[2] ? Math.round((layout[2] / 100) * window.innerWidth) : 250

  return (
    <div className="h-screen w-screen">
      <Allotment
        defaultSizes={[leftSize, Math.max(window.innerWidth - leftSize - rightSize, 400), rightSize]}
        onChange={(sizes) => {
          if (sizes.length === 3) {
            const total = sizes[0] + sizes[1] + sizes[2]
            if (total > 0) {
              saveLayout([
                Math.round((sizes[0] / total) * 100),
                Math.round((sizes[1] / total) * 100),
                Math.round((sizes[2] / total) * 100),
              ])
            }
          }
        }}
        separator
      >
        <Allotment.Pane
          minSize={MIN_PANEL_PX}
          maxSize={MAX_PANEL_PX}
          preferredSize={250}
          visible={!leftCollapsed}
        >
          <div ref={leftPanelRef} className="h-full">
            <LeftPanel />
          </div>
        </Allotment.Pane>

        <Allotment.Pane minSize={400}>
          <CenterPanel
            documentPath={currentDocument?.filePath}
            documentId={currentDocument?.id}
            leftCollapsed={leftCollapsed}
            rightCollapsed={rightCollapsed}
            onToggleLeft={handleToggleLeft}
            onToggleRight={handleToggleRight}
          />
        </Allotment.Pane>

        <Allotment.Pane
          minSize={MIN_PANEL_PX}
          maxSize={MAX_PANEL_PX}
          preferredSize={250}
          visible={!rightCollapsed}
        >
          <div ref={rightPanelRef} className="h-full">
            <RightPanel />
          </div>
        </Allotment.Pane>
      </Allotment>
    </div>
  )
}
