import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground",
        outline:
          "text-foreground",
        // Status variants using the project's status colors
        todo:
          "border-transparent bg-muted text-muted-foreground",
        active:
          "border-transparent bg-accent text-accent-foreground",
        proposed:
          "border-transparent bg-[rgba(212,146,42,0.12)] text-[var(--color-status-proposed)]",
        done:
          "border-transparent bg-[rgba(59,184,122,0.12)] text-[var(--color-status-done)]",
        blocked:
          "border-transparent bg-[rgba(224,90,75,0.12)] text-[var(--color-status-blocked)]",
        dropped:
          "border-transparent bg-muted text-muted-foreground",
        working:
          "border-transparent bg-accent text-accent-foreground",
        idle:
          "border-transparent bg-[rgba(59,184,122,0.12)] text-[var(--color-status-done)]",
        waiting:
          "border-transparent bg-[rgba(212,146,42,0.12)] text-[var(--color-status-proposed)]",
        mono:
          "border-transparent bg-muted text-accent-foreground font-mono",
      },
    },
    defaultVariants: { variant: "default" },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
