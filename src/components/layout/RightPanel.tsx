import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Highlighter, Trash2, MessageSquare } from "lucide-react"
import { useAnnotationStore } from "@/stores/annotation.store"

export function RightPanel() {
  const items = useAnnotationStore((s) => s.items)

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-10 items-center justify-between border-b px-3">
        <h2 className="text-sm font-semibold text-muted-foreground">Annotations</h2>
        <span className="text-xs text-muted-foreground tabular-nums">
          {items.length}
        </span>
      </div>
      <ScrollArea className="flex-1">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground px-4">
            <Highlighter className="h-8 w-8 mb-2" />
            <p className="text-xs text-center">
              Highlight text in the document to add annotations
            </p>
          </div>
        ) : (
          <div className="space-y-0">
            {items.map((ann) => (
              <AnnotationCard key={ann.id} annotation={ann} />
            ))}
          </div>
        )}
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

interface AnnotationCardProps {
  annotation: {
    id: string
    type: string
    text: string
    pageNumber: number
  }
}

function AnnotationCard({ annotation }: AnnotationCardProps) {
  const queueDelete = useAnnotationStore((s) => s.queueDelete)

  const handleDelete = () => {
    queueDelete(annotation.id, annotation.pageNumber)
  }

  return (
    <div className="group relative border-b border-border/50 px-3 py-2.5 hover:bg-accent/30 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Highlighter className="h-3 w-3 text-yellow-500 shrink-0" />
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              {annotation.type}
            </span>
            <span className="text-[11px] text-muted-foreground">
              p.{annotation.pageNumber + 1}
            </span>
          </div>
          <p className="text-sm leading-relaxed line-clamp-3">
            {annotation.text || "No text content"}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={handleDelete}
        >
          <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
        </Button>
      </div>
    </div>
  )
}
