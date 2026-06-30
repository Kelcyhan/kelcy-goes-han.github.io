import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { CheckCircle2, Circle, CircleDot, Lock, Pause, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { statusToGroup } from "./status-utils"

const statusBadgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full type-medium",
  {
    variants: {
      group: {
        inactive: "bg-[var(--status-inactive-bg)] text-[var(--color-status-inactive)]",
        active: "bg-[var(--status-active-bg)] text-[var(--color-status-active)]",
        attention: "bg-[var(--status-attention-bg)] text-[var(--color-status-attention)]",
        complete: "bg-[var(--status-complete-bg)] text-[var(--color-status-complete)]",
      },
      size: {
        default: "px-2.5 py-[3px] type-label",
        sm: "px-1.5 py-px type-caption",
      },
    },
    defaultVariants: {
      group: "inactive",
      size: "default",
    },
  }
)

export interface StatusBadgeProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, "children">,
  Omit<VariantProps<typeof statusBadgeVariants>, "group"> {
  status: string
  label?: string
}

function statusClassName(status: string) {
  return `status-chip-${status.toLowerCase().replace(/[^a-z0-9_-]/g, '-')}`
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'done':
    case 'complete':
    case 'stable':
      return <CheckCircle2 size={10} className="shrink-0" />
    case 'active':
    case 'executing':
    case 'working':
    case 'in_progress':
      return <CircleDot size={10} className="shrink-0" />
    case 'blocked':
    case 'login_required':
    case 'error':
    case 'stalled':
      return <Lock size={10} className="shrink-0" />
    case 'shelved':
    case 'paused':
    case 'idle':
      return <Pause size={10} className="shrink-0" />
    case 'dropped':
    case 'archived':
    case 'closed':
      return <X size={10} className="shrink-0" />
    default:
      return <Circle size={10} className="shrink-0" />
  }
}

export function StatusBadge({ status, label, size, className, ...props }: StatusBadgeProps) {
  const group = statusToGroup(status)
  return (
    <span
      className={cn(
        statusBadgeVariants({ group, size }),
        "status-chip",
        statusClassName(status),
        className,
      )}
      {...props}
    >
      <StatusIcon status={status} />
      {label ?? status}
    </span>
  )
}

export { statusBadgeVariants }
