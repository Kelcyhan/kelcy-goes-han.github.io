import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * IconButton — compact icon-only buttons for sidebars, toolbars, and headers.
 * Wraps shadcn Button. Replaces sidebar-icon-btn, topbar-action-btn CSS classes.
 */

const iconButtonVariants = cva("flex-shrink-0", {
  variants: {
    variant: {
      ghost:
        "bg-transparent text-muted-foreground hover:bg-[rgba(0,0,0,0.1)] hover:text-foreground active:bg-[rgba(0,0,0,0.2)]",
      ingrained:
        "bg-[var(--bg-ingrained)] border border-[var(--color-border-subtle)] text-muted-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] hover:bg-[var(--bg-ingrained-hover)] hover:text-foreground active:bg-[var(--bg-ingrained-active)]",
      toolbar:
        "bg-transparent border border-transparent text-muted-foreground hover:bg-[var(--bg-card-hover)] hover:text-foreground disabled:hover:bg-transparent disabled:hover:text-muted-foreground",
      appShell:
        "relative bg-transparent border border-transparent text-muted-foreground hover:bg-[var(--glass-card-hover-bg)] hover:text-foreground hover:border-[var(--glass-border-hover)] disabled:hover:bg-transparent disabled:hover:text-muted-foreground disabled:hover:border-transparent",
      input:
        "bg-transparent border border-transparent text-muted-foreground hover:bg-[var(--bg-ingrained)] hover:text-foreground active:bg-[var(--bg-ingrained-active)] disabled:opacity-50 disabled:pointer-events-none",
      inputPrimary:
        "bg-muted-foreground border border-transparent text-[var(--bg-surface)] hover:bg-foreground active:bg-foreground active:opacity-80 disabled:opacity-30 disabled:pointer-events-none",
      overlay:
        "bg-black/60 border border-transparent text-white hover:bg-black/75 disabled:pointer-events-none",
      copy:
        "bg-[var(--bg-surface)] border border-[var(--color-border)] text-muted-foreground hover:text-foreground hover:bg-[var(--bg-raised)]",
    },
    shape: {
      square: "rounded-md",
      round: "rounded-full",
    },
    size: {
      default: "h-8 w-8",
      sm: "h-7 w-7 rounded-full",
      xs: "h-[22px] min-w-[22px] px-1",
      file: "h-[18px] w-[18px] min-w-[18px] p-0 rounded",
      input: "h-[34px] w-[34px] min-w-[34px] p-0 rounded-full",
      copy: "h-[22px] min-w-[22px] px-1 rounded-sm",
      lg: "h-9 w-9",
    },
  },
  defaultVariants: {
    variant: "ghost",
    shape: "square",
    size: "default",
  },
})

export interface IconButtonProps
  extends Omit<React.ComponentPropsWithoutRef<typeof Button>, 'variant' | 'size'>,
    VariantProps<typeof iconButtonVariants> {}

const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, variant, shape, size, ...props }, ref) => {
    return (
      <Button
        ref={ref}
        variant="ghost"
        size="icon"
        className={cn(iconButtonVariants({ variant, shape, size }), className)}
        {...props}
      />
    )
  }
)
IconButton.displayName = "IconButton"

export { IconButton, iconButtonVariants }
