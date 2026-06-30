import { cn } from '@/lib/utils'
import type { StatusCounts } from './helpers'

/**
 * SegmentedProgress — multi-color progress bar showing done/executing/todo/shelved segments.
 * Replaces single-color ProgressBar for goal and milestone progress visualization.
 */

export interface SegmentedProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  counts: StatusCounts
  large?: boolean
  hideLabel?: boolean
}

export function SegmentedProgress({ counts, large, hideLabel, className, ...props }: SegmentedProgressProps) {
  const { done, executing, todo, shelved, total } = counts
  if (total === 0) return null

  const segments = [
    { count: done, color: 'bg-green' },
    { count: executing, color: 'bg-accent' },
    { count: shelved, color: 'bg-[var(--color-text-subtle)]' },
    { count: todo, color: 'bg-[var(--bg-ingrained)]' },
  ].filter(s => s.count > 0)

  return (
    <div className={cn('flex items-center gap-2', className)} {...props}>
      <div className={cn(
        'flex-1 rounded-full overflow-hidden flex',
        large ? 'h-2' : 'h-1.5',
        'bg-[var(--bg-ingrained)]',
      )}>
        {segments.map((seg, i) => (
          <div
            key={i}
            className={cn('h-full transition-[width] duration-300', seg.color, i === 0 && 'rounded-l-full', i === segments.length - 1 && 'rounded-r-full')}
            style={{ width: `${(seg.count / total) * 100}%` }}
          />
        ))}
      </div>
      {!hideLabel && (
        <span className="type-caption text-muted-foreground whitespace-nowrap flex-shrink-0 font-mono tabular-nums">
          {done}/{total}
        </span>
      )}
    </div>
  )
}

/** Compact text legend for status breakdown */
export function StatusBreakdown({ counts, className }: { counts: StatusCounts; className?: string }) {
  const parts: string[] = []
  if (counts.done > 0) parts.push(`Done ${counts.done}`)
  if (counts.executing > 0) parts.push(`Exec ${counts.executing}`)
  if (counts.todo > 0) parts.push(`Todo ${counts.todo}`)
  if (counts.shelved > 0) parts.push(`Shvd ${counts.shelved}`)
  if (counts.other > 0) parts.push(`Other ${counts.other}`)

  return (
    <div className={cn('flex items-center gap-2 type-caption text-muted-foreground flex-wrap', className)}>
      {counts.done > 0 && <span><span className="inline-block w-1.5 h-1.5 rounded-full bg-green mr-0.5" /> Done {counts.done}</span>}
      {counts.executing > 0 && <span><span className="inline-block w-1.5 h-1.5 rounded-full bg-accent mr-0.5" /> Exec {counts.executing}</span>}
      {counts.todo > 0 && <span><span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--color-text-subtle)] mr-0.5 opacity-40" /> Todo {counts.todo}</span>}
      {counts.shelved > 0 && <span><span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--color-text-subtle)] mr-0.5" /> Shvd {counts.shelved}</span>}
    </div>
  )
}
