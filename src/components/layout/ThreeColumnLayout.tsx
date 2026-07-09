import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable"
import { LeftPanel } from "./LeftPanel"
import { CenterPanel } from "./CenterPanel"
import { RightPanel } from "./RightPanel"

export function ThreeColumnLayout() {
  return (
    <div className="h-screen w-screen overflow-hidden">
      <ResizablePanelGroup direction="horizontal" className="h-full">
        <ResizablePanel defaultSize={25} minSize={18} maxSize={40}>
          <LeftPanel />
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel defaultSize={50} minSize={30}>
          <CenterPanel />
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel defaultSize={25} minSize={18} maxSize={40}>
          <RightPanel />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}
