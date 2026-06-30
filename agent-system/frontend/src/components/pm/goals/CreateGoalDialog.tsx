import { useState } from 'react'
import { CalendarIcon, Plus, X } from 'lucide-react'
import { format } from 'date-fns'
import { usePMStore } from '@/stores/pm-store.ts'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog.tsx'
import { Label } from '@/components/ui/label.tsx'
import { Checkbox } from '@/components/ui/checkbox.tsx'
import { Calendar } from '@/components/ui/calendar.tsx'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover.tsx'
import { ActionButton, IconButton } from '@/components/primitives'
import { cn } from '@/lib/utils'

export interface CreateGoalDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function emptyForm() {
  return {
    title: '',
    description: '',
    targetDate: undefined as Date | undefined,
    doneWhen: [] as string[],
  }
}

export function CreateGoalDialog({ open, onOpenChange }: CreateGoalDialogProps) {
  const createGoal = usePMStore(s => s.createGoal)
  const selectGoal = usePMStore(s => s.selectGoal)

  const [form, setForm] = useState(emptyForm)
  const [createAnother, setCreateAnother] = useState(false)
  const [titleError, setTitleError] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [calendarOpen, setCalendarOpen] = useState(false)

  const resetForm = () => {
    setForm(emptyForm())
    setTitleError(false)
  }

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen) {
      resetForm()
      setCreateAnother(false)
    }
    onOpenChange(nextOpen)
  }

  const handleAddDoneWhen = () => {
    setForm(prev => ({ ...prev, doneWhen: [...prev.doneWhen, ''] }))
  }

  const handleUpdateDoneWhen = (index: number, value: string) => {
    setForm(prev => ({
      ...prev,
      doneWhen: prev.doneWhen.map((item, i) => i === index ? value : item),
    }))
  }

  const handleRemoveDoneWhen = (index: number) => {
    setForm(prev => ({
      ...prev,
      doneWhen: prev.doneWhen.filter((_, i) => i !== index),
    }))
  }

  const handleSubmit = async () => {
    const trimmedTitle = form.title.trim()
    if (!trimmedTitle) {
      setTitleError(true)
      return
    }
    setTitleError(false)
    setSubmitting(true)

    const fields: { title: string; description?: string; target?: string; done_when?: string[] } = {
      title: trimmedTitle,
    }
    if (form.description.trim()) {
      fields.description = form.description.trim()
    }
    if (form.targetDate) {
      fields.target = format(form.targetDate, 'yyyy-MM-dd')
    }
    const nonEmptyDoneWhen = form.doneWhen.map(s => s.trim()).filter(Boolean)
    if (nonEmptyDoneWhen.length > 0) {
      fields.done_when = nonEmptyDoneWhen
    }

    try {
      const goalId = await createGoal(fields)
      if (createAnother) {
        resetForm()
      } else {
        handleClose(false)
        if (goalId) {
          selectGoal(goalId)
        }
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Create Goal</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          {/* Title */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="goal-title">Title <span className="text-destructive">*</span></Label>
            <input
              id="goal-title"
              className={cn(
                'flex h-9 w-full rounded-md border bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                titleError ? 'border-destructive' : 'border-input',
              )}
              placeholder="What is the goal?"
              value={form.title}
              onChange={(e) => { setForm(prev => ({ ...prev, title: e.target.value })); setTitleError(false) }}
              autoFocus
            />
            {titleError && (
              <span className="type-label text-destructive">Title is required</span>
            )}
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="goal-desc">Description</Label>
            <textarea
              id="goal-desc"
              className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
              placeholder="Optional description..."
              value={form.description}
              onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
              rows={2}
            />
          </div>

          {/* Target date */}
          <div className="flex flex-col gap-1.5">
            <Label>Target Date</Label>
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <ActionButton
                  variant="toolbar"
                  className={cn(
                    'w-full justify-start text-left font-normal h-9',
                    !form.targetDate && 'text-muted-foreground',
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {form.targetDate ? format(form.targetDate, 'PPP') : 'Pick a date'}
                </ActionButton>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={form.targetDate}
                  onSelect={(date) => {
                    setForm(prev => ({ ...prev, targetDate: date ?? undefined }))
                    setCalendarOpen(false)
                  }}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Done when */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label>Done When</Label>
              <ActionButton
                type="button"
                variant="back"
                size="sm"
                className="h-auto gap-1 p-0"
                onClick={handleAddDoneWhen}
              >
                <Plus size={12} /> Add
              </ActionButton>
            </div>
            {form.doneWhen.length === 0 && (
              <span className="type-label text-muted-foreground">No criteria yet</span>
            )}
            {form.doneWhen.map((item, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <input
                  className="flex-1 h-8 rounded-md border border-input bg-background px-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  placeholder={`Criterion ${i + 1}...`}
                  value={item}
                  onChange={(e) => handleUpdateDoneWhen(i, e.target.value)}
                />
                <IconButton
                  type="button"
                  variant="appShell"
                  size="xs"
                  className="hover:text-destructive"
                  onClick={() => handleRemoveDoneWhen(i)}
                  title="Remove criterion"
                >
                  <X size={14} />
                </IconButton>
              </div>
            ))}
          </div>
        </div>

        {/* Create another checkbox */}
        <div className="flex items-center gap-2">
          <Checkbox
            id="create-another"
            checked={createAnother}
            onCheckedChange={(checked) => setCreateAnother(checked === true)}
          />
          <Label htmlFor="create-another" className="text-sm font-normal cursor-pointer">
            Create another
          </Label>
        </div>

        <DialogFooter>
          <ActionButton variant="toolbar" onClick={() => handleClose(false)} disabled={submitting}>
            Cancel
          </ActionButton>
          <ActionButton variant="toolbarPrimary" onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Creating...' : 'Create Goal'}
          </ActionButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
