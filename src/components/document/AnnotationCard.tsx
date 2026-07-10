import { Button } from "@/components/ui/button"
import { Highlighter, Trash2 } from "lucide-react"

interface AnnotationCardProps {
  id: string
  type: string
  text: string
  pageNumber: number
  onDelete: (id: string) => void
  className?: string
  textSize?: "xs" | "sm"
  lineClamp?: 2 | 3
}

export function AnnotationCard({
  id,
  type,
  text,
  pageNumber,
  onDelete,
  className = "",
  textSize = "sm",
  lineClamp = 3,
}: AnnotationCardProps) {
  return (
    <div
      className={`group relative border-b border-border/50 px-3 py-2.5 hover:bg-accent/30 transition-colors ${className}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Highlighter className="h-3 w-3 text-yellow-500 shrink-0" />
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              {type}
            </span>
            <span className="text-[11px] text-muted-foreground">
              p.{pageNumber}
            </span>
          </div>
          <p className={`leading-relaxed ${textSize === "xs" ? "text-xs" : "text-sm"} ${lineClamp === 2 ? "line-clamp-2" : "line-clamp-3"}`}>
            {text || `${type} on page ${pageNumber}`}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={() => onDelete(id)}
        >
          <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
        </Button>
      </div>
    </div>
  )
}
