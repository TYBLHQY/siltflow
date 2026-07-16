"use client";

import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef } from "react";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ctp-mauve/50 focus-visible:ring-ctp-mauve/50 focus-visible:ring-[3px] aria-invalid:ring-ctp-red/20 dark:aria-invalid:ring-ctp-red/40 aria-invalid:border-ctp-red",
  {
    variants: {
      variant: {
        default:
          "bg-ctp-mauve text-ctp-crust shadow-xs hover:bg-ctp-mauve/90",
        destructive:
          "bg-ctp-red text-ctp-crust shadow-xs hover:bg-ctp-red/90 focus-visible:ring-ctp-red/20 dark:focus-visible:ring-ctp-red/40 dark:bg-ctp-red/60",
        outline:
          "border bg-ctp-base shadow-xs hover:bg-ctp-surface0 dark:bg-ctp-surface0/30 dark:border-ctp-surface0",
        secondary:
          "bg-ctp-surface0 text-ctp-text shadow-xs hover:bg-ctp-surface0/80",
        ghost:
          "hover:bg-ctp-surface0 hover:text-ctp-text dark:hover:bg-ctp-surface0/50",
        link: "text-ctp-mauve underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
