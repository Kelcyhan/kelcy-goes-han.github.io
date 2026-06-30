import { useState, useEffect, useCallback } from 'react'
import { usePMStore, type Milestone } from '@/stores/pm-store.ts'
import { searchTasks, type SearchTask } from '@/lib/api.ts'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog.tsx'
import {
  Command,
  CommandInput,
  CommandList,
  CommandItem,
  CommandEmpty,
  CommandGroup,
} from '@/components/ui/command.tsx'
import { Checkbox } from '@/components/ui/checkbox.tsx'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select.tsx'
import { Label } from '@/components/ui/label.tsx'
import { ActionButton, PMStatusDot } from '@/components/primitives'
import { Loader2 } from 'lucide-react'

export interface TaskSearchPickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  goalId: string
  goalTitle: string
  milestones: Milestone[]
  onSuccess?: (count: number) => void
}

const NONE_VALUE = '__none__'

export function TaskSearchPicker({
  open,
  onOpenChange,
  goalId,
  goalTitle,
  milestones,
  onSuccess,
}: TaskSearchPickerProps) {
  const activeProject = usePMStore(s => s.activeProject)
  const addTasksToGoal = usePMStore(s => s.addTasksToGoal)

  const [tasks, setTasks] = useState<SearchTask[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [milestoneId, setMilestoneId] = useState<string>(NONE_VALUE)
  const [keepOpen, setKeepOpen] = useState(false)

  // Load all available tasks when dialog opens
  const loadTasks = useCallback(async () => {
    if (!activeProject) return
    setLoading(true)
    setError(null)
    try {
      const result = await searchTasks(activeProject, { excludeGoal: goalId })
      setTasks(result.tasks)
    } catch (err) {
      console.error('Failed to load tasks:', err)
      setError(err instanceof Error ? err.message : 'Failed to load tasks')
      setTasks([])
    } finally {
      setLoading(false)
    }
  }, [activeProject, goalId])

  useEffect(() => {
    if (open) {
      loadTasks()
      setSelectedIds(new Set())
      setMilestoneId(NONE_VALUE)
    }
  }, [open, loadTasks])

  const toggleTask = (taskId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(taskId)) {
        next.delete(taskId)
      } else {
        next.add(taskId)
      }
      return next
    })
  }

  const handleAdd = async () => {
    if (selectedIds.size === 0) return
    setSubmitting(true)
    try {
      const milestone = milestoneId === NONE_VALUE ? undefined : milestoneId
      const count = selectedIds.size
      await addTasksToGoal(goalId, Array.from(selectedIds), milestone)
      onSuccess?.(count)

      if (keepOpen) {
        setSelectedIds(new Set())
        setMilestoneId(NONE_VALUE)
        // Reload to exclude newly added tasks
        await loadTasks()
      } else {
        onOpenChange(false)
      }
    } catch (err) {
      console.error('Failed to add tasks to goal:', err)
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen) {
      setSelectedIds(new Set())
      setMilestoneId(NONE_VALUE)
      setKeepOpen(false)
    }
    onOpenChange(nextOpen)
  }

  const statusLabel = (status: string) =>
    status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ')

  const normalizeStatus = (status: string): string => {
    const map: Record<string, string> = {
      active: 'active',
      exec: 'active',
      executing: 'active',
      working: 'working',
      idle: 'idle',
      waiting: 'waiting',
      blocked: 'blocked',
      error: 'error',
      done: 'done',
      todo: 'todo',
    }
    return map[status.toLowerCase()] || 'unknown'
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] flex flex-col gap-4 max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Add tasks to {goalTitle}</DialogTitle>
          <DialogDescription className="sr-only">
            Search and select tasks to add to this goal
          </DialogDescription>
        </DialogHeader>

        <Command
          className="border rounded-md"
          shouldFilter={true}
          filter={(value, search) => {
            // value is set to `${id} ${title}` so both are searchable
            if (!search) return 1
            const lower = search.toLowerCase()
            return value.toLowerCase().includes(lower) ? 1 : 0
          }}
        >
          <CommandInput placeholder="Search by task ID or title..." />

          <div className="px-3 py-1.5">
            <span className="type-micro text-muted-foreground font-medium">
              Available tasks
            </span>
          </div>

          <CommandList className="max-h-[280px]">
            {loading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                <span className="text-sm">Loading tasks...</span>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                <span className="text-sm text-destructive">{error}</span>
                <button
                  className="type-label text-accent-foreground bg-transparent border border-[var(--color-border-subtle)] rounded px-3 py-1 cursor-pointer hover:border-[var(--color-accent)]"
                  onClick={loadTasks}
                >
                  Retry
                </button>
              </div>
            ) : (
              <>
                <CommandEmpty>No matching tasks found.</CommandEmpty>
                <CommandGroup>
                  {tasks.map(task => (
                    <CommandItem
                      key={task.id}
                      value={`${task.id} ${task.title}`}
                      onSelect={() => toggleTask(task.id)}
                      className="flex items-center gap-2 py-1.5 cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedIds.has(task.id)}
                        onCheckedChange={() => toggleTask(task.id)}
                        className="h-3.5 w-3.5 pointer-events-none"
                        tabIndex={-1}
                      />

                      <span className="type-micro font-mono text-muted-foreground w-[72px] shrink-0 truncate">
                        {task.id}
                      </span>

                      <span className="type-label truncate flex-1" title={task.title}>
                        {task.title}
                      </span>

                      <span className="flex items-center gap-1.5 shrink-0">
                        <PMStatusDot
                          status={normalizeStatus(task.status)}
                        />
                        <span className="type-micro text-muted-foreground w-[52px] truncate">
                          {statusLabel(task.status)}
                        </span>
                      </span>

                      {task.est_hours != null && (
                        <span className="type-micro text-muted-foreground tabular-nums w-[32px] text-right shrink-0">
                          {task.est_hours}h
                        </span>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>

        {/* Milestone picker */}
        {milestones.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <Label className="text-sm">Assign to milestone</Label>
            <Select value={milestoneId} onValueChange={setMilestoneId}>
              <SelectTrigger className="w-full max-w-[280px]">
                <SelectValue placeholder="(none)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_VALUE}>(none)</SelectItem>
                {milestones.map(m => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Keep open toggle */}
        <div className="flex items-center gap-2">
          <Checkbox
            id="keep-open-after-adding"
            checked={keepOpen}
            onCheckedChange={(checked) => setKeepOpen(checked === true)}
          />
          <Label htmlFor="keep-open-after-adding" className="text-sm font-normal cursor-pointer">
            Keep open after adding
          </Label>
        </div>

        <DialogFooter className="flex items-center">
          <span className="type-label text-muted-foreground mr-auto">
            Selected: {selectedIds.size} task{selectedIds.size !== 1 ? 's' : ''}
          </span>
          <ActionButton variant="toolbar" onClick={() => handleClose(false)} disabled={submitting}>
            Cancel
          </ActionButton>
          <ActionButton variant="toolbarPrimary" onClick={handleAdd} disabled={submitting || selectedIds.size === 0}>
            {submitting ? 'Adding...' : 'Add to Goal'}
          </ActionButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
