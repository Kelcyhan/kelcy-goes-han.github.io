import { useState, useCallback, useRef } from 'react'
import { ChevronRight, ChevronDown, ArrowLeft, CheckCircle2, Circle, CircleDot, Lock, Pause, X, AlertTriangle, Plus } from 'lucide-react'
import { usePMStore } from '@/stores/pm-store.ts'
import type { Goal, Milestone, TaggedTask, TaggedBacklog, SequenceStep } from '@/stores/pm-store.ts'
import { GoalStatusIcon } from './shared.tsx'
import { GoalRoadmap } from './GoalRoadmap.tsx'
import { GoalDAGEditor } from './GoalDAGEditor.tsx'
import { ProgressBar, PMBadge, PMStatusDot, ActionButton, IconButton } from '@/components/primitives'

// --- Shared helpers ---

function formatBuffer(hours: number): string {
  const abs = Math.abs(hours)
  if (abs >= 48) return `${Math.round(abs / 24)}d`
  return `${abs}h`
}

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
  const icon = ms.status === 'done' ? '✓'
    : ms.status === 'in_progress' ? '◐'
    : '○'
  return (
    <span className="inline-flex items-center gap-1 type-micro text-muted-foreground bg-[var(--bg-raised)] px-2 py-0.5 rounded-full border border-[var(--color-border-subtle)]">
      <span>{icon}</span>
      <span className="max-w-[120px] overflow-hidden text-ellipsis whitespace-nowrap">{ms.title}</span>
    </span>
  )
}

function TaskStatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'done': return <CheckCircle2 size={12} className="text-green" />
    case 'active':
    case 'executing': return <CircleDot size={12} className="text-accent" />
    case 'propose':
    case 'conversation': return <CircleDot size={12} className="text-orange" />
    case 'blocked': return <Lock size={12} className="text-red" />
    case 'shelved': return <Pause size={12} className="text-muted-foreground" />
    case 'dropped': return <X size={12} className="text-muted-foreground" />
    default: return <Circle size={12} className="text-muted-foreground" />
  }
}

// --- Inline add form ---

function InlineAddForm({ placeholder, onAdd }: { placeholder: string; onAdd: (value: string) => void }) {
  const [active, setActive] = useState(false)
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  if (!active) {
    return (
      <ActionButton
        variant="back"
        size="sm"
        className="h-auto gap-1 p-0"
        onClick={() => { setActive(true); setTimeout(() => inputRef.current?.focus(), 0) }}
      >
        <Plus size={10} /> Add
      </ActionButton>
    )
  }

  const handleSubmit = () => {
    const trimmed = value.trim()
    if (trimmed) {
      onAdd(trimmed)
      setValue('')
    }
    setActive(false)
  }

  return (
    <div className="flex items-center gap-1">
      <input
        ref={inputRef}
        className="flex-1 type-micro bg-[var(--bg-raised)] border border-[var(--color-border-subtle)] rounded px-1.5 py-0.5 text-foreground outline-none focus:border-[var(--color-accent)]"
        placeholder={placeholder}
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); if (e.key === 'Escape') setActive(false) }}
        autoFocus
      />
      <ActionButton
        variant="toolbar"
        size="toolbar"
        onClick={handleSubmit}
      >
        Add
      </ActionButton>
      <ActionButton
        variant="back"
        size="sm"
        onClick={() => setActive(false)}
      >
        Cancel
      </ActionButton>
    </div>
  )
}

function RemoveButton({ onClick }: { onClick: () => void }) {
  return (
    <IconButton
      variant="appShell"
      size="file"
      className="opacity-0 transition-opacity group-hover:opacity-100 hover:text-red"
      onClick={(e) => { e.stopPropagation(); onClick() }}
      title="Remove"
    >
      <X size={11} />
    </IconButton>
  )
}

// --- Collapsible section ---

function useCollapsed(key: string, defaultOpen = true) {
  const storageKey = `goal-section-${key}`
  const [open, setOpen] = useState(() => {
    try {
      const stored = localStorage.getItem(storageKey)
      return stored !== null ? stored === 'true' : defaultOpen
    } catch { return defaultOpen }
  })
  const toggle = useCallback(() => {
    setOpen(prev => {
      const next = !prev
      try { localStorage.setItem(storageKey, String(next)) } catch {}
      return next
    })
  }, [storageKey])
  return { open, toggle }
}

function CollapsibleSection({ title, storageKey, defaultOpen = true, count, actions, children }: {
  title: string
  storageKey: string
  defaultOpen?: boolean
  count?: number
  actions?: React.ReactNode
  children: React.ReactNode
}) {
  const { open, toggle } = useCollapsed(storageKey, defaultOpen)
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        <ActionButton
          variant="back"
          size="sm"
          className="h-auto gap-1.5 p-0 font-semibold text-foreground"
          onClick={toggle}
        >
          {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          {title}
          {count != null && <span className="text-muted-foreground font-normal">({count})</span>}
        </ActionButton>
        {open && actions && <div className="ml-auto">{actions}</div>}
      </div>
      {open && children}
    </div>
  )
}

// --- Goal Card (list view) ---

function GoalCard({ goal, onClick }: { goal: Goal; onClick: () => void }) {
  const isOverdue = goal.target && new Date(goal.target) < new Date()
  const milestones = goal.milestones || []

  return (
    <div
      className="bg-card border border-border rounded-md p-3 flex flex-col gap-2 cursor-pointer transition-all duration-150 hover:border-[var(--color-accent)] hover:shadow-[0_2px_8px_rgba(0,0,0,0.08)]"
      onClick={onClick}
    >
      <div className="flex items-center gap-2">
        <GoalStatusIcon status={goal.status} />
        <span className="text-sm font-semibold flex-1">{goal.id}</span>
      </div>
      <div className="text-xs text-muted-foreground">{goal.title}</div>
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`type-micro text-muted-foreground ${isOverdue ? 'text-red' : ''}`}>
          target: {goal.target}
        </span>
        <BufferBadge hours={goal.buffer_hours} target={goal.target} />
        <ScheduleBadge status={goal.schedule_status} />
      </div>
      <div className="flex items-center gap-2">
        <ProgressBar done={goal.progress?.done ?? 0} total={goal.progress?.total ?? 0} />
        <span className="type-micro text-muted-foreground shrink-0">
          {goal.progress?.done ?? 0}/{goal.progress?.total ?? 0}
        </span>
      </div>
      {milestones.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-1 border-t border-[var(--color-border-subtle)]">
          {milestones.map(ms => <MilestoneChip key={ms.id} ms={ms} />)}
        </div>
      )}
    </div>
  )
}

// --- Goal List ---

function GoalList() {
  const state = usePMStore(s => s.state)
  const selectGoal = usePMStore(s => s.selectGoal)

  if (!state) return null
  const goals = state.goals || []

  if (goals.length === 0) {
    return <div className="text-muted-foreground type-body-sm py-6 text-center">No goals defined yet</div>
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
        {goals.map(goal => (
          <GoalCard key={goal.id} goal={goal} onClick={() => selectGoal(goal.id)} />
        ))}
      </div>
      {goals.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="type-body-sm font-semibold text-foreground m-0">Roadmap</h2>
          <GoalRoadmap />
        </div>
      )}
    </div>
  )
}

// --- Tagged Task Row (three-level interaction) ---

function TaggedTaskRow({ task, onOpenFull, onRemove }: { task: TaggedTask; onOpenFull: (taskId: string) => void; onRemove?: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const selectGoal = usePMStore(s => s.selectGoal)

  return (
    <div className="flex flex-col">
      <div
        className="group flex items-center gap-1.5 py-1 px-1 rounded type-label cursor-pointer hover:bg-[var(--bg-ingrained)]"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? <ChevronDown size={12} className="shrink-0" /> : <ChevronRight size={12} className="shrink-0" />}
        <TaskStatusIcon status={task.status} />
        <span className="text-muted-foreground type-micro font-mono shrink-0">{task.id}</span>
        <span className="flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{task.title}</span>
        <span className="type-caption text-muted-foreground shrink-0">{task.status}</span>
        {task.est_hours != null && (
          <span className="type-caption text-muted-foreground shrink-0">{task.est_hours}h</span>
        )}
        {onRemove && <RemoveButton onClick={onRemove} />}
      </div>
      {expanded && (
        <div className="flex flex-col gap-1 py-1.5 px-2 ml-6 mb-1 border-l-2 border-[var(--color-border-subtle)] bg-[var(--bg-raised)] rounded-r type-micro">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">status:</span>
            <span>{task.status}</span>
          </div>
          {task.est_hours != null && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">est:</span>
              <span>{task.est_hours}h</span>
            </div>
          )}
          {task.goals.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-muted-foreground">goals:</span>
              {task.goals.map(g => {
                const goalId = g.includes('/') ? g.split('/')[0] : g
                return (
                  <PMBadge
                    key={g}
                    variant="goal"
                    size="sm"
                    className="cursor-pointer"
                    onClick={(e: React.MouseEvent) => { e.stopPropagation(); selectGoal(goalId) }}
                  >
                    {g}
                  </PMBadge>
                )
              })}
            </div>
          )}
          <ActionButton
            variant="toolbar"
            size="toolbar"
            className="self-end"
            onClick={(e) => { e.stopPropagation(); onOpenFull(task.id) }}
          >
            Open full →
          </ActionButton>
        </div>
      )}
    </div>
  )
}

// --- Milestones Section ---

function MilestoneSection({ milestone, taggedTasks }: { milestone: Milestone; taggedTasks: TaggedTask[] }) {
  const statusDot = milestone.status === 'done' ? 'done'
    : milestone.status === 'in_progress' ? 'active'
    : 'todo'

  const stepTaskIds = new Set(milestone.steps || [])
  const stepTasks = taggedTasks.filter(t => stepTaskIds.has(t.id))

  return (
    <div className="flex flex-col gap-1 pl-1">
      <div className="flex items-center gap-1.5 type-label font-medium">
        <PMStatusDot status={statusDot} />
        <span className="flex-1">{milestone.id} — {milestone.title}</span>
      </div>
      {(milestone.steps || []).length > 0 && (
        <div className="flex flex-col gap-0.5 pl-5">
          {(milestone.steps || []).map(stepId => {
            const task = stepTasks.find(t => t.id === stepId)
            return (
              <div key={stepId} className="flex items-center gap-1.5 type-micro">
                {task ? <TaskStatusIcon status={task.status} /> : <Circle size={11} className="text-muted-foreground" />}
                <span className="text-muted-foreground font-mono">{stepId}</span>
                {task && <span className="flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{task.title}</span>}
                {task && <span className="type-caption text-muted-foreground">{task.status}</span>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// --- Tagged Backlog Section ---

function BacklogSection({ items }: { items: TaggedBacklog[] }) {
  const bySource = new Map<string, TaggedBacklog[]>()
  for (const item of items) {
    const source = item.source || 'unknown'
    if (!bySource.has(source)) bySource.set(source, [])
    bySource.get(source)!.push(item)
  }

  const totalEstimated = items.reduce((sum, i) => sum + (i.est_hours || 0), 0)
  const hasUnknowns = items.some(i => i.est_hours == null)

  return (
    <div className="flex flex-col gap-2">
      {[...bySource.entries()].map(([source, sourceItems]) => (
        <div key={source} className="flex flex-col gap-0.5">
          <div className="type-caption text-muted-foreground font-medium uppercase tracking-wide">Source: {source}</div>
          {sourceItems.map((item, i) => (
            <div key={i} className="flex items-center gap-2 type-micro pl-2">
              <span className="text-muted-foreground">☐</span>
              <span className="flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{item.title}</span>
              {item.est_hours != null ? (
                <span className="type-caption text-muted-foreground shrink-0">{item.est_hours}h</span>
              ) : (
                <span className="type-caption shrink-0"><AlertTriangle size={10} className="text-orange inline" /> ?h</span>
              )}
            </div>
          ))}
        </div>
      ))}
      <div className="type-caption text-muted-foreground pt-1 border-t border-[var(--color-border-subtle)]">
        Total: {totalEstimated}h estimated{hasUnknowns ? ' + unknowns' : ''}
      </div>
    </div>
  )
}

// --- Goal Detail ---

function GoalDetail({ goalId }: { goalId: string }) {
  const state = usePMStore(s => s.state)
  const clearSelectedGoal = usePMStore(s => s.clearSelectedGoal)
  const navigateToLevel = usePMStore(s => s.navigateToLevel)
  const setActiveView = usePMStore(s => s.setActiveView)
  const updateGoal = usePMStore(s => s.updateGoal)

  const goal = state?.goals?.find(g => g.id === goalId)

  const handleOpenFull = (taskId: string) => {
    setActiveView('domains')
    navigateToLevel(taskId)
  }

  if (!goal) {
    return (
      <div className="flex flex-col gap-2">
        <ActionButton variant="back" className="self-start" onClick={clearSelectedGoal}>
          <ArrowLeft size={14} /> Back to Goals
        </ActionButton>
        <div className="text-muted-foreground text-sm">Goal "{goalId}" not found</div>
      </div>
    )
  }

  const isOverdue = goal.target && new Date(goal.target) < new Date()
  const milestones = goal.milestones || []
  const timeline = goal.timeline || []
  const taggedTasks = (goal.tagged_tasks || []).filter(t => !t.in_sequence)
  const taggedBacklog = goal.tagged_backlog || []
  const allTaggedTasks = goal.tagged_tasks || []

  // --- Editing callbacks ---
  const handleAddDoneWhen = (text: string) => {
    const current = (goal.done_when || []).map(c =>
      typeof c === 'string' ? { text: c, done: false } : { text: c.text || String(c), done: !!c.done }
    )
    updateGoal(goalId, { done_when: [...current, { text, done: false }] })
  }

  const handleRemoveDoneWhen = (index: number) => {
    const current = (goal.done_when || []).map(c =>
      typeof c === 'string' ? { text: c, done: false } : { text: c.text || String(c), done: !!c.done }
    )
    updateGoal(goalId, { done_when: current.filter((_, i) => i !== index) })
  }

  const handleAddMilestone = (input: string) => {
    // Format: "id — title" or just "id"
    const parts = input.split('—').map(s => s.trim())
    const id = parts[0].replace(/\s+/g, '-').toLowerCase()
    const title = parts[1] || id
    const current = milestones.map(ms => ({ id: ms.id, title: ms.title, steps: ms.steps || [] }))
    updateGoal(goalId, { milestones: [...current, { id, title, steps: [] }] })
  }

  const handleRemoveMilestone = (msId: string) => {
    const current = milestones.map(ms => ({ id: ms.id, title: ms.title, steps: ms.steps || [] }))
    updateGoal(goalId, { milestones: current.filter(ms => ms.id !== msId) })
  }

  // Sequence editing: uses goal.sequence (raw DAG with depends_on)
  const sequence = goal.sequence || []

  const handleSequenceChange = (newSequence: SequenceStep[]) => {
    updateGoal(goalId, { sequence: newSequence })
  }

  const handleAddSequenceStep = (input: string) => {
    // Format: "task-id — title" or just "task-id"
    const parts = input.split('—').map(s => s.trim())
    const id = parts[0]
    const title = parts[1] || ''
    updateGoal(goalId, { sequence: [...sequence, { id, title, depends_on: [] }] })
  }

  // Tagged task removal: remove this goal from the task's goals field
  const handleUntagTask = async (taskId: string) => {
    const task = taggedTasks.find(t => t.id === taskId)
    if (!task) return
    const newGoals = task.goals.filter(g => {
      const gId = g.includes('/') ? g.split('/')[0] : g
      return gId !== goalId
    })
    // Use the single-goal field for backward compat — set to first remaining goal or null
    const updateFields: { goal?: string | null } = { goal: newGoals[0] || null }
    await usePMStore.getState().updateTaskFields(taskId, updateFields)
    // Refresh state to reflect changes
    usePMStore.getState().fetchState(usePMStore.getState().activeProject!)
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Back button */}
      <ActionButton variant="back" className="self-start" onClick={clearSelectedGoal}>
        <ArrowLeft size={14} /> Back to Goals
      </ActionButton>

      {/* Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <GoalStatusIcon status={goal.status} />
          <span className="text-sm font-bold">{goal.id}</span>
          <span className="text-sm text-muted-foreground">—</span>
          <span className="text-sm font-medium flex-1">{goal.title}</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap type-micro">
          <span className={`text-muted-foreground ${isOverdue ? 'text-red' : ''}`}>target: {goal.target}</span>
          <BufferBadge hours={goal.buffer_hours} target={goal.target} />
          <ScheduleBadge status={goal.schedule_status} />
        </div>
        <div className="flex items-center gap-2">
          <ProgressBar done={goal.progress?.done ?? 0} total={goal.progress?.total ?? 0} />
          <span className="type-micro text-muted-foreground">
            {goal.progress?.done ?? 0}/{goal.progress?.total ?? 0}
          </span>
        </div>
      </div>

      {/* done_when */}
      <CollapsibleSection
        title="Done When"
        storageKey={`${goalId}-done-when`}
        count={(goal.done_when || []).length}
        actions={<InlineAddForm placeholder="New criterion…" onAdd={handleAddDoneWhen} />}
      >
        <div className="flex flex-col gap-0.5 pl-1">
          {(goal.done_when || []).map((criterion, i) => (
            <div key={i} className="group flex items-center gap-1.5 type-micro">
              <span>☐</span>
              <span className="flex-1">{typeof criterion === 'string' ? criterion : String(criterion)}</span>
              <RemoveButton onClick={() => handleRemoveDoneWhen(i)} />
            </div>
          ))}
        </div>
      </CollapsibleSection>

      {/* Sequence DAG — React Flow */}
      <CollapsibleSection
        title="Sequence DAG"
        storageKey={`${goalId}-sequence-dag`}
        count={sequence.length}
        actions={<InlineAddForm placeholder="task-id — title" onAdd={handleAddSequenceStep} />}
      >
        <GoalDAGEditor
          sequence={sequence}
          timeline={timeline}
          criticalPath={goal.critical_path || []}
          taggedTasks={allTaggedTasks}
          onSequenceChange={handleSequenceChange}
          onNodeDoubleClick={handleOpenFull}
          onAddStep={() => {/* handled by InlineAddForm above */}}
        />
        {sequence.length > 0 && (
          <div className="type-caption text-muted-foreground mt-1">
            Double-click node to open full. Drag handles to add edges. Select + Delete to remove.
          </div>
        )}
      </CollapsibleSection>

      {/* Milestones */}
      <CollapsibleSection
        title="Milestones"
        storageKey={`${goalId}-milestones`}
        count={milestones.length}
        actions={<InlineAddForm placeholder="id — title" onAdd={handleAddMilestone} />}
      >
        <div className="flex flex-col gap-2">
          {milestones.map(ms => (
            <div key={ms.id} className="group flex items-start gap-1">
              <div className="flex-1">
                <MilestoneSection milestone={ms} taggedTasks={allTaggedTasks} />
              </div>
              <RemoveButton onClick={() => handleRemoveMilestone(ms.id)} />
            </div>
          ))}
          {milestones.length === 0 && (
            <div className="type-micro text-muted-foreground">(no milestones)</div>
          )}
        </div>
      </CollapsibleSection>

      {/* Tagged Tasks (not in sequence) */}
      {taggedTasks.length > 0 && (
        <CollapsibleSection title="Tagged Tasks" storageKey={`${goalId}-tagged-tasks`} count={taggedTasks.length}>
          <div className="flex flex-col">
            {taggedTasks.map(task => (
              <TaggedTaskRow key={task.id} task={task} onOpenFull={handleOpenFull} onRemove={() => handleUntagTask(task.id)} />
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Tagged Backlog */}
      {taggedBacklog.length > 0 && (
        <CollapsibleSection title="Tagged Backlog" storageKey={`${goalId}-tagged-backlog`} count={taggedBacklog.length}>
          <BacklogSection items={taggedBacklog} />
        </CollapsibleSection>
      )}

      {/* Observations */}
      <CollapsibleSection
        title="Observations"
        storageKey={`${goalId}-observations`}
        defaultOpen={false}
        count={(goal.observations || []).length}
        actions={<InlineAddForm placeholder="New observation…" onAdd={(text) => {
          const current = goal.observations || []
          const today = new Date().toISOString().slice(0, 10)
          updateGoal(goalId, { observations: [...current, { date: today, note: text }] })
        }} />}
      >
        <div className="flex flex-col gap-1 pl-1">
          {(goal.observations || []).map((obs, i) => (
            <div key={i} className="group flex items-start gap-1.5 type-micro">
              <span className="text-muted-foreground shrink-0">{obs.date}:</span>
              <span className="flex-1">{obs.note}</span>
              <RemoveButton onClick={() => {
                const current = goal.observations || []
                updateGoal(goalId, { observations: current.filter((_, idx) => idx !== i) })
              }} />
            </div>
          ))}
          {(goal.observations || []).length === 0 && (
            <div className="type-micro text-muted-foreground">(no observations)</div>
          )}
        </div>
      </CollapsibleSection>

      {/* Decisions */}
      <CollapsibleSection
        title="Decisions"
        storageKey={`${goalId}-decisions`}
        defaultOpen={false}
        count={(goal.decisions || []).length}
        actions={<InlineAddForm placeholder="New decision…" onAdd={(text) => {
          const current = goal.decisions || []
          const today = new Date().toISOString().slice(0, 10)
          updateGoal(goalId, { decisions: [...current, { date: today, decision: text }] })
        }} />}
      >
        <div className="flex flex-col gap-1 pl-1">
          {(goal.decisions || []).map((dec, i) => (
            <div key={i} className="group flex flex-col gap-0.5">
              <div className="flex items-start gap-1.5 type-micro">
                <span className="text-muted-foreground shrink-0">{dec.date}:</span>
                <span className="flex-1">{dec.decision}</span>
                <RemoveButton onClick={() => {
                  const current = goal.decisions || []
                  updateGoal(goalId, { decisions: current.filter((_, idx) => idx !== i) })
                }} />
              </div>
              {dec.context && (
                <div className="type-caption text-muted-foreground pl-[70px]">
                  Context: {dec.context}
                </div>
              )}
            </div>
          ))}
          {(goal.decisions || []).length === 0 && (
            <div className="type-micro text-muted-foreground">(no decisions)</div>
          )}
        </div>
      </CollapsibleSection>

      {/* References */}
      <CollapsibleSection
        title="References"
        storageKey={`${goalId}-references`}
        defaultOpen={false}
        count={(goal.references || []).length}
        actions={<InlineAddForm placeholder="Add reference path…" onAdd={(text) => {
          const current = goal.references || []
          updateGoal(goalId, { references: [...current, text] })
        }} />}
      >
        <div className="flex flex-col gap-0.5 pl-1">
          {(goal.references || []).map((ref, i) => (
            <div key={i} className="group flex items-center gap-1.5 type-micro">
              <span className="text-muted-foreground">•</span>
              <span className="flex-1 font-mono type-caption">{ref}</span>
              <RemoveButton onClick={() => {
                const current = goal.references || []
                updateGoal(goalId, { references: current.filter((_, idx) => idx !== i) })
              }} />
            </div>
          ))}
          {(goal.references || []).length === 0 && (
            <div className="type-micro text-muted-foreground">(no references)</div>
          )}
        </div>
      </CollapsibleSection>

      {/* Schedule Gantt (collapsed by default) */}
      {timeline.length > 0 && (
        <CollapsibleSection title="Schedule (Gantt)" storageKey={`${goalId}-gantt`} defaultOpen={false}>
          <GoalRoadmap goalId={goalId} />
        </CollapsibleSection>
      )}

    </div>
  )
}

// --- Main export ---

export function GoalsView() {
  const selectedGoalId = usePMStore(s => s.selectedGoalId)

  if (selectedGoalId) {
    return <GoalDetail goalId={selectedGoalId} />
  }
  return <GoalList />
}
