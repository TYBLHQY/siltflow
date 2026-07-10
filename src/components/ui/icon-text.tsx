import { type LucideIcon } from "lucide-react"

type IconSize = "xs" | "sm" | "md" | "lg"

const ICON_CLASSES: Record<IconSize, string> = {
  xs: "h-3 w-3",
  sm: "h-3.5 w-3.5",
  md: "h-4 w-4",
  lg: "h-5 w-5",
}

export interface IconTextProps {
  icon: LucideIcon
  children: React.ReactNode
  size?: IconSize
  className?: string
}

/**
 * Renders a Lucide icon followed by text, properly baseline-aligned.
 *
 * The icon SVG is geometrically centered within its viewBox, while text
 * glyphs sit near the baseline of their line-height box.  A 1px translateY
 * on the text span compensates for this and makes the visual centers align.
 */
export function IconText({ icon: Icon, children, size = "sm", className = "" }: IconTextProps) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <Icon className={`${ICON_CLASSES[size]} shrink-0`} />
      <span className="translate-y-px">{children}</span>
    </span>
  )
}
