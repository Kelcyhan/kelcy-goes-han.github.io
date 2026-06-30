import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Card, CardHeader, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

/**
 * CollapsibleCard — expandable card with header + body sections.
 * Wraps shadcn Card. Replaces tool-card, tool-result-card, thinking-block, system-card CSS classes.
 *
 * Usage:
 *   <CollapsibleCard variant="tool">
 *     <CollapsibleCardHeader>Tool name</CollapsibleCardHeader>
 *     {isOpen && <CollapsibleCardBody>Result content</CollapsibleCardBody>}
 *   </CollapsibleCard>
 *
 * The parent controls expand/collapse state — just conditionally render the body.
 */

const collapsibleCardVariants = cva(
  "my-1.5 overflow-hidden shadow-none",
  {
    variants: {
      variant: {
        tool: "border border-border",
        result: "border border-border",
        "result-error": "border border-[rgba(224,90,75,0.3)]",
        thinking: "border border-dashed border-border",
        system: "border border-border text-xs",
        "system-success": "border border-[rgba(59,184,122,0.3)]",
        "system-error": "border border-[rgba(224,90,75,0.3)]",
      },
    },
    defaultVariants: { variant: "tool" },
  }
)

export interface CollapsibleCardProps
  extends React.ComponentPropsWithoutRef<typeof Card>,
    VariantProps<typeof collapsibleCardVariants> {}

export function CollapsibleCard({ variant, className, children, ...props }: CollapsibleCardProps) {
  return (
    <Card className={cn(collapsibleCardVariants({ variant }), className)} {...props}>
      {children}
    </Card>
  )
}

export function CollapsibleCardHeader({ className, children, ...props }: React.ComponentPropsWithoutRef<typeof CardHeader>) {
  return (
    <CardHeader
      className={cn(
        "flex-row items-center gap-1.5 px-2.5 py-1.5 cursor-pointer select-none space-y-0",
        "bg-[var(--bg-surface)] hover:bg-[var(--bg-card-hover)] transition-colors",
        className
      )}
      {...props}
    >
      {children}
    </CardHeader>
  )
}

export function CollapsibleCardBody({ className, children, ...props }: React.ComponentPropsWithoutRef<typeof CardContent>) {
  return (
    <CardContent className={cn("border-t border-border p-0", className)} {...props}>
      {children}
    </CardContent>
  )
}

export { collapsibleCardVariants }
