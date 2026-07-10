import { memo } from "react"
import { useStyleStore, buildFontStack } from "@/stores/style.store"

export interface KnuthPlassTextProps {
  text: string
  className?: string
}

/**
 * Renders text using simple web-native line-breaking instead of Knuth-Plass.
 * Preserves the same interface for backward compatibility.
 */
export const KnuthPlassText = memo(function KnuthPlassText({
  text,
  className = "",
}: KnuthPlassTextProps) {
  const style = useStyleStore((s) => s.style)

  if (!text) return null

  return (
    <p
      className={className}
      style={{
        fontFamily: buildFontStack(style.fontFamilies),
        fontSize: style.fontSize,
        lineHeight: 1.6,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
      }}
    >
      {text}
    </p>
  )
})
