import { useRef, useEffect, useState, memo, useMemo } from "react"
import {
  prepareWithSegments,
  layoutNextLineRange,
  materializeLineRange,
  type PreparedTextWithSegments,
} from "@chenglou/pretext"
import { useStyleStore } from "@/stores/style.store"
import { hyphenateText } from "@/lib/hyphenation"

export interface KnuthPlassTextProps {
  text: string
  maxWidth?: number
  className?: string
  responsive?: boolean
}

interface LineRender {
  text: string
  /** Character width (no spaces) */
  wordWidth: number
  /** Inter-word gap count */
  spaceCount: number
  isLast: boolean
}

/**
 * Renders text using Knuth-Plass optimal line-breaking.
 *
 * Pre-processes text with hyphenation (inserts soft hyphens at dictionary
 * and prefix/suffix break points) before feeding it to @chenglou/pretext,
 * which handles soft-hyphen segments natively.
 */
export const KnuthPlassText = memo(function KnuthPlassText({
  text,
  maxWidth: maxWidthProp,
  className = "",
  responsive = true,
}: KnuthPlassTextProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [renderLines, setRenderLines] = useState<LineRender[]>([])
  const [contentWidth, setContentWidth] = useState(0)

  const style = useStyleStore((s) => s.style)
  const fontString = `${style.fontSize}px ${style.fontFamily}`
  const unitLineHeight = 1.6 // unitless multiplier for CSS

  const spaceWidth = useMemo(() => {
    try {
      const ctx = document.createElement("canvas").getContext("2d")
      if (!ctx) return style.fontSize * 0.25
      ctx.font = fontString
      return ctx.measureText(" ").width
    } catch {
      return style.fontSize * 0.25
    }
  }, [fontString, style.fontSize])

  // Build line renders
  useEffect(() => {
    if (!text || !containerRef.current) return

    function doLayout() {
      const container = containerRef.current
      if (!container) return

      const cs = getComputedStyle(container)
      const innerW =
        maxWidthProp ??
        container.clientWidth -
          parseFloat(cs.paddingLeft) -
          parseFloat(cs.paddingRight)
      const w = innerW > 0 ? innerW : 400
      setContentWidth(w)

      let prepared: PreparedTextWithSegments
      try {
        prepared = prepareWithSegments(hyphenateText(text), fontString)
      } catch {
        return
      }

      const segs = prepared.segments
      const widths = prepared.widths
      const kinds = prepared.kinds
      const lines: LineRender[] = []
      let cursor = { segmentIndex: 0, graphemeIndex: 0 }

      while (cursor.segmentIndex < segs.length) {
        const range = layoutNextLineRange(prepared, cursor, w)
        if (!range) break

        const fromSI = range.start.segmentIndex
        const toSI = range.end.segmentIndex
        const isLast = range.end.segmentIndex >= segs.length

        // Does this line break at a soft hyphen?
        const endsWithSoftHyphen =
          toSI > fromSI && kinds[toSI - 1] === "soft-hyphen"

        // Compute wordWidth and spaceCount from raw segments
        let wordWidth = 0
        let spaceCount = 0
        for (let si = fromSI; si < toSI && si < segs.length; si++) {
          if (kinds[si] === "soft-hyphen" || kinds[si] === "hard-break") continue
          const segText = segs[si]
          if (!segText) continue
          if (segText.trim().length === 0) {
            spaceCount++
          } else {
            wordWidth += widths[si]
          }
        }

        // Trailing space doesn't participate in justification
        if (toSI > fromSI) {
          const lastSeg = segs[toSI - 1]
          if (lastSeg && lastSeg.trim().length === 0) {
            spaceCount = Math.max(0, spaceCount - 1)
          }
        }

        // Build visible text, skipping soft-hyphen/hard-break segments
        const lineSegs: string[] = []
        for (let si = fromSI; si < toSI && si < segs.length; si++) {
          if (kinds[si] === "soft-hyphen" || kinds[si] === "hard-break") continue
          const segText = segs[si]
          if (!segText || (segText.trim().length === 0 && si >= toSI - 1)) {
            // skip trailing space
            continue
          }
          lineSegs.push(segText)
        }

        // Append visible hyphen when the line breaks at a soft hyphen
        const lineText = lineSegs.join("") + (endsWithSoftHyphen ? "-" : "")

        lines.push({
          text: lineText,
          wordWidth,
          spaceCount,
          isLast,
        })

        cursor = range.end
      }

      setRenderLines(lines)
    }

    const raf = requestAnimationFrame(() => doLayout())

    if (responsive) {
      const ro = new ResizeObserver(() => doLayout())
      ro.observe(containerRef.current)
      return () => {
        cancelAnimationFrame(raf)
        ro.disconnect()
      }
    }
    return () => cancelAnimationFrame(raf)
  }, [text, fontString, maxWidthProp, responsive, spaceWidth])

  if (!text) return null

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        fontFamily: style.fontFamily,
        fontSize: style.fontSize,
        lineHeight: unitLineHeight,
      }}
    >
      {renderLines.map((line, li) => {
        let wordSpacing: number | undefined

        if (line.spaceCount > 0) {
          if (!line.isLast) {
            const totalGap = contentWidth - line.wordWidth
            if (totalGap > 0) {
              const justifiedSpace = totalGap / line.spaceCount
              wordSpacing = justifiedSpace - spaceWidth
            }
          } else {
            // last line: squeeze if overflow
            const naturalWidth = line.wordWidth + line.spaceCount * spaceWidth
            const overflow = naturalWidth - contentWidth
            if (overflow > 0.5) {
              const squeezePerGap = overflow / line.spaceCount
              wordSpacing = -squeezePerGap
            }
          }
        }

        return (
          <div
            key={li}
            style={
              wordSpacing != null
                ? { wordSpacing: `${wordSpacing}px` }
                : undefined
            }
          >
            {line.text || "​"}
          </div>
        )
      })}
    </div>
  )
})
