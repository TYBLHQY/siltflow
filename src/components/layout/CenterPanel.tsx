import { BookOpen } from "lucide-react"
import { PdfViewer } from "@/components/document/PdfViewer"

interface CenterPanelProps {
  documentPath?: string | null
}

export function CenterPanel({ documentPath }: CenterPanelProps) {
  if (!documentPath) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex h-10 items-center border-b px-3">
          <h1 className="text-sm font-medium">Siltflow</h1>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <BookOpen className="h-12 w-12" />
            <p className="text-sm">Select a document to start reading</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-10 items-center border-b px-3">
        <h1 className="text-sm font-medium truncate">
          {documentPath.split("/").pop()?.split("\\").pop()}
        </h1>
      </div>
      <div className="flex-1 min-h-0">
        <PdfViewer className="h-full w-full" src={documentPath} />
      </div>
    </div>
  )
}
