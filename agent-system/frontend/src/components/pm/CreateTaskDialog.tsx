import { useEffect, useState } from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog.tsx'
import { ActionButton } from '@/components/primitives'
import { useSessionStore } from '@/stores/session-store.ts'
import { useTabStore } from '@/stores/tab-store.ts'
import { usePMStore } from '@/stores/pm-store.ts'
import * as api from '@/lib/api.ts'
import { ModelSelect, RuntimeToggle, type Runtime, fetchInteractiveDefaultsForSurface } from '@/components/pm/shared.tsx'
import { useNewSessionGate } from '@/components/auth/useNewSessionGate.ts'

interface CreateTaskDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  context: {
    project: string
    parentId?: string
    parentTitle?: string
  }
}

type EntityType = 'task' | 'area'

export function CreateTaskDialog({ open, onOpenChange, context }: CreateTaskDialogProps) {
  const [title, setTitle] = useState('')
  const [entityType, setEntityType] = useState<EntityType>('task')
  const [runtime, setRuntime] = useState<Runtime>('claude-code')
  const [model, setModel] = useState('default')
  const [defaultModels, setDefaultModels] = useState<Record<Runtime, string>>({ 'claude-code': 'default', codex: 'default' })
  const [availableModels, setAvailableModels] = useState<Record<Runtime, { id: string, label: string }[]>>({ 'claude-code': [], codex: [] })
  const [enabledRuntimes, setEnabledRuntimes] = useState<Record<Runtime, boolean>>({ 'claude-code': true, codex: true })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const newSessionGate = useNewSessionGate()

  const breadcrumb = context.parentTitle
    ? `${context.project} › ${context.parentTitle}`
    : context.project

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
    setTitle('')
    setEntityType('task')
    setRuntime('claude-code')
    setModel('default')
    setError('')
    setSubmitting(false)
  }

  const close = () => {
    reset()
    onOpenChange(false)
  }

  const createEntity = async () => {
    if (entityType === 'area') {
      return api.createArea({
        project: context.project,
        parent_id: context.parentId || '1',
        title: title.trim(),
      })
    } else {
      return api.createTask({
        project: context.project,
        parent_id: context.parentId || '1',
        title: title.trim(),
      })
    }
  }

  const handleAdd = async () => {
    if (!title.trim()) return
    setSubmitting(true)
    setError('')

    try {
      await createEntity()
      usePMStore.getState().silentRefreshCurrentNode()
      close()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create')
      setSubmitting(false)
    }
  }

  const handleSetupWithAgent = async () => {
    if (!title.trim()) return
    setSubmitting(true)
    setError('')

    try {
      // 1. Create the bare entity
      const created = await createEntity()

      // 2. Spawn a normal task-agent on it
      const result = await api.spawnTaskAgent({
        working_dir: created.folder,
        runtime,
        model: model === 'default' ? undefined : model,
        conversation: true,
        display_name: title.trim(),
        surface: 'task_agent',
      })

      // 3. Open the session
      useSessionStore.getState().setActiveSession(result.session_name)
      useTabStore.getState().openAgentTab(result.session_name)

      // 4. Navigate PM view to the new entity so it's visible next to the chat
      const newId = 'area_id' in created ? created.area_id : created.task_id
      if (newId) {
        await usePMStore.getState().navigateTo(newId)
      } else {
        usePMStore.getState().silentRefreshCurrentNode()
      }
      close()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set up')
      setSubmitting(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && title.trim()) {
      e.preventDefault()
      handleAdd()
    }
  }

  const placeholder = entityType === 'task'
    ? 'e.g. Add OAuth for university SSO'
    : 'e.g. DevOps, Frontend, Research'

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v) }}>
      <DialogContent className="sm:max-w-[440px]">
        <div className="flex flex-col gap-3">
          {/* Breadcrumb as context */}
          <div className="type-micro text-muted-foreground font-medium">
            {breadcrumb}
          </div>

          {/* Title input */}
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="bg-[rgba(255,255,255,0.04)] border border-border rounded px-2.5 py-2
              type-body-sm text-foreground placeholder:text-muted-foreground
              focus:outline-none focus:border-[var(--color-accent)]
              transition-[border-color] duration-150 w-full"
            autoFocus
          />

          {/* Task / Area radio toggle */}
          <div className="flex flex-col gap-1.5">
            <label
              className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer type-label transition-colors ${entityType === 'task' ? 'text-foreground' : 'text-muted-foreground'}`}
              onClick={() => setEntityType('task')}
            >
              <input
                type="radio"
                name="entityType"
                checked={entityType === 'task'}
                onChange={() => setEntityType('task')}
                className="accent-[var(--color-accent)]"
              />
              <span className="font-medium">Task</span>
              <span className="text-muted-foreground">— has a finish line</span>
            </label>
            <label
              className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer type-label transition-colors ${entityType === 'area' ? 'text-foreground' : 'text-muted-foreground'}`}
              onClick={() => setEntityType('area')}
            >
              <input
                type="radio"
                name="entityType"
                checked={entityType === 'area'}
                onChange={() => setEntityType('area')}
                className="accent-[var(--color-accent)]"
              />
              <span className="font-medium">Area</span>
              <span className="text-muted-foreground">— ongoing, groups related work</span>
            </label>
          </div>

          {/* Runtime selector — only shown when agent setup is possible */}
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
              disabled={submitting || !title.trim() || newSessionGate.disabled}
              title={newSessionGate.disabled
                ? newSessionGate.tooltip
                : 'An agent will help define details, then plan and execute'}
            >
              {submitting ? 'Starting...' : 'Set up w/ agent'}
            </ActionButton>
            <ActionButton
              variant="primary"
              size="sm"
              onClick={handleAdd}
              disabled={submitting || !title.trim()}
            >
              {submitting ? 'Adding...' : 'Add'}
            </ActionButton>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
