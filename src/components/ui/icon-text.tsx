import { type LucideIcon } from "lucide-react";

type IconSize = "xs" | "sm" | "md" | "lg";

const ICON_CLASSES: Record<IconSize, string> = {
  xs: "h-3 w-3",
  sm: "h-3.5 w-3.5",
  md: "h-4 w-4",
  lg: "h-5 w-5",
};

export interface IconTextProps {
  icon: LucideIcon;
  children: React.ReactNode;
  size?: IconSize;
  className?: string;
}

/** Renders a Lucide icon followed by text. */
export function IconText({
  icon: Icon,
  children,
  size = "sm",
  className = "",
}: IconTextProps) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <Icon className={`${ICON_CLASSES[size]} shrink-0`} />
      <span>{children}</span>
    </span>
  );
}
