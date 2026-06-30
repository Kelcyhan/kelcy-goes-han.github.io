import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

export interface TypedTitleConfirmDialogProps {
  /** Title whose name appears in the dialog. User must type `delete <title>` verbatim to enable the Delete button. */
  expectedTitle: string
  /** Label on the confirm button. Defaults to "Delete". */
  confirmLabel?: string
  /** Heading shown at the top of the dialog. Defaults to "Delete {expectedTitle}?" */
  heading?: string
  /** Optional paragraph under the heading — explain cascade / irreversibility here. */
  description?: React.ReactNode
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Called when the user confirms. If it throws, the dialog stays open and the error shows. */
  onConfirm: () => Promise<void> | void
}

export function TypedTitleConfirmDialog({
  expectedTitle,
  confirmLabel = 'Delete',
  heading,
  description,
  open,
  onOpenChange,
  onConfirm,
}: TypedTitleConfirmDialogProps) {
  const [typed, setTyped] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setTyped('')
      setSubmitting(false)
      setError(null)
    }
  }, [open])

  const expectedPhrase = `delete ${expectedTitle.trim()}`
  const matches = typed.trim() === expectedPhrase && expectedTitle.trim().length > 0

  const handleConfirm = async () => {
    if (!matches || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      await onConfirm()
      onOpenChange(false)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!submitting) onOpenChange(v) }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{heading || `Delete "${expectedTitle}"?`}</DialogTitle>
          {description && (
            <DialogDescription asChild>
              <div className="type-label text-muted-foreground leading-relaxed pt-1">{description}</div>
            </DialogDescription>
          )}
        </DialogHeader>
        <div className="flex flex-col gap-2 py-2">
          <label className="type-micro text-muted-foreground">
            Type <span className="font-mono font-semibold text-foreground">{expectedPhrase}</span> to confirm.
          </label>
          <input
            type="text"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleConfirm() }}
            autoFocus
            spellCheck={false}
            autoComplete="off"
            className="w-full h-8 px-2 type-label rounded border border-border bg-transparent outline-none focus:border-accent"
            placeholder={expectedPhrase}
            disabled={submitting}
          />
          {error && (
            <div className="type-micro text-red-500 leading-relaxed">{error}</div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleConfirm}
            disabled={!matches || submitting}
          >
            {submitting ? 'Deleting…' : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
