import { useState, useEffect } from 'react'
import { usePMStore, type Milestone } from '@/stores/pm-store.ts'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog.tsx'
import { ActionButton } from '@/components/primitives'
import { Label } from '@/components/ui/label.tsx'
import { cn } from '@/lib/utils'

export interface CreateMilestoneDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  goalId: string
  goalTitle: string
  existingMilestones: Milestone[]
  onSuccess?: (title: string) => void
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export function CreateMilestoneDialog({
  open,
  onOpenChange,
  goalId,
  goalTitle,
  existingMilestones,
  onSuccess,
}: CreateMilestoneDialogProps) {
  const updateGoal = usePMStore(s => s.updateGoal)

  const [title, setTitle] = useState('')
  const [id, setId] = useState('')
  const [idManuallyEdited, setIdManuallyEdited] = useState(false)
  const [titleError, setTitleError] = useState(false)
  const [idError, setIdError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Auto-generate ID from title unless manually edited
  useEffect(() => {
    if (!idManuallyEdited) {
      setId(slugify(title))
    }
  }, [title, idManuallyEdited])

  // Clear errors when fields change
  useEffect(() => { setTitleError(false) }, [title])
  useEffect(() => { setIdError(null) }, [id])

  const resetForm = () => {
    setTitle('')
    setId('')
    setIdManuallyEdited(false)
    setTitleError(false)
    setIdError(null)
  }

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen) {
      resetForm()
    }
    onOpenChange(nextOpen)
  }

  const handleIdChange = (value: string) => {
    setIdManuallyEdited(true)
    setId(value)
  }

  const handleSubmit = async () => {
    const trimmedTitle = title.trim()
    const trimmedId = id.trim()
    let hasError = false

    if (!trimmedTitle) {
      setTitleError(true)
      hasError = true
    }

    if (!trimmedId) {
      setIdError('ID is required')
      hasError = true
    } else if (existingMilestones.some(m => m.id === trimmedId)) {
      setIdError('A milestone with this ID already exists')
      hasError = true
    }

    if (hasError) return

    setSubmitting(true)
    try {
      const newMilestone: Milestone = {
        id: trimmedId,
        title: trimmedTitle,
        steps: [],
        status: 'not_started',
      }
      await updateGoal(goalId, {
        milestones: [...existingMilestones, newMilestone],
      })
      onSuccess?.(trimmedTitle)
      handleClose(false)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>New Milestone for {goalTitle}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          {/* ID */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="milestone-id">ID <span className="text-destructive">*</span></Label>
            <input
              id="milestone-id"
              className={cn(
                'flex h-9 w-full rounded-md border bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                idError ? 'border-destructive' : 'border-input',
              )}
              placeholder="e.g. deployment-ready"
              value={id}
              onChange={(e) => handleIdChange(e.target.value)}
            />
            {idError && (
              <span className="type-label text-destructive">{idError}</span>
            )}
          </div>

          {/* Title */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="milestone-title">Title <span className="text-destructive">*</span></Label>
            <input
              id="milestone-title"
              className={cn(
                'flex h-9 w-full rounded-md border bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                titleError ? 'border-destructive' : 'border-input',
              )}
              placeholder="e.g. System deployed and accessible remotely"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
            {titleError && (
              <span className="type-label text-destructive">Title is required</span>
            )}
          </div>
        </div>

        <DialogFooter>
          <ActionButton variant="toolbar" onClick={() => handleClose(false)} disabled={submitting}>
            Cancel
          </ActionButton>
          <ActionButton variant="toolbarPrimary" onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Creating...' : 'Create Milestone'}
          </ActionButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
