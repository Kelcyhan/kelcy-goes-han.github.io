import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog.tsx'
import { ActionButton } from '@/components/primitives'
import { useSessionStore } from '@/stores/session-store.ts'
import { useTabStore } from '@/stores/tab-store.ts'
import { usePMStore } from '@/stores/pm-store.ts'
import * as api from '@/lib/api.ts'
import { ModelSelect, RuntimeToggle, type Runtime, fetchInteractiveDefaultsForSurface } from '@/components/pm/shared.tsx'
import { useNewSessionGate } from '@/components/auth/useNewSessionGate.ts'

interface CreateProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateProjectDialog({ open, onOpenChange }: CreateProjectDialogProps) {
  const [name, setName] = useState('')
  const [vision, setVision] = useState('')
  const [runtime, setRuntime] = useState<Runtime>('claude-code')
  const [model, setModel] = useState('default')
  const [defaultModels, setDefaultModels] = useState<Record<Runtime, string>>({ 'claude-code': 'default', codex: 'default' })
  const [availableModels, setAvailableModels] = useState<Record<Runtime, { id: string, label: string }[]>>({ 'claude-code': [], codex: [] })
  const [enabledRuntimes, setEnabledRuntimes] = useState<Record<Runtime, boolean>>({ 'claude-code': true, codex: true })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const newSessionGate = useNewSessionGate()

  useEffect(() => {
    if (!open) return
    void fetchInteractiveDefaultsForSurface('task_agent').then(({ runtime, model, defaultModels, availableModels, enabledRuntimes }) => {
      setRuntime(runtime)
      setModel(model)
      setDefaultModels(defaultModels)
      setAvailableModels(availableModels)
      setEnabledRuntimes(enabledRuntimes)
    })
  }, [open])

  const reset = () => {
    setName('')
    setVision('')
    setRuntime('claude-code')
    setModel('default')
    setError('')
    setSubmitting(false)
  }

  const close = () => {
    reset()
    onOpenChange(false)
  }

  const handleCreate = async () => {
    if (!name.trim()) return
    setSubmitting(true)
    setError('')

    try {
      await api.createProject({
        name: name.trim(),
        vision: vision.trim() || undefined,
      })

      usePMStore.getState().fetchProjects()
      close()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project')
      setSubmitting(false)
    }
  }

  const handleSetupWithAgent = async () => {
    if (!name.trim()) return
    setSubmitting(true)
    setError('')

    try {
      // 1. Create the bare project
      const created = await api.createProject({
        name: name.trim(),
        vision: vision.trim() || undefined,
      })

      // 2. Spawn a normal task-agent on it (will enter project mode)
      const session = await api.spawnTaskAgent({
        working_dir: created.path,
        runtime,
        model: model === 'default' ? undefined : model,
        conversation: true,
        display_name: name.trim(),
        surface: 'task_agent',
      })

      // 3. Open the session
      useSessionStore.getState().setActiveSession(session.session_name)
      useTabStore.getState().openAgentTab(session.session_name)

      // 4. Navigate PM view into the new project
      await usePMStore.getState().fetchProjects()
      await usePMStore.getState().openProject(created.project_id)
      close()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set up project')
      setSubmitting(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && name.trim()) {
      e.preventDefault()
      handleCreate()
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v) }}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>New Project</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3 mt-1">
          {/* Name input — no label, obviously the name */}
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g. SLM Agent Research"
            className="bg-[rgba(255,255,255,0.04)] border border-border rounded px-2.5 py-2
              type-body-sm text-foreground placeholder:text-muted-foreground
              focus:outline-none focus:border-[var(--color-accent)]
              transition-[border-color] duration-150 w-full"
            autoFocus
          />

          {/* Vision textarea */}
          <div className="flex flex-col gap-1">
            <label className="type-micro text-muted-foreground">
              What does success look like? (optional)
            </label>
            <textarea
              value={vision}
              onChange={e => setVision(e.target.value)}
              placeholder="e.g. Prove that teams of small LMs can outperform single large LLMs in agent architectures"
              className="bg-[rgba(255,255,255,0.04)] border border-border rounded px-2.5 py-2
                type-label text-foreground placeholder:text-muted-foreground
                focus:outline-none focus:border-[var(--color-accent)]
                transition-[border-color] duration-150 w-full min-h-[64px] resize-y"
              rows={2}
            />
          </div>

          {/* Runtime selector */}
          <div className="flex flex-col gap-1.5">
            <label className="type-micro text-muted-foreground">Agent runtime</label>
            <RuntimeToggle
              value={runtime}
              onChange={(next) => { setRuntime(next); setModel(defaultModels[next] || 'default') }}
              enabledRuntimes={enabledRuntimes}
            />
          </div>

          {/* Model selector */}
          <div className="flex flex-col gap-1.5">
            <label className="type-micro text-muted-foreground">Model</label>
            <ModelSelect runtime={runtime} value={model} onChange={setModel} options={availableModels[runtime]} includeDefaultOption={false} />
          </div>

          {error && <span className="type-micro text-red-400">{error}</span>}

          {/* Actions */}
          <div className="flex justify-end gap-2 mt-1">
            <ActionButton
              variant="secondary"
              size="sm"
              onClick={close}
              disabled={submitting}
            >
              Cancel
            </ActionButton>
            <ActionButton
              variant="secondary"
              size="sm"
              onClick={handleSetupWithAgent}
              disabled={submitting || !name.trim() || newSessionGate.disabled}
              title={newSessionGate.disabled
                ? newSessionGate.tooltip
                : 'An agent will help define vision, structure, and goals'}
            >
              {submitting ? 'Starting...' : 'Set up w/ agent'}
            </ActionButton>
            <ActionButton
              variant="primary"
              size="sm"
              onClick={handleCreate}
              disabled={submitting || !name.trim()}
            >
              {submitting ? 'Creating...' : 'Create'}
            </ActionButton>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
