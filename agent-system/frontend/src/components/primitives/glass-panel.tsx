import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

/**
 * GlassPanel — structural panel or card with glass styling.
 * Component equivalent of .glass-panel and .glass-card CSS classes.
 *
 * Use `variant="panel"` for sidebar/workspace structural panels.
 * Use `variant="card"` for elevated card containers with hover lift.
 */

const glassPanelVariants = cva("", {
  variants: {
    variant: {
      panel:
        "bg-[var(--bg-surface)] border border-[var(--color-border-glass)] shadow-[var(--glass-highlight),var(--shadow-panel)]",
      card:
        "bg-card border border-border rounded-xl shadow-[var(--shadow-card)] transition-[box-shadow,transform] duration-150 hover:shadow-[var(--shadow-card-hover)] hover:-translate-y-px",
    },
  },
  defaultVariants: { variant: "panel" },
})

export interface GlassPanelProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof glassPanelVariants> {}

const GlassPanel = React.forwardRef<HTMLDivElement, GlassPanelProps>(
  ({ className, variant, ...props }, ref) => {
    return <div className={cn(glassPanelVariants({ variant }), className)} ref={ref} {...props} />
  }
)
GlassPanel.displayName = "GlassPanel"

export { GlassPanel, glassPanelVariants }
