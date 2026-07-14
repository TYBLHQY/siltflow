"use client";

import { forwardRef } from "react";
import { cn } from "./cn.js";

/**
 * CSS-only scroll area — no Radix dependency.
 * Custom scrollbar via Tailwind's overflow utilities and styled scrollbar.
 */
const ScrollArea = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "relative overflow-auto",
      /* Custom scrollbar */
      "[&::-webkit-scrollbar]:w-2.5 [&::-webkit-scrollbar]:h-2.5",
      "[&::-webkit-scrollbar-track]:bg-transparent",
      "[&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border",
      className,
    )}
    {...props}
  >
    {children}
  </div>
));
ScrollArea.displayName = "ScrollArea";

const ScrollBar = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { orientation?: "vertical" | "horizontal" }
>(({ className, orientation = "vertical", ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex touch-none select-none transition-colors",
      orientation === "vertical" &&
        "h-full w-2.5 border-l border-l-transparent p-[1px]",
      orientation === "horizontal" &&
        "h-2.5 flex-col border-t border-t-transparent p-[1px]",
      className,
    )}
    {...props}
  >
    <div className="relative flex-1 rounded-full bg-border" />
  </div>
));
ScrollBar.displayName = "ScrollBar";

export { ScrollArea, ScrollBar };
