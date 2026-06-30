import { useEffect, useState } from 'react'
import { useSessionStore } from '@/stores/session-store.ts'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog.tsx'
import { Label } from '@/components/ui/label.tsx'
import { ActionButton } from '@/components/primitives'
import { ModelSelect, RuntimeToggle, fetchInteractiveDefaultsForSurface } from '@/components/pm/shared.tsx'

interface NewAgentModalProps {
  onClose: () => void
}

const DEFAULT_PROMPT = 'Welcome to life!'

import type { Runtime } from '@/components/pm/shared.tsx'

export function NewAgentModal({ onClose }: NewAgentModalProps) {
  const doCreateSession = useSessionStore(s => s.doCreateSession)
  const setActiveSession = useSessionStore(s => s.setActiveSession)
  const [model, setModel] = useState('default')
  const [runtime, setRuntime] = useState<Runtime>('claude-code')
  const [defaultModels, setDefaultModels] = useState<Record<Runtime, string>>({ 'claude-code': 'default', codex: 'default' })
  const [availableModels, setAvailableModels] = useState<Record<Runtime, { id: string, label: string }[]>>({ 'claude-code': [], codex: [] })
  const [enabledRuntimes, setEnabledRuntimes] = useState<Record<Runtime, boolean>>({ 'claude-code': true, codex: true })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    void fetchInteractiveDefaultsForSurface('concierge').then(({ runtime, model, defaultModels, availableModels, enabledRuntimes }) => {
      setRuntime(runtime)
      setModel(model)
      setDefaultModels(defaultModels)
      setAvailableModels(availableModels)
      setEnabledRuntimes(enabledRuntimes)
    })
  }, [])

  const handleCreate = async () => {
    setSubmitting(true)
    try {
      const name = await doCreateSession(
        DEFAULT_PROMPT,
        model || undefined,
        runtime,
      )
      if (name) {
        setActiveSession(name)
        onClose()
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>New Agent</DialogTitle>
          <DialogDescription>Start a new agent session.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          {/* Runtime picker */}
          <div className="grid gap-2">
            <Label>Runtime</Label>
            <RuntimeToggle value={runtime} onChange={(next) => { setRuntime(next); setModel(defaultModels[next] || 'default') }} enabledRuntimes={enabledRuntimes} />
          </div>

          {/* Model selector */}
          <div className="grid gap-2">
            <Label htmlFor="nc-model">Model</Label>
            <ModelSelect runtime={runtime} value={model} onChange={setModel} id="nc-model" options={availableModels[runtime]} includeDefaultOption={false} />
          </div>
        </div>
        <DialogFooter>
          <ActionButton variant="toolbar" type="button" onClick={onClose}>Cancel</ActionButton>
          <ActionButton variant="toolbarPrimary" onClick={handleCreate} disabled={submitting}>
            {submitting ? 'Creating…' : 'Create'}
          </ActionButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
