"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-2)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)] disabled:opacity-50 disabled:pointer-events-none",
  {
    variants: {
      variant: {
        primary:
          "bg-[var(--accent)] text-white hover:bg-[var(--accent-2)] shadow-[0_8px_24px_-12px_rgba(200,16,46,0.6)]",
        secondary:
          "bg-[var(--surface-2)] text-[var(--text)] border border-[var(--border)] hover:bg-[var(--border)]",
        ghost:
          "text-[var(--text)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]",
        outline:
          "border border-[var(--border)] bg-transparent text-[var(--text)] hover:bg-[var(--surface-2)]",
        danger:
          "bg-[var(--accent)] text-white hover:bg-[var(--accent-2)]",
        success:
          "bg-[var(--success)] text-[#0a1e16] hover:brightness-110",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        md: "h-10 px-4",
        lg: "h-12 px-5 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size }), className)}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
