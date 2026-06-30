import { useState, useRef, useCallback, useEffect, memo } from 'react'
import {
  ChevronDown, ChevronRight, Search, X, Loader2, RotateCcw, ExternalLink,
} from 'lucide-react'
import type { PastAgent } from '@/lib/types.ts'
import { useSessionStore } from '@/stores/session-store.ts'
import { useTabStore } from '@/stores/tab-store.ts'
import { useChatStore } from '@/stores/chat-store.ts'
import { usePMStore } from '@/stores/pm-store.ts'
import { useHomeLayoutStore } from '@/stores/home-layout-store.ts'
import { StatusDot, PMBadge, GlanceTooltip, SegmentedControl, type GlanceSection } from '@/components/primitives'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select.tsx'
import { ReadOnlyChatContainer } from '@/components/chat/ReadOnlyChatContainer.tsx'
import * as api from '@/lib/api.ts'

type AgentTab = 'summary' | 'chat'

const TIME_OPTIONS = [
  { value: '1', label: 'Today' },
  { value: '3', label: '3d' },
  { value: '7', label: '7d' },
  { value: '30', label: '30d' },
]

function pastTitle(agent: PastAgent): string {
  return agent.display_title
    || agent.shadow_glance
    || (agent.task_id ? `${agent.task_id}${agent.task_title ? ` — ${agent.task_title}` : ''}` : agent.role || 'Agent')
}

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
    return { label, agents: items }
  })
}

// --- Summary panel (mirrors LiveAgentCard SummaryPanel) -----------------

function PastSummaryPanel({ agent }: { agent: PastAgent }) {
  const summaryText = agent.shadow_summary || agent.summary || null
  const progressItems = agent.shadow_progress || null

  return (
    <div className="flex flex-col gap-2">
      {progressItems && progressItems.length > 0 && (
        <ul className="list-disc pl-4 m-0 type-label leading-relaxed text-foreground">
          {progressItems.map((b, i) => (
            <li key={i} className="my-0.5">{b}</li>
          ))}
        </ul>
      )}
      {(!progressItems || progressItems.length === 0) && summaryText && (
        <div className="type-label leading-relaxed text-foreground whitespace-pre-wrap">
          {summaryText}
        </div>
      )}
      {agent.outcome && (
        <div>
          <div className="type-caption font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">Outcome</div>
          <div className="type-micro text-foreground leading-relaxed">{agent.outcome}</div>
        </div>
      )}
      {agent.next_step && (
        <div>
          <div className="type-caption font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">Next Step</div>
          <div className="type-micro text-foreground leading-relaxed">{agent.next_step}</div>
        </div>
      )}
      {agent.errors && (
        <div>
          <div className="type-caption font-semibold text-orange uppercase tracking-wider mb-0.5">Errors</div>
          <div className="type-micro text-foreground leading-relaxed">{agent.errors}</div>
        </div>
      )}
      {agent.deliverables && agent.deliverables.length > 0 && (
        <div>
          <div className="type-caption font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">
            Deliverables ({agent.deliverables.length})
          </div>
          <ul className="list-none m-0 p-0 flex flex-col gap-0.5">
            {agent.deliverables.slice(0, 3).map((d, i) => (
              <li key={i} className="type-micro text-foreground leading-relaxed">
                <span className="font-mono type-caption text-muted-foreground">• </span>
                <span className="font-mono type-caption">{d.path}</span>
                {d.desc && <span className="text-muted-foreground"> — {d.desc}</span>}
              </li>
            ))}
            {agent.deliverables.length > 3 && (
              <li className="type-caption text-muted-foreground italic">+{agent.deliverables.length - 3} more</li>
            )}
          </ul>
        </div>
      )}
      {!progressItems?.length && !summaryText && !agent.outcome && !agent.next_step && !agent.errors && !agent.deliverables?.length && (
        <div className="type-micro text-muted-foreground italic">No summary available.</div>
      )}
    </div>
  )
}

// --- Chat panel (read-only, no composer) -------------------------------

function PastChatPanel({ agent }: { agent: PastAgent }) {
  const jsonlPath = agent.jsonl_path
  const sessionKey = `past:${agent.session_id}`

  useEffect(() => {
    if (!jsonlPath) return
    useChatStore.getState().loadHistoryFromJsonl(sessionKey, jsonlPath)
  }, [jsonlPath, sessionKey])

  if (!jsonlPath) {
    return (
      <div className="type-micro text-muted-foreground italic py-2">
        Chat log not available.
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-1 min-h-0 flex flex-col">
        <ReadOnlyChatContainer sessionName={sessionKey} compact />
      </div>
    </div>
  )
}

// --- Past agent card (mirrors LiveAgentCard chrome) --------------------

const PastAgentCard = memo(function PastAgentCard({ agent, compactMode }: { agent: PastAgent; compactMode?: boolean }) {
  const [activeTabs, setActiveTabs] = useState<Set<AgentTab>>(new Set())
  const lastClickRef = useRef(0)
  const isExpanded = activeTabs.size > 0

  const displayTitle = pastTitle(agent)
  const canResume = !!(agent.session_id && agent.working_dir)
  const hasChat = !!agent.jsonl_path

  const toggleTab = useCallback((tab: AgentTab) => {
    setActiveTabs(prev => {
      const next = new Set(prev)
      if (next.has(tab)) next.delete(tab)
      else next.add(tab)
      return next
    })
  }, [])

  const expandDefault = useCallback(() => {
    setActiveTabs(prev => prev.size > 0 ? new Set() : new Set(['summary']))
  }, [])

  const handleResume = useCallback(async (e: React.MouseEvent) => {
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
  }, [agent.session_id, agent.working_dir])

  const handleOpenReadOnly = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (!agent.jsonl_path) return
    useTabStore.getState().openAgentTab(agent.name, {
      jsonlPath: agent.jsonl_path,
      readOnly: true,
      sessionUuid: agent.session_id,
      resumeWorkingDir: agent.working_dir ?? undefined,
    })
  }, [agent.name, agent.jsonl_path, agent.session_id, agent.working_dir])

  const handleCardClick = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.ec-tabs')) return
    if ((e.target as HTMLElement).closest('.ec-detail')) return
    if ((e.target as HTMLElement).closest('.lac-open')) return
    if ((e.target as HTMLElement).closest('.lac-close')) return
    const now = Date.now()
    const dt = now - lastClickRef.current
    lastClickRef.current = now
    if (dt < 350) {
      if (canResume) {
        handleResume(e)
        return
      }
      handleOpenReadOnly(e)
      return
    }
    expandDefault()
  }, [canResume, handleResume, handleOpenReadOnly, expandDefault])

  const subtitle = [
    agent.project_id || null,
    agent.task_status || 'ended',
    agent.ended || null,
  ].filter(Boolean).join(' · ')

  const glanceSections: GlanceSection[] = []
  if (agent.outcome) glanceSections.push({ kind: 'text', label: 'Outcome', text: agent.outcome, bold: true })
  const summaryText = agent.summary || (!agent.outcome ? agent.shadow_summary : null)
  if (summaryText) {
    glanceSections.push({ kind: 'text', label: 'Summary', text: summaryText.slice(0, 200) })
  }

  return (
    <GlanceTooltip sections={glanceSections} disabled={isExpanded}>
    <div
      className={`group cursor-pointer entity-card task-card live-agent-card task-border-inactive ${isExpanded ? 'ec-expanded' : ''}`}
      onClick={handleCardClick}
    >
      <div className="p-[10px_12px] flex flex-col gap-1">
        <div className="flex items-center gap-[5px] min-w-0">
          <StatusDot status="closed" size="md" />
          <span className="lac-title type-label font-semibold flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
            {displayTitle}
          </span>
          {!isExpanded && !compactMode && (
            <span className="type-caption text-[var(--color-text-muted)] shrink-0 flex items-center gap-1">
              {agent.project_id && <PMBadge>{agent.project_id}</PMBadge>}
              <span>{agent.ended}</span>
            </span>
          )}
          {hasChat && (
            <button
              className="lac-open shrink-0"
              onClick={handleOpenReadOnly}
              title="Open full chat (read-only)"
            >
              <ExternalLink size={12} />
            </button>
          )}
          {canResume && (
            <button
              className="lac-close shrink-0"
              onClick={handleResume}
              title="Resume this session"
            >
              <RotateCcw size={12} />
            </button>
          )}
        </div>
        {isExpanded && subtitle && (
          <div className="type-micro text-[var(--color-text-muted)] leading-[1.4]">
            {subtitle}
          </div>
        )}
      </div>

      <div className={`ec-panel ${isExpanded ? 'show' : ''}`}>
        <div className="ec-detail" onClick={(e) => e.stopPropagation()}>
          <div className={`tab-panel tp-summary ${activeTabs.has('summary') ? 'active' : ''}`}>
            {activeTabs.has('summary') && <PastSummaryPanel agent={agent} />}
          </div>
          <div className={`tab-panel tp-chat ${activeTabs.has('chat') ? 'active' : ''}`}>
            {activeTabs.has('chat') && <PastChatPanel agent={agent} />}
          </div>
        </div>
      </div>

      <SegmentedControl
        className="ec-tabs"
        variant="flatTabs"
        radius="bottom"
        values={activeTabs}
        stopPropagation
        items={[
          { id: 'summary', label: 'Summary' },
          { id: 'chat', label: 'Chat', disabled: !hasChat, title: hasChat ? undefined : 'Chat log not available' },
        ]}
        onValueChange={(id) => toggleTab(id as AgentTab)}
      />
    </div>
    </GlanceTooltip>
  )
})

// --- Inline filter bar ------------------------------------------------

function PastFilters({
  projectFilter, setProjectFilter,
  timeFilter, setTimeFilter,
  searchQuery, setSearchQuery, onSearch,
}: {
  projectFilter: string
  setProjectFilter: (v: string) => void
  timeFilter: string
  setTimeFilter: (v: string) => void
  searchQuery: string
  setSearchQuery: (v: string) => void
  onSearch: (v: string) => void
}) {
  const [searchOpen, setSearchOpen] = useState(!!searchQuery)
  const projects = usePMStore(s => s.availableProjects)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (searchOpen) inputRef.current?.focus()
  }, [searchOpen])

  return (
    <div className="flex items-center gap-1.5 mb-2">
      {!searchOpen ? (
        <button
          className="flex items-center justify-center h-6 w-6 rounded text-muted-foreground hover:text-foreground hover:bg-[var(--bg-card-hover)] bg-transparent border-none cursor-pointer"
          onClick={() => setSearchOpen(true)}
          title="Search past agents"
        >
          <Search size={12} />
        </button>
      ) : (
        <div className="relative flex-1 max-w-[200px]">
          <Search size={11} className="absolute left-1.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search…"
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); onSearch(e.target.value) }}
            onBlur={() => { if (!searchQuery) setSearchOpen(false) }}
            className="w-full h-6 pl-6 pr-6 type-micro rounded border border-border bg-transparent outline-none focus:border-accent"
          />
          {searchQuery && (
            <button
              className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground bg-transparent border-none cursor-pointer p-0"
              onClick={() => { setSearchQuery(''); onSearch(''); setSearchOpen(false) }}
            >
              <X size={11} />
            </button>
          )}
        </div>
      )}
      <Select value={projectFilter} onValueChange={v => setProjectFilter(v)}>
        <SelectTrigger className="h-6 type-caption w-[90px]">
          <SelectValue placeholder="All" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All projects</SelectItem>
          {projects.map(p => (
            <SelectItem key={p.id} value={p.id}>{p.id}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={timeFilter} onValueChange={v => setTimeFilter(v)}>
        <SelectTrigger className="h-6 type-caption w-[70px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {TIME_OPTIONS.map(o => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

// --- Main PastAgents section ------------------------------------------

export interface PastAgentsProps {
  projectId?: string
  defaultDays?: number
  workingDirPrefixes?: string[]
  taskIdPrefixes?: string[]
  filter?: (a: PastAgent) => boolean
  emptyState?: React.ReactNode
  compactMode?: boolean
  /** When true, skip "Today/Yesterday/…" day headers and render a flat list sorted newest-first. */
  suppressDayGrouping?: boolean
}

export function PastAgents({ projectId, defaultDays = 7, workingDirPrefixes, taskIdPrefixes, filter, emptyState, compactMode, suppressDayGrouping }: PastAgentsProps = {}) {
  const layout = useHomeLayoutStore(s => s.layout)
  const loadLayout = useHomeLayoutStore(s => s.loadLayout)
  const setSectionCollapsed = useHomeLayoutStore(s => s.setSectionCollapsed)
  const pastAgentsRevision = useSessionStore(s => s.pastAgentsRevision)

  const [searchQuery, setSearchQuery] = useState('')
  const [projectFilter, setProjectFilter] = useState('all')
  const [timeFilter, setTimeFilter] = useState(String(defaultDays))
  const [agents, setAgents] = useState<PastAgent[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { loadLayout() }, [loadLayout])
  useEffect(() => { setTimeFilter(String(defaultDays)) }, [defaultDays])

  const prefixesKey = workingDirPrefixes?.join(',') || ''
  const taskIdsKey = taskIdPrefixes?.join(',') || ''

  const fetchAgents = useCallback((q: string, filterProject: string, days: string) => {
    setLoading(true)
    api.fetchPastAgents({
      days: parseInt(days),
      limit: 50,
      q: q.trim() || undefined,
      project: filterProject === 'all' ? (projectId || undefined) : filterProject,
      workingDirPrefixes: workingDirPrefixes?.length ? workingDirPrefixes : undefined,
      taskIdPrefixes: taskIdPrefixes?.length ? taskIdPrefixes : undefined,
    }).then(data => {
      setAgents(data.sessions)
      setTotal(data.total)
      setLoading(false)
    }).catch(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefixesKey, taskIdsKey, projectId])

  useEffect(() => {
    fetchAgents(searchQuery, projectFilter, timeFilter)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectFilter, timeFilter, pastAgentsRevision, fetchAgents])

  const handleSearch = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      fetchAgents(q, projectFilter, timeFilter)
    }, 200)
  }, [fetchAgents, projectFilter, timeFilter])

  const section = layout?.sections?.past || { collapsed: true }
  const collapsed = section.collapsed !== false
  const Chev = collapsed ? ChevronRight : ChevronDown
  const filteredAgents = filter ? agents.filter(filter) : agents
  const dayGroups = groupByDay(filteredAgents)
  const isEmbedded = !!(workingDirPrefixes?.length || taskIdPrefixes?.length || filter || emptyState || compactMode)

  if (isEmbedded) {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-4 gap-1.5 text-muted-foreground">
          <Loader2 size={14} className="animate-spin" />
          <span className="type-micro">Loading…</span>
        </div>
      )
    }
    if (filteredAgents.length === 0) {
      return emptyState ? <>{emptyState}</> : null
    }
    if (suppressDayGrouping) {
      const sorted = [...filteredAgents].sort((a, b) => (b.ended || '').localeCompare(a.ended || ''))
      return (
        <div className="flex flex-col gap-1.5">
          {sorted.map(a => (
            <PastAgentCard key={a.session_id} agent={a} compactMode={compactMode} />
          ))}
        </div>
      )
    }
    return (
      <div className="flex flex-col gap-3">
        {dayGroups.map(group => (
          <div key={group.label}>
            <div className="type-caption font-semibold text-muted-foreground uppercase tracking-wider mb-1">
              {group.label} <span className="text-muted-foreground/70">({group.agents.length})</span>
            </div>
            <div className="flex flex-col gap-1.5">
              {group.agents.map(a => (
                <PastAgentCard key={a.session_id} agent={a} compactMode={compactMode} />
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="mb-4">
      <div className="flex items-center gap-1.5 mb-2">
        <button
          className="flex items-center gap-1 bg-transparent border-none cursor-pointer p-0 hover:text-foreground"
          onClick={() => setSectionCollapsed('past', !collapsed)}
        >
          <Chev size={14} className="text-muted-foreground" />
          <h2 className="type-body-sm font-semibold text-foreground m-0">Past Agents</h2>
          {total > 0 && (
            <span className="type-micro text-muted-foreground">({total})</span>
          )}
        </button>
      </div>

      {!collapsed && (
        <>
          <PastFilters
            projectFilter={projectFilter}
            setProjectFilter={setProjectFilter}
            timeFilter={timeFilter}
            setTimeFilter={setTimeFilter}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            onSearch={handleSearch}
          />

          {loading ? (
            <div className="flex items-center justify-center py-4 gap-1.5 text-muted-foreground">
              <Loader2 size={14} className="animate-spin" />
              <span className="type-micro">Searching…</span>
            </div>
          ) : filteredAgents.length === 0 ? (
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
                    {group.label} <span className="text-muted-foreground/70">({group.agents.length})</span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {group.agents.map(a => (
                      <PastAgentCard key={a.session_id} agent={a} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
