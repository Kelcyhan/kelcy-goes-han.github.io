import { useState } from 'react'
import type { Goal } from '@/stores/pm-store.ts'
import { usePMStore } from '@/stores/pm-store.ts'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog.tsx'
import { Checkbox } from '@/components/ui/checkbox.tsx'
import { Label } from '@/components/ui/label.tsx'
import { ActionButton } from '@/components/primitives'

export interface DeleteGoalDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  goal: Goal
}

export function DeleteGoalDialog({ open, onOpenChange, goal }: DeleteGoalDialogProps) {
  const deleteGoal = usePMStore(s => s.deleteGoal)
  const [untagTasks, setUntagTasks] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const taggedTaskCount = goal.tagged_tasks?.length ?? 0
  const milestoneCount = goal.milestones?.length ?? 0
  const sequenceCount = goal.sequence?.length ?? 0

  const handleDelete = async () => {
    setSubmitting(true)
    try {
      await deleteGoal(goal.id, untagTasks)
      onOpenChange(false)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!submitting) onOpenChange(v) }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Goal</DialogTitle>
          <DialogDescription asChild>
            <div className="flex flex-col gap-3">
              <p>
                Are you sure you want to delete <span className="font-semibold text-foreground">{goal.id}</span>
                {goal.title ? <> &mdash; <span className="text-foreground">{goal.title}</span></> : null}?
              </p>
              <div className="flex flex-col gap-1 type-body-sm bg-[var(--bg-raised)] rounded-md p-3 border border-[var(--color-border-subtle)]">
                <span className="font-medium text-foreground">Impact:</span>
                <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
                  <li>{taggedTaskCount} task{taggedTaskCount !== 1 ? 's' : ''} tagged</li>
                  <li>{milestoneCount} milestone{milestoneCount !== 1 ? 's' : ''}</li>
                  <li>{sequenceCount} sequence step{sequenceCount !== 1 ? 's' : ''}</li>
                </ul>
              </div>
            </div>
          </DialogDescription>
        </DialogHeader>

        {taggedTaskCount > 0 && (
          <div className="flex items-center gap-2 py-1">
            <Checkbox
              id="untag-tasks"
              checked={untagTasks}
              onCheckedChange={(checked) => setUntagTasks(checked === true)}
            />
            <Label htmlFor="untag-tasks" className="text-sm font-normal cursor-pointer">
              Also remove goal tags from all {taggedTaskCount} task{taggedTaskCount !== 1 ? 's' : ''}
            </Label>
          </div>
        )}

        <DialogFooter>
          <ActionButton variant="toolbar" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </ActionButton>
          <ActionButton
            variant="destructive"
            onClick={handleDelete}
            disabled={submitting}
          >
            {submitting ? 'Deleting...' : 'Delete'}
          </ActionButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
