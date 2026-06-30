import { cn } from "@/lib/utils"

/**
 * ProgressBar — done/total progress indicator with label.
 * Replaces pm-progress-bar, pm-progress-fill, pm-progress-label CSS classes.
 */

export interface ProgressBarProps extends React.HTMLAttributes<HTMLDivElement> {
  done: number
  total: number
  large?: boolean
  hideLabel?: boolean
}

export function ProgressBar({ done, total, large, hideLabel, className, ...props }: ProgressBarProps) {
  const pct = total > 0 ? (done / total) * 100 : 0
  return (
    <div className={cn("flex items-center gap-2", className)} {...props}>
      <div className={cn(
        "flex-1 rounded-full overflow-hidden bg-[var(--bg-ingrained)]",
        large ? "h-2" : "h-1.5",
      )}>
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      {!hideLabel && (
        <span className="type-caption text-muted-foreground whitespace-nowrap flex-shrink-0 font-mono tabular-nums">
          {done}/{total}
        </span>
      )}
    </div>
  )
}
