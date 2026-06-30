import { useEffect, useCallback, useMemo, useState, useRef, Suspense } from 'react'
import {
  Pencil, Check, ArrowLeft, GripVertical, LayoutGrid,
  Plus, MessageSquare, Clock, Mic, ChevronRight, Trash2, X,
  Activity, BookOpen, BarChart3, Heart, Dumbbell, Newspaper,
  Calendar, Star, Zap, FileText, Globe, Database, Search,
  ArrowRight, Bot, FolderKanban, Inbox, PanelLeft, Sparkles, Users,
  ArrowUp, ArrowDown, Maximize2, Minimize2,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import {
  DndContext, DragOverlay, closestCenter,
  PointerSensor, useSensor, useSensors,
  type DragStartEvent, type DragOverEvent, type DragEndEvent,
} from '@dnd-kit/core'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { snapCenterToCursor } from '@dnd-kit/modifiers'

import { useHomeStore, resolveIcon, type WidgetDef, type BuildingWidget } from '@/stores/home-store.tsx'
import { useSessionStore } from '@/stores/session-store.ts'
import { useTabStore } from '@/stores/tab-store.ts'
import { usePMStore } from '@/stores/pm-store.ts'
import { GlobalSearchTrigger } from './GlobalSearch.tsx'
import { CreateProjectDialog } from './CreateProjectDialog.tsx'
import { SpawnSessionButton } from './shared.tsx'
import { IconButton, ActionButton, PMStatusDot, TypedTitleConfirmDialog } from '@/components/primitives'
import { ActiveAgents } from '@/components/home/ActiveAgents.tsx'
import { PastAgents } from '@/components/home/PastAgents.tsx'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog.tsx'
import { Checkbox } from '@/components/ui/checkbox.tsx'
import { useVoice } from '@/hooks/useVoice.ts'
import { useVoiceStream } from '@/hooks/useVoiceStream.ts'
import { useNewSessionGate } from '@/components/auth/useNewSessionGate.ts'
import * as api from '@/lib/api.ts'
import { getAuthToken, checkVoiceSupport } from '@/lib/api.ts'
import { cn } from '@/lib/utils.ts'

// ── Icon options for widget creation ──

const ICON_OPTIONS: { name: string; icon: LucideIcon }[] = [
  { name: 'Activity', icon: Activity },
  { name: 'Heart', icon: Heart },
  { name: 'Dumbbell', icon: Dumbbell },
  { name: 'BookOpen', icon: BookOpen },
  { name: 'BarChart3', icon: BarChart3 },
  { name: 'Newspaper', icon: Newspaper },
  { name: 'Calendar', icon: Calendar },
  { name: 'Clock', icon: Clock },
  { name: 'Star', icon: Star },
  { name: 'Zap', icon: Zap },
  { name: 'FileText', icon: FileText },
  { name: 'Globe', icon: Globe },
  { name: 'Database', icon: Database },
  { name: 'Search', icon: Search },
  { name: 'LayoutGrid', icon: LayoutGrid },
]

const DESCRIPTION_PLACEHOLDER = `e.g. "Track my sleep schedule with bedtime and wake-up entries each day. The compact card should show last night's hours slept, a 7-day average, and a streak counter for consecutive 7h+ nights. The detail view needs: (1) a log form with bed time and wake time inputs, (2) a weekly bar chart of hours slept with a target line at 8h — green bars for 7h+, yellow for 6-7h, red for under 6h, (3) a scrollable history list showing date, times, and duration for each night. Store all data in localStorage."`

// ── Suspense Fallback for lazy-loaded widgets ──

function WidgetLoadingFallback() {
  return (
    <div className="flex items-center justify-center py-6">
      <span className="type-micro text-muted-foreground">Loading...</span>
    </div>
  )
}

// ── Widget Error Boundary ──

import { Component, type ReactNode, type ErrorInfo } from 'react'

interface ErrorBoundaryProps {
  widgetId: string
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

class WidgetErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`Widget "${this.props.widgetId}" crashed:`, error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center py-4 gap-1.5">
          <span className="type-micro text-red-400">Widget error</span>
          <span className="type-caption text-muted-foreground truncate max-w-full px-2">
            {this.state.error?.message}
          </span>
          <button
            className="type-caption text-accent hover:underline bg-transparent border-none cursor-pointer p-0"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Retry
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

const HIDDEN_AGENT_ROLES = new Set(['chainlink', 'verifier', 'shadow'])

type HomeModuleId = 'widgets' | 'handoffs' | 'projects'

const HOME_MODULE_ORDER: HomeModuleId[] = ['widgets', 'handoffs', 'projects']
const HOME_LAYOUT_STORAGE_KEY = 'locusly.home.moduleLayout.v1'

interface HomeModuleLayout {
  order: HomeModuleId[]
  wide: HomeModuleId[]
}

function normalizeHomeModuleOrder(order?: unknown): HomeModuleId[] {
  const provided = Array.isArray(order) ? order : []
  const valid = provided.filter((id): id is HomeModuleId =>
    typeof id === 'string' && HOME_MODULE_ORDER.includes(id as HomeModuleId),
  )
  return [...valid, ...HOME_MODULE_ORDER.filter(id => !valid.includes(id))]
}

function readHomeModuleLayout(): HomeModuleLayout {
  if (typeof window === 'undefined') return { order: HOME_MODULE_ORDER, wide: ['widgets'] }
  try {
    const raw = window.localStorage.getItem(HOME_LAYOUT_STORAGE_KEY)
    if (!raw) return { order: HOME_MODULE_ORDER, wide: ['widgets'] }
    const parsed = JSON.parse(raw) as Partial<HomeModuleLayout>
    return {
      order: normalizeHomeModuleOrder(parsed.order),
      wide: normalizeHomeModuleOrder(parsed.wide).filter(id => parsed.wide?.includes(id)),
    }
  } catch {
    return { order: HOME_MODULE_ORDER, wide: ['widgets'] }
  }
}

function writeHomeModuleLayout(layout: HomeModuleLayout) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(HOME_LAYOUT_STORAGE_KEY, JSON.stringify(layout))
}

// ── Widget Sessions Panel (collapsible, shown in detail view) ──

function WidgetSessionsPanel({ widgetId, widgetTitle, workingDirPrefixes }: {
  widgetId: string
  widgetTitle: string
  workingDirPrefixes?: string[]
}) {
  const [collapsed, setCollapsed] = useState(true)
  const allSessions = useSessionStore(s => s.sessions)
  const refreshSessions = useSessionStore(s => s.refreshSessions)
  const newSessionGate = useNewSessionGate()

  const prefixes = workingDirPrefixes?.length
    ? workingDirPrefixes
    : [`/home/agent/vault/widgets/${widgetId}`]
  const prefixesKey = prefixes.join('|')

  const filter = useCallback(
    (s: { working_dir?: string | null }) =>
      !!s.working_dir && prefixes.some(p => s.working_dir!.startsWith(p)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [prefixesKey],
  )

  const liveCount = allSessions.filter(
    s => filter(s)
      && s.status !== 'dead'
      && s.status !== 'ended'
      && !(s.agent_role && HIDDEN_AGENT_ROLES.has(s.agent_role)),
  ).length

  const widgetSpawnPrompt = [
    `You are working on the widget at widgets/${widgetId}.`,
    'Start by reading task.md, current code, any artifacts, and prior widget sessions so you understand the current state.',
    'If the user has not yet given a concrete change request, orient yourself and then wait for instructions.',
  ].join('\n\n')

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-3">
        <button
          className="flex items-center gap-2 bg-transparent border-none cursor-pointer p-0 text-left min-w-0"
          onClick={() => setCollapsed(!collapsed)}
        >
          <ChevronRight
            size={14}
            className={cn(
              'text-muted-foreground transition-transform duration-150',
              !collapsed && 'rotate-90',
            )}
          />
          <MessageSquare size={14} className="text-muted-foreground" />
          <span className="type-body-sm font-semibold text-foreground">Agents</span>
          {liveCount > 0 && (
            <span className="type-micro text-muted-foreground">({liveCount})</span>
          )}
        </button>
        <div className="flex-1" />
        <SpawnSessionButton
          taskPath={`widgets/${widgetId}`}
          surface="widget_builder"
          prompt={widgetSpawnPrompt}
          displayName={`Widget — ${widgetTitle}`}
          conversation={false}
          openTabAfterSpawn={false}
          onSpawned={() => void refreshSessions()}
          trigger={
            <ActionButton
              variant="secondary"
              size="sm"
              disabled={newSessionGate.disabled}
              title={newSessionGate.disabled ? newSessionGate.tooltip : undefined}
            >
              Spawn Agent
            </ActionButton>
          }
        />
      </div>

      {!collapsed && (
        <div className="flex flex-col gap-4 mt-3">
          <div>
            <div className="type-caption font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
              Active
            </div>
            <ActiveAgents
              filter={filter}
              readOnly
              compactMode
              emptyState={
                <div className="type-micro text-muted-foreground italic py-1">
                  No active agents for this widget.
                </div>
              }
            />
          </div>
          <div>
            <div className="type-caption font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
              Past
            </div>
            <PastAgents
              defaultDays={365}
              workingDirPrefixes={prefixes}
              compactMode
              emptyState={
                <div className="type-micro text-muted-foreground italic py-1">
                  No past agents for this widget.
                </div>
              }
            />
          </div>
        </div>
      )}
    </div>
  )
}

// ── Inline Widget Creation Form ──

function NewWidgetForm({ onClose, onCreated }: {
  onClose: () => void
  onCreated: (id: string, sessionName: string, title: string, icon: string) => void
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [selectedIcon, setSelectedIcon] = useState('Activity')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [voiceEnabled, setVoiceEnabled] = useState(false)
  const [interimText, setInterimText] = useState('')
  const [streamFailed, setStreamFailed] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { checkVoiceSupport().then(setVoiceEnabled) }, [])

  const { recording, transcribing, toggleRecording } = useVoice({
    onTranscript: (t) => {
      setDescription(prev => prev ? prev + ' ' + t : t)
      textareaRef.current?.focus()
    },
  })

  const { state: streamState, start: startStream, stop: stopStream } = useVoiceStream({
    onInterim: (t) => setInterimText(t),
    onFinal: (t) => {
      setDescription(prev => prev ? prev + ' ' + t : t)
      setInterimText('')
      textareaRef.current?.focus()
    },
    onError: (msg) => {
      console.warn('Voice stream error:', msg)
      setStreamFailed(true)
      setInterimText('')
    },
  })

  const isStreaming = streamState === 'streaming' || streamState === 'connecting'
  const useStreamMode = voiceEnabled && !streamFailed
  const micActive = useStreamMode ? isStreaming : recording
  const micBusy = useStreamMode ? streamState === 'connecting' : transcribing

  const handleMicClick = useCallback(() => {
    if (useStreamMode) {
      if (isStreaming) stopStream()
      else if (streamState === 'idle') startStream()
    } else {
      toggleRecording()
    }
  }, [useStreamMode, isStreaming, stopStream, streamState, startStream, toggleRecording])

  const handleCreate = async () => {
    if (!title.trim()) return
    setSubmitting(true)
    setError('')

    const widgetId = title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

    try {
      // Scaffold + spawn the build-agent in a single backend call.
      // The spawn prompt lives in _system/templates/WIDGET_SPAWN_PROMPT.md — edit it there.
      const token = getAuthToken()
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`
      const createRes = await fetch('/api/widgets/create', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          id: widgetId,
          title: title.trim(),
          description: description.trim(),
          icon: selectedIcon,
        }),
      })
      if (!createRes.ok) {
        const err = await createRes.json().catch(() => ({ detail: 'Failed to create widget' }))
        throw new Error(err.detail || 'Failed to create widget')
      }
      const created = await createRes.json()
      const sessionName = created.session_name as string

      useSessionStore.getState().setActiveSession(sessionName)
      useTabStore.getState().openAgentTab(sessionName)

      onCreated(widgetId, sessionName, title.trim(), selectedIcon)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create widget')
      setSubmitting(false)
    }
  }

  const inputClasses = `bg-[rgba(255,255,255,0.04)] border border-border rounded px-2.5 py-1.5
    type-label text-foreground placeholder:text-muted-foreground
    focus:outline-none focus:border-[var(--color-accent)]
    transition-[border-color] duration-150 w-full`

  // Show interim text appended when streaming
  const displayValue = isStreaming && interimText
    ? description + (description ? ' ' : '') + interimText
    : description

  return (
    <div className="bg-card border border-border rounded-md p-4 flex flex-col gap-3 mb-4">
      <div className="flex items-center justify-between">
        <span className="type-body-sm font-semibold text-foreground">New Widget</span>
        <span className="type-caption text-muted-foreground">
          Describe what you want and an agent will build it
        </span>
      </div>

      {/* Name */}
      <div className="flex flex-col gap-1">
        <label className="type-micro text-muted-foreground font-medium">Name</label>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="e.g. Sleep Tracker"
          className={inputClasses}
          autoFocus
        />
      </div>

      {/* Description with mic button */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <label className="type-micro text-muted-foreground font-medium">
            {isStreaming ? 'Listening...' : 'Description'}
          </label>
          {voiceEnabled && (
            <button
              onClick={handleMicClick}
              disabled={micBusy}
              className={cn(
                'w-7 h-7 rounded-full bg-transparent border-none cursor-pointer flex items-center justify-center shrink-0 p-0',
                'transition-[background,color] duration-150 hover:bg-[var(--bg-ingrained)]',
                micActive
                  ? 'text-[var(--color-red)] animate-mic-pulse'
                  : 'text-muted-foreground hover:text-foreground',
                micBusy && 'opacity-50 cursor-default pointer-events-none',
              )}
              title="Voice input"
            >
              <Mic size={14} />
            </button>
          )}
        </div>
        <textarea
          ref={textareaRef}
          value={displayValue}
          onChange={e => setDescription(e.target.value)}
          placeholder={DESCRIPTION_PLACEHOLDER}
          className={cn(inputClasses, 'min-h-[100px] resize-y')}
          rows={4}
          readOnly={isStreaming}
        />
      </div>

      {/* Icon picker */}
      <div className="flex flex-col gap-1">
        <label className="type-micro text-muted-foreground font-medium">Icon</label>
        <div className="flex flex-wrap gap-1">
          {ICON_OPTIONS.map(opt => {
            const Icon = opt.icon
            return (
              <button
                key={opt.name}
                onClick={() => setSelectedIcon(opt.name)}
                className={cn(
                  'p-1.5 rounded border transition-all duration-150 bg-transparent cursor-pointer',
                  selectedIcon === opt.name
                    ? 'border-[var(--color-accent)] text-accent'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border',
                )}
                title={opt.name}
                type="button"
              >
                <Icon size={16} />
              </button>
            )
          })}
        </div>
      </div>

      {error && <span className="type-micro text-red-400">{error}</span>}

      <div className="flex justify-end gap-2 mt-1">
        <ActionButton variant="secondary" size="sm" onClick={onClose} disabled={submitting}>
          Cancel
        </ActionButton>
        <ActionButton variant="primary" size="sm" onClick={handleCreate} disabled={submitting || !title.trim()}>
          {submitting ? 'Creating...' : 'Create & Watch'}
        </ActionButton>
      </div>
    </div>
  )
}

// ── Building Widget Card (shown while agent is creating) ──

function BuildingCard({ widget }: { widget: BuildingWidget }) {
  const Icon = resolveIcon(widget.icon)

  return (
    <div className="group bg-card border border-border rounded-md flex flex-col transition-[border-color] duration-150">
      <div className="flex items-center gap-2 p-3 pb-0">
        <Icon size={16} className="text-accent shrink-0" />
        <span className="type-body-sm font-semibold flex-1">{widget.title}</span>
      </div>
      <div className="mx-3 mt-2.5 border-t border-[var(--color-border-subtle)]" />
      <div className="p-3 flex flex-col items-center gap-1.5 py-6">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          <span className="type-label text-foreground font-medium">Building...</span>
        </div>
        <span className="type-caption text-muted-foreground">Agent is creating this widget</span>
      </div>
    </div>
  )
}

// ── Onboarding Package ──

type OnboardingRow = {
  icon: LucideIcon
  mark?: string
  title: string
  description: string
}

type OnboardingScreen = {
  eyebrow: string
  title: string
  description: string
  kind: 'map' | 'system' | 'collaboration' | 'start'
  rows?: OnboardingRow[]
}

const ONBOARDING_SCREENS: OnboardingScreen[] = [
  {
    eyebrow: 'Step 1 of 4',
    title: 'Start with the work, not the tool',
    description: 'Locusly keeps your projects, agent sessions, and working files connected so you can move from an idea to a finished artifact without losing the thread.',
    kind: 'map',
  },
  {
    eyebrow: 'Step 2 of 4',
    title: 'How the system works',
    description: 'A project contains tasks. A task can launch an agent session. The session writes plans, logs, and artifacts back onto the task so the next step is visible.',
    kind: 'system',
  },
  {
    eyebrow: 'Step 3 of 4',
    title: 'Agents ask when the next move is yours',
    description: 'Concierge helps shape the work, task agents execute, and handoffs surface the moments that need your review.',
    kind: 'collaboration',
    rows: [
      { icon: Users, mark: 'C', title: 'Concierge', description: 'Thinks through goals and structure.' },
      { icon: Bot, mark: 'T', title: 'Task agent', description: 'Plans and executes a task.' },
      { icon: Inbox, title: 'Handoffs', description: 'Shows approvals, blockers, and decisions.' },
    ],
  },
  {
    eyebrow: 'Step 4 of 4',
    title: 'What should Locusly help with first?',
    description: 'Pick the first real action. The onboarding gets out of the way and leaves you inside the same workspace.',
    kind: 'start',
    rows: [
      { icon: Plus, title: 'Plan a project with Concierge', description: 'Best if you have a goal but no structure yet.' },
      { icon: FolderKanban, title: 'Create a project', description: 'Best if you know what to organize.' },
      { icon: Sparkles, title: 'Try a quick task', description: 'Best for learning with a small example.' },
    ],
  },
]

function OnboardingVisual({ screen }: { screen: OnboardingScreen }) {
  if (screen.kind === 'map') {
    const areas = [
      { icon: PanelLeft, title: 'Sessions', detail: 'running agents' },
      { icon: FolderKanban, title: 'Projects', detail: 'organized work' },
      { icon: MessageSquare, title: 'Workspace', detail: 'chat and files' },
    ]
    return (
      <div className="grid gap-2 sm:grid-cols-3">
        {areas.map(area => {
          const Icon = area.icon
          return (
            <div key={area.title} className="rounded-md border border-[var(--color-border-subtle)] bg-[var(--bg-ingrained)] p-3">
              <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-md bg-card text-accent">
                <Icon size={16} />
              </div>
              <div className="type-label font-semibold text-foreground">{area.title}</div>
              <div className="type-caption mt-0.5 text-muted-foreground">{area.detail}</div>
            </div>
          )
        })}
      </div>
    )
  }

  if (screen.kind === 'system') {
    return (
      <div className="rounded-md border border-[var(--color-border-subtle)] bg-[var(--bg-ingrained)] p-3">
        <div className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2">
          <PMStatusDot status="active" />
          <span className="type-label font-semibold text-foreground">Product Launch</span>
        </div>
        <div className="ml-4 border-l border-[var(--color-border-subtle)] pl-3 pt-3">
          <div className="rounded-md border border-border bg-card p-3">
            <div className="flex items-center gap-2">
              <PMStatusDot status="todo" />
              <div className="type-label font-semibold text-foreground">Write launch checklist</div>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="rounded-full bg-[var(--status-active-bg)] px-2 py-0.5 type-caption text-accent">agent session</span>
              <ArrowRight size={12} className="text-muted-foreground" />
              <span className="rounded-full bg-card px-2 py-0.5 type-caption text-muted-foreground">plan.md</span>
              <span className="rounded-full bg-card px-2 py-0.5 type-caption text-muted-foreground">artifacts</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {screen.rows?.map(row => {
        const Icon = row.icon
        return (
          <div
            key={row.title}
            className="flex items-center gap-3 rounded-md border border-[var(--color-border-subtle)] bg-[var(--bg-ingrained)] px-3 py-2.5"
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-card text-accent">
              {row.mark ? (
                <span className="type-caption font-bold text-accent">{row.mark}</span>
              ) : (
                <Icon size={14} />
              )}
            </div>
            <div className="min-w-0">
              <div className="type-label text-foreground font-semibold">{row.title}</div>
              <div className="type-caption text-muted-foreground mt-0.5">{row.description}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function OnboardingChecklist() {
  const [dismissed, setDismissed] = useState(() =>
    localStorage.getItem('onboarding-checklist-dismissed') === '1'
  )
  const [currentStep, setCurrentStep] = useState(() => {
    try {
      const stored = Number(localStorage.getItem('onboarding-package-step') || '0')
      return Number.isFinite(stored)
        ? Math.min(Math.max(stored, 0), ONBOARDING_SCREENS.length - 1)
        : 0
    } catch { return 0 }
  })

  useEffect(() => {
    localStorage.setItem('onboarding-package-step', String(currentStep))
  }, [currentStep])

  if (dismissed) return null

  const screen = ONBOARDING_SCREENS[currentStep]
  const isLastStep = currentStep === ONBOARDING_SCREENS.length - 1
  const dismiss = () => {
    setDismissed(true)
    localStorage.setItem('onboarding-checklist-dismissed', '1')
  }
  const goNext = () => {
    if (isLastStep) dismiss()
    else setCurrentStep(step => Math.min(step + 1, ONBOARDING_SCREENS.length - 1))
  }
  const startProject = () => {
    dismiss()
    document.dispatchEvent(new CustomEvent('home:create-project'))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(10,10,18,0.58)] px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-[520px] rounded-lg border border-border bg-[var(--bg-overlay)] p-4 shadow-[var(--shadow-modal)]">
        <div className="mb-3 flex items-center gap-2">
          <span className="type-micro font-semibold uppercase tracking-[0.08em] text-accent">
            {screen.eyebrow}
          </span>
          <div className="flex flex-1 justify-center gap-1.5" aria-hidden="true">
            {ONBOARDING_SCREENS.map((_, index) => (
              <span
                key={index}
                className={cn(
                  'h-1.5 rounded-full transition-all duration-150',
                  index === currentStep
                    ? 'w-5 bg-[var(--color-accent)]'
                    : index < currentStep
                      ? 'w-1.5 bg-[var(--color-accent-glow)]'
                      : 'w-1.5 bg-[var(--color-border-strong)]',
                )}
              />
            ))}
          </div>
          <button
            onClick={dismiss}
            className="bg-transparent border-none cursor-pointer p-0.5 text-muted-foreground hover:text-foreground transition-colors"
            title="Dismiss onboarding"
          >
            <X size={14} />
          </button>
        </div>

        <div className="mb-4">
          <h3 className="type-title-lg m-0 text-foreground font-semibold">{screen.title}</h3>
          <p className="type-body-sm m-0 mt-1 text-muted-foreground">{screen.description}</p>
        </div>

        <OnboardingVisual screen={screen} />

        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            onClick={() => setCurrentStep(step => Math.max(step - 1, 0))}
            disabled={currentStep === 0}
            className={cn(
              'type-label bg-transparent border-none p-0 text-muted-foreground transition-colors',
              currentStep === 0
                ? 'cursor-default opacity-40'
                : 'cursor-pointer hover:text-foreground',
            )}
          >
            Back
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={dismiss}
              className="type-label cursor-pointer border-none bg-transparent p-0 text-muted-foreground transition-colors hover:text-foreground"
            >
              Skip
            </button>
            {isLastStep ? (
              <ActionButton variant="primary" size="sm" onClick={startProject}>
                Create project
                <ArrowRight size={12} />
              </ActionButton>
            ) : (
              <ActionButton variant="primary" size="sm" onClick={goNext}>
                Continue
                <ArrowRight size={12} />
              </ActionButton>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Project Cards (fixed section above widget grid) ──

function ProjectCards({ showHeader = true }: { showHeader?: boolean }) {
  const availableProjects = usePMStore(s => s.availableProjects)
  const fetchProjects = usePMStore(s => s.fetchProjects)
  const deleteProject = usePMStore(s => s.deleteProject)
  const [showCreateProject, setShowCreateProject] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<{ id: string; title: string } | null>(null)

  useEffect(() => { fetchProjects() }, [fetchProjects])

  useEffect(() => {
    const openCreateProject = () => setShowCreateProject(true)
    document.addEventListener('home:create-project', openCreateProject)
    return () => document.removeEventListener('home:create-project', openCreateProject)
  }, [])

  // Auto-seed demo project on first load when no projects exist
  useEffect(() => {
    if (availableProjects.length > 0 || seeding) return
    const seeded = localStorage.getItem('onboarding-demo-seeded')
    if (seeded) return

    setSeeding(true)
    api.seedDemoProject()
      .then(() => {
        localStorage.setItem('onboarding-demo-seeded', '1')
        fetchProjects()
      })
      .catch(() => {})
      .finally(() => setSeeding(false))
  }, [availableProjects.length, fetchProjects, seeding])

  return (
    <div className={showHeader ? 'mb-4' : 'mb-0'}>
      {showHeader && (
        <div className="flex items-center gap-2 mb-2">
          <h2 className="type-body-sm font-semibold text-foreground m-0 flex-1">Projects</h2>
          <button
            onClick={() => setShowCreateProject(true)}
            className="flex items-center gap-1 type-micro text-muted-foreground hover:text-accent
                       bg-transparent border-none cursor-pointer p-0 transition-colors duration-150"
          >
            <Plus size={12} /> New Project
          </button>
        </div>
      )}
      {seeding && (
        <div className="type-label text-muted-foreground py-3">
          Setting up your workspace...
        </div>
      )}
      {!seeding && availableProjects.length > 0 && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-2">
          {availableProjects.map(project => (
            <div
              key={project.id}
              className="group relative bg-card border border-border rounded-lg cursor-pointer transition-all duration-150
                         hover:shadow-[var(--shadow-card-hover)] hover:-translate-y-px
                         overflow-hidden"
              style={{ borderTop: '3px solid var(--color-accent)' }}
              onClick={() => {
                void usePMStore.getState().openProject(project.id)
              }}
            >
              <div className="flex items-center gap-1.5 p-2.5">
                <PMStatusDot status={project.status} />
                <span className="type-label font-semibold truncate flex-1">{project.title}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setPendingDelete({ id: project.id, title: project.title })
                  }}
                  className="bg-transparent border-none cursor-pointer p-0.5 rounded transition-colors duration-150
                             text-muted-foreground hover:text-red-400
                             opacity-0 group-hover:opacity-100"
                  title="Delete project"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {!seeding && availableProjects.length === 0 && (
        <div className="type-label text-muted-foreground py-3">
          No projects yet.{' '}
          <button
            onClick={() => setShowCreateProject(true)}
            className="text-accent bg-transparent border-none cursor-pointer p-0 hover:underline type-label"
          >
            Create one
          </button>
        </div>
      )}
      <CreateProjectDialog open={showCreateProject} onOpenChange={setShowCreateProject} />
      {pendingDelete && (
        <TypedTitleConfirmDialog
          expectedTitle={pendingDelete.title}
          open={!!pendingDelete}
          onOpenChange={(v) => { if (!v) setPendingDelete(null) }}
          description={(
            <>
              Permanently deletes the project folder and all tasks, artifacts, and
              session records under it. This cannot be undone.
              Refused if any task in the project is still executing.
            </>
          )}
          onConfirm={async () => {
            await deleteProject(pendingDelete.id)
            setPendingDelete(null)
          }}
        />
      )}
    </div>
  )
}

// ── Widget Card — Compact (shown in grid) ──

function CompactCardContent({ def, editMode }: { def: WidgetDef; editMode: boolean }) {
  const Icon = def.icon
  return (
    <>
      {/* Header */}
      <div className="flex items-center gap-2 p-3 pb-0">
        {editMode && (
          <div className="cursor-grab active:cursor-grabbing" data-drag-handle>
            <GripVertical size={14} className="text-muted-foreground" />
          </div>
        )}
        <Icon size={16} className="text-accent shrink-0" />
        <span className="type-body-sm font-semibold flex-1">{def.title}</span>
      </div>
      {/* Separator */}
      <div className="mx-3 mt-2.5 border-t border-[var(--color-border-subtle)]" />
      {/* Body — compact view wrapped in Suspense + ErrorBoundary */}
      <div className="p-3">
        <WidgetErrorBoundary widgetId={def.id}>
          <Suspense fallback={<WidgetLoadingFallback />}>
            <def.CompactComponent />
          </Suspense>
        </WidgetErrorBoundary>
      </div>
    </>
  )
}

// ── Draggable Widget Card (edit mode) ──

function EditModeCard({ def, sortOrder }: { def: WidgetDef; sortOrder: number }) {
  const dragData = useMemo(() => ({ sortOrder }), [sortOrder])
  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: def.id,
    data: dragData,
  })
  const { setNodeRef: setDropRef } = useDroppable({ id: def.id })

  const setRef = useCallback((node: HTMLDivElement | null) => {
    setDragRef(node)
    setDropRef(node)
  }, [setDragRef, setDropRef])

  return (
    <div
      ref={setRef}
      className={cn(
        'group bg-card border border-border rounded-md flex flex-col transition-[border-color,box-shadow,opacity] duration-150',
        'border-dashed border-[var(--color-accent)]',
        isDragging && 'opacity-0',
      )}
      {...attributes}
      {...listeners}
    >
      <CompactCardContent def={def} editMode />
    </div>
  )
}

// ── [+ New Widget] Card ──

function NewWidgetCard({ onClick }: { onClick: () => void }) {
  return (
    <div
      className="group bg-transparent border-2 border-dashed border-border rounded-md flex flex-col items-center justify-center
                 cursor-pointer transition-all duration-150 min-h-[120px]
                 hover:border-[var(--color-accent)] hover:bg-[rgba(255,255,255,0.02)]"
      onClick={onClick}
    >
      <Plus size={20} className="text-muted-foreground group-hover:text-accent transition-colors duration-150" />
      <span className="type-label text-muted-foreground group-hover:text-foreground mt-1.5 transition-colors duration-150">
        New Widget
      </span>
    </div>
  )
}

// ── Static Widget Card (normal mode — click to expand) ──

function StaticCard({ def, onClick }: { def: WidgetDef; onClick: () => void }) {
  return (
    <div
      className={cn(
        'group bg-card border border-border rounded-md flex flex-col cursor-pointer transition-[border-color,box-shadow] duration-150',
        'hover:border-[var(--color-accent)] hover:shadow-[0_2px_8px_rgba(0,0,0,0.08)]',
      )}
      onClick={onClick}
    >
      <CompactCardContent def={def} editMode={false} />
    </div>
  )
}

// ── Detail View (shown when a card is clicked) ──

function DetailView({ def }: { def: WidgetDef }) {
  const collapseWidget = useHomeStore(s => s.collapseWidget)
  const deleteWidget = useHomeStore(s => s.deleteWidget)
  const Icon = def.icon
  const isAgentCreated = def.category === 'agent-created'
  const canDelete = !def.protected && def.category !== 'built-in'
  const [deleteOpen, setDeleteOpen] = useState(false)

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 p-3 border-b border-[var(--color-border-subtle)]">
        <button
          className="border-none bg-transparent type-label font-medium text-muted-foreground cursor-pointer hover:text-foreground flex items-center gap-1 transition-colors p-0"
          onClick={collapseWidget}
        >
          <ArrowLeft size={12} /> Home
        </button>
        <div className="w-px h-4 bg-border" />
        <Icon size={16} className="text-accent" />
        <span className="type-title-sm font-bold flex-1">{def.title}</span>
        {isAgentCreated && (
          <span className="type-caption text-muted-foreground bg-[rgba(255,255,255,0.06)] px-1.5 py-0.5 rounded">
            agent-created
          </span>
        )}
        {canDelete && (
          <IconButton
            variant="ghost"
            size="sm"
            onClick={() => setDeleteOpen(true)}
            title="Delete widget"
          >
            <Trash2 size={14} className="text-muted-foreground" />
          </IconButton>
        )}
      </div>

      <TypedTitleConfirmDialog
        expectedTitle={def.title}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        description="Deletes the widget directory on disk, including code and any data under it. This cannot be undone."
        onConfirm={async () => { await deleteWidget(def.id) }}
      />

      {/* Body — detail view wrapped in Suspense + ErrorBoundary */}
      <div className="flex-1 overflow-y-auto p-4">
        <WidgetErrorBoundary widgetId={def.id}>
          <Suspense fallback={<WidgetLoadingFallback />}>
            <def.DetailComponent />
          </Suspense>
        </WidgetErrorBoundary>

        {/* Agent sessions section for agent-created widgets — collapsible */}
        {isAgentCreated && (
          <div className="mt-6 pt-4 border-t border-[var(--color-border-subtle)]">
            <WidgetSessionsPanel
              widgetId={def.id}
              widgetTitle={def.title}
              workingDirPrefixes={def.workingDirPrefixes}
            />
          </div>
        )}
      </div>
    </div>
  )
}

// ── Manage Widgets Modal ──

function ManageWidgetsModal() {
  const open = useHomeStore(s => s.manageModalOpen)
  const close = useHomeStore(s => s.closeManageModal)
  const widgets = useHomeStore(s => s.widgets)
  const registry = useHomeStore(s => s.registry)
  const toggleWidget = useHomeStore(s => s.toggleWidget)
  const deleteWidget = useHomeStore(s => s.deleteWidget)
  const [pendingDelete, setPendingDelete] = useState<WidgetDef | null>(null)

  const sorted = [...widgets].sort((a, b) => a.sort_order - b.sort_order)

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && close()}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Manage Widgets</DialogTitle>
            <DialogDescription>Show or hide widgets on your home screen.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col">
            {sorted.map(config => {
              const def = registry.find(d => d.id === config.id)
              if (!def) return null
              const Icon = def.icon
              const canDelete = !def.protected && def.category !== 'built-in'
              return (
                <div
                  key={config.id}
                  className="flex items-center gap-3 px-2 py-2.5 rounded-md hover:bg-[var(--bg-card)] transition-colors group"
                >
                  <Checkbox
                    checked={config.enabled}
                    onCheckedChange={() => toggleWidget(config.id)}
                  />
                  <Icon size={14} className="text-muted-foreground" />
                  <span className={cn(
                    'type-body-sm font-medium flex-1',
                    !config.enabled && 'text-muted-foreground'
                  )}>
                    {def.title}
                  </span>
                  {canDelete && (
                    <button
                      onClick={() => setPendingDelete(def)}
                      className={cn(
                        'bg-transparent border-none cursor-pointer p-1 rounded transition-colors duration-150',
                        'text-muted-foreground hover:text-red-400',
                        'opacity-0 group-hover:opacity-100',
                      )}
                      title="Delete widget"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </DialogContent>
      </Dialog>
      {pendingDelete && (
        <TypedTitleConfirmDialog
          expectedTitle={pendingDelete.title}
          open={!!pendingDelete}
          onOpenChange={(v) => { if (!v) setPendingDelete(null) }}
          description="Deletes the widget directory on disk, including code and any data under it. This cannot be undone."
          onConfirm={async () => {
            await deleteWidget(pendingDelete.id)
            setPendingDelete(null)
          }}
        />
      )}
    </>
  )
}

// ── Empty State ──

function EmptyState({ onNewWidget }: { onNewWidget: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3">
      <LayoutGrid size={24} className="text-muted-foreground" />
      <span className="text-sm text-muted-foreground">No widgets enabled</span>
      <ActionButton variant="primary" size="sm" onClick={onNewWidget}>
        Create Widget
      </ActionButton>
    </div>
  )
}

// ── Widget Grid (normal mode) ──

function NormalGrid({ enabledWidgets, buildingWidgets, onNewWidget }: {
  enabledWidgets: { id: string; sort_order: number }[]
  buildingWidgets: BuildingWidget[]
  onNewWidget: () => void
}) {
  const expandWidget = useHomeStore(s => s.expandWidget)
  const registry = useHomeStore(s => s.registry)

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
      {enabledWidgets.map(config => {
        const def = registry.find(d => d.id === config.id)
        if (!def) return null
        return (
          <StaticCard
            key={def.id}
            def={def}
            onClick={() => expandWidget(def.id)}
          />
        )
      })}
      {buildingWidgets.map(bw => (
        <BuildingCard key={bw.id} widget={bw} />
      ))}
      <NewWidgetCard onClick={onNewWidget} />
    </div>
  )
}

// ── Widget Grid (edit mode — with drag-and-drop) ──

function EditGrid({ enabledWidgets, onNewWidget }: {
  enabledWidgets: { id: string; sort_order: number }[]
  onNewWidget: () => void
}) {
  const reorderWidgets = useHomeStore(s => s.reorderWidgets)
  const registry = useHomeStore(s => s.registry)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )
  const [activeDragId, setActiveDragId] = useState<string | null>(null)

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveDragId(String(event.active.id))
  }, [])

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      reorderWidgets(String(active.id), String(over.id))
    }
  }, [reorderWidgets])

  const handleDragEnd = useCallback((_event: DragEndEvent) => {
    setActiveDragId(null)
  }, [])

  const handleDragCancel = useCallback(() => {
    setActiveDragId(null)
  }, [])

  const activeDragDef = activeDragId
    ? registry.find(d => d.id === activeDragId)
    : null

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
        {enabledWidgets.map(config => {
          const def = registry.find(d => d.id === config.id)
          if (!def) return null
          return (
            <EditModeCard
              key={def.id}
              def={def}
              sortOrder={config.sort_order}
            />
          )
        })}
        <NewWidgetCard onClick={onNewWidget} />
      </div>
      <DragOverlay dropAnimation={null} modifiers={[snapCenterToCursor]}>
        {activeDragDef && (
          <div className="bg-card border border-[var(--color-accent)] rounded-md flex flex-col shadow-lg opacity-95 w-[300px]">
            <CompactCardContent def={activeDragDef} editMode />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}

function HomePill({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'agent' | 'attention' | 'danger' | 'project' }) {
  return (
    <span className={cn(
      'inline-flex items-center rounded-full border px-2 py-0.5 type-caption font-semibold whitespace-nowrap',
      tone === 'neutral' && 'bg-[var(--bg-ingrained)] border-[var(--color-border-subtle)] text-muted-foreground',
      tone === 'agent' && 'bg-[var(--entity-agent-bg)] border-[color-mix(in_srgb,var(--entity-agent)_32%,transparent)] text-[color-mix(in_srgb,var(--entity-agent)_86%,var(--color-text))]',
      tone === 'attention' && 'bg-[var(--status-attention-bg)] border-[color-mix(in_srgb,var(--color-status-attention)_32%,transparent)] text-[color-mix(in_srgb,var(--color-status-attention)_86%,var(--color-text))]',
      tone === 'danger' && 'bg-[rgba(224,90,75,0.12)] border-[rgba(224,90,75,0.32)] text-[color-mix(in_srgb,var(--color-red)_86%,var(--color-text))]',
      tone === 'project' && 'bg-[var(--entity-project-bg)] border-[color-mix(in_srgb,var(--entity-project)_30%,transparent)] text-[color-mix(in_srgb,var(--entity-project)_86%,var(--color-text))]',
    )}>
      {children}
    </span>
  )
}

function HomeModule({
  title,
  description,
  meta,
  defaultOpen,
  editMode,
  wide,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onToggleWide,
  children,
}: {
  title: string
  description: string
  meta?: ReactNode
  defaultOpen?: boolean
  editMode?: boolean
  wide?: boolean
  canMoveUp?: boolean
  canMoveDown?: boolean
  onMoveUp?: () => void
  onMoveDown?: () => void
  onToggleWide?: () => void
  children: ReactNode
}) {
  const [open, setOpen] = useState(!!defaultOpen)

  return (
    <details
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
      className={cn(
        'group rounded-lg border border-[var(--color-border-subtle)]',
        'bg-[color-mix(in_srgb,var(--bg-card)_72%,transparent)]',
        'open:bg-[color-mix(in_srgb,var(--bg-card)_92%,transparent)]',
        'open:border-[var(--color-border)] overflow-hidden',
        'transition-[border-color,background-color] duration-150',
        wide && 'xl:col-span-2',
      )}
    >
      <summary className="list-none cursor-pointer select-none min-h-[58px] px-3 py-2.5 grid grid-cols-[20px_minmax(0,1fr)_auto] items-center gap-3 [&::-webkit-details-marker]:hidden">
        <ChevronRight
          size={15}
          className="text-muted-foreground transition-transform duration-150 group-open:rotate-90"
        />
        <span className="min-w-0">
          <span className="block type-body-sm font-semibold text-foreground truncate">{title}</span>
          <span className="block type-micro text-muted-foreground truncate">{description}</span>
        </span>
        <span className="flex items-center gap-1.5 flex-wrap justify-end">
          {meta}
          {editMode && (
            <>
              <button
                type="button"
                disabled={!canMoveUp}
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  onMoveUp?.()
                }}
                className="h-6 w-6 inline-grid place-items-center rounded border border-[var(--color-border-subtle)] bg-[var(--bg-ingrained)] text-muted-foreground disabled:opacity-35 disabled:cursor-default hover:text-foreground"
                title="Move module up"
              >
                <ArrowUp size={12} />
              </button>
              <button
                type="button"
                disabled={!canMoveDown}
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  onMoveDown?.()
                }}
                className="h-6 w-6 inline-grid place-items-center rounded border border-[var(--color-border-subtle)] bg-[var(--bg-ingrained)] text-muted-foreground disabled:opacity-35 disabled:cursor-default hover:text-foreground"
                title="Move module down"
              >
                <ArrowDown size={12} />
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  onToggleWide?.()
                }}
                className="h-6 w-6 inline-grid place-items-center rounded border border-[var(--color-border-subtle)] bg-[var(--bg-ingrained)] text-muted-foreground hover:text-foreground"
                title={wide ? 'Use compact width' : 'Use wide width'}
              >
                {wide ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
              </button>
            </>
          )}
        </span>
      </summary>
      <div className="px-3 pb-3">
        {children}
      </div>
    </details>
  )
}

// ── Home Screen (main export) ──

export function HomeScreen() {
  const initWidgets = useHomeStore(s => s.initWidgets)
  const loadDynamicWidgets = useHomeStore(s => s.loadDynamicWidgets)
  const widgets = useHomeStore(s => s.widgets)
  const expandedWidgetId = useHomeStore(s => s.expandedWidgetId)
  const registry = useHomeStore(s => s.registry)
  const editMode = useHomeStore(s => s.editMode)
  const toggleEditMode = useHomeStore(s => s.toggleEditMode)
  const openManageModal = useHomeStore(s => s.openManageModal)
  const buildingWidgets = useHomeStore(s => s.buildingWidgets)
  const addBuildingWidget = useHomeStore(s => s.addBuildingWidget)
  const removeBuildingWidget = useHomeStore(s => s.removeBuildingWidget)
  const sessionStatuses = useSessionStore(s => s.sessionStatuses)
  const sessions = useSessionStore(s => s.sessions)
  const pendingCount = usePMStore(s => s.pendingCount)
  const blockingCount = usePMStore(s => s.blockingCount)
  const availableProjects = usePMStore(s => s.availableProjects)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [homeLayout, setHomeLayout] = useState<HomeModuleLayout>(() => readHomeModuleLayout())

  useEffect(() => {
    initWidgets()
    loadDynamicWidgets()
  }, [initWidgets, loadDynamicWidgets])

  // Auto-refresh: when a building widget's agent session ends, reload registry
  useEffect(() => {
    for (const bw of buildingWidgets) {
      const status = sessionStatuses[bw.sessionName]
      if (status === 'ended') {
        removeBuildingWidget(bw.id)
        // Reload dynamic widgets after a short delay for build/restart to finish
        setTimeout(() => loadDynamicWidgets(), 2000)
      }
    }
  }, [buildingWidgets, sessionStatuses, removeBuildingWidget, loadDynamicWidgets])

  const handleWidgetCreated = (id: string, sessionName: string, title: string, icon: string) => {
    addBuildingWidget({ id, title, icon, sessionName })
    setShowCreateForm(false)
  }

  const updateHomeLayout = useCallback((updater: (layout: HomeModuleLayout) => HomeModuleLayout) => {
    setHomeLayout(current => {
      const next = updater(current)
      writeHomeModuleLayout(next)
      return next
    })
  }, [])

  const moveHomeModule = useCallback((id: HomeModuleId, direction: -1 | 1) => {
    updateHomeLayout(layout => {
      const order = normalizeHomeModuleOrder(layout.order)
      const index = order.indexOf(id)
      const nextIndex = index + direction
      if (index < 0 || nextIndex < 0 || nextIndex >= order.length) return layout
      const nextOrder = [...order]
      const [item] = nextOrder.splice(index, 1)
      if (!item) return layout
      nextOrder.splice(nextIndex, 0, item)
      return { ...layout, order: nextOrder }
    })
  }, [updateHomeLayout])

  const toggleHomeModuleWide = useCallback((id: HomeModuleId) => {
    updateHomeLayout(layout => {
      const wide = new Set(layout.wide)
      if (wide.has(id)) wide.delete(id)
      else wide.add(id)
      return { ...layout, wide: HOME_MODULE_ORDER.filter(moduleId => wide.has(moduleId)) }
    })
  }, [updateHomeLayout])

  // Enabled widgets sorted by sort_order
  const enabledWidgets = [...widgets]
    .filter(w => w.enabled)
    .sort((a, b) => a.sort_order - b.sort_order)

  const liveAgentCount = sessions.filter(s =>
    s.status !== 'dead' &&
    s.status !== 'ended' &&
    !s.name.startsWith('helper_') &&
    !(s.agent_role && HIDDEN_AGENT_ROLES.has(s.agent_role))
  ).length

  // Detail view for expanded widget
  const expandedDef = expandedWidgetId
    ? registry.find(d => d.id === expandedWidgetId)
    : null

  const homeModuleOrder = normalizeHomeModuleOrder(homeLayout.order)
  const wideModules = new Set(homeLayout.wide)

  const renderHomeModule = (moduleId: HomeModuleId, index: number) => {
    const moduleProps = {
      editMode,
      wide: wideModules.has(moduleId),
      canMoveUp: index > 0,
      canMoveDown: index < homeModuleOrder.length - 1,
      onMoveUp: () => moveHomeModule(moduleId, -1),
      onMoveDown: () => moveHomeModule(moduleId, 1),
      onToggleWide: () => toggleHomeModuleWide(moduleId),
    }

    switch (moduleId) {
      case 'widgets':
        return (
          <HomeModule
            key={moduleId}
            title={editMode ? 'Widgets — Editing' : 'Widgets'}
            description="Pinned instruments and custom home tools."
            defaultOpen
            meta={
              <>
                <HomePill>{enabledWidgets.length + buildingWidgets.length} visible</HomePill>
                {!editMode && <HomePill>Customize</HomePill>}
              </>
            }
            {...moduleProps}
          >
            {showCreateForm && (
              <NewWidgetForm
                onClose={() => setShowCreateForm(false)}
                onCreated={handleWidgetCreated}
              />
            )}

            {enabledWidgets.length === 0 && buildingWidgets.length === 0 && !showCreateForm ? (
              <EmptyState onNewWidget={() => setShowCreateForm(true)} />
            ) : editMode ? (
              <EditGrid enabledWidgets={enabledWidgets} onNewWidget={() => setShowCreateForm(true)} />
            ) : (
              <NormalGrid
                enabledWidgets={enabledWidgets}
                buildingWidgets={buildingWidgets}
                onNewWidget={() => setShowCreateForm(true)}
              />
            )}
          </HomeModule>
        )
      case 'handoffs':
        return (
          <HomeModule
            key={moduleId}
            title="Agent Handoffs"
            description="Agent sessions that may need user review or a workspace jump."
            defaultOpen
            meta={
              <>
                <HomePill tone="agent">{liveAgentCount} agents</HomePill>
                {(blockingCount > 0 || pendingCount > 0) && (
                  <HomePill tone="attention">{blockingCount || pendingCount} need user</HomePill>
                )}
              </>
            }
            {...moduleProps}
          >
            <ActiveAgents
              readOnly
              compactMode
              suppressGroupHeaders
              emptyState={
                <div className="type-micro text-muted-foreground italic py-2">
                  No active agent handoffs.
                </div>
              }
            />
          </HomeModule>
        )
      case 'projects':
        return (
          <HomeModule
            key={moduleId}
            title="Projects"
            description="Recent project records and task hierarchy entry points."
            meta={<HomePill tone="project">{availableProjects.length} projects</HomePill>}
            {...moduleProps}
          >
            <ProjectCards showHeader={false} />
          </HomeModule>
        )
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header bar — hidden when viewing detail */}
      {!expandedDef && (
        <div className="flex items-center gap-2 px-4 pt-1 pb-2">
          <span className="type-body-sm font-semibold text-foreground flex-1">
            {editMode ? 'Editing' : 'Home'}
          </span>
          {editMode ? (
            <>
              <ActionButton variant="secondary" size="sm" onClick={openManageModal}>
                Show/Hide
              </ActionButton>
              <ActionButton variant="primary" size="sm" onClick={toggleEditMode}>
                <Check size={12} /> Done
              </ActionButton>
            </>
          ) : (
            <IconButton variant="ghost" size="sm" onClick={toggleEditMode} title="Edit widgets">
              <Pencil size={14} />
            </IconButton>
          )}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {expandedDef ? (
          <DetailView def={expandedDef} />
        ) : (
          <>
            <section className="mb-3 flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0">
                <h1 className="type-title-lg text-foreground m-0">
                  {editMode ? 'Arrange modules' : 'Today'}
                </h1>
                <p className="type-caption text-muted-foreground mt-1">
                  {pendingCount + blockingCount > 0
                    ? `${pendingCount + blockingCount} items need attention.`
                    : 'No urgent handoffs right now.'}
                </p>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {availableProjects.slice(0, 4).map(project => (
                  <button
                    key={project.id}
                    onClick={() => { void usePMStore.getState().openProject(project.id) }}
                    className="inline-flex items-center gap-1.5 h-7 px-2 rounded-full border border-[var(--color-border-subtle)] bg-[var(--bg-ingrained)] text-muted-foreground hover:text-foreground hover:border-[var(--color-border)] transition-colors type-caption font-semibold"
                  >
                    <PMStatusDot status={project.status} />
                    <span className="max-w-[150px] truncate">{project.title}</span>
                  </button>
                ))}
                {availableProjects.length > 4 && (
                  <HomePill tone="project">+{availableProjects.length - 4} more</HomePill>
                )}
              </div>
            </section>

            <section className="mb-4 rounded-lg border border-[rgba(110,149,246,0.22)] bg-[color-mix(in_srgb,var(--bg-card)_86%,transparent)] p-3">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={14} className="text-accent" />
                <div className="min-w-0 flex-1">
                  <h2 className="type-body-sm font-semibold text-foreground m-0">Command Bar</h2>
                  <p className="type-micro text-muted-foreground">Search, jump, dispatch, or ask for status.</p>
                </div>
                <HomePill>Home context</HomePill>
              </div>
              <GlobalSearchTrigger onClick={() => {
                document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, ctrlKey: true }))
              }} />
              <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                <HomePill>Summarize blockers</HomePill>
                <HomePill>Spawn from current project</HomePill>
                <HomePill>Find files</HomePill>
              </div>
            </section>

            <OnboardingChecklist />

            <div className="grid grid-cols-1 xl:grid-cols-2 auto-rows-min gap-3">
              {homeModuleOrder.map((moduleId, index) => renderHomeModule(moduleId, index))}
            </div>
          </>
        )}
      </div>

      <ManageWidgetsModal />
    </div>
  )
}
