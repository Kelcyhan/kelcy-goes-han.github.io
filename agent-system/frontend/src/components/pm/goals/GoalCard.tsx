import { useState } from 'react'
import { MoreHorizontal, ArrowRight, Trash2 } from 'lucide-react'
import type { Goal, Milestone } from '@/stores/pm-store.ts'
import { GoalStatusIcon } from '../shared.tsx'
import { GlassPanel, IconButton, PMBadge } from '@/components/primitives'
import { SegmentedProgress, StatusBreakdown } from './shared/SegmentedProgress.tsx'
import { computeStatusCounts, formatBuffer } from './shared/helpers.ts'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu.tsx'

// --- Inline badges (extracted from original GoalsView) ---

function BufferBadge({ hours, target }: { hours: number | null | undefined; target: string }) {
  if (hours == null) return null
  const isOverdue = target && new Date(target) < new Date()
  let variant: 'green' | 'amber' | 'red' = 'green'
  let label = `${formatBuffer(hours)} buffer`
  if (hours < 0) { variant = 'red'; label = `${formatBuffer(hours)} behind` }
  else if (hours < 24) { variant = 'amber' }
  if (isOverdue) { variant = 'red' }
  return <PMBadge variant={variant}>{label}</PMBadge>
}

function ScheduleBadge({ status }: { status?: string }) {
  if (!status) return null
  const variant = status === 'ON_SCHEDULE' ? 'green'
    : status === 'AT_RISK' ? 'amber'
    : status === 'BEHIND' ? 'red'
    : 'count'
  return <PMBadge variant={variant}>{status.replace(/_/g, ' ')}</PMBadge>
}

function MilestoneChip({ ms }: { ms: Milestone }) {
  const icon = ms.status === 'done' ? '\u2713'
    : ms.status === 'in_progress' ? '\u25D0'
    : '\u25CB'
  return (
    <span className="inline-flex items-center gap-1 type-micro text-muted-foreground bg-[var(--bg-raised)] px-2 py-0.5 rounded-full border border-[var(--color-border-subtle)]">
      <span>{icon}</span>
      <span className="max-w-[120px] overflow-hidden text-ellipsis whitespace-nowrap">{ms.title}</span>
    </span>
  )
}

// --- GoalCard ---

export interface GoalCardProps {
  goal: Goal
  onClick: () => void
  onDelete: (goal: Goal) => void
}

export function GoalCard({ goal, onClick, onDelete }: GoalCardProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const isOverdue = goal.target && new Date(goal.target) < new Date()
  const milestones = goal.milestones || []

  // Compute status counts from tagged_tasks if available, else fall back to progress
  const counts = goal.tagged_tasks && goal.tagged_tasks.length > 0
    ? computeStatusCounts(goal.tagged_tasks)
    : {
        done: goal.progress?.done ?? 0,
        executing: 0,
        todo: (goal.progress?.total ?? 0) - (goal.progress?.done ?? 0),
        shelved: 0,
        other: 0,
        total: goal.progress?.total ?? 0,
      }

  return (
    <GlassPanel
      variant="card"
      className="p-3 flex flex-col gap-2 cursor-pointer relative"
      onClick={onClick}
    >
      {/* Header row */}
      <div className="flex items-center gap-2">
        <GoalStatusIcon status={goal.status} />
        <span className="text-sm font-semibold flex-1">{goal.id}</span>

        {/* Kebab menu */}
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger asChild>
            <IconButton
              variant="appShell"
              size="xs"
              title="Goal actions"
              onClick={(e) => { e.stopPropagation() }}
            >
              <MoreHorizontal size={14} />
            </IconButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem
              className="cursor-pointer"
              onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onClick() }}
            >
              <ArrowRight size={14} />
              Edit details
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="cursor-pointer text-destructive focus:text-destructive"
              onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onDelete(goal) }}
            >
              <Trash2 size={14} />
              Delete...
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Title */}
      <div className="text-xs text-muted-foreground">{goal.title}</div>

      {/* Schedule info */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`type-micro text-muted-foreground ${isOverdue ? 'text-red' : ''}`}>
          target: {goal.target}
        </span>
        <BufferBadge hours={goal.buffer_hours} target={goal.target} />
        <ScheduleBadge status={goal.schedule_status} />
      </div>

      {/* Segmented progress */}
      <SegmentedProgress counts={counts} />

      {/* Status breakdown text */}
      {counts.total > 0 && <StatusBreakdown counts={counts} />}

      {/* Milestones */}
      {milestones.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-1 border-t border-[var(--color-border-subtle)]">
          {milestones.map(ms => <MilestoneChip key={ms.id} ms={ms} />)}
        </div>
      )}
    </GlassPanel>
  )
}
