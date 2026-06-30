import { useState, useRef, useMemo } from 'react'
import type { Goal, SequenceStep, TaggedTask, TaggedBacklog } from '@/stores/pm-store.ts'
import { usePMStore } from '@/stores/pm-store.ts'
import { MilestoneGroup } from './MilestoneGroup.tsx'
import { TaskRow } from './TaskRow.tsx'
import { BacklogRow } from './BacklogRow.tsx'
import { TaskSearchPicker } from './TaskSearchPicker.tsx'
import { CreateMilestoneDialog } from './CreateMilestoneDialog.tsx'
import { ViewConfigBar, useViewConfig, type GoalViewConfig } from './ViewConfigBar.tsx'
import { useCollapsed, useActionToast } from './shared/helpers.ts'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible.tsx'
import { GoalDAGEditor } from '@/components/pm/GoalDAGEditor.tsx'
import { GoalRoadmap } from '@/components/pm/GoalRoadmap.tsx'
import { ActionButton } from '@/components/primitives'
import { ChevronDown, ChevronRight, Plus } from 'lucide-react'

export interface GoalDetailMainProps {
  goal: Goal
}

// --- Inline add form for backlog items ---

function BacklogAddForm({ goalId, existingBacklog, onClose }: { goalId: string; existingBacklog: TaggedBacklog[]; onClose: () => void }) {
  const updateGoal = usePMStore(s => s.updateGoal)
  const [title, setTitle] = useState('')
  const [hours, setHours] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const titleRef = useRef<HTMLInputElement>(null)

  const handleSubmit = async () => {
    const trimmedTitle = title.trim()
    if (!trimmedTitle || submitting) return
    const newItem: { title: string; est_hours?: number } = { title: trimmedTitle }
    const parsedHours = parseFloat(hours)
    if (!isNaN(parsedHours) && parsedHours > 0) {
      newItem.est_hours = parsedHours
    }
    setSubmitting(true)
    try {
      await updateGoal(goalId, { tagged_backlog: [...existingBacklog.map(b => ({ title: b.title, ...(b.est_hours != null ? { est_hours: b.est_hours } : {}) })), newItem] })
      setTitle('')
      setHours('')
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex items-center gap-1.5 mt-1 px-1">
      <input
        ref={titleRef}
        className="flex-1 type-micro bg-[var(--bg-raised)] border border-[var(--color-border-subtle)] rounded px-1.5 py-1 text-foreground outline-none focus:border-[var(--color-accent)]"
        placeholder="New backlog item title..."
        value={title}
        onChange={e => setTitle(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); if (e.key === 'Escape') onClose() }}
        autoFocus
      />
      <input
        className="w-14 type-micro bg-[var(--bg-raised)] border border-[var(--color-border-subtle)] rounded px-1.5 py-1 text-foreground outline-none focus:border-[var(--color-accent)] text-right"
        placeholder="Est: _h"
        value={hours}
        onChange={e => setHours(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); if (e.key === 'Escape') onClose() }}
      />
      <ActionButton
        variant="toolbar"
        size="toolbar"
        onClick={handleSubmit}
      >
        Add
      </ActionButton>
    </div>
  )
}

// --- Collapsible section header ---

function SectionHeader({ title, count, suffix, storageKey, defaultOpen = true, children }: {
  title: string
  count: number
  suffix?: string
  storageKey: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const { open, toggle } = useCollapsed(storageKey, defaultOpen)

  return (
    <Collapsible open={open} onOpenChange={toggle}>
      <CollapsibleTrigger asChild>
        <ActionButton
          variant="appShell"
          size="sm"
          className="h-auto w-full justify-start gap-2 px-1 py-1.5 text-left"
        >
          <span className="type-label text-muted-foreground select-none">&mdash;&mdash;</span>
          <span className="type-label font-semibold text-foreground whitespace-nowrap">{title}</span>
          <span className="flex-1 border-b border-dashed border-[var(--color-border-subtle)] min-w-[20px]" />
          <span className="type-micro text-muted-foreground whitespace-nowrap tabular-nums font-mono">
            {count}{suffix ? `, ${suffix}` : ''}
          </span>
          {open
            ? <ChevronDown size={13} className="text-muted-foreground shrink-0" />
            : <ChevronRight size={13} className="text-muted-foreground shrink-0" />
          }
        </ActionButton>
      </CollapsibleTrigger>
      <CollapsibleContent>
        {children}
      </CollapsibleContent>
    </Collapsible>
  )
}

// --- Filter/sort helpers ---

const STATUS_ORDER: Record<string, number> = {
  executing: 0, todo: 1, propose: 2, conversation: 3, blocked: 4, done: 5, shelved: 6, dropped: 7,
}

function filterTasks(tasks: TaggedTask[], config: GoalViewConfig): TaggedTask[] {
  return tasks.filter(t => {
    if (config.hiddenStatuses.includes(t.status)) return false
    if (config.showOnlyEstimated === true && t.est_hours == null) return false
    if (config.showOnlyEstimated === false && t.est_hours != null) return false
    return true
  })
}

function sortTasks(tasks: TaggedTask[], config: GoalViewConfig): TaggedTask[] {
  const sorted = [...tasks].sort((a, b) => {
    switch (config.sortBy) {
      case 'status':
        return (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99)
      case 'id':
        return a.id.localeCompare(b.id, undefined, { numeric: true })
      case 'est_hours':
        return (a.est_hours ?? 999) - (b.est_hours ?? 999)
      case 'title':
        return a.title.localeCompare(b.title)
      default:
        return 0
    }
  })
  return config.sortReversed ? sorted.reverse() : sorted
}

function groupByStatus(tasks: TaggedTask[]): { label: string; status: string; tasks: TaggedTask[] }[] {
  const groups = new Map<string, TaggedTask[]>()
  for (const t of tasks) {
    const existing = groups.get(t.status) || []
    existing.push(t)
    groups.set(t.status, existing)
  }
  // Sort groups by status order
  return Array.from(groups.entries())
    .sort(([a], [b]) => (STATUS_ORDER[a] ?? 99) - (STATUS_ORDER[b] ?? 99))
    .map(([status, tasks]) => ({
      label: status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' '),
      status,
      tasks,
    }))
}

export function GoalDetailMain({ goal }: GoalDetailMainProps) {
  const updateTaskFields = usePMStore(s => s.updateTaskFields)
  const updateGoal = usePMStore(s => s.updateGoal)
  const fetchState = usePMStore(s => s.fetchState)
  const activeProject = usePMStore(s => s.activeProject)
  const setActiveView = usePMStore(s => s.setActiveView)
  const navigateToLevel = usePMStore(s => s.navigateToLevel)

  const [backlogFormOpen, setBacklogFormOpen] = useState(false)
  const [taskPickerOpen, setTaskPickerOpen] = useState(false)
  const [milestoneDialogOpen, setMilestoneDialogOpen] = useState(false)

  const { config, update: updateConfig } = useViewConfig(goal.id)
  const { toast, show: showToast } = useActionToast()

  const milestones = goal.milestones || []
  const allTaggedTasks = goal.tagged_tasks || []
  const taggedBacklog = goal.tagged_backlog || []
  const sequence = goal.sequence || []
  const timeline = goal.timeline || []

  // Apply filters and sorting
  const filteredTasks = useMemo(() => sortTasks(filterTasks(allTaggedTasks, config), config), [allTaggedTasks, config])

  // Collect all task IDs that belong to milestones
  const milestoneTaskIds = new Set<string>()
  for (const ms of milestones) {
    for (const stepId of ms.steps || []) {
      milestoneTaskIds.add(stepId)
    }
  }

  // "Other tagged tasks": not in any milestone AND not in_sequence
  const otherTasks = filteredTasks.filter(t => !milestoneTaskIds.has(t.id) && !t.in_sequence)

  // Backlog total hours
  const backlogTotalHours = taggedBacklog.reduce((sum, i) => sum + (i.est_hours || 0), 0)
  const backlogHasUnknowns = taggedBacklog.some(i => i.est_hours == null)
  const backlogSuffix = backlogTotalHours > 0
    ? `~${backlogTotalHours}h${backlogHasUnknowns ? '+' : ''}`
    : backlogHasUnknowns ? '?h' : undefined

  // --- Callbacks ---

  const handleOpenFull = (taskId: string) => {
    setActiveView('domains')
    navigateToLevel(taskId)
  }

  const handleStatusChange = async (taskId: string, status: string) => {
    await updateTaskFields(taskId, { status })
    if (activeProject) fetchState(activeProject)
  }

  const handleRemoveTask = async (taskId: string) => {
    // Find the task to get its current goals list, then remove this goal
    const task = allTaggedTasks.find(t => t.id === taskId)
    const currentGoals = task?.goals || []
    const remainingGoals = currentGoals.filter(g => {
      // Strip milestone suffix for comparison (e.g. "system-v1/ms-1" → "system-v1")
      const baseGoal = g.includes('/') ? g.split('/')[0] : g
      return baseGoal !== goal.id
    })
    // Use the goals field (plural) to set the remaining goals
    await updateTaskFields(taskId, { goals: remainingGoals })
    if (activeProject) fetchState(activeProject)
  }

  const handleDeleteMilestone = async (msId: string) => {
    await updateGoal(goal.id, { milestones: milestones.filter(m => m.id !== msId) })
  }

  const handleSequenceChange = (newSequence: SequenceStep[]) => {
    updateGoal(goal.id, { sequence: newSequence })
  }

  // Power views state
  const dagState = useCollapsed(`${goal.id}-power-dag`, false)
  const ganttState = useCollapsed(`${goal.id}-power-gantt`, false)

  // Grouped views
  const statusGroups = useMemo(() => groupByStatus(filteredTasks), [filteredTasks])

  // Filtered empty state
  const isFiltered = config.hiddenStatuses.length > 0 || config.hiddenMilestones.length > 0 || config.showOnlyEstimated !== null
  const hasVisibleTasks = config.groupBy === 'milestone'
    ? (milestones.some(ms => !config.hiddenMilestones.includes(ms.id)) || otherTasks.length > 0)
    : filteredTasks.length > 0

  return (
    <div className="flex flex-col gap-2 p-3 h-full overflow-y-auto">
      {/* Action toast */}
      {toast && (
        <div className={`type-micro px-2.5 py-1.5 rounded-md transition-opacity ${
          toast.type === 'success'
            ? 'bg-green/10 text-green border border-green/20'
            : 'bg-destructive/10 text-destructive border border-destructive/20'
        }`}>
          {toast.message}
        </div>
      )}

      {/* View config bar */}
      <ViewConfigBar config={config} update={updateConfig} milestones={milestones} />

      {/* Task content — varies by groupBy mode */}
      {config.groupBy === 'milestone' && (
        <>
          {/* 1. Milestone groups */}
          {milestones.map(ms => {
            // Filter milestone tasks by hidden milestones
            if (config.hiddenMilestones.includes(ms.id)) return null
            return (
              <MilestoneGroup
                key={ms.id}
                milestone={ms}
                tasks={filteredTasks}
                goalId={goal.id}
                onOpenFull={handleOpenFull}
                onStatusChange={handleStatusChange}
                onRemoveTask={handleRemoveTask}
                onDelete={() => handleDeleteMilestone(ms.id)}
              />
            )
          })}

          {/* 2. Other tagged tasks (not in milestones and not in sequence) */}
          {otherTasks.length > 0 && !config.hiddenMilestones.includes('__none__') && (
            <SectionHeader
              title="Other tagged tasks"
              count={otherTasks.length}
              storageKey={`${goal.id}-other-tasks`}
            >
              <div className="flex flex-col">
                {otherTasks.map(task => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    onOpenFull={handleOpenFull}
                    onStatusChange={(status) => handleStatusChange(task.id, status)}
                    onRemove={() => handleRemoveTask(task.id)}
                  />
                ))}
              </div>
            </SectionHeader>
          )}
        </>
      )}

      {config.groupBy === 'status' && statusGroups.map(group => (
        <SectionHeader
          key={group.status}
          title={group.label}
          count={group.tasks.length}
          storageKey={`${goal.id}-status-${group.status}`}
        >
          <div className="flex flex-col">
            {group.tasks.map(task => (
              <TaskRow
                key={task.id}
                task={task}
                onOpenFull={handleOpenFull}
                onStatusChange={(status) => handleStatusChange(task.id, status)}
                onRemove={() => handleRemoveTask(task.id)}
              />
            ))}
          </div>
        </SectionHeader>
      ))}

      {config.groupBy === 'none' && filteredTasks.length > 0 && (
        <div className="flex flex-col">
          {filteredTasks.map(task => (
            <TaskRow
              key={task.id}
              task={task}
              onOpenFull={handleOpenFull}
              onStatusChange={(status) => handleStatusChange(task.id, status)}
              onRemove={() => handleRemoveTask(task.id)}
            />
          ))}
        </div>
      )}

      {/* Filtered empty state */}
      {!hasVisibleTasks && isFiltered && (
        <div className="text-center py-6 text-muted-foreground type-label">
          No tasks match the current filters.
          <ActionButton
            variant="back"
            size="sm"
            className="ml-1 h-auto p-0 underline"
            onClick={() => updateConfig({ hiddenStatuses: [], hiddenMilestones: [], showOnlyEstimated: null })}
          >
            Clear filters
          </ActionButton>
        </div>
      )}

      {/* Backlog (always shown below tasks regardless of grouping) */}
      {taggedBacklog.length > 0 && (
        <SectionHeader
          title="Backlog"
          count={taggedBacklog.length}
          suffix={backlogSuffix}
          storageKey={`${goal.id}-backlog`}
        >
          <div className="flex flex-col">
            {taggedBacklog.map((item, i) => (
              <BacklogRow
                key={i}
                item={item}
              />
            ))}
          </div>
        </SectionHeader>
      )}

      {/* 4. Action bar */}
      <div className="flex items-center gap-2 py-2 px-1 border-t border-[var(--color-border-subtle)]">
        <ActionButton
          variant="toolbar"
          size="toolbar"
          onClick={() => setTaskPickerOpen(true)}
        >
          <Plus size={12} /> Add task
        </ActionButton>
        <ActionButton
          variant="toolbar"
          size="toolbar"
          onClick={() => setBacklogFormOpen(!backlogFormOpen)}
        >
          <Plus size={12} /> Add backlog
        </ActionButton>
        <ActionButton
          variant="toolbar"
          size="toolbar"
          onClick={() => setMilestoneDialogOpen(true)}
        >
          <Plus size={12} /> Add milestone
        </ActionButton>
      </div>

      {backlogFormOpen && <BacklogAddForm goalId={goal.id} existingBacklog={taggedBacklog} onClose={() => setBacklogFormOpen(false)} />}

      {/* Dialogs */}
      <TaskSearchPicker
        open={taskPickerOpen}
        onOpenChange={setTaskPickerOpen}
        goalId={goal.id}
        goalTitle={goal.title}
        milestones={milestones}
        onSuccess={(count) => showToast(`Added ${count} task${count !== 1 ? 's' : ''} to goal`)}
      />
      <CreateMilestoneDialog
        open={milestoneDialogOpen}
        onOpenChange={setMilestoneDialogOpen}
        goalId={goal.id}
        goalTitle={goal.title}
        existingMilestones={milestones}
        onSuccess={(name) => showToast(`Created milestone "${name}"`)}
      />

      {/* 5. Power views */}
      <div className="flex flex-col gap-1 mt-1">
        {/* Sequence DAG */}
        <Collapsible open={dagState.open} onOpenChange={dagState.toggle}>
          <CollapsibleTrigger asChild>
            <ActionButton variant="back" size="sm" className="h-auto gap-1.5 p-0 font-semibold text-foreground">
              {dagState.open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              Sequence DAG
              {sequence.length > 0 && (
                <span className="text-muted-foreground font-normal type-caption">({sequence.length} steps)</span>
              )}
            </ActionButton>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-1.5">
              <GoalDAGEditor
                sequence={sequence}
                timeline={timeline}
                criticalPath={goal.critical_path || []}
                taggedTasks={allTaggedTasks}
                onSequenceChange={handleSequenceChange}
                onNodeDoubleClick={handleOpenFull}
              />
              {sequence.length > 0 && (
                <div className="type-caption text-muted-foreground mt-1">
                  Double-click node to open full. Drag handles to add edges. Select + Delete to remove.
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Schedule Gantt */}
        {timeline.length > 0 && (
          <Collapsible open={ganttState.open} onOpenChange={ganttState.toggle}>
            <CollapsibleTrigger asChild>
              <ActionButton variant="back" size="sm" className="h-auto gap-1.5 p-0 font-semibold text-foreground">
                {ganttState.open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                Schedule Gantt
              </ActionButton>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-1.5">
                <GoalRoadmap goalId={goal.id} />
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>
    </div>
  )
}
