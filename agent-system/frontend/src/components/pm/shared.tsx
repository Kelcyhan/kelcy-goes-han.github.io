import { useEffect, useState, type ReactNode } from 'react'
import { CheckCircle2, Circle, CircleDot, Target, ArrowRight, Play } from 'lucide-react'
import { useTabStore } from '@/stores/tab-store.ts'
import { useSessionStore } from '@/stores/session-store.ts'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover.tsx'
import { Label } from '@/components/ui/label.tsx'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select.tsx'
import * as api from '@/lib/api.ts'
import { getResolvedInteractiveCategory, type Runtime as PolicyRuntime } from '@/lib/llm-policy.ts'
import { useNewSessionGate } from '@/components/auth/useNewSessionGate.ts'
import { ActionButton, SegmentedControl } from '@/components/primitives'

// --- Shared types ---

export interface DirEntry {
  name: string
  type: 'file' | 'dir'
  size?: number
  count?: number
}

// --- Shared components ---

// Re-export ProgressBar primitive (replaces pm-progress-* CSS classes)
export { ProgressBar } from '@/components/primitives'

export function GoalStatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'achieved': return <CheckCircle2 size={14} className="text-green" />
    case 'in_progress': return <CircleDot size={14} className="text-accent" />
    case 'pending_confirmation': return <Target size={14} className="text-orange animate-pulse" />
    default: return <Circle size={14} className="text-muted-foreground" />
  }
}

export function TaskStatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'done': return <CheckCircle2 size={12} className="text-green" />
    case 'active': return <ArrowRight size={12} className="text-accent" />
    default: return <Circle size={12} className="text-muted-foreground" />
  }
}

export function daysAgo(dateStr?: string): string {
  if (!dateStr) return ''
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
  if (diff === 0) return 'today'
  if (diff === 1) return '1d ago'
  return `${diff}d ago`
}

// --- Runtime toggle + model select (shared across all spawn dialogs) ---
export type Runtime = PolicyRuntime
const DEFAULT_MODEL_ID = 'default'

const DEFAULT_MODEL_OPTIONS: Record<Runtime, api.LLMModelOption[]> = {
  'claude-code': [{ id: 'default', label: 'Use category default' }],
  codex: [{ id: 'default', label: 'Use category default' }],
}

let llmSettingsPayloadCache: api.LLMSettingsPayload | null = null
let llmSettingsPayloadInflight: Promise<api.LLMSettingsPayload> | null = null

function stripDefaultModelOption(options: api.LLMModelOption[] | undefined): api.LLMModelOption[] {
  return (options || []).filter(option => option.id !== DEFAULT_MODEL_ID)
}

function fallbackModelForRuntime(options: api.LLMModelOption[] | undefined): string {
  const runtimeOptions = stripDefaultModelOption(options)
  return runtimeOptions[0]?.id || DEFAULT_MODEL_ID
}

function preferredModelForSurface(
  payload: api.LLMSettingsPayload,
  surface: string,
  runtime: Runtime,
  options: api.LLMModelOption[] | undefined,
): string {
  const stored = payload.settings?.categories?.[surface]?.default_model_by_runtime?.[runtime]
    || payload.settings?.categories?.interactive_agent?.default_model_by_runtime?.[runtime]
  return normalizeModelForRuntime(runtime, stored || undefined, options, { allowDefault: false })
}

function normalizeModelForRuntime(
  runtime: Runtime,
  model: string | undefined,
  options: api.LLMModelOption[] | undefined,
  { allowDefault = false }: { allowDefault?: boolean } = {},
): string {
  const runtimeOptions = options || DEFAULT_MODEL_OPTIONS[runtime]
  if (model && runtimeOptions.some(option => option.id === model)) {
    if (model === DEFAULT_MODEL_ID && !allowDefault) {
      return fallbackModelForRuntime(runtimeOptions)
    }
    return model
  }
  return allowDefault ? DEFAULT_MODEL_ID : fallbackModelForRuntime(runtimeOptions)
}

export function primeLLMSettingsPayloadCache(payload: api.LLMSettingsPayload) {
  llmSettingsPayloadCache = payload
}

async function fetchLLMSettingsPayloadCached(): Promise<api.LLMSettingsPayload> {
  if (llmSettingsPayloadCache) return llmSettingsPayloadCache
  if (!llmSettingsPayloadInflight) {
    llmSettingsPayloadInflight = api.fetchLLMSettings().then(payload => {
      llmSettingsPayloadCache = payload
      return payload
    }).finally(() => {
      llmSettingsPayloadInflight = null
    })
  }
  return llmSettingsPayloadInflight
}

function buildInteractiveDefaults(
  payload: api.LLMSettingsPayload,
  surface: string,
): {
  runtime: Runtime
  model: string
  defaultModels: Record<Runtime, string>
  availableModels: Record<Runtime, api.LLMModelOption[]>
  enabledRuntimes: Record<Runtime, boolean>
} {
  const resolved = getResolvedInteractiveCategory(payload, surface, new Set())
  const enabledRuntimes: Record<Runtime, boolean> = {
    'claude-code': !!payload.providers?.claude,
    codex: !!payload.providers?.codex,
  }
  const availableModels: Record<Runtime, api.LLMModelOption[]> = {
    'claude-code': stripDefaultModelOption(payload.selectable_models?.['claude-code']) || DEFAULT_MODEL_OPTIONS['claude-code'],
    codex: stripDefaultModelOption(payload.selectable_models?.codex) || DEFAULT_MODEL_OPTIONS.codex,
  }
  const defaultModels: Record<Runtime, string> = {
    'claude-code': preferredModelForSurface(payload, surface, 'claude-code', availableModels['claude-code']),
    codex: preferredModelForSurface(payload, surface, 'codex', availableModels.codex),
  }
  return {
    runtime: resolved.runtime,
    model: defaultModels[resolved.runtime],
    defaultModels,
    availableModels,
    enabledRuntimes,
  }
}

export async function fetchInteractiveDefaults(): Promise<{
  runtime: Runtime
  model: string
  defaultModels: Record<Runtime, string>
  availableModels: Record<Runtime, api.LLMModelOption[]>
  enabledRuntimes: Record<Runtime, boolean>
}> {
  try {
    const payload = await fetchLLMSettingsPayloadCached()
    return buildInteractiveDefaults(payload, 'interactive_agent')
  } catch {
    return {
      runtime: 'claude-code',
      model: fallbackModelForRuntime(DEFAULT_MODEL_OPTIONS['claude-code']),
      defaultModels: {
        'claude-code': fallbackModelForRuntime(DEFAULT_MODEL_OPTIONS['claude-code']),
        codex: fallbackModelForRuntime(DEFAULT_MODEL_OPTIONS.codex),
      },
      availableModels: DEFAULT_MODEL_OPTIONS,
      enabledRuntimes: { 'claude-code': true, codex: true },
    }
  }
}

export async function fetchInteractiveDefaultsForSurface(surface: string): Promise<{
  runtime: Runtime
  model: string
  defaultModels: Record<Runtime, string>
  availableModels: Record<Runtime, api.LLMModelOption[]>
  enabledRuntimes: Record<Runtime, boolean>
}> {
  try {
    const payload = await fetchLLMSettingsPayloadCached()
    return buildInteractiveDefaults(payload, surface)
  } catch {
    return {
      runtime: 'claude-code',
      model: fallbackModelForRuntime(DEFAULT_MODEL_OPTIONS['claude-code']),
      defaultModels: {
        'claude-code': fallbackModelForRuntime(DEFAULT_MODEL_OPTIONS['claude-code']),
        codex: fallbackModelForRuntime(DEFAULT_MODEL_OPTIONS.codex),
      },
      availableModels: DEFAULT_MODEL_OPTIONS,
      enabledRuntimes: { 'claude-code': true, codex: true },
    }
  }
}

interface RuntimeToggleProps {
  value: Runtime
  onChange: (r: Runtime) => void
  enabledRuntimes?: Record<Runtime, boolean>
}

export function RuntimeToggle({ value, onChange, enabledRuntimes }: RuntimeToggleProps) {
  const claudeEnabled = enabledRuntimes?.['claude-code'] ?? true
  const codexEnabled = enabledRuntimes?.codex ?? true
  return (
    <SegmentedControl
      items={[
        { id: 'claude-code', label: 'Claude', disabled: !claudeEnabled },
        { id: 'codex', label: 'Codex', disabled: !codexEnabled },
      ]}
      value={value}
      onValueChange={(id) => onChange(id as Runtime)}
      className="rounded-md bg-[rgba(255,255,255,0.04)] p-0.5"
    />
  )
}

interface ModelSelectProps {
  runtime: Runtime
  value: string
  onChange: (m: string) => void
  options?: api.LLMModelOption[]
  id?: string
  className?: string
  includeDefaultOption?: boolean
}

export function ModelSelect({ runtime, value, onChange, options, id, className, includeDefaultOption = true }: ModelSelectProps) {
  const [resolvedOptions, setResolvedOptions] = useState<Record<Runtime, api.LLMModelOption[]>>(DEFAULT_MODEL_OPTIONS)

  useEffect(() => {
    if (options) return
    void fetchInteractiveDefaults().then(({ availableModels }) => setResolvedOptions(availableModels))
  }, [options])

  const rawOptions = options || resolvedOptions[runtime] || DEFAULT_MODEL_OPTIONS[runtime]
  const runtimeOptions = includeDefaultOption ? rawOptions : stripDefaultModelOption(rawOptions)
  const resolvedValue = normalizeModelForRuntime(runtime, value, runtimeOptions, { allowDefault: includeDefaultOption })

  return (
    <Select value={resolvedValue} onValueChange={onChange}>
      <SelectTrigger id={id} className={className ?? 'h-8 type-label'}>
        <SelectValue placeholder="Default" />
      </SelectTrigger>
      <SelectContent>
        {runtimeOptions.map((option) => (
          <SelectItem key={option.id} value={option.id}>{option.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

// --- Spawn session button (used by NodeHeader + ChildCardGrid) ---

interface SpawnSessionButtonProps {
  taskPath: string
  small?: boolean
  onSpawned?: () => void
  surface?: string
  // Optional pass-through args for callers that need to spawn with a custom prompt
  // or different post-spawn behavior (e.g., HomeScreen widget builder).
  prompt?: string
  displayName?: string
  conversation?: boolean
  openTabAfterSpawn?: boolean
  trigger?: ReactNode
}

export function SpawnSessionButton({
  taskPath,
  small,
  onSpawned,
  surface = 'task_agent',
  prompt,
  displayName,
  conversation = true,
  openTabAfterSpawn = true,
  trigger,
}: SpawnSessionButtonProps) {
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [model, setModel] = useState(fallbackModelForRuntime(DEFAULT_MODEL_OPTIONS['claude-code']))
  const [runtime, setRuntime] = useState<Runtime>('claude-code')
  const [availableModels, setAvailableModels] = useState<Record<Runtime, api.LLMModelOption[]>>(DEFAULT_MODEL_OPTIONS)
  const [defaultModels, setDefaultModels] = useState<Record<Runtime, string>>({
    'claude-code': fallbackModelForRuntime(DEFAULT_MODEL_OPTIONS['claude-code']),
    codex: fallbackModelForRuntime(DEFAULT_MODEL_OPTIONS.codex),
  })
  const [enabledRuntimes, setEnabledRuntimes] = useState<Record<Runtime, boolean>>({ 'claude-code': true, codex: true })
  const [submitting, setSubmitting] = useState(false)
  const newSessionGate = useNewSessionGate()

  useEffect(() => {
    void fetchInteractiveDefaultsForSurface(surface).then(({ runtime, model, defaultModels, availableModels, enabledRuntimes }) => {
      setRuntime(runtime)
      setModel(model)
      setDefaultModels(defaultModels)
      setAvailableModels(availableModels)
      setEnabledRuntimes(enabledRuntimes)
    })
  }, [surface])

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      const result = await api.spawnTaskAgent({
        working_dir: taskPath,
        model: model !== 'default' ? model : undefined,
        runtime,
        conversation,
        surface,
        ...(prompt !== undefined ? { prompt } : {}),
        ...(displayName !== undefined ? { display_name: displayName } : {}),
      })
      setPopoverOpen(false)
      useSessionStore.getState().setActiveSession(result.session_name)
      if (openTabAfterSpawn) {
        useTabStore.getState().openAgentTab(result.session_name)
      }
      onSpawned?.()
    } catch (err) {
      console.error('Failed to spawn agent:', err)
    } finally {
      setSubmitting(false)
    }
  }

  const iconSize = small ? 10 : 12

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          {trigger ?? (
            <ActionButton
              variant="toolbar"
              size={small ? 'panel' : 'toolbar'}
              className="gap-[3px]"
              onClick={(e) => e.stopPropagation()}
              title={newSessionGate.disabled ? newSessionGate.tooltip : 'New agent'}
              disabled={newSessionGate.disabled}
            >
              <Play size={iconSize} /> New Agent
            </ActionButton>
          )}
        </PopoverTrigger>
        <PopoverContent className="w-64" onClick={(e) => e.stopPropagation()}>
          <div className="grid gap-4">
            <div className="space-y-2">
              <h4 className="font-medium leading-none">New Agent</h4>
              <p className="text-sm text-muted-foreground">Start a conversation session.</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Runtime</Label>
              <RuntimeToggle value={runtime} onChange={(r) => { setRuntime(r); setModel(defaultModels[r] || fallbackModelForRuntime(availableModels[r])) }} enabledRuntimes={enabledRuntimes} />
            </div>
            <div className="grid grid-cols-3 items-center gap-4">
              <Label htmlFor="sp-model">Model</Label>
              <ModelSelect runtime={runtime} value={model} onChange={setModel} options={availableModels[runtime]} id="sp-model" className="col-span-2 h-8" includeDefaultOption={false} />
            </div>
            <ActionButton
              variant="toolbarPrimary"
              className="w-full justify-center"
              onClick={handleSubmit}
              disabled={submitting || newSessionGate.disabled}
              title={newSessionGate.disabled ? newSessionGate.tooltip : undefined}
            >
              {submitting ? 'Starting…' : 'Start'}
            </ActionButton>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
