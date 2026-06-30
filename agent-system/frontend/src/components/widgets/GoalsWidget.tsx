/**
 * Goals Widget — cross-project goal overview for the home screen.
 *
 * Compact: progress bars for all goals across all projects.
 * Detail: full goal cards with milestones, click to edit (navigates into project).
 */
import { useEffect, useState, useCallback } from 'react'
import { Target, RefreshCw } from 'lucide-react'
import { usePMStore } from '@/stores/pm-store.ts'
import type { Goal } from '@/stores/pm-store.ts'
import { GoalCard } from '@/components/pm/goals/GoalCard.tsx'
// GoalRoadmap removed — not used in widget view
import { DeleteGoalDialog } from '@/components/pm/goals/DeleteGoalDialog.tsx'
import { PMBadge } from '@/components/primitives'
import * as api from '@/lib/api.ts'

// Goal with project context attached
interface ProjectGoal extends Goal {
  _projectId: string
  _projectTitle: string
}

function useAllGoals() {
  const [goals, setGoals] = useState<ProjectGoal[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      setLoading(true)
      const { projects } = await api.fetchPMProjects()
      const withState = projects.filter(p => p.has_state)

      const results = await Promise.all(
        withState.map(async (p) => {
          try {
            const { state } = await api.fetchPMState(p.id)
            return (state.goals || []).map((g: Goal) => ({
              ...g,
              _projectId: p.id,
              _projectTitle: p.title,
            }))
          } catch {
            return []
          }
        })
      )
      setGoals(results.flat())
    } catch {
      // silently fail — widget shows empty state
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  return { goals, loading, refresh }
}

// ── Schedule status helpers ──

function scheduleVariant(status?: string): 'green' | 'amber' | 'red' | 'count' {
  if (status === 'ON_SCHEDULE') return 'green'
  if (status === 'AT_RISK') return 'amber'
  if (status === 'BEHIND') return 'red'
  return 'count'
}

function formatTarget(target: string): string {
  if (!target) return ''
  try {
    const d = new Date(target)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  } catch {
    return target
  }
}

// ── Compact View ──

export function GoalsCompact() {
  const { goals, loading } = useAllGoals()

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4 text-muted-foreground">
        <RefreshCw size={14} className="animate-spin mr-2" />
        <span className="text-xs">Loading goals...</span>
      </div>
    )
  }

  if (goals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-4 text-center">
        <Target size={18} className="text-muted-foreground" />
        <span className="type-micro text-muted-foreground">No goals defined</span>
      </div>
    )
  }

  // Sort by urgency: BEHIND first, then AT_RISK, then ON_SCHEDULE
  const sorted = [...goals].sort((a, b) => {
    const order: Record<string, number> = { BEHIND: 0, AT_RISK: 1, ON_SCHEDULE: 2 }
    return (order[a.schedule_status || ''] ?? 3) - (order[b.schedule_status || ''] ?? 3)
  })

  return (
    <div className="flex flex-col gap-2.5">
      {sorted.map(goal => {
        const done = goal.progress?.done ?? 0
        const total = goal.progress?.total ?? 0
        const pct = total > 0 ? Math.round((done / total) * 100) : 0

        return (
          <div key={`${goal._projectId}-${goal.id}`} className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium flex-1 truncate">{goal.id}</span>
              <span className="type-caption text-muted-foreground">{formatTarget(goal.target)}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 rounded-full bg-[var(--bg-ingrained)] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: pct === 100 ? 'var(--color-green)' : 'var(--color-accent)',
                  }}
                />
              </div>
              <span className="type-caption text-muted-foreground w-8 text-right">{pct}%</span>
              <PMBadge variant={scheduleVariant(goal.schedule_status)} size="sm">
                {(goal.schedule_status || 'N/A').replace(/_/g, ' ')}
              </PMBadge>
            </div>
            <span className="type-caption text-muted-foreground truncate">{goal._projectTitle}</span>
          </div>
        )
      })}
    </div>
  )
}

// ── Detail View (expanded) ──

export function GoalsDetail() {
  const { goals, loading } = useAllGoals()
  const fetchState = usePMStore(s => s.fetchState)
  const selectGoal = usePMStore(s => s.selectGoal)
  const [deleteGoal, setDeleteGoal] = useState<Goal | null>(null)

  const handleGoalClick = async (goal: ProjectGoal) => {
    // Load the project state first (fetchState clears selectedGoalId on project switch),
    // then select the goal. Awaiting ensures the useEffect re-trigger of fetchState
    // won't see a project switch and clear the goal again.
    await fetchState(goal._projectId)
    selectGoal(goal.id)
  }

  const handleDelete = (goal: Goal) => {
    setDeleteGoal(goal)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <RefreshCw size={16} className="animate-spin mr-2" />
        <span className="text-sm">Loading goals...</span>
      </div>
    )
  }

  if (goals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
        <div className="p-3 rounded-full bg-[var(--bg-raised)] border border-[var(--color-border-subtle)]">
          <Target size={24} className="text-muted-foreground" />
        </div>
        <span className="text-sm font-medium text-foreground">No goals defined</span>
        <span className="type-body-sm text-muted-foreground">
          Goals are defined per-project. Open a project to create goals.
        </span>
      </div>
    )
  }

  // Group by project
  const byProject = new Map<string, ProjectGoal[]>()
  for (const g of goals) {
    const key = g._projectId
    if (!byProject.has(key)) byProject.set(key, [])
    byProject.get(key)!.push(g)
  }

  return (
    <div className="flex flex-col gap-6">
      {Array.from(byProject.entries()).map(([projectId, projectGoals]) => (
        <div key={projectId} className="flex flex-col gap-3">
          <h3 className="type-body-sm font-semibold text-muted-foreground m-0">
            {projectGoals[0]._projectTitle}
          </h3>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
            {projectGoals.map(goal => (
              <GoalCard
                key={goal.id}
                goal={goal}
                onClick={() => handleGoalClick(goal)}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </div>
      ))}

      {deleteGoal && (
        <DeleteGoalDialog
          open={!!deleteGoal}
          onOpenChange={(open) => { if (!open) setDeleteGoal(null) }}
          goal={deleteGoal}
        />
      )}
    </div>
  )
}
