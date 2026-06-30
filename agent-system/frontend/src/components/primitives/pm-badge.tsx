import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

/**
 * PMBadge — general-purpose badge for the PM dashboard.
 * Wraps shadcn Badge. Replaces all pm-badge / pm-status-* CSS classes.
 */

const pmBadgeVariants = cva(
  "gap-1 whitespace-nowrap type-caption font-semibold uppercase tracking-wide px-2 py-px border-transparent",
  {
    variants: {
      variant: {
        count: "bg-[var(--bg-raised)] text-muted-foreground",
        goal: "bg-[var(--color-accent-dim)] text-[var(--color-accent)]",
        blocked: "bg-[rgba(224,90,75,0.15)] text-[rgb(224,90,75)]",
        red: "bg-[rgba(224,90,75,0.15)] text-[rgb(224,90,75)]",
        amber: "bg-[rgba(212,146,42,0.15)] text-[rgb(212,146,42)]",
        mock: "bg-[rgba(212,146,42,0.12)] text-[rgb(212,146,42)]",
        green: "bg-[rgba(59,184,122,0.15)] text-[rgb(59,184,122)]",
        blue: "bg-[rgba(59,130,246,0.15)] text-[rgb(59,130,246)]",
        gray: "bg-[var(--bg-raised)] text-muted-foreground",
        task: "bg-[var(--bg-card)] text-muted-foreground font-mono",
        size: "bg-[var(--bg-card)] text-muted-foreground font-bold px-1.5",
        dep: "gap-[3px]",
        context: "bg-[var(--bg-card)] text-muted-foreground type-micro font-normal",
      },
      size: {
        default: "",
        sm: "type-caption px-[5px] py-px",
      },
      editable: {
        true: "cursor-pointer transition-all duration-150 hover:border-[var(--color-accent)] hover:shadow-[0_0_0_1px_var(--color-accent)]",
        false: "",
      },
    },
    defaultVariants: {
      variant: "gray",
      size: "default",
      editable: false,
    },
  }
)

export interface PMBadgeProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "children">,
    VariantProps<typeof pmBadgeVariants> {
  children?: React.ReactNode
}

export function PMBadge({ className, variant, size, editable, ...props }: PMBadgeProps) {
  return (
    <Badge
      className={cn(pmBadgeVariants({ variant, size, editable }), className)}
      {...props}
    />
  )
}

export { pmBadgeVariants }
