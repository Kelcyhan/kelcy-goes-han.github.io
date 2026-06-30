import { useState, useCallback, useEffect } from 'react'
import { ActionButton, IconButton } from '@/components/primitives'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover.tsx'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select.tsx'
import { Checkbox } from '@/components/ui/checkbox.tsx'
import { X, ListFilter } from 'lucide-react'
import type { Milestone } from '@/stores/pm-store.ts'

// --- View Config types ---

export type GroupBy = 'milestone' | 'status' | 'none'
export type SortBy = 'status' | 'id' | 'est_hours' | 'title'

export interface GoalViewConfig {
  groupBy: GroupBy
  sortBy: SortBy
  sortReversed: boolean
  hiddenStatuses: string[]
  hiddenMilestones: string[]
  showOnlyEstimated: boolean | null // null = any, true = only with est, false = only without
}

const DEFAULTS: GoalViewConfig = {
  groupBy: 'milestone',
  sortBy: 'status',
  sortReversed: false,
  hiddenStatuses: [],
  hiddenMilestones: [],
  showOnlyEstimated: null,
}

function loadConfig(goalId: string): GoalViewConfig {
  try {
    const raw = localStorage.getItem(`goal-view-${goalId}`)
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch { /* ignore */ }
  return { ...DEFAULTS }
}

function saveConfig(goalId: string, config: GoalViewConfig) {
  localStorage.setItem(`goal-view-${goalId}`, JSON.stringify(config))
}

export function useViewConfig(goalId: string) {
  const [config, setConfig] = useState<GoalViewConfig>(() => loadConfig(goalId))

  useEffect(() => {
    setConfig(loadConfig(goalId))
  }, [goalId])

  const update = useCallback((patch: Partial<GoalViewConfig>) => {
    setConfig(prev => {
      const next = { ...prev, ...patch }
      saveConfig(goalId, next)
      return next
    })
  }, [goalId])

  return { config, update }
}

// --- Active filter count ---

function activeFilterCount(config: GoalViewConfig): number {
  let n = 0
  if (config.hiddenStatuses.length > 0) n++
  if (config.hiddenMilestones.length > 0) n++
  if (config.showOnlyEstimated !== null) n++
  return n
}

// --- Filter chips ---

const ALL_TASK_STATUSES = ['todo', 'executing', 'done', 'propose', 'conversation', 'shelved', 'dropped', 'blocked']

interface FilterPopoverProps {
  config: GoalViewConfig
  update: (patch: Partial<GoalViewConfig>) => void
  milestones: Milestone[]
}

function FilterPopover({ config, update, milestones }: FilterPopoverProps) {
  const [open, setOpen] = useState(false)

  const toggleStatus = (status: string) => {
    const hidden = config.hiddenStatuses.includes(status)
      ? config.hiddenStatuses.filter(s => s !== status)
      : [...config.hiddenStatuses, status]
    update({ hiddenStatuses: hidden })
  }

  const toggleMilestone = (msId: string) => {
    const hidden = config.hiddenMilestones.includes(msId)
      ? config.hiddenMilestones.filter(s => s !== msId)
      : [...config.hiddenMilestones, msId]
    update({ hiddenMilestones: hidden })
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <ActionButton variant="toolbar" size="toolbar" className="gap-1">
          <ListFilter size={11} />
          Filter
          {activeFilterCount(config) > 0 && (
            <span className="ml-0.5 type-caption bg-accent text-accent-foreground rounded-full w-4 h-4 flex items-center justify-center">
              {activeFilterCount(config)}
            </span>
          )}
        </ActionButton>
      </PopoverTrigger>
      <PopoverContent className="w-[260px] p-3" align="start">
        <div className="flex flex-col gap-3">
          {/* Status filter */}
          <div className="flex flex-col gap-1.5">
            <span className="type-micro font-semibold text-foreground">Status</span>
            <div className="grid grid-cols-2 gap-1">
              {ALL_TASK_STATUSES.map(status => (
                <label key={status} className="flex items-center gap-1.5 type-micro cursor-pointer">
                  <Checkbox
                    checked={!config.hiddenStatuses.includes(status)}
                    onCheckedChange={() => toggleStatus(status)}
                    className="h-3 w-3"
                  />
                  <span className="capitalize">{status}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Milestone filter */}
          {milestones.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="type-micro font-semibold text-foreground">Milestone</span>
              <div className="flex flex-col gap-1">
                {milestones.map(ms => (
                  <label key={ms.id} className="flex items-center gap-1.5 type-micro cursor-pointer">
                    <Checkbox
                      checked={!config.hiddenMilestones.includes(ms.id)}
                      onCheckedChange={() => toggleMilestone(ms.id)}
                      className="h-3 w-3"
                    />
                    <span className="truncate">{ms.title}</span>
                  </label>
                ))}
                <label className="flex items-center gap-1.5 type-micro cursor-pointer">
                  <Checkbox
                    checked={!config.hiddenMilestones.includes('__none__')}
                    onCheckedChange={() => toggleMilestone('__none__')}
                    className="h-3 w-3"
                  />
                  <span className="text-muted-foreground">(no milestone)</span>
                </label>
              </div>
            </div>
          )}

          {/* Estimate filter */}
          <div className="flex flex-col gap-1.5">
            <span className="type-micro font-semibold text-foreground">Has estimate</span>
            <div className="flex gap-3">
              {([['Any', null], ['Yes', true], ['No', false]] as const).map(([label, val]) => (
                <label key={label} className="flex items-center gap-1 type-micro cursor-pointer">
                  <input
                    type="radio"
                    name="est-filter"
                    checked={config.showOnlyEstimated === val}
                    onChange={() => update({ showOnlyEstimated: val })}
                    className="w-3 h-3"
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          {/* Clear all */}
          {activeFilterCount(config) > 0 && (
            <ActionButton
              variant="back"
              size="sm"
              className="self-end"
              onClick={() => update({ hiddenStatuses: [], hiddenMilestones: [], showOnlyEstimated: null })}
            >
              Clear all filters
            </ActionButton>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

// --- Active filter chips ---

function FilterChips({ config, update }: { config: GoalViewConfig; update: (patch: Partial<GoalViewConfig>) => void }) {
  const chips: { label: string; onRemove: () => void }[] = []

  if (config.hiddenStatuses.length > 0) {
    const hidden = config.hiddenStatuses.join(', ')
    chips.push({
      label: `Hide: ${hidden}`,
      onRemove: () => update({ hiddenStatuses: [] }),
    })
  }

  if (config.hiddenMilestones.length > 0) {
    chips.push({
      label: `Milestones filtered`,
      onRemove: () => update({ hiddenMilestones: [] }),
    })
  }

  if (config.showOnlyEstimated === true) {
    chips.push({
      label: 'Has estimate',
      onRemove: () => update({ showOnlyEstimated: null }),
    })
  } else if (config.showOnlyEstimated === false) {
    chips.push({
      label: 'No estimate',
      onRemove: () => update({ showOnlyEstimated: null }),
    })
  }

  if (chips.length === 0) return null

  return (
    <>
      {chips.map((chip, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-1 type-caption bg-[var(--bg-ingrained)] text-muted-foreground rounded px-1.5 py-0.5"
        >
          {chip.label}
          <IconButton
            variant="appShell"
            size="file"
            onClick={chip.onRemove}
            title="Remove filter"
          >
            <X size={10} />
          </IconButton>
        </span>
      ))}
    </>
  )
}

// --- Main ViewConfigBar ---

export interface ViewConfigBarProps {
  config: GoalViewConfig
  update: (patch: Partial<GoalViewConfig>) => void
  milestones: Milestone[]
}

export function ViewConfigBar({ config, update, milestones }: ViewConfigBarProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap py-1.5 px-1 border-t border-[var(--color-border-subtle)]">
      <FilterChips config={config} update={update} />
      <FilterPopover config={config} update={update} milestones={milestones} />

      <div className="flex items-center gap-1 ml-auto">
        <span className="type-caption text-muted-foreground">Group:</span>
        <Select value={config.groupBy} onValueChange={(v: GroupBy) => update({ groupBy: v })}>
          <SelectTrigger className="h-6 w-[100px] type-micro border-[var(--color-border-subtle)] bg-transparent px-1.5">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="milestone" className="type-micro">Milestone</SelectItem>
            <SelectItem value="status" className="type-micro">Status</SelectItem>
            <SelectItem value="none" className="type-micro">None (flat)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-1">
        <span className="type-caption text-muted-foreground">Sort:</span>
        <Select value={config.sortBy} onValueChange={(v: SortBy) => update({ sortBy: v })}>
          <SelectTrigger className="h-6 w-[90px] type-micro border-[var(--color-border-subtle)] bg-transparent px-1.5">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="status" className="type-micro">Status</SelectItem>
            <SelectItem value="id" className="type-micro">Task ID</SelectItem>
            <SelectItem value="est_hours" className="type-micro">Est. hours</SelectItem>
            <SelectItem value="title" className="type-micro">Title (A-Z)</SelectItem>
          </SelectContent>
        </Select>
        <label className="flex items-center gap-1 type-caption text-muted-foreground cursor-pointer">
          <Checkbox
            checked={config.sortReversed}
            onCheckedChange={(checked) => update({ sortReversed: checked === true })}
            className="h-3 w-3"
          />
          Rev
        </label>
      </div>
    </div>
  )
}
