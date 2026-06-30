import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * ActionButton — project-specific button variants for approve/done/spawn actions.
 * Wraps shadcn Button. Replaces pm-btn-*, sq-btn-*, pm-session-btn-* CSS classes.
 */

const actionButtonVariants = cva("", {
  variants: {
    variant: {
      primary:
        "bg-[var(--color-accent-dim)] border border-[var(--color-border-accent)] text-accent-foreground hover:bg-[var(--color-accent-glow)]",
      secondary:
        "bg-card border border-border text-muted-foreground hover:bg-[var(--bg-card-hover)] hover:text-foreground",
      ghost:
        "bg-transparent border border-transparent text-muted-foreground hover:text-foreground hover:bg-card",
      approve:
        "bg-[rgba(59,184,122,0.12)] border border-[rgba(59,184,122,0.4)] text-green hover:bg-[rgba(59,184,122,0.22)]",
      done:
        "bg-[rgba(59,130,246,0.12)] border border-[rgba(59,130,246,0.4)] text-accent-foreground hover:bg-[rgba(59,130,246,0.22)]",
      back:
        "bg-transparent border border-transparent text-muted-foreground hover:text-accent-foreground",
      toolbar:
        "bg-[var(--bg-raised)] border border-border text-foreground hover:border-accent hover:text-accent",
      toolbarPrimary:
        "bg-[var(--color-accent-dim)] border border-[var(--color-border-accent)] text-accent hover:bg-accent hover:text-white",
      panel:
        "bg-transparent border border-border text-muted-foreground hover:border-accent hover:text-accent hover:bg-[var(--color-accent-dim)] disabled:opacity-50 disabled:cursor-not-allowed",
      appShell:
        "bg-transparent border border-transparent text-muted-foreground hover:bg-[var(--glass-card-hover-bg)] hover:text-foreground hover:border-[var(--glass-border-hover)]",
      chip:
        "bg-[var(--bg-raised)] border border-border text-muted-foreground hover:bg-[var(--bg-ingrained)] hover:text-foreground hover:border-[var(--color-border-muted)] active:scale-[0.96]",
      destructive:
        "bg-destructive border border-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed",
    },
    size: {
      default: "px-3 py-1.5 type-label h-auto",
      sm: "px-2 py-1 type-micro h-auto",
      toolbar: "px-2.5 py-[3px] type-label h-auto rounded-sm",
      panel: "px-2 py-1 type-caption h-auto rounded-sm",
      appShell: "h-7 px-2 type-micro rounded-md gap-1.5",
      chip: "h-auto px-2.5 py-1 type-micro rounded-full gap-1 font-medium whitespace-nowrap",
      icon: "p-1 type-label h-auto",
    },
  },
  defaultVariants: {
    variant: "secondary",
    size: "default",
  },
})

export interface ActionButtonProps
  extends Omit<React.ComponentPropsWithoutRef<typeof Button>, 'variant' | 'size'>,
    VariantProps<typeof actionButtonVariants> {}

const ActionButton = React.forwardRef<HTMLButtonElement, ActionButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <Button
        ref={ref}
        variant="ghost"
        size="sm"
        className={cn(actionButtonVariants({ variant, size }), className)}
        {...props}
      />
    )
  }
)
ActionButton.displayName = "ActionButton"

export { ActionButton, actionButtonVariants }
