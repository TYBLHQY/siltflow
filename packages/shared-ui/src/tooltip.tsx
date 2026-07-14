"use client";

import {
  createElement,
  forwardRef,
  isValidElement,
  useCallback,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cn } from "./cn.js";

/** The tooltip will use this delay unless a different value is provided. */
const DEFAULT_DELAY_DURATION = 300;

// ── Provider ─────────────────────────────────────────────────────────────

function TooltipProvider({ children, delayDuration }: { children: ReactNode; delayDuration?: number }) {
  return <>{children}</>;
}

// ── Tooltip Root ─────────────────────────────────────────────────────────

interface TooltipProps {
  children: ReactNode;
  delayDuration?: number;
}

function Tooltip({ children }: TooltipProps) {
  return <>{children}</>;
}

// ── Trigger ──────────────────────────────────────────────────────────────

interface TooltipTriggerProps {
  children: ReactNode;
  asChild?: boolean;
  /** Shorthand tooltip text rendered inline (optional — use TooltipContent for rich content). */
  tooltip?: string;
}

function TooltipTrigger({ children, asChild, tooltip: _tooltip, ...props }: TooltipTriggerProps) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(() => {
    timerRef.current = setTimeout(() => setVisible(true), DEFAULT_DELAY_DURATION);
  }, []);

  const hide = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setVisible(false);
  }, []);

  const eventProps = {
    onMouseEnter: show,
    onMouseLeave: hide,
    onFocus: show,
    onBlur: hide,
  };

  if (asChild && isValidElement(children)) {
    return createElement(children.type, {
      ...children.props,
      ...props,
      ...eventProps,
    });
  }

  return (
    <span className="relative inline-flex" {...eventProps} {...props}>
      {children}
    </span>
  );
}

// ── Content ──────────────────────────────────────────────────────────────

interface TooltipContentProps extends React.HTMLAttributes<HTMLDivElement> {
  sideOffset?: number;
  side?: "top" | "bottom" | "left" | "right";
}

const TooltipContent = forwardRef<HTMLDivElement, TooltipContentProps>(
  ({ className, sideOffset = 4, side = "top", ...props }, ref) => {
    const style: React.CSSProperties = {};
    if (side === "top") style.marginBottom = `${sideOffset}px`;
    else if (side === "bottom") style.marginTop = `${sideOffset}px`;
    else if (side === "left") style.marginRight = `${sideOffset}px`;
    else if (side === "right") style.marginLeft = `${sideOffset}px`;

    return (
      <div
        ref={ref}
        className={cn(
          "z-50 overflow-hidden rounded-md border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md",
          className,
        )}
        style={style}
        {...props}
      />
    );
  },
);
TooltipContent.displayName = "TooltipContent";

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
