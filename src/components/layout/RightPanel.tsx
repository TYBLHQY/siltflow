import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Highlighter, MessageSquare } from "lucide-react"
import { useAnnotationStore } from "@/stores/annotation.store"
import { useAIStore } from "@/stores/ai.store"
import { useToastStore } from "@/stores/toast.store"
import { AITranslateCard } from "@/components/document/AITranslateCard"

export function RightPanel() {
  const items = useAnnotationStore((s) => s.items)
  const profiles = useAIStore((s) => s.profiles)
  const removeItem = useAnnotationStore((s) => s.removeItem)
  const updateItem = useAnnotationStore((s) => s.updateItem)
  const showToast = useToastStore((s) => s.show)

  /** Get the active profile from the store's raw state */
  const activeProfile = profiles.find((p) => p.active) ?? profiles[0] ?? null

  const handleTranslate = async (id: string) => {
    const item = items.find((i) => i.id === id)
    if (!item || item.aiResult !== undefined) return

    const profile = activeProfile
    if (!profile) {
      showToast("Please configure an AI provider in Settings > AI Config", "info")
      return
    }

    // Mark as loading
    updateItem(id, { aiResult: null })

    try {
      const { translateAnnotation } = await import("@/lib/translate")
      console.log("[RightPanel] Starting translation for", id, "text:", item.text.slice(0, 50))
      const result = await translateAnnotation(profile, {
        text: item.text,
        targetLang: "zh",
      })
      console.log("[RightPanel] Translation result:", result)
      updateItem(id, { aiResult: result })
    } catch (err) {
      console.error("Translation failed:", err)
      const message = err instanceof Error ? err.message : "Translation failed"
      showToast(message, "error")
      updateItem(id, { aiResult: undefined }) // allow retry
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-10 items-center justify-between border-b px-3">
        <h2 className="text-sm font-semibold text-muted-foreground">Annotations</h2>
        <span className="text-xs text-muted-foreground tabular-nums">
          {items.length}
        </span>
      </div>
      {items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center text-muted-foreground px-4">
          <Highlighter className="h-8 w-8 mb-2" />
          <p className="text-xs text-center">
            Highlight text in the document to add annotations
          </p>
        </div>
      ) : (
        <ScrollArea className="flex-1">
          <div className="space-y-0">
            {items.map((ann) => (
              <AITranslateCard
                key={ann.id}
                id={ann.id}
                item={ann}
                onDelete={(id) => {
                  window.siltflow.annotations.delete(id)
                  removeItem(id)
                }}
                onTranslate={handleTranslate}
              />
            ))}
          </div>
        </ScrollArea>
      )}
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
