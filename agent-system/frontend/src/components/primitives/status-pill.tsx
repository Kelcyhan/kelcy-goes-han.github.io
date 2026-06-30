import { cn } from "@/lib/utils"
import { statusToGroup, groupColors, entityStatusLabel, progressLabel } from "./status-utils"

/**
 * StatusPill — tinted pill with human-readable status label.
 * 12px font, no uppercase, 4-color system (grey/blue/orange/green).
 * Supports entity-type-aware labels and progress display.
 */

export interface StatusPillProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, "children"> {
  status: string
  entityType?: string
  progress?: { done: number; total: number } | null
  label?: string
}

export function StatusPill({ status, entityType, progress, label, className, ...props }: StatusPillProps) {
  const group = statusToGroup(status)
  const color = groupColors[group]
  const displayLabel = label ?? (progress ? progressLabel(status, progress, entityType) : entityStatusLabel(status, entityType))

  return (
    <span
      className={cn("inline-flex items-center rounded-full px-2 py-0.5 type-label leading-tight font-medium whitespace-nowrap", className)}
      style={{
        backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)`,
        color: color,
      }}
      {...props}
    >
      {displayLabel}
    </span>
  )
}
