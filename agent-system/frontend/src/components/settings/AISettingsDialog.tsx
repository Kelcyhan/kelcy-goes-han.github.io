import { Dialog, DialogContent } from '@/components/ui/dialog.tsx'
import { AISettingsPage } from '@/components/settings/AISettingsPage.tsx'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AISettingsDialog({ open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[1100px] h-[86vh] p-0 overflow-hidden">
        <AISettingsPage onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}
