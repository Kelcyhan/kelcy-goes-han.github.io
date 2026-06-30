import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

/**
 * FileChip — small clickable file reference pill.
 * Replaces pm-file-chip, sq-file-link, file-link CSS classes.
 */

const fileChipVariants = cva(
  "inline-flex items-center gap-1 rounded text-muted-foreground cursor-pointer transition-colors border font-mono hover:border-[var(--color-border-accent)] hover:text-accent-foreground [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "border-[var(--color-border-subtle)] bg-[var(--bg-surface)]",
        link: "border-transparent bg-transparent",
      },
      size: {
        default: "px-2 py-0.5 type-micro",
        sm: "px-1.5 py-px type-caption",
      },
      active: {
        true: "border-[var(--color-border-accent)] text-accent-foreground",
        false: "",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
      active: false,
    },
  }
)

export interface FileChipProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof fileChipVariants> {}

const FileChip = React.forwardRef<HTMLButtonElement, FileChipProps>(
  ({ className, variant, size, active, ...props }, ref) => {
    return (
      <button
        className={cn(fileChipVariants({ variant, size, active, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
FileChip.displayName = "FileChip"

export { FileChip, fileChipVariants }
