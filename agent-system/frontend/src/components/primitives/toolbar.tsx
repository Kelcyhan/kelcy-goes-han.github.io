import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const toolbarVariants = cva(
  "flex items-center gap-2 px-4 py-1.5 border-b border-[var(--color-border-subtle)] bg-[var(--bg-surface)] shrink-0",
  {
    variants: {
      density: {
        compact: "px-3 py-1.5",
        default: "px-4 py-1.5",
      },
    },
    defaultVariants: {
      density: "default",
    },
  }
)

export interface ToolbarProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof toolbarVariants> {}

export function Toolbar({ className, density, ...props }: ToolbarProps) {
  return <div className={cn(toolbarVariants({ density }), className)} {...props} />
}

export function ToolbarGroup({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex items-center gap-1.5 shrink-0", className)} {...props} />
}

export { toolbarVariants }
