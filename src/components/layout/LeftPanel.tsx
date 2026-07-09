import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { FileText, Plus } from "lucide-react"

export function LeftPanel() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between p-3">
        <h2 className="text-sm font-semibold text-muted-foreground">Documents</h2>
        <Button variant="ghost" size="icon" className="h-7 w-7">
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <Separator />
      <ScrollArea className="flex-1 p-2">
        <div className="space-y-1">
          <button className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent transition-colors">
            <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate">Sample Document.pdf</span>
          </button>
        </div>
      </ScrollArea>
      <Separator />
      <div className="p-3">
        <h2 className="text-sm font-semibold text-muted-foreground mb-2">Review Queue</h2>
        <p className="text-xs text-muted-foreground">No documents due</p>
      </div>
    </div>
  )
}
