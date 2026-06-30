import type { Milestone, TaggedTask } from '@/stores/pm-store.ts'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible.tsx'
import { SegmentedProgress, StatusBreakdown } from './shared/SegmentedProgress.tsx'
import { computeStatusCounts, useCollapsed } from './shared/helpers.ts'
import { TaskRow } from './TaskRow.tsx'
import { ChevronDown, ChevronRight, Check, X } from 'lucide-react'

export interface MilestoneGroupProps {
  milestone: Milestone
  tasks: TaggedTask[]
  goalId: string
  onOpenFull: (id: string) => void
  onStatusChange: (taskId: string, status: string) => void
  onRemoveTask: (taskId: string) => void
  onDelete?: () => void
}

export function MilestoneGroup({
  milestone,
  tasks,
  goalId,
  onOpenFull,
  onStatusChange,
  onRemoveTask,
  onDelete,
}: MilestoneGroupProps) {
  const { open, toggle } = useCollapsed(`${goalId}-ms-${milestone.id}`, true)

  // Resolve step IDs to actual tasks
  const stepIds = new Set(milestone.steps || [])
  const stepTasks = tasks.filter(t => stepIds.has(t.id))
  const counts = computeStatusCounts(stepTasks)
  const allDone = counts.total > 0 && counts.done === counts.total
  const currentStepId = (milestone.steps || []).find(stepId => {
    const task = stepTasks.find(t => t.id === stepId)
    return task && task.status !== 'done'
  })
  const currentStep = currentStepId ? stepTasks.find(t => t.id === currentStepId) : null
  const currentStepTitle = currentStep?.title?.trim() || 'Untitled step'

  return (
    <Collapsible open={open} onOpenChange={toggle}>
      {/* Header line: dashed bar + title + count + chevron */}
      <CollapsibleTrigger asChild>
        <button className="w-full flex items-center gap-2 py-1.5 px-1 bg-transparent border-none cursor-pointer text-left group/ms hover:bg-[var(--bg-ingrained)] rounded transition-colors">
          {/* Dashed line before title */}
          <span className="type-label text-muted-foreground select-none">&mdash;&mdash;</span>

          {/* Title */}
          <span className="type-label font-semibold text-foreground whitespace-nowrap">
            {milestone.title || milestone.id}
          </span>

          {/* Dashed line fill */}
          <span className="flex-1 border-b border-dashed border-[var(--color-border-subtle)] min-w-[20px]" />

          {/* Count badge */}
          <span className="type-micro text-muted-foreground whitespace-nowrap tabular-nums font-mono">
            {counts.done}/{counts.total}
          </span>

          {!allDone && currentStep && (
            <span
              className="hidden min-w-0 max-w-[180px] truncate type-micro text-muted-foreground sm:inline"
              title={currentStepTitle}
            >
              now: {currentStepTitle}
            </span>
          )}

          {/* All-done checkmark */}
          {allDone && (
            <Check size={13} className="text-green shrink-0" />
          )}

          {/* Delete milestone button (visible on hover) */}
          {onDelete && (
            <span
              role="button"
              className="text-muted-foreground hover:text-red shrink-0 opacity-0 group-hover/ms:opacity-100 transition-opacity cursor-pointer"
              onClick={(e) => { e.stopPropagation(); onDelete() }}
              title="Delete milestone"
            >
              <X size={13} />
            </span>
          )}

          {/* Chevron */}
          {open
            ? <ChevronDown size={13} className="text-muted-foreground shrink-0" />
            : <ChevronRight size={13} className="text-muted-foreground shrink-0" />
          }
        </button>
      </CollapsibleTrigger>

      {/* Progress bar (always visible, even when collapsed) */}
      <div className="px-1 pb-1">
        <SegmentedProgress counts={counts} className="mt-0.5" />
        {open && <StatusBreakdown counts={counts} className="mt-0.5" />}
      </div>

      {/* Task rows */}
      <CollapsibleContent>
        <div className="flex flex-col">
          {(milestone.steps || []).map(stepId => {
            const task = stepTasks.find(t => t.id === stepId)
            if (!task) {
              // Step ID not found in tagged tasks — show a placeholder
              return (
                <div key={stepId} className="grid items-center gap-1 rounded py-0.5 px-1 type-micro text-muted-foreground" style={{ gridTemplateColumns: '24px 72px 1fr' }}>
                  <span />
                  <span className="font-mono">{stepId}</span>
                  <span className="italic">(not found in tagged tasks)</span>
                </div>
              )
            }
            return (
              <TaskRow
                key={task.id}
                task={task}
                onOpenFull={onOpenFull}
                onStatusChange={(status) => onStatusChange(task.id, status)}
                onRemove={() => onRemoveTask(task.id)}
              />
            )
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
