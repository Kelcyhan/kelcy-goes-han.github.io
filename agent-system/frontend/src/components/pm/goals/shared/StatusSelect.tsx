import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PMStatusDot, PM_STATUS_OPTIONS, GOAL_STATUS_OPTIONS, pmStatusLabel } from '@/components/primitives'
import { cn } from '@/lib/utils'

/**
 * StatusSelect — compact colored dropdown for task/goal status changes.
 * Uses centralized PM_STATUS_OPTIONS / GOAL_STATUS_OPTIONS from status-utils.ts.
 */

const TERMINAL_OPTIONS = PM_STATUS_OPTIONS.filter(o => o.value === 'shelved' || o.value === 'dropped')
const MAIN_OPTIONS = PM_STATUS_OPTIONS.filter(o => o.value !== 'shelved' && o.value !== 'dropped')

export interface StatusSelectProps {
  value: string
  onChange: (value: string) => void
  type?: 'task' | 'goal'
  compact?: boolean
  className?: string
  disabled?: boolean
}

export function StatusSelect({ value, onChange, type = 'task', compact, className, disabled }: StatusSelectProps) {
  const statuses = type === 'goal' ? GOAL_STATUS_OPTIONS : MAIN_OPTIONS
  const terminal = type === 'goal' ? [] : TERMINAL_OPTIONS

  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger
        className={cn(
          'h-6 border-[var(--color-border-subtle)] bg-transparent gap-1 type-micro font-medium',
          compact ? 'w-[72px] px-1.5' : 'w-[100px] px-2',
          className,
        )}
      >
        <PMStatusDot status={value} />
        <SelectValue>{pmStatusLabel(value)}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {statuses.map(s => (
          <SelectItem key={s.value} value={s.value} className="type-micro">
            <span className="flex items-center gap-1.5">
              <PMStatusDot status={s.value} />
              {s.label}
            </span>
          </SelectItem>
        ))}
        {terminal.length > 0 && (
          <>
            <div className="h-px bg-border my-1" />
            {terminal.map(s => (
              <SelectItem key={s.value} value={s.value} className="type-micro">
                <span className="flex items-center gap-1.5">
                  <PMStatusDot status={s.value} />
                  {s.label}
                </span>
              </SelectItem>
            ))}
          </>
        )}
      </SelectContent>
    </Select>
  )
}
