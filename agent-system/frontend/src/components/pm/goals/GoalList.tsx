import { useState } from 'react'
import { Plus, Target } from 'lucide-react'
import { usePMStore } from '@/stores/pm-store.ts'
import type { Goal } from '@/stores/pm-store.ts'
import { ActionButton } from '@/components/primitives'
import { GoalCard } from './GoalCard.tsx'
import { GoalRoadmap } from '../GoalRoadmap.tsx'
import { CreateGoalDialog } from './CreateGoalDialog.tsx'
import { DeleteGoalDialog } from './DeleteGoalDialog.tsx'

export function GoalList() {
  const state = usePMStore(s => s.state)
  const selectGoal = usePMStore(s => s.selectGoal)

  const [createOpen, setCreateOpen] = useState(false)
  const [deleteGoal, setDeleteGoal] = useState<Goal | null>(null)

  if (!state) return null
  const goals = state.goals || []

  const handleDelete = (goal: Goal) => {
    setDeleteGoal(goal)
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="type-title-sm font-semibold text-foreground m-0">Goals</h2>
        <ActionButton variant="toolbar" size="toolbar" className="gap-1.5" onClick={() => setCreateOpen(true)}>
          <Plus size={14} />
          New Goal
        </ActionButton>
      </div>

      {/* Goal cards or empty state */}
      {goals.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
          <div className="p-3 rounded-full bg-[var(--bg-raised)] border border-[var(--color-border-subtle)]">
            <Target size={24} className="text-muted-foreground" />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-foreground">No goals defined yet</span>
            <span className="type-body-sm text-muted-foreground">
              Goals help you track progress across tasks and milestones.
            </span>
          </div>
          <ActionButton variant="toolbarPrimary" className="mt-1 gap-1.5" onClick={() => setCreateOpen(true)}>
            <Plus size={14} />
            Create your first goal
          </ActionButton>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
            {goals.map(goal => (
              <GoalCard
                key={goal.id}
                goal={goal}
                onClick={() => selectGoal(goal.id)}
                onDelete={handleDelete}
              />
            ))}
          </div>

          {/* Roadmap */}
          <div className="flex flex-col gap-2">
            <h2 className="type-body-sm font-semibold text-foreground m-0">Roadmap</h2>
            <GoalRoadmap />
          </div>
        </>
      )}

      {/* Dialogs */}
      <CreateGoalDialog open={createOpen} onOpenChange={setCreateOpen} />
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
