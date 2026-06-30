import { useState, useRef } from 'react'
import type { Goal } from '@/stores/pm-store.ts'
import { usePMStore } from '@/stores/pm-store.ts'
import { Separator } from '@/components/ui/separator.tsx'
import { Checkbox } from '@/components/ui/checkbox.tsx'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible.tsx'
import { StatusSelect } from './shared/StatusSelect.tsx'
import { SegmentedProgress, StatusBreakdown } from './shared/SegmentedProgress.tsx'
import { computeStatusCounts, formatBuffer, useCollapsed } from './shared/helpers.ts'
import { ActionButton, IconButton, PMBadge } from '@/components/primitives'
import { ChevronDown, ChevronRight, Plus, X } from 'lucide-react'

export interface GoalDetailSidebarProps {
  goal: Goal
}

// --- Inline add form (lightweight, used for done_when, observations, decisions, references) ---

function InlineAddButton({ label, placeholder, onAdd }: { label: string; placeholder: string; onAdd: (text: string) => void }) {
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
        <Plus size={10} /> {label}
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
    <div className="flex items-center gap-1 mt-1">
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
      <IconButton
        variant="appShell"
        size="file"
        onClick={() => setActive(false)}
        title="Cancel"
      >
        <X size={11} />
      </IconButton>
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

export function GoalDetailSidebar({ goal }: GoalDetailSidebarProps) {
  const updateGoal = usePMStore(s => s.updateGoal)

  const allTaggedTasks = goal.tagged_tasks || []
  const counts = computeStatusCounts(allTaggedTasks)

  const isOverdue = goal.target && new Date(goal.target) < new Date()

  // Buffer display
  const bufferDisplay = goal.buffer_hours != null ? formatBuffer(goal.buffer_hours) : null

  // Schedule badge
  const scheduleVariant = goal.schedule_status === 'ON_SCHEDULE' ? 'green'
    : goal.schedule_status === 'AT_RISK' ? 'amber'
    : goal.schedule_status === 'BEHIND' ? 'red'
    : 'count'

  // Notes section state
  const notesState = useCollapsed(`${goal.id}-sidebar-notes`, false)
  const refsState = useCollapsed(`${goal.id}-sidebar-refs`, false)

  const observations = goal.observations || []
  const decisions = goal.decisions || []
  const references = goal.references || []

  // --- Mutation callbacks ---

  const handleStatusChange = (status: string) => {
    updateGoal(goal.id, { status })
  }

  // Normalize done_when to {text, done} format (handles both string and object items from server)
  const normalizedDoneWhen = (goal.done_when || []).map(c =>
    typeof c === 'string' ? { text: c, done: false } : { text: c.text || String(c), done: !!c.done }
  )

  const handleToggleDoneWhen = (index: number) => {
    const updated = normalizedDoneWhen.map((item, i) =>
      i === index ? { ...item, done: !item.done } : item
    )
    updateGoal(goal.id, { done_when: updated })
  }

  const handleAddDoneWhen = (text: string) => {
    updateGoal(goal.id, { done_when: [...normalizedDoneWhen, { text, done: false }] })
  }

  const handleRemoveDoneWhen = (index: number) => {
    updateGoal(goal.id, { done_when: normalizedDoneWhen.filter((_, i) => i !== index) })
  }

  const handleAddObservation = (text: string) => {
    const today = new Date().toISOString().slice(0, 10)
    updateGoal(goal.id, { observations: [...observations, { date: today, note: text }] })
  }

  const handleRemoveObservation = (index: number) => {
    updateGoal(goal.id, { observations: observations.filter((_, i) => i !== index) })
  }

  const handleAddDecision = (text: string) => {
    const today = new Date().toISOString().slice(0, 10)
    updateGoal(goal.id, { decisions: [...decisions, { date: today, decision: text }] })
  }

  const handleRemoveDecision = (index: number) => {
    updateGoal(goal.id, { decisions: decisions.filter((_, i) => i !== index) })
  }

  const handleAddReference = (text: string) => {
    updateGoal(goal.id, { references: [...references, text] })
  }

  const handleRemoveReference = (index: number) => {
    updateGoal(goal.id, { references: references.filter((_, i) => i !== index) })
  }

  return (
    <div className="flex flex-col gap-3 p-3 h-full overflow-y-auto">
      {/* 1. Title + description */}
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-bold text-foreground m-0">{goal.id}</h2>
        <p className="type-label text-muted-foreground m-0">{goal.title}</p>
      </div>

      <Separator />

      {/* 2. Status */}
      <div className="flex flex-col gap-1">
        <span className="type-micro font-medium text-muted-foreground">Status</span>
        <StatusSelect
          value={goal.status}
          onChange={handleStatusChange}
          type="goal"
        />
      </div>

      {/* 3. Target / Buffer / Schedule */}
      <div className="flex flex-col gap-1.5">
        <div>
          <span className="type-micro font-medium text-muted-foreground">Target</span>
          <div className={`type-label ${isOverdue ? 'text-red' : 'text-foreground'}`}>
            {goal.target || 'No target set'}
          </div>
        </div>

        {bufferDisplay && (
          <div>
            <span className="type-micro font-medium text-muted-foreground">Buffer</span>
            <div className="type-label text-foreground">{bufferDisplay}</div>
          </div>
        )}

        {goal.schedule_status && (
          <div>
            <span className="type-micro font-medium text-muted-foreground">Schedule</span>
            <div className="mt-0.5">
              <PMBadge variant={scheduleVariant}>{goal.schedule_status.replace(/_/g, ' ')}</PMBadge>
            </div>
          </div>
        )}
      </div>

      <Separator />

      {/* 5. Progress */}
      <div className="flex flex-col gap-1">
        <span className="type-micro font-medium text-muted-foreground">Progress</span>
        <SegmentedProgress counts={counts} large />
        <StatusBreakdown counts={counts} />
      </div>

      <Separator />

      {/* 7. Done-when */}
      <div className="flex flex-col gap-1.5">
        <span className="type-micro font-medium text-muted-foreground">Done when</span>
        <div className="flex flex-col gap-1">
          {normalizedDoneWhen.map((criterion, i) => (
            <div key={i} className="group flex items-start gap-1.5">
              <Checkbox
                checked={criterion.done}
                onCheckedChange={() => handleToggleDoneWhen(i)}
                className="h-3.5 w-3.5 mt-0.5 shrink-0"
              />
              <span className={`type-micro flex-1 leading-snug ${criterion.done ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                {criterion.text}
              </span>
              <RemoveButton onClick={() => handleRemoveDoneWhen(i)} />
            </div>
          ))}
        </div>
        <InlineAddButton
          label="Add criterion"
          placeholder="New criterion..."
          onAdd={handleAddDoneWhen}
        />
      </div>

      <Separator />

      {/* 9. Notes (observations + decisions) */}
      <Collapsible open={notesState.open} onOpenChange={notesState.toggle}>
        <CollapsibleTrigger asChild>
          <ActionButton variant="back" size="sm" className="h-auto w-full justify-start gap-1.5 p-0 font-semibold text-foreground">
            {notesState.open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            Notes
            <span className="text-muted-foreground font-normal type-caption">
              ({observations.length} obs, {decisions.length} dec)
            </span>
          </ActionButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="flex flex-col gap-2 mt-2 pl-1">
            {/* Observations */}
            <div className="flex flex-col gap-1">
              <span className="type-caption font-medium text-muted-foreground uppercase tracking-wide">Observations</span>
              {observations.length === 0 && (
                <span className="type-micro text-muted-foreground italic">(none yet)</span>
              )}
              {observations.map((obs, i) => (
                <div key={i} className="group flex items-start gap-1.5 type-micro">
                  <span className="text-muted-foreground shrink-0">{obs.date}:</span>
                  <span className="flex-1 leading-snug">{obs.note}</span>
                  <RemoveButton onClick={() => handleRemoveObservation(i)} />
                </div>
              ))}
              <InlineAddButton
                label="Add observation"
                placeholder="New observation..."
                onAdd={handleAddObservation}
              />
            </div>

            {/* Decisions */}
            <div className="flex flex-col gap-1">
              <span className="type-caption font-medium text-muted-foreground uppercase tracking-wide">Decisions</span>
              {decisions.length === 0 && (
                <span className="type-micro text-muted-foreground italic">(none yet)</span>
              )}
              {decisions.map((dec, i) => (
                <div key={i} className="group flex flex-col gap-0.5">
                  <div className="flex items-start gap-1.5 type-micro">
                    <span className="text-muted-foreground shrink-0">{dec.date}:</span>
                    <span className="flex-1 leading-snug">{dec.decision}</span>
                    <RemoveButton onClick={() => handleRemoveDecision(i)} />
                  </div>
                  {dec.context && (
                    <div className="type-caption text-muted-foreground pl-4">
                      Context: {dec.context}
                    </div>
                  )}
                </div>
              ))}
              <InlineAddButton
                label="Add decision"
                placeholder="New decision..."
                onAdd={handleAddDecision}
              />
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* 10. References */}
      <Collapsible open={refsState.open} onOpenChange={refsState.toggle}>
        <CollapsibleTrigger asChild>
          <ActionButton variant="back" size="sm" className="h-auto w-full justify-start gap-1.5 p-0 font-semibold text-foreground">
            {refsState.open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            References
            <span className="text-muted-foreground font-normal type-caption">({references.length})</span>
          </ActionButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="flex flex-col gap-1 mt-1.5 pl-1">
            {references.length === 0 && (
              <span className="type-micro text-muted-foreground italic">(none)</span>
            )}
            {references.map((ref, i) => (
              <div key={i} className="group flex items-center gap-1.5 type-micro">
                <span className="text-muted-foreground shrink-0">&bull;</span>
                <span className="flex-1 font-mono type-caption truncate">{ref}</span>
                <RemoveButton onClick={() => handleRemoveReference(i)} />
              </div>
            ))}
            <InlineAddButton
              label="Add reference"
              placeholder="Add reference path..."
              onAdd={handleAddReference}
            />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}
