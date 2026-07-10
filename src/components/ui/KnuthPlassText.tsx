import { useRef, useEffect, useState, memo, useMemo } from "react"
import { prepareWithSegments } from "@chenglou/pretext"
import type { PreparedTextWithSegments } from "@chenglou/pretext"
import { useStyleStore } from "@/stores/style.store"
import { hyphenateText } from "@/lib/hyphenation"
import {
  computeOptimalLayout,
  computeWordSpacing,
} from "@/lib/kp-justify"

export interface KnuthPlassTextProps {
  text: string
  maxWidth?: number
  className?: string
  responsive?: boolean
}

/**
 * Renders text using Knuth-Plass optimal line-breaking with full justification.
 *
 * Uses DP-based optimal break-point enumeration (ported from obsidian-pretext)
 * that minimises a badness cost function across all possible line breaks.
 */
export const KnuthPlassText = memo(function KnuthPlassText({
  text,
  maxWidth: maxWidthProp,
  className = "",
  responsive = true,
}: KnuthPlassTextProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [lines, setLines] = useState<
    { text: string; isLast: boolean; maxWidth: number; wordSpacing: number | undefined }[]
  >([])

  const style = useStyleStore((s) => s.style)
  const fontString = `${style.fontSize}px ${style.fontFamily}`
  const unitLineHeight = 1.6

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

  const hyphenWidth = useMemo(() => {
    try {
      const ctx = document.createElement("canvas").getContext("2d")
      if (!ctx) return style.fontSize * 0.35
      ctx.font = fontString
      return ctx.measureText("-").width
    } catch {
      return style.fontSize * 0.35
    }
  }, [fontString, style.fontSize])

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

      let prepared: PreparedTextWithSegments
      try {
        prepared = prepareWithSegments(hyphenateText(text), fontString)
      } catch {
        return
      }

      const computed = computeOptimalLayout({
        segments: prepared.segments,
        widths: prepared.widths,
        maxWidth: w,
        normalSpaceWidth: spaceWidth,
        hyphenWidth,
        minSpacingRatio: 0.4,
        tightThreshold: 0.65,
      })

      setLines(
        computed.map((line) => ({
          text: line.segments.map((s) => s.text).join(""),
          isLast: line.isLast,
          maxWidth: line.maxWidth,
          wordSpacing: computeWordSpacing(line, spaceWidth, 0.4),
        })),
      )
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
  }, [text, fontString, maxWidthProp, responsive, spaceWidth, hyphenWidth])

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
      {lines.map((line, li) => (
        <div
          key={li}
          style={
            line.wordSpacing != null
              ? { wordSpacing: `${line.wordSpacing}px` }
              : undefined
          }
        >
          {line.text || "​"}
        </div>
      ))}
    </div>
  )
})
