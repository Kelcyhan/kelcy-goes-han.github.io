import { useState } from 'react'
import { ChevronDown, ChevronRight, Target } from 'lucide-react'
import type { Goal, Milestone } from '@/stores/pm-store.ts'
import { usePMStore } from '@/stores/pm-store.ts'
import { GoalStatusIcon, ProgressBar } from './shared.tsx'
import { PMBadge, StatusDot } from '@/components/primitives'

function MilestoneChip({ ms }: { ms: Milestone }) {
  const statusMap = { done: 'done' as const, in_progress: 'active' as const, not_started: 'todo' as const }
  return (
    <span className="inline-flex items-center gap-1 type-caption text-muted-foreground bg-card px-1.5 py-px rounded-full border border-[var(--color-border-subtle)]">
      <StatusDot status={statusMap[ms.status as keyof typeof statusMap] || 'todo'} size="sm" />
      <span className="max-w-[100px] overflow-hidden text-ellipsis whitespace-nowrap">{ms.title}</span>
    </span>
  )
}

function formatBuffer(hours: number): string {
  const abs = Math.abs(hours)
  if (abs >= 48) return `${Math.round(abs / 24)}d`
  return `${abs}h`
}

function BufferIndicator({ hours, target }: { hours: number | null | undefined; target: string }) {
  if (hours == null) return null
  const isOverdue = target && new Date(target) < new Date()
  let variant: 'green' | 'amber' | 'red' = 'green'
  let label = formatBuffer(hours)
  if (hours < 0) { variant = 'red'; label = `${formatBuffer(hours)} behind` }
  else if (hours < 24) { variant = 'amber' }
  if (isOverdue) { variant = 'red' }
  return <PMBadge variant={variant}>{label}</PMBadge>
}

function GoalRow({ goal }: { goal: Goal }) {
  const selectGoal = usePMStore(s => s.selectGoal)
  const isOverdue = goal.target && new Date(goal.target) < new Date()
  const milestones = goal.milestones || []

  return (
    <div
      className="flex flex-col gap-1 cursor-pointer hover:bg-[var(--bg-raised)] rounded px-1 py-0.5 -mx-1 transition-colors"
      onClick={() => selectGoal(goal.id)}
    >
      <div className="flex items-center gap-2 text-xs font-medium text-foreground">
        <GoalStatusIcon status={goal.status} />
        <span className="flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{goal.id}</span>
        <ProgressBar done={goal.progress.done} total={goal.progress.total} />
        <span className="type-caption text-muted-foreground">
          {goal.progress.done}/{goal.progress.total}
        </span>
        <BufferIndicator hours={goal.buffer_hours} target={goal.target} />
        <span className={`type-caption text-muted-foreground shrink-0 ${isOverdue ? 'text-red font-semibold' : ''}`}>
          {goal.target}
        </span>
      </div>
      {milestones.length > 0 && (
        <div className="flex flex-wrap gap-1 pl-5">
          {milestones.map(ms => <MilestoneChip key={ms.id} ms={ms} />)}
        </div>
      )}
    </div>
  )
}

interface GoalRibbonProps {
  goals: Goal[]
}

export function GoalRibbon({ goals }: GoalRibbonProps) {
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('goal-ribbon-collapsed') === 'true' } catch { return false }
  })

  if (goals.length === 0) return null

  const toggle = () => {
    const next = !collapsed
    setCollapsed(next)
    try { localStorage.setItem('goal-ribbon-collapsed', String(next)) } catch {}
  }

  return (
    <div className="shrink-0 mx-3 mt-3 px-3 py-2 rounded-lg bg-[var(--bg-card)] border border-[var(--color-border-subtle)]">
      <button
        className="flex items-center gap-1.5 type-micro font-semibold uppercase tracking-wide text-muted-foreground mb-1 bg-transparent border-none cursor-pointer p-0 w-full hover:text-foreground"
        onClick={toggle}
      >
        <Target size={13} />
        <span>Goals</span>
        <span className="flex-1" />
        {collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
      </button>
      {!collapsed && (
        <div className="flex flex-col gap-1">
          {goals.map(goal => <GoalRow key={goal.id} goal={goal} />)}
        </div>
      )}
    </div>
  )
}
