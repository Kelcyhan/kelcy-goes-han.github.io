import { useState, useEffect } from 'react'
import { usePMStore } from '@/stores/pm-store.ts'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog.tsx'
import { Label } from '@/components/ui/label.tsx'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover.tsx'
import { Calendar } from '@/components/ui/calendar.tsx'
import { CalendarIcon } from 'lucide-react'
import { ActionButton, IconButton } from '@/components/primitives'
import { cn } from '@/lib/utils'
import type { Goal } from '@/stores/pm-store.ts'

export interface EditGoalDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  goal: Goal
}

export function EditGoalDialog({ open, onOpenChange, goal }: EditGoalDialogProps) {
  const updateGoal = usePMStore(s => s.updateGoal)
  const fetchState = usePMStore(s => s.fetchState)
  const activeProject = usePMStore(s => s.activeProject)

  const [title, setTitle] = useState(goal.title)
  const [target, setTarget] = useState(goal.target || '')
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Reset form when goal changes or dialog opens
  useEffect(() => {
    if (open) {
      setTitle(goal.title)
      setTarget(goal.target || '')
    }
  }, [open, goal.title, goal.target])

  const handleSave = async () => {
    const fields: Record<string, string> = {}
    if (title.trim() !== goal.title) fields.title = title.trim()
    if (target !== (goal.target || '')) fields.target = target

    if (Object.keys(fields).length === 0) {
      onOpenChange(false)
      return
    }

    setSubmitting(true)
    try {
      await updateGoal(goal.id, fields)
      if (activeProject) fetchState(activeProject)
      onOpenChange(false)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      const iso = date.toISOString().slice(0, 10)
      setTarget(iso)
    }
    setCalendarOpen(false)
  }

  const parsedDate = target ? new Date(target + 'T00:00:00') : undefined

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Edit Goal</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          {/* Title */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-goal-title">Title</Label>
            <input
              id="edit-goal-title"
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>

          {/* Target date */}
          <div className="flex flex-col gap-1.5">
            <Label>Target date</Label>
            <div className="flex items-center gap-2">
              <input
                className="flex h-9 flex-1 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder="YYYY-MM-DD"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
              />
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger asChild>
                  <IconButton variant="appShell" size="lg" className={cn(!target && 'text-muted-foreground')} title="Pick target date">
                    <CalendarIcon size={15} />
                  </IconButton>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    mode="single"
                    selected={parsedDate}
                    onSelect={handleDateSelect}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            {target && (
              <ActionButton
                variant="back"
                size="sm"
                className="self-start h-auto px-1"
                onClick={() => setTarget('')}
              >
                Clear date
              </ActionButton>
            )}
          </div>
        </div>

        <DialogFooter>
          <ActionButton variant="toolbar" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </ActionButton>
          <ActionButton variant="toolbarPrimary" onClick={handleSave} disabled={submitting || !title.trim()}>
            {submitting ? 'Saving...' : 'Save'}
          </ActionButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
