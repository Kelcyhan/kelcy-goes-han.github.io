import { useState, useRef, useEffect, useCallback, useMemo, type MouseEvent as ReactMouseEvent } from 'react'
import { Play, MessageSquare, Bot, Square, Plus, ChevronLeft, ChevronDown, ChevronRight, Search, Loader2, X, ExternalLink, RotateCcw, Zap } from 'lucide-react'
import { useSessionStore, extractProjectFromWorkingDir } from '@/stores/session-store.ts'
import { usePMStore } from '@/stores/pm-store.ts'
import { buildTaskFolderPath, normalizeVaultPath } from '@/lib/paths.ts'
import { useTabStore } from '@/stores/tab-store.ts'
import { StatusDot, ActionButton, PMBadge, SegmentedControl } from '@/components/primitives'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover.tsx'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select.tsx'
import { ModelSelect, RuntimeToggle, fetchInteractiveDefaultsForSurface } from '@/components/pm/shared.tsx'
import { Button } from '@/components/ui/button.tsx'
import { formatTokens } from '@/lib/markdown.ts'
import { MessageResponse } from '@/components/ai-elements/message.tsx'
import { isVaultPath } from '@/lib/clickable-code.ts'
import * as api from '@/lib/api.ts'
import type { Session, PastAgent, SessionCard } from '@/lib/types.ts'
import { useNewSessionGate } from '@/components/auth/useNewSessionGate.ts'

// ── Helpers ──────────────────────────────────────────────────────────

type DotVariant = 'working' | 'idle' | 'waiting' | 'unknown' | 'done' | 'todo'

function statusToVariant(status?: string): DotVariant {
  if (status === 'working') return 'working'
  if (status === 'idle') return 'idle'
  if (status === 'waiting_input') return 'waiting'
  return 'unknown'
}

function statusPriority(status?: string): number {
  if (status === 'waiting_input') return 0
  if (status === 'working') return 1
  if (status === 'idle') return 2
  return 3
}

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^\s*[-*]\s+/gm, '')
    .replace(/\|/g, ' ')
    .replace(/---+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function getProjectBadge(session: Session, vaultRoot: string | null): string | null {
  return extractProjectFromWorkingDir(session.working_dir, vaultRoot)
}

function getSessionTokens(session: Session): number {
  return (session.total_input_tokens ?? 0) + (session.total_output_tokens ?? 0)
}

function sortByPriority(sessions: Session[]): Session[] {
  return [...sessions].sort((a, b) => statusPriority(a.status) - statusPriority(b.status))
}

/** Get glance text: prefer shadow card glance > task_title > session name */
function getGlance(session: Session, card?: SessionCard): string {
  return card?.glance || session.task_title || session.name
}

/** Get summary text: prefer shadow card summary > final_message */
function getSummary(session: Session, card?: SessionCard): string | null {
  if (card?.summary) return card.summary
  if (session.final_message) return stripMarkdown(session.final_message).slice(0, 150)
  return null
}

// ── Compact View ─────────────────────────────────────────────────────

export function AgentsCompact() {
  const allSessions = useSessionStore(s => s.sessions)
  const sessions = allSessions.filter(s => !s.name.startsWith('helper_'))
  const groups = useSessionStore(s => s.groups)
  void useSessionStore(s => s.vaultRoot)
  const cards = usePMStore(s => s.sessionCards)

  // Filter to top-level sessions (hide group children)
  const grouped = new Set<string>()
  for (const g of Object.values(groups)) {
    for (const name of g.sessions) {
      if (name !== g.anchorSession) grouped.add(name)
    }
  }
  const topLevel = sessions.filter(s => !grouped.has(s.name))
  const sorted = sortByPriority(topLevel)

  const workingCount = sessions.filter(s => s.status === 'working').length
  const waitingCount = sessions.filter(s => s.status === 'waiting_input').length
  const idleCount = sessions.filter(s => s.status === 'idle').length
  const totalTokens = sessions.reduce((sum, s) => sum + getSessionTokens(s), 0)

  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-4 gap-1">
        <span className="type-micro text-muted-foreground">No active agents</span>
        <span className="type-caption text-muted-foreground">Click to spawn one</span>
      </div>
    )
  }

  const MAX_ROWS = 5
  const shownSessions = sorted.slice(0, MAX_ROWS)
  const overflowCount = topLevel.length - shownSessions.length

  return (
    <div className="flex flex-col gap-1.5">
      {/* Fleet bar */}
      <div className="flex items-center gap-2 type-caption text-muted-foreground mb-0.5">
        {workingCount > 0 && <span className="flex items-center gap-1"><StatusDot status="working" size="sm" /> {workingCount}</span>}
        {waitingCount > 0 && <span className="flex items-center gap-1 text-orange font-medium"><StatusDot status="waiting" size="sm" /> {waitingCount}</span>}
        {idleCount > 0 && <span className="flex items-center gap-1"><StatusDot status="idle" size="sm" /> {idleCount}</span>}
        <span className="ml-auto">{totalTokens > 0 ? formatTokens(totalTokens) + ' tokens' : ''}</span>
      </div>

      {/* Agent rows — glance text + duration */}
      {shownSessions.map(s => {
        const card = cards[s.name]
        const glance = getGlance(s, card)
        const isWaiting = s.status === 'waiting_input'
        const isWrapping = useSessionStore.getState().isWrappingUp(s)
        const variant = statusToVariant(s.status)

        return (
          <div key={s.name} className="flex items-center gap-1.5">
            <StatusDot status={variant} size="sm" wrapping={isWrapping} className="shrink-0" />
            <span className={`type-micro truncate flex-1 ${isWaiting ? 'text-orange font-medium' : ''}`}>
              {glance}
            </span>
            {s.turns != null && (
              <span className="type-caption font-mono text-muted-foreground shrink-0">
                {s.turns}t
              </span>
            )}
          </div>
        )
      })}

      {overflowCount > 0 && (
        <span className="type-caption text-muted-foreground text-right">+{overflowCount} more</span>
      )}
    </div>
  )
}

// ── Detail View ──────────────────────────────────────────────────────

export function AgentsDetail() {
  const sessions = useSessionStore(s => s.sessions).filter(s => !s.name.startsWith('helper_'))
  const groups = useSessionStore(s => s.groups)
  const vaultRoot = useSessionStore(s => s.vaultRoot)
  const cards = usePMStore(s => s.sessionCards)
  const [openCard, setOpenCard] = useState<string | null>(null)
  const [openTab, setOpenTab] = useState<'summary' | 'activity'>('summary')

  // Fetch cards on mount if not already loaded
  useEffect(() => {
    if (Object.keys(usePMStore.getState().sessionCards).length === 0) {
      api.fetchSessionCards().then(data => usePMStore.setState({ sessionCards: data.cards })).catch(() => {})
    }
  }, [])

  // Filter to top-level sessions
  const grouped = new Set<string>()
  for (const g of Object.values(groups)) {
    for (const name of g.sessions) {
      if (name !== g.anchorSession) grouped.add(name)
    }
  }
  const topLevel = sessions.filter(s => !grouped.has(s.name))
  const sorted = sortByPriority(topLevel)

  // Fleet metrics
  const workingCount = sessions.filter(s => s.status === 'working').length
  const waitingCount = sessions.filter(s => s.status === 'waiting_input').length
  const idleCount = sessions.filter(s => s.status === 'idle').length
  const totalTokens = sessions.reduce((sum, s) => sum + getSessionTokens(s), 0)

  const handleCardClick = useCallback((name: string) => {
    if (openCard === name) {
      setOpenCard(null)
    } else {
      setOpenCard(name)
      setOpenTab('summary')
    }
  }, [openCard])

  const handleTabClick = useCallback((name: string, tab: 'summary' | 'activity') => {
    setOpenCard(name)
    setOpenTab(tab)
  }, [])

  return (
    <div className="flex flex-col gap-4" onClick={(e) => {
      // Click outside cards → close
      if ((e.target as HTMLElement).closest('[data-agent-card]')) return
      setOpenCard(null)
    }}>
      {/* Fleet bar + spawn */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 type-micro text-muted-foreground">
          {workingCount > 0 && <span className="flex items-center gap-1"><StatusDot status="working" size="sm" /> {workingCount} working</span>}
          {waitingCount > 0 && <span className="flex items-center gap-1 text-orange font-medium"><StatusDot status="waiting" size="sm" /> {waitingCount} waiting</span>}
          {idleCount > 0 && <span className="flex items-center gap-1"><StatusDot status="idle" size="sm" /> {idleCount} idle</span>}
          {totalTokens > 0 && <span className="ml-1">{formatTokens(totalTokens)} tokens</span>}
        </div>
        <SpawnPopover />
      </div>

      {/* Agent card grid */}
      {sessions.length === 0 ? (
        <div className="type-micro text-muted-foreground italic py-8 text-center">
          No active agents — use "+ New Agent" to spawn one
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3">
          {sorted.map(s => {
            const group = Object.values(groups).find(g => g.anchorSession === s.name)
            const children = group
              ? group.sessions.filter(n => n !== s.name).map(n => sessions.find(ss => ss.name === n)).filter(Boolean) as Session[]
              : []
            return (
              <div key={s.name} className="relative" style={{ zIndex: openCard === s.name ? 100 : undefined }}>
                <LiveAgentCard
                  session={s}
                  project={getProjectBadge(s, vaultRoot)}
                  children={children}
                  card={cards[s.name]}
                  isOpen={openCard === s.name}
                  activeTab={openTab}
                  onClickBody={() => handleCardClick(s.name)}
                  onClickTab={(tab) => handleTabClick(s.name, tab)}
                />
              </div>
            )
          })}
        </div>
      )}

      {/* Separator */}
      <div className="border-t border-[var(--color-border-subtle)]" />

      {/* Past agents */}
      <PastAgentsSection />
    </div>
  )
}

// ── Live Agent Card ──────────────────────────────────────────────────

function LiveAgentCard({
  session,
  project,
  children,
  card,
  isOpen,
  activeTab,
  onClickBody,
  onClickTab,
}: {
  session: Session
  project: string | null
  children: Session[]
  card?: SessionCard
  isOpen: boolean
  activeTab: 'summary' | 'activity'
  onClickBody: () => void
  onClickTab: (tab: 'summary' | 'activity') => void
}) {
  const isWrapping = useSessionStore(s => s.isWrappingUp(session))
  const wrapupAge = useSessionStore(s => s.wrapupAgeSeconds(session))
  const canForceClose = isWrapping && wrapupAge !== null && wrapupAge > 180
  const doKillSession = useSessionStore(s => s.doKillSession)
  const variant = statusToVariant(session.status)

  // Tick every second so the force-close affordance appears past 180s
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!isWrapping) return
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [isWrapping])
  const isWaiting = session.status === 'waiting_input'
  const glance = getGlance(session, card)
  const summary = getSummary(session, card)
  const role = session.agent_role || 'agent'
  const totalTokens = getSessionTokens(session)

  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation()
    useSessionStore.getState().setActiveSession(session.name)
    useTabStore.getState().openAgentTab(session.name)
  }

  const handleWrapup = (e: React.MouseEvent) => {
    e.stopPropagation()
    doKillSession(session.name)
  }

  return (
    <div
      data-agent-card
      className={`rounded-md border transition-all duration-150 ${
        isWaiting
          ? 'border-l-[3px] border-l-orange border-orange/30 bg-orange/5'
          : 'border-border hover:border-[var(--color-accent)]'
      } ${isOpen ? 'shadow-[0_10px_36px_rgba(0,0,0,0.13),0_3px_10px_rgba(0,0,0,0.05)]' : 'hover:shadow-[0_2px_8px_rgba(0,0,0,0.08)]'}`}
      style={isOpen ? { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100 } : undefined}
    >
      {/* Card body — clickable */}
      <div className="cursor-pointer p-2.5" onClick={onClickBody}>
        {/* Title row */}
        <div className="flex items-center gap-1.5">
          <StatusDot status={variant} size="sm" wrapping={isWrapping} className="shrink-0" />
          <span className="type-label font-semibold truncate flex-1">{glance}</span>
          {isWrapping && (
            <span className="type-caption text-[var(--color-accent)] opacity-80 shrink-0">
              {canForceClose ? `stuck \u00B7 ${wrapupAge}s` : 'wrapping\u2026'}
            </span>
          )}
          {project && <span className="type-caption font-mono text-muted-foreground shrink-0">{project}</span>}
          <button
            className="text-muted-foreground hover:text-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity bg-transparent border-none cursor-pointer p-0"
            onClick={handleOpen}
            title="Open in workspace"
            style={{ opacity: isOpen ? 1 : undefined }}
          >
            <ExternalLink size={12} />
          </button>
        </div>
        {/* Meta row */}
        <div className="type-caption text-muted-foreground mt-0.5 pl-[14px]">
          {role}
          {session.turns != null && <> · {session.turns} turns</>}
          {totalTokens > 0 && <> · {formatTokens(totalTokens)}</>}
          {session.task_id && <> · {session.task_id}</>}
        </div>
        {/* Summary — 2 lines */}
        {summary && (
          <div className={`type-micro mt-1.5 pl-[14px] line-clamp-2 leading-relaxed ${isWaiting ? 'text-foreground' : 'text-muted-foreground'}`}>
            {summary}
          </div>
        )}
      </div>

      {/* Group children (if any) */}
      {children.length > 0 && (
        <div className="border-t border-[var(--color-border-subtle)] px-2.5 py-1.5 flex flex-col gap-1">
          {children.map(child => {
            const childVariant = statusToVariant(child.status)
            const childRole = child.agent_role || 'agent'
            return (
              <div key={child.name} className="flex items-center gap-1.5 pl-3 py-0.5 type-caption text-muted-foreground">
                <StatusDot status={childVariant} size="sm" className="shrink-0" />
                <span>{childRole}</span>
                {child.turns != null && <span>· {child.turns}t</span>}
              </div>
            )
          })}
        </div>
      )}

      {/* Expand panel */}
      <div
        className="overflow-hidden transition-all duration-300"
        style={{
          maxHeight: isOpen ? 600 : 0,
          opacity: isOpen ? 1 : 0,
        }}
      >
        {isOpen && activeTab === 'summary' && (
          <SummaryPanel session={session} card={card} isWaiting={isWaiting} onOpen={handleOpen} onWrapup={handleWrapup} isWrapping={isWrapping} canForceClose={canForceClose} />
        )}
        {isOpen && activeTab === 'activity' && (
          <ActivityPanel session={session} card={card} />
        )}
      </div>

      <SegmentedControl
        variant="flatTabs"
        radius="bottom"
        value={isOpen ? activeTab : undefined}
        stopPropagation
        items={[
          { id: 'summary', label: 'Summary' },
          { id: 'activity', label: 'Activity' },
        ]}
        onValueChange={(id) => onClickTab(id as 'summary' | 'activity')}
      />
    </div>
  )
}

// ── Summary Panel ────────────────────────────────────────────────────

function SummaryPanel({ session, card, isWaiting, onOpen, onWrapup, isWrapping, canForceClose }: {
  session: Session
  card?: SessionCard
  isWaiting: boolean
  onOpen: (e: React.MouseEvent) => void
  onWrapup: (e: React.MouseEvent) => void
  isWrapping: boolean
  canForceClose: boolean
}) {
  return (
    <div className="px-3 py-2.5 border-t border-[var(--color-border-subtle)] flex flex-col gap-2.5">
      {/* Waiting message */}
      {isWaiting && session.final_message && (
        <div>
          <div className="type-caption font-semibold text-orange uppercase tracking-wider mb-1">Waiting for</div>
          <div className="type-micro leading-relaxed text-foreground italic">
            "{stripMarkdown(session.final_message).slice(0, 200)}"
          </div>
        </div>
      )}

      {/* Progress */}
      {card && card.progress.length > 0 && (
        <div>
          <div className="type-caption font-semibold text-muted-foreground uppercase tracking-wider mb-1">Progress</div>
          <ul className="list-none space-y-0.5 type-micro text-muted-foreground leading-relaxed">
            {card.progress.slice(-5).map((item, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <span className="text-muted-foreground shrink-0 mt-[3px]">·</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Status */}
      {card?.status && (
        <div>
          <div className="type-caption font-semibold text-muted-foreground uppercase tracking-wider mb-1">Status</div>
          <div className="type-micro text-muted-foreground leading-relaxed">{card.status}</div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        <ActionButton variant="primary" size="sm" onClick={onOpen}>
          <ExternalLink size={12} /> Open
        </ActionButton>
        {!isWrapping && (
          <ActionButton variant="secondary" size="sm" onClick={onWrapup}>
            <Square size={12} /> Wrapup
          </ActionButton>
        )}
        {isWrapping && !canForceClose && (
          <span className="type-caption text-muted-foreground italic">Wrapping up…</span>
        )}
        {canForceClose && (
          <ActionButton
            variant="secondary"
            size="sm"
            onClick={(e) => { e.stopPropagation(); api.killSession(session.name).catch(() => {}) }}
          >
            <Zap size={12} /> Force Close
          </ActionButton>
        )}
      </div>
    </div>
  )
}

// ── Activity Panel ───────────────────────────────────────────────────

function ActivityPanel({ session, card: _card }: { session: Session; card?: SessionCard }) {
  const openDocTab = useTabStore(s => s.openDocTab)
  const vaultRoot = useSessionStore(s => s.vaultRoot)
  const tools = session.tools_used || []
  const toolCounts = new Map<string, number>()
  for (const t of tools) {
    toolCounts.set(t, (toolCounts.get(t) || 0) + 1)
  }

  const messageComponents = useMemo(() => ({
    a: ({ href, children, ...props }: any) => {
      const hrefBase = href?.split('#')[0] ?? ''
      const normalized = hrefBase ? normalizeVaultPath(hrefBase, vaultRoot) : ''
      if (href && normalized && isVaultPath(normalized)) {
        return (
          <a
            href="#"
            className="file-link"
            onClick={(e) => {
              e.preventDefault()
              void openDocTab(normalized, e.ctrlKey || e.metaKey)
            }}
            {...props}
          >📄 {children}</a>
        )
      }
      return <a href={href} target="_blank" rel="noopener" {...props}>{children}</a>
    },
  }), [openDocTab, vaultRoot])

  const handleMessageClick = useCallback((e: ReactMouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement
    if (target.tagName !== 'CODE' || target.dataset.streamdown !== 'inline-code') return
    const text = target.textContent?.trim() ?? ''
    const normalized = normalizeVaultPath(text, vaultRoot)
    if (!isVaultPath(normalized)) return
    e.preventDefault()
    void openDocTab(normalized, e.ctrlKey || e.metaKey)
  }, [openDocTab, vaultRoot])

  return (
    <div className="px-3 py-2.5 border-t border-[var(--color-border-subtle)] flex flex-col gap-2.5">
      {/* Latest response */}
      {session.final_message && (
        <div>
          <div className="type-caption font-semibold text-muted-foreground uppercase tracking-wider mb-1">Latest Response</div>
          <div className="type-micro leading-relaxed text-muted-foreground max-h-[180px] overflow-y-auto" onClick={handleMessageClick}>
            <MessageResponse components={messageComponents}>{session.final_message}</MessageResponse>
          </div>
        </div>
      )}

      {/* Tools used */}
      {toolCounts.size > 0 && (
        <div>
          <div className="type-caption font-semibold text-muted-foreground uppercase tracking-wider mb-1">Tools Used</div>
          <div className="flex flex-wrap gap-1">
            {Array.from(toolCounts.entries()).map(([tool, count]) => (
              <span key={tool} className="type-caption bg-[var(--bg-card)] border border-[var(--color-border-subtle)] rounded px-1.5 py-0.5 text-muted-foreground">
                {tool}{count > 1 ? ` ×${count}` : ''}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Spawn Popover ────────────────────────────────────────────────────

type SpawnStep = 'type' | 'concierge' | 'project' | 'task'

function SpawnPopover() {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<SpawnStep>('type')
  const [model, setModel] = useState('default')
  const [runtime, setRuntime] = useState<'claude-code' | 'codex'>('claude-code')
  const [defaultModels, setDefaultModels] = useState<Record<'claude-code' | 'codex', string>>({ 'claude-code': 'default', codex: 'default' })
  const [availableModels, setAvailableModels] = useState<Record<'claude-code' | 'codex', { id: string, label: string }[]>>({ 'claude-code': [], codex: [] })
  const [enabledRuntimes, setEnabledRuntimes] = useState<Record<'claude-code' | 'codex', boolean>>({ 'claude-code': true, codex: true })
  const [selectedProject, setSelectedProject] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [taskSearch, setTaskSearch] = useState('')
  const [tasks, setTasks] = useState<api.SearchTask[]>([])
  const [tasksLoading, setTasksLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const projects = usePMStore(s => s.availableProjects)
  const fetchProjects = usePMStore(s => s.fetchProjects)
  const newSessionGate = useNewSessionGate()

  useEffect(() => {
    if (open) {
      fetchProjects()
      setStep('type')
      setModel('default')
      setSelectedProject(null)
      setTaskSearch('')
      setTasks([])
    }
  }, [open, fetchProjects])

  useEffect(() => {
    if (!open) return
    void fetchInteractiveDefaultsForSurface(step === 'type' ? 'concierge' : 'task_agent').then(({ runtime, model, defaultModels, availableModels, enabledRuntimes }) => {
      setRuntime(runtime)
      setModel(model)
      setDefaultModels(defaultModels)
      setAvailableModels(availableModels)
      setEnabledRuntimes(enabledRuntimes)
    })
  }, [open, step])

  useEffect(() => {
    if (!selectedProject) return
    setTasksLoading(true)
    api.searchTasks(selectedProject, { limit: 20 }).then(data => {
      setTasks(data.tasks)
      setTasksLoading(false)
    }).catch(() => setTasksLoading(false))
  }, [selectedProject])

  const handleTaskSearch = useCallback((q: string) => {
    setTaskSearch(q)
    if (!selectedProject) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setTasksLoading(true)
      api.searchTasks(selectedProject, { q: q.trim() || undefined, limit: 20 }).then(data => {
        setTasks(data.tasks)
        setTasksLoading(false)
      }).catch(() => setTasksLoading(false))
    }, 200)
  }, [selectedProject])

  const handleSpawnConcierge = async () => {
    if (newSessionGate.disabled) return
    setSubmitting(true)
    try {
      const name = await useSessionStore.getState().doCreateSession(
        'Welcome to life!',
        model === 'default' ? undefined : model,
        runtime,
      )
      if (name) {
        useSessionStore.getState().setActiveSession(name)
        useTabStore.getState().openAgentTab(name)
      }
      setOpen(false)
    } finally {
      setSubmitting(false)
    }
  }

  const handleSpawnTaskAgent = async (taskPath?: string) => {
    if (!selectedProject) return
    if (newSessionGate.disabled) return
    setSubmitting(true)
    try {
      const workingDir = taskPath || `projects/${selectedProject}`
      const result = await api.spawnTaskAgent({
        working_dir: workingDir,
        model: model === 'default' ? undefined : model,
        conversation: true,
        runtime: runtime,
        surface: 'task_agent',
      })
      useSessionStore.getState().setActiveSession(result.session_name)
      useTabStore.getState().openAgentTab(result.session_name)
      setOpen(false)
    } catch (err) {
      console.error('Failed to spawn agent:', err)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <ActionButton variant="secondary" size="sm">
          <Plus size={12} /> New Agent
        </ActionButton>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="end">
        {step === 'type' && (
          <div className="flex flex-col gap-2">
            <h4 className="type-body-sm font-semibold">New Agent</h4>
            <button
              className="flex items-center gap-2 p-2 rounded-md border border-border hover:border-accent hover:bg-accent/5 cursor-pointer transition-colors bg-transparent text-left"
              onClick={() => setStep('concierge')}
            >
              <MessageSquare size={14} className="text-accent shrink-0" />
              <div>
                <div className="type-label font-medium">Concierge</div>
                <div className="type-caption text-muted-foreground">General conversation</div>
              </div>
            </button>
            <button
              className="flex items-center gap-2 p-2 rounded-md border border-border hover:border-accent hover:bg-accent/5 cursor-pointer transition-colors bg-transparent text-left"
              onClick={() => setStep('project')}
            >
              <Bot size={14} className="text-accent shrink-0" />
              <div>
                <div className="type-label font-medium">Task Agent</div>
                <div className="type-caption text-muted-foreground">Work on a specific task</div>
              </div>
            </button>
          </div>
        )}

        {step === 'concierge' && (
          <div className="flex flex-col gap-3">
            <button
              className="flex items-center gap-1 type-micro text-muted-foreground hover:text-foreground cursor-pointer bg-transparent border-none p-0"
              onClick={() => setStep('type')}
            >
              <ChevronLeft size={12} /> New Concierge
            </button>
            <div className="flex flex-col gap-1.5">
              <label className="type-micro font-medium">Runtime</label>
              <RuntimeToggle value={runtime} onChange={(next) => { setRuntime(next); setModel(defaultModels[next] || 'default') }} enabledRuntimes={enabledRuntimes} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="type-micro font-medium">Model</label>
              <ModelSelect runtime={runtime} value={model} onChange={setModel} options={availableModels[runtime]} includeDefaultOption={false} />
            </div>
            <Button
              size="sm"
              className="w-full"
              onClick={handleSpawnConcierge}
              disabled={submitting || newSessionGate.disabled}
              title={newSessionGate.disabled ? newSessionGate.tooltip : undefined}
            >
              {submitting ? 'Starting…' : 'Start'}
            </Button>
          </div>
        )}

        {step === 'project' && (
          <div className="flex flex-col gap-2">
            <button
              className="flex items-center gap-1 type-micro text-muted-foreground hover:text-foreground cursor-pointer bg-transparent border-none p-0"
              onClick={() => setStep('type')}
            >
              <ChevronLeft size={12} /> New Task Agent
            </button>
            <div className="type-micro font-medium">Project</div>
            {projects.map(p => (
              <button
                key={p.id}
                className="flex items-center gap-2 p-2 rounded-md border border-border hover:border-accent hover:bg-accent/5 cursor-pointer transition-colors bg-transparent text-left"
                onClick={() => { setSelectedProject(p.id); setStep('task') }}
              >
                <span className="type-label font-medium flex-1">{p.title}</span>
                <span className="type-caption text-muted-foreground">{p.status}</span>
              </button>
            ))}
            {projects.length === 0 && (
              <span className="type-micro text-muted-foreground italic">No projects found</span>
            )}
          </div>
        )}

        {step === 'task' && selectedProject && (
          <div className="flex flex-col gap-2">
            <button
              className="flex items-center gap-1 type-micro text-muted-foreground hover:text-foreground cursor-pointer bg-transparent border-none p-0"
              onClick={() => setStep('project')}
            >
              <ChevronLeft size={12} /> {selectedProject}
            </button>
            <input
              type="text"
              placeholder="Search tasks…"
              value={taskSearch}
              onChange={e => handleTaskSearch(e.target.value)}
              className="w-full h-7 px-2 type-micro rounded border border-border bg-transparent outline-none focus:border-accent"
            />
            <div className="max-h-[200px] overflow-y-auto flex flex-col gap-1">
              <button
                className="flex items-center gap-2 p-1.5 rounded hover:bg-accent/5 cursor-pointer bg-transparent border-none text-left w-full"
                onClick={() => handleSpawnTaskAgent()}
              >
                <span className="type-micro text-muted-foreground italic">Project root</span>
              </button>
              {tasksLoading ? (
                <span className="type-caption text-muted-foreground italic py-2 text-center">Loading…</span>
              ) : tasks.map(t => (
                <button
                  key={t.id}
                  className="flex items-center gap-2 p-1.5 rounded hover:bg-accent/5 cursor-pointer bg-transparent border-none text-left w-full"
                  onClick={() => handleSpawnTaskAgent(buildTaskFolderPath(selectedProject, t.id))}
                >
                  <span className="type-caption font-mono text-muted-foreground shrink-0">{t.id}</span>
                  <span className="type-micro truncate flex-1">{t.title}</span>
                  <StatusDot status={t.status === 'done' ? 'done' : t.status === 'executing' ? 'working' : 'todo'} size="sm" />
                </button>
              ))}
              {!tasksLoading && tasks.length === 0 && taskSearch && (
                <span className="type-caption text-muted-foreground italic py-2 text-center">No tasks found</span>
              )}
            </div>
            <div className="border-t border-[var(--color-border-subtle)] pt-2 flex flex-col gap-1.5">
              <label className="type-micro font-medium">Runtime</label>
              <RuntimeToggle value={runtime} onChange={(next) => { setRuntime(next); setModel(defaultModels[next] || 'default') }} enabledRuntimes={enabledRuntimes} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="type-micro font-medium">Model</label>
              <ModelSelect runtime={runtime} value={model} onChange={setModel} options={availableModels[runtime]} includeDefaultOption={false} />
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

// ── Past Agents Section ──────────────────────────────────────────────

const TIME_OPTIONS = [
  { value: '1', label: 'Today' },
  { value: '3', label: '3 days' },
  { value: '7', label: '7 days' },
  { value: '30', label: '30 days' },
]

function groupByDay(agents: PastAgent[]): { label: string; agents: PastAgent[] }[] {
  const groups = new Map<string, PastAgent[]>()
  const today = new Date().toISOString().slice(0, 10)
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)

  for (const a of agents) {
    const key = a.ended || 'Unknown'
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(a)
  }

  return Array.from(groups.entries()).map(([date, items]) => {
    let label = date
    if (date === today) label = 'Today'
    else if (date === yesterday) label = 'Yesterday'
    else {
      const d = new Date(date + 'T00:00:00')
      if (!isNaN(d.getTime())) {
        label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      }
    }
    return { label: `${label} (${items.length})`, agents: items }
  })
}

function PastAgentsSection() {
  const [collapsed, setCollapsed] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [projectFilter, setProjectFilter] = useState('all')
  const [timeFilter, setTimeFilter] = useState('7')
  const [agents, setAgents] = useState<PastAgent[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [expandedRow, setExpandedRow] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const projects = usePMStore(s => s.availableProjects)

  const fetchAgents = useCallback((q: string, project: string, days: string) => {
    setLoading(true)
    api.fetchPastAgents({
      days: parseInt(days),
      limit: 50,
      q: q.trim() || undefined,
      project: project === 'all' ? undefined : project,
    }).then(data => {
      setAgents(data.sessions)
      setTotal(data.total)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchAgents(searchQuery, projectFilter, timeFilter)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectFilter, timeFilter, fetchAgents])

  const handleSearch = useCallback((q: string) => {
    setSearchQuery(q)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      fetchAgents(q, projectFilter, timeFilter)
    }, 200)
  }, [fetchAgents, projectFilter, timeFilter])

  const dayGroups = groupByDay(agents)
  const PastChevron = collapsed ? ChevronRight : ChevronDown

  return (
    <div>
      <button
        className="flex items-center gap-1 type-micro font-semibold text-muted-foreground uppercase tracking-wider mb-2 bg-transparent border-none cursor-pointer p-0 hover:text-foreground"
        onClick={() => setCollapsed(c => !c)}
      >
        <PastChevron size={12} /> Past Agents {total > 0 && `(${total})`}
      </button>

      {collapsed ? null : <>
        {/* Search bar + filters */}
        <div className="flex items-center gap-1.5 mb-3">
          <div className="relative flex-1">
            <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search agents…"
              value={searchQuery}
              onChange={e => handleSearch(e.target.value)}
              className="w-full h-7 pl-7 pr-7 type-micro rounded border border-border bg-transparent outline-none focus:border-accent"
            />
            {searchQuery && (
              <button
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground bg-transparent border-none cursor-pointer p-0"
                onClick={() => { setSearchQuery(''); fetchAgents('', projectFilter, timeFilter) }}
              >
                <X size={12} />
              </button>
            )}
          </div>
          <Select value={projectFilter} onValueChange={v => setProjectFilter(v)}>
            <SelectTrigger className="h-7 type-caption w-[100px]">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {projects.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.id}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={timeFilter} onValueChange={v => setTimeFilter(v)}>
            <SelectTrigger className="h-7 type-caption w-[70px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIME_OPTIONS.map(o => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Results */}
        {loading ? (
          <div className="flex items-center justify-center py-4 gap-1.5 text-muted-foreground">
            <Loader2 size={14} className="animate-spin" />
            <span className="type-micro">Searching…</span>
          </div>
        ) : agents.length === 0 ? (
          <div className="type-micro text-muted-foreground italic py-4 text-center">
            {searchQuery || projectFilter !== 'all'
              ? 'No matching agents found.'
              : 'No past agents in this time range.'}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {dayGroups.map(group => (
              <div key={group.label}>
                <div className="type-caption font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                  {group.label}
                </div>
                <div className="flex flex-col gap-0.5">
                  {group.agents.map(a => (
                    <PastAgentRow
                      key={a.session_id}
                      agent={a}
                      isExpanded={expandedRow === a.session_id}
                      onToggle={() => setExpandedRow(expandedRow === a.session_id ? null : a.session_id)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </>}
    </div>
  )
}

// ── Past Agent Row (expand-in-place) ─────────────────────────────────

function PastAgentRow({ agent, isExpanded, onToggle }: { agent: PastAgent; isExpanded: boolean; onToggle: () => void }) {
  // Use shadow glance as title, fall back to task info
  const displayTitle = agent.shadow_glance
    || (agent.task_id ? `${agent.task_id}${agent.task_title ? ` — ${agent.task_title}` : ''}` : agent.role || 'Agent')

  const statusIcon = agent.task_status === 'done' ? 'done'
    : agent.task_status === 'dropped' ? 'error'
    : agent.task_status === 'blocked' ? 'waiting'
    : 'idle' as DotVariant

  const canResume = !!(agent.session_id && agent.working_dir)

  const handleResume = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!agent.session_id || !agent.working_dir) return
    try {
      const result = await api.spawnTaskAgent({
        working_dir: agent.working_dir,
        resume_session_id: agent.session_id,
      })
      useSessionStore.getState().setActiveSession(result.session_name)
      useTabStore.getState().openAgentTab(result.session_name)
    } catch (err) {
      console.error('Failed to resume session:', err)
    }
  }

  const handleViewChat = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!agent.jsonl_path) return
    useTabStore.getState().openAgentTab(agent.name, {
      jsonlPath: agent.jsonl_path,
      readOnly: true,
      sessionUuid: agent.session_id,
      resumeWorkingDir: agent.working_dir ?? undefined,
    })
  }

  // Determine the best summary text
  const summaryText = agent.shadow_summary || agent.summary || null
  const progressItems = agent.shadow_progress || null

  return (
    <div
      className={`rounded-md transition-all cursor-pointer ${
        isExpanded
          ? 'border border-[var(--color-border-subtle)] bg-[var(--bg-card)]'
          : 'hover:bg-accent/5 border border-transparent'
      }`}
      onClick={onToggle}
    >
      {/* Compact row */}
      <div className="flex items-center gap-1.5 p-2">
        <StatusDot status={statusIcon} size="sm" className="shrink-0" />
        <span className="type-micro font-medium truncate flex-1">{displayTitle}</span>
        {agent.task_id && !agent.shadow_glance && (
          <span className="type-caption font-mono text-muted-foreground shrink-0">{agent.task_id}</span>
        )}
        {agent.project_id && <PMBadge>{agent.project_id}</PMBadge>}
        <span className="type-caption text-muted-foreground shrink-0">{agent.task_status || 'ended'}</span>
        <span className="type-caption text-muted-foreground shrink-0">{agent.ended}</span>
      </div>

      {/* Expanded detail */}
      <div
        className="overflow-hidden transition-all duration-300"
        style={{ maxHeight: isExpanded ? 500 : 0, opacity: isExpanded ? 1 : 0 }}
      >
        <div className="px-3 pb-3 pt-1 border-t border-[var(--color-border-subtle)] flex flex-col gap-2">
          {/* Shadow summary */}
          {summaryText && (
            <div>
              <div className="type-caption font-semibold text-muted-foreground uppercase tracking-wider mb-1">Summary</div>
              <div className="type-micro text-muted-foreground leading-relaxed">{summaryText}</div>
            </div>
          )}

          {/* Shadow progress */}
          {progressItems && progressItems.length > 0 && (
            <div>
              <div className="type-caption font-semibold text-muted-foreground uppercase tracking-wider mb-1">Progress</div>
              <ul className="list-none space-y-0.5 type-micro text-muted-foreground leading-relaxed">
                {progressItems.map((item, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="shrink-0 mt-[3px]">·</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Outcome (from receipt) */}
          {agent.outcome && (
            <div>
              <div className="type-caption font-semibold text-muted-foreground uppercase tracking-wider mb-1">Outcome</div>
              <div className="type-micro text-muted-foreground leading-relaxed">{agent.outcome}</div>
            </div>
          )}

          {/* Next step */}
          {agent.next_step && (
            <div>
              <div className="type-caption font-semibold text-muted-foreground uppercase tracking-wider mb-1">Next Step</div>
              <div className="type-micro text-muted-foreground leading-relaxed">{agent.next_step}</div>
            </div>
          )}

          {/* Errors */}
          {agent.errors && (
            <div>
              <div className="type-caption font-semibold text-orange uppercase tracking-wider mb-1">Errors</div>
              <div className="type-micro text-muted-foreground leading-relaxed">{agent.errors}</div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-1">
            {canResume && (
              <ActionButton variant="primary" size="sm" onClick={handleResume}>
                <RotateCcw size={12} /> Resume
              </ActionButton>
            )}
            {agent.jsonl_path ? (
              <ActionButton variant="secondary" size="sm" onClick={handleViewChat}>
                <Play size={12} /> View Chat
              </ActionButton>
            ) : (
              <span className="type-caption text-muted-foreground italic">Chat log not available</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
