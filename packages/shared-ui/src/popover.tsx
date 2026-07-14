"use client";

import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  createElement,
  isValidElement,
  type ReactNode,
} from "react";
import { cn } from "./cn.js";

// ── Context ──────────────────────────────────────────────────────────────

interface PopoverContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const PopoverContext = createContext<PopoverContextValue | null>(null);

function usePopoverContext() {
  const ctx = useContext(PopoverContext);
  if (!ctx) throw new Error("Popover components must be used within <Popover>");
  return ctx;
}

// ── Root ─────────────────────────────────────────────────────────────────

function Popover({ children, open: controlledOpen, onOpenChange }: {
  children: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [uncontrolled, setUncontrolled] = useState(false);
  const open = controlledOpen ?? uncontrolled;
  const setOpen = useCallback(
    (v: boolean) => {
      if (onOpenChange) onOpenChange(v);
      else setUncontrolled(v);
    },
    [onOpenChange],
  );

  return (
    <PopoverContext.Provider value={{ open, setOpen }}>
      {children}
    </PopoverContext.Provider>
  );
}

// ── Trigger ──────────────────────────────────────────────────────────────

interface PopoverTriggerProps {
  children: ReactNode;
  asChild?: boolean;
}

function PopoverTrigger({ children, asChild, ...props }: PopoverTriggerProps & Record<string, unknown>) {
  const { open, setOpen } = usePopoverContext();
  const onClick = () => setOpen(!open);

  if (asChild && isValidElement(children)) {
    return createElement(children.type, {
      ...children.props,
      onClick,
    });
  }

  return (
    <button type="button" onClick={onClick} {...props}>
      {children}
    </button>
  );
}

// ── Portal ───────────────────────────────────────────────────────────────

function PopoverPortal({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

// ── Content ──────────────────────────────────────────────────────────────

interface PopoverContentProps extends React.HTMLAttributes<HTMLDivElement> {
  align?: "start" | "center" | "end";
  sideOffset?: number;
}

const PopoverContent = forwardRef<HTMLDivElement, PopoverContentProps>(
  ({ className, align = "center", sideOffset = 4, children, ...props }, ref) => {
    const { open, setOpen } = usePopoverContext();
    const contentRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
      if (!open) return;
      const handler = (e: MouseEvent) => {
        if (contentRef.current && !contentRef.current.contains(e.target as Node)) {
          setOpen(false);
        }
      };
      document.addEventListener("mousedown", handler);
      return () => document.removeEventListener("mousedown", handler);
    }, [open, setOpen]);

    // Close on Escape
    useEffect(() => {
      if (!open) return;
      const handler = (e: KeyboardEvent) => {
        if (e.key === "Escape") setOpen(false);
      };
      document.addEventListener("keydown", handler);
      return () => document.removeEventListener("keydown", handler);
    }, [open, setOpen]);

    if (!open) return null;

    return (
      <PopoverPortal>
        <div
          ref={(node) => {
            (contentRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
            if (typeof ref === "function") ref(node);
            else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
          }}
          className={cn(
            "z-50 w-72 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            className,
          )}
          style={{
            position: "fixed",
            ...(align === "center" ? { left: "50%", transform: "translateX(-50%)" } : {}),
            marginTop: `${sideOffset}px`,
          }}
          {...props}
        >
          {children}
        </div>
      </PopoverPortal>
    );
  },
);
PopoverContent.displayName = "PopoverContent";

export { Popover, PopoverTrigger, PopoverContent };
