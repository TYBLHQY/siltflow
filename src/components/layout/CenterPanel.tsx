import { BookOpen } from "lucide-react"

export function CenterPanel() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center border-b px-4 py-2">
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
