import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Highlighter, MessageSquare } from "lucide-react"

export function RightPanel() {
  return (
    <div className="flex h-full flex-col">
      <div className="p-3">
        <h2 className="text-sm font-semibold text-muted-foreground">Annotations</h2>
      </div>
      <Separator />
      <ScrollArea className="flex-1 p-2">
        <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
          <Highlighter className="h-8 w-8 mb-2" />
          <p className="text-xs text-center px-4">
            Highlight text in the document to add annotations
          </p>
        </div>
      </ScrollArea>
      <Separator />
      <div className="p-3 space-y-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <MessageSquare className="h-3 w-3" />
          <span>AI analysis will appear here</span>
        </div>
      </div>
    </div>
  )
}
