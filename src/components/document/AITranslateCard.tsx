import { Button } from "@/components/ui/button"
import { Highlighter, Trash2, Sparkles, Loader2, ChevronDown, ChevronRight } from "lucide-react"
import { useState, useCallback } from "react"
import type { AnnotationItem } from "@/stores/annotation.store"
import { reviewAnnotation, getNextReview } from "@/stores/fsrs.store"
import type { Grade } from "ts-fsrs"

interface AITranslateCardProps {
  id: string
  item: AnnotationItem
  onDelete: (id: string) => void
  onTranslate: (id: string) => void
  className?: string
}

const GRADE_LABELS: { grade: Grade; label: string; color: string }[] = [
  { grade: 1, label: "Again", color: "bg-red-500/10 text-red-600 hover:bg-red-500/20" },
  { grade: 2, label: "Hard", color: "bg-orange-500/10 text-orange-600 hover:bg-orange-500/20" },
  { grade: 3, label: "Good", color: "bg-green-500/10 text-green-600 hover:bg-green-500/20" },
  { grade: 4, label: "Easy", color: "bg-blue-500/10 text-blue-600 hover:bg-blue-500/20" },
]

/** Renders a single annotation card, with AI result when available. */
export function AITranslateCard({
  id,
  item,
  onDelete,
  onTranslate,
  className = "",
}: AITranslateCardProps) {
  const ai = item.aiResult
  const [expanded, setExpanded] = useState(false)
  const [reviewed, setReviewed] = useState(false)
  const isWord = ai?.type === "word" || ai?.type === "phrase"
  const isLong = ai?.type === "sentence" || ai?.type === "passage"

  const handleDelete = () => onDelete(id)

  const handleReview = useCallback(
    (grade: Grade) => {
      reviewAnnotation(id, grade)
      setReviewed(true)
      setTimeout(() => setReviewed(false), 1500)
    },
    [id],
  )

  const card = item.fsrsCard
  const nextReview = card ? getNextReview(card) : undefined
  const isDue = nextReview ? nextReview <= new Date() : false

  return (
    <div
      className={`group relative border-b border-border/50 px-3 py-2.5 transition-colors ${className}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex items-center gap-2 min-w-0">
          <Highlighter className="h-3 w-3 text-yellow-500 shrink-0" />
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            {ai?.type ?? "highlight"}
          </span>
          <span className="text-[11px] text-muted-foreground">p.{item.pageNumber}</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity -mt-0.5"
          onClick={handleDelete}
        >
          <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
        </Button>
      </div>

      {/* Source text */}
      <p className="text-sm leading-relaxed mb-1">{item.text}</p>

      {/* AI state: loading / trigger / result */}
      {ai === null && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          Translating…
        </div>
      )}

      {ai === undefined && (
        <button
          className="flex items-center gap-1 text-xs text-primary hover:underline py-1"
          onClick={(e) => {
            e.stopPropagation()
            console.log("[AITranslateCard] AI Translate clicked, id:", id)
            onTranslate(id)
          }}
        >
          <Sparkles className="h-3 w-3" />
          AI Translate
        </button>
      )}

      {ai && (
        <div className="mt-1 space-y-1.5">
          {/* Translation */}
          {ai.translations && ai.translations.length > 0 && (
            <p className="text-sm font-medium text-primary">
              {ai.translations[0]!.target}
              {ai.translations.length > 1 && (
                <span className="text-[10px] text-muted-foreground font-normal ml-1">
                  +{ai.translations.length - 1} more
                </span>
              )}
            </p>
          )}

          {/* Definition */}
          {ai.definitions && ai.definitions[0] && (
            <p className="text-xs text-muted-foreground">
              {ai.definitions[0].part_of_speech && (
                <span className="italic mr-1">{ai.definitions[0].part_of_speech}</span>
              )}
              {ai.definitions[0].definition_local ?? ai.definitions[0].definition}
            </p>
          )}

          {/* Phonetic */}
          {ai.phonetic && isWord && (
            <p className="text-xs text-muted-foreground/70 italic">{ai.phonetic}</p>
          )}

          {/* Difficulty & tags */}
          <div className="flex flex-wrap gap-1">
            {ai.difficulty_level && (
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                {ai.difficulty_level}
              </span>
            )}
            {ai.category_tags?.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>

          {/* FSRS review buttons */}
          <div className="flex flex-wrap gap-1">
            {GRADE_LABELS.map((g) => (
              <button
                key={g.grade}
                className={`rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${g.color}`}
                onClick={() => handleReview(g.grade as Grade)}
              >
                {g.label}
              </button>
            ))}
            {reviewed && (
              <span className="text-[10px] text-muted-foreground italic self-center">✓</span>
            )}
            {nextReview && !reviewed && (
              <span className={`text-[10px] self-center ${isDue ? "text-destructive" : "text-muted-foreground"}`}>
                {formatDue(nextReview)}
              </span>
            )}
          </div>

          {/* Expand for details */}
          <button
            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
            {expanded ? "Less" : "More"}
          </button>

          {expanded && (
            <div className="space-y-1.5 text-xs text-muted-foreground border-t pt-1.5">
              {/* All translations */}
              {ai.translations && ai.translations.length > 1 && (
                <div>
                  <span className="font-medium text-foreground">Translations: </span>
                  {ai.translations.map((t, i) => (
                    <span key={i}>
                      {t.target}
                      {t.context_hint && (
                        <span className="italic"> ({t.context_hint})</span>
                      )}
                      {i < ai.translations!.length - 1 ? "; " : ""}
                    </span>
                  ))}
                </div>
              )}

              {/* All definitions */}
              {ai.definitions && ai.definitions.length > 1 && (
                <div>
                  <span className="font-medium text-foreground">Definitions: </span>
                  {ai.definitions.map((d, i) => (
                    <span key={i}>
                      {d.part_of_speech && <span className="italic">({d.part_of_speech}) </span>}
                      {d.definition_local ?? d.definition}
                      {i < ai.definitions!.length - 1 ? "; " : ""}
                    </span>
                  ))}
                </div>
              )}

              {/* Related terms */}
              {ai.related_terms && ai.related_terms.length > 0 && (
                <div>
                  <span className="font-medium text-foreground">Related: </span>
                  {ai.related_terms.map((r, i) => (
                    <span key={i}>
                      {r.term}
                      {r.term_local && <span> ({r.term_local})</span>}
                      <span className="italic"> — {r.relation}</span>
                      {i < ai.related_terms!.length - 1 ? "; " : ""}
                    </span>
                  ))}
                </div>
              )}

              {/* Usage examples */}
              {ai.usage_examples && ai.usage_examples.length > 0 && (
                <div>
                  <span className="font-medium text-foreground">Examples: </span>
                  {ai.usage_examples.map((ex, i) => (
                    <p key={i} className="italic">
                      "{ex}"
                    </p>
                  ))}
                </div>
              )}

              {ai.usage_notes && (
                <p>
                  <span className="font-medium text-foreground">Usage: </span>
                  {ai.usage_notes}
                </p>
              )}

              {/* Sentence / passage fields */}
              {isLong && ai.grammar_notes && (
                <p>
                  <span className="font-medium text-foreground">Grammar: </span>
                  {ai.grammar_notes}
                </p>
              )}
              {isLong && ai.gist && (
                <p>
                  <span className="font-medium text-foreground">Gist: </span>
                  {ai.gist}
                </p>
              )}
              {isLong && ai.key_terms && ai.key_terms.length > 0 && (
                <div>
                  <span className="font-medium text-foreground">Key terms: </span>
                  <ul className="list-disc list-inside">
                    {ai.key_terms.map((kt, i) => (
                      <li key={i}>
                        <span className="font-medium">{kt.term}</span>
                        <span className="text-muted-foreground"> — {kt.explanation}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/** Format a due date as a relative string. */
function formatDue(date: Date): string {
  const now = new Date()
  const diffMs = date.getTime() - now.getTime()
  if (diffMs <= 0) return "Due"
  const diffMin = Math.round(diffMs / 60000)
  if (diffMin < 60) return `in ${diffMin}m`
  const diffHour = Math.round(diffMin / 60)
  if (diffHour < 24) return `in ${diffHour}h`
  const diffDay = Math.round(diffHour / 24)
  if (diffDay < 30) return `in ${diffDay}d`
  const diffMonth = Math.round(diffDay / 30)
  return `in ${diffMonth}mo`
}
