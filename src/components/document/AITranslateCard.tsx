import { Highlighter, Trash2, Sparkles, Loader2, Volume2, Pencil } from "lucide-react"
import { useState, useRef, useEffect } from "react"
import type { AnnotationItem } from "@/stores/annotation.store"
import { IconText } from "@/components/ui/icon-text"
import { KnuthPlassText } from "@/components/ui/KnuthPlassText"
import { useTTS } from "@/lib/use-tts"
import { useAnnotationStore } from "@/stores/annotation.store"
import { useStyleStore, buildFontStack } from "@/stores/style.store"

interface AITranslateCardProps {
  id: string
  item: AnnotationItem
  onDelete: (id: string) => void
  onTranslate: (id: string) => void
  onClick?: () => void
  scrolled?: boolean
  className?: string
  expanded: boolean
  onToggleExpand: (id: string) => void
}

// ── Backward-compat helpers ─────────────────────────────────────────────

function getTranslation(ai: NonNullable<AnnotationItem["aiResult"]>): string | undefined {
  return ai.translation || ai.translate
}

function getDefinitions(ai: NonNullable<AnnotationItem["aiResult"]>) {
  if (ai.definitions && ai.definitions.length > 0) {
    return ai.definitions.filter(d => d.definition || d.gloss)
  }
  if (ai.words && ai.words.length > 0) {
    return ai.words.filter(w => w.word).map(w => ({
      pos: w.pos,
      definition: w.word,
      gloss: w.meaning,
      _legacyWord: w.word,
    }))
  }
  return []
}

function getCollocations(ai: NonNullable<AnnotationItem["aiResult"]>) {
  if (ai.collocations && ai.collocations.length > 0) return ai.collocations
  if (ai.frequently && ai.frequently.length > 0) return ai.frequently
  return []
}

function getIpa(ai: NonNullable<AnnotationItem["aiResult"]>): string | undefined {
  return ai.pronunciation?.ipa || ai.phonetic
}

function getDifficulty(ai: NonNullable<AnnotationItem["aiResult"]>): string | undefined {
  return ai.metadata?.difficulty || ai.difficulty_level
}

function getTags(ai: NonNullable<AnnotationItem["aiResult"]>): string[] | undefined {
  return ai.metadata?.tags || ai.category_tags
}

function getRegister(ai: NonNullable<AnnotationItem["aiResult"]>): string | undefined {
  return ai.metadata?.register
}

function getAlternatives(ai: NonNullable<AnnotationItem["aiResult"]>) {
  if (ai.alternatives && ai.alternatives.length > 0) return ai.alternatives
  if (ai.words) {
    const syns = ai.words.filter(w => w.pos === "syn")
    if (syns.length > 0) return syns.map(s => ({ expression: s.word, register: undefined as string | undefined }))
  }
  return []
}

function inferGranularity(ai: NonNullable<AnnotationItem["aiResult"]>, text: string): string {
  if (ai.granularity) return ai.granularity
  const t = text.trim()
  if (t.includes("\n") || (t.split(" ").length > 30 && t.includes("."))) return "passage"
  if (t.split(/[.!?;]+/).filter(Boolean).length > 1) return "sentence"
  if (t.split(" ").length > 2) return "phrase"
  return "word"
}

function hasDetails(ai: NonNullable<AnnotationItem["aiResult"]>): boolean {
  const coll = getCollocations(ai)
  const alts = getAlternatives(ai)
  const defs = getDefinitions(ai)
  const exs = ai.examples
  const register = getRegister(ai)
  const contextSentence = ai.context_sentence
  if (coll.length > 0) return true
  if (alts.length > 0) return true
  if (exs && exs.length > 0) return true
  if (register) return true
  if (contextSentence) return true
  if (defs.length > 1) return true
  return false
}

// ── Component ──────────────────────────────────────────────────────────

export function AITranslateCard({
  id,
  item,
  onDelete,
  onTranslate,
  onClick,
  scrolled,
  className = "",
  expanded,
  onToggleExpand,
}: AITranslateCardProps) {
  const ai = item.aiResult
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState(item.text)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const tts = useTTS()
  const updateItem = useAnnotationStore((s) => s.updateItem)
  const style = useStyleStore((s) => s.style)

  useEffect(() => {
    setEditText(item.text)
  }, [item.text])

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    onDelete(id)
  }

  const handleEditToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (editing) {
      updateItem(id, { text: editText })
    }
    setEditing(!editing)
  }

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      updateItem(id, { text: editText })
      setEditing(false)
    }
    if (e.key === "Escape") {
      setEditText(item.text)
      setEditing(false)
    }
  }

  const handleCardClick = () => {
    if (ai) {
      onToggleExpand(id)
    }
    onClick?.()
  }

  const translation = ai ? getTranslation(ai) : undefined
  const defs = ai ? getDefinitions(ai) : []
  const colls = ai ? getCollocations(ai) : []
  const ipa = ai ? getIpa(ai) : undefined
  const difficulty = ai ? getDifficulty(ai) : undefined
  const tags = ai ? getTags(ai) : undefined
  const register = ai ? getRegister(ai) : undefined
  const alts = ai ? getAlternatives(ai) : []
  const examples = ai?.examples ?? []
  const contextSentence = ai?.context_sentence
  const granularity = ai ? inferGranularity(ai, item.text) : "highlight"
  const isWord = granularity === "word" || granularity === "phrase"
  const isDetailAvailable = ai ? hasDetails(ai) : false

  return (
    <div
      className={`w-full min-w-0 rounded-lg border border-border/80 bg-base shadow-sm p-3 transition-colors cursor-pointer ${
        scrolled ? "bg-accent/40 border-accent" : "hover:border-accent"
      } ${className}`}
      onClick={handleCardClick}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-2 min-w-0">
          <IconText icon={Highlighter} size="xs">
            <span className="font-medium text-muted-foreground uppercase tracking-wider">
              {granularity}
            </span>
          </IconText>
          <span className="text-muted-foreground">p.{item.pageNumber}</span>
        </div>
      </div>

      {/* Source text — editable */}
      {editing ? (
        <textarea
          ref={inputRef}
          className="w-full rounded border bg-background px-2 py-1 resize-none min-h-[60px]"
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          onKeyDown={handleEditKeyDown}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <KnuthPlassText
          text={item.text}
          className="mb-1"
        />
      )}

      {/* Action bar — icon-only buttons */}
      <div className="flex flex-wrap items-center gap-1 mt-1.5">
        <button
          className={`inline-flex items-center justify-center rounded border border-border/50 bg-muted/40 p-1 transition-colors ${
            editing
              ? "text-primary"
              : "text-maroon hover:bg-accent"
          }`}
          onClick={handleEditToggle}
          title={editing ? "Save" : "Edit"}
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>

        <button
          className={`inline-flex items-center justify-center rounded border border-border/50 bg-muted/40 p-1 transition-colors ${
            tts.state === "playing"
              ? "text-primary"
              : "text-maroon hover:bg-accent"
          }`}
          onClick={(e) => {
            e.stopPropagation()
            if (tts.state === "playing") tts.stop()
            else tts.speak(item.text)
          }}
          title={tts.state === "playing" ? "Stop" : "Read aloud"}
        >
          {tts.state === "loading" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Volume2 className="h-3.5 w-3.5" />
          )}
        </button>

        {ai === undefined && (
          <button
            className="inline-flex items-center justify-center rounded border border-border/50 bg-muted/40 p-1 text-maroon hover:bg-accent transition-colors"
            onClick={(e) => {
              e.stopPropagation()
              onTranslate(id)
            }}
            title="Translate"
          >
            <Sparkles className="h-3.5 w-3.5" />
          </button>
        )}

        {ai === null && (
          <span className="inline-flex items-center justify-center rounded border border-border/50 bg-muted/40 p-1 text-maroon/60">
            <Loader2 className="h-3 w-3 animate-spin" />
          </span>
        )}

        {ai !== undefined && ai !== null && (
          <button
            className="inline-flex items-center justify-center rounded border border-border/50 bg-muted/40 p-1 text-maroon hover:bg-accent transition-colors"
            onClick={(e) => {
              e.stopPropagation()
              onTranslate(id)
            }}
            title="Re-translate"
          >
            <Sparkles className="h-3.5 w-3.5" />
          </button>
        )}

        <button
          className="ml-auto inline-flex items-center justify-center rounded border border-border/50 bg-muted/40 p-1 text-maroon hover:bg-accent hover:text-destructive transition-colors"
          onClick={handleDelete}
          title="Delete"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* AI result content */}
      {ai && (
        <div
          className="mt-1.5 space-y-1"
          style={{
            fontFamily: buildFontStack(style.fontFamilies),
            fontSize: style.fontSize,
          }}
        >
          {translation && (
            <p className="font-medium text-primary leading-relaxed">{translation}</p>
          )}

          {ai.lemma && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-semibold text-foreground">{ai.lemma}</span>
              {ai.pos && (
                <span className="rounded bg-peach/15 px-1.5 py-0.5 text-peach font-mono">
                  {ai.pos}
                </span>
              )}
              {register && (
                <span className="rounded bg-peach/15 px-1.5 py-0.5 text-peach">
                  {register}
                </span>
              )}
            </div>
          )}

          {ipa && isWord && (
            <p className="text-muted-foreground/70 italic leading-relaxed">{ipa.startsWith("/") ? ipa : `/${ipa}/`}</p>
          )}

          {(difficulty || (tags && tags.length > 0)) && (
            <div className="flex flex-wrap gap-1">
              {difficulty && (
                <span className="rounded bg-peach/15 px-1.5 py-0.5 text-peach">
                  {difficulty}
                </span>
              )}
              {tags?.slice(0, 3).map((tag) => (
                <span key={tag} className="rounded bg-peach/15 px-1.5 py-0.5 text-peach">
                  {tag}
                </span>
              ))}
            </div>
          )}

          {defs.length > 0 && (
            <div className="space-y-0.5">
              {defs.slice(0, 5).map((d: any, i) => (
                <div key={i} className="leading-relaxed">
                  {d._legacyWord ? (
                    <>
                      <span className="font-medium">{d._legacyWord}</span>
                      {d.pos && <span className="text-muted-foreground/60 ml-1">{d.pos}</span>}
                      <span className="text-muted-foreground ml-1">{d.gloss || d.meaning}</span>
                    </>
                  ) : (
                    <>
                      {d.definition && <span className="text-foreground">{d.definition}</span>}
                      {d.gloss && <span className="text-muted-foreground/70 ml-1">{d.gloss}</span>}
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          {contextSentence && !expanded && (
            <p className="text-muted-foreground/80 italic leading-relaxed truncate">
              "{contextSentence}"
            </p>
          )}

          {expanded && isDetailAvailable && (
            <div className="space-y-1.5 text-muted-foreground border-t pt-1.5 leading-relaxed">
              {examples.length > 0 && (
                <div>
                  <span className="font-medium text-foreground flex items-center justify-center mb-0.5 text-center">
                    Examples
                  </span>
                  <ul className="space-y-1">
                    {examples.slice(0, 5).map((ex: any, i) => (
                      <li key={i}>
                        <span className="text-foreground">{ex.sentence}</span>
                        {ex.translation && (
                          <span className="text-muted-foreground block ml-0">
                            {ex.translation}
                            {ex.source === "context" && (
                              <span className="text-muted-foreground/50 ml-1">(from text)</span>
                            )}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {colls.length > 0 && (
                <div>
                  <span className="font-medium text-foreground flex items-center justify-center mb-0.5 text-center">
                    Collocations
                  </span>
                  <div className="space-y-0.5">
                    {colls.map((c: any, i) => (
                      <div key={i} className="leading-relaxed">
                        <span className="font-medium text-foreground">{c.phrase}</span>
                        <span className="text-muted-foreground"> {c.translation}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {alts.length > 0 && (
                <div>
                  <span className="font-medium text-foreground flex items-center justify-center mb-0.5 text-center">
                    Alternatives
                  </span>
                  <div className="space-y-0.5">
                    {alts.map((a: any, i) => (
                      <div key={i} className="leading-relaxed">
                        <span className="font-medium text-foreground">{a.expression}</span>
                        {a.register && (
                          <span className="text-muted-foreground/60 ml-1">({a.register})</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
