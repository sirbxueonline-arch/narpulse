import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide leading-none",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--surface-2)] text-[var(--text)] border border-[var(--border)]",
        active: "bg-[var(--accent)]/15 text-[var(--accent-2)] border border-[var(--accent)]/30",
        planned: "bg-[var(--warning)]/15 text-[var(--warning)] border border-[var(--warning)]/30",
        resolved: "bg-[var(--success)]/15 text-[var(--success)] border border-[var(--success)]/30",
        muted: "bg-transparent text-[var(--muted)] border border-[var(--border)]",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
