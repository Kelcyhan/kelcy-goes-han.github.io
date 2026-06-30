import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
} from '@/components/ui/dialog.tsx'
import {
  Command,
  CommandInput,
  CommandList,
  CommandItem,
  CommandEmpty,
  CommandGroup,
} from '@/components/ui/command.tsx'
import { StatusDot } from '@/components/primitives/status-dot.tsx'
import {
  Search, FolderKanban, CheckSquare, MonitorPlay, Clock, FileText, Loader2,
  Sparkles, Star, Copy, Check, ChevronDown, ChevronRight, ChevronLeft, BookOpen,
} from 'lucide-react'
import {
  unifiedSearch, semanticSearch,
  type GlobalSearchResults,
  type ProjectSearchResult,
  type TaskSearchResult,
  type SessionSearchResult,
  type HistorySearchResult,
  type FileSearchResult,
  type SemanticSearchResult,
} from '@/lib/api.ts'
import { useSessionStore } from '@/stores/session-store.ts'
import { extractProjectFromWorkingDir } from '@/stores/session-store.ts'
import { useTabStore } from '@/stores/tab-store.ts'
import { usePMStore } from '@/stores/pm-store.ts'
import { useChatStore } from '@/stores/chat-store.ts'
import { ReadOnlyChatContainer } from '@/components/chat/ReadOnlyChatContainer.tsx'
import { MarkdownPreview } from '@/components/pm/MarkdownPreview.tsx'
import { cn } from '@/lib/utils.ts'
import { buildTaskFilePath } from '@/lib/paths.ts'

// ---------------------------------------------------------------------------
// Preview data — what to show in the right panel
// ---------------------------------------------------------------------------

type PreviewItem =
  | { type: 'project'; data: ProjectSearchResult }
  | { type: 'task'; data: TaskSearchResult }
  | { type: 'session'; data: SessionSearchResult }
  | { type: 'history'; data: HistorySearchResult }
  | { type: 'file'; data: FileSearchResult }
  | { type: 'semantic'; data: SemanticSearchResult }

// Shared sub-components for preview
function PreviewSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="type-caption text-muted-foreground font-medium uppercase tracking-wider">{label}</span>
      {children}
    </div>
  )
}

function MetaRow({ items }: { items: (string | null | undefined | false)[] }) {
  const filtered = items.filter(Boolean) as string[]
  if (filtered.length === 0) return null
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {filtered.map((item, i) => (
        <span key={i} className="type-caption px-1.5 py-px rounded bg-[rgba(130,130,160,0.08)] text-muted-foreground">{item}</span>
      ))}
    </div>
  )
}

function FileContentPreview({ path }: { path: string }) {
  const [content, setContent] = useState<{ frontmatter: Record<string, unknown>; body: string } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    setContent(null)
    import('@/lib/api.ts').then(api => api.fetchVaultFile(path))
      .then(data => {
        setContent({ frontmatter: data.frontmatter, body: data.body })
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [path])

  if (loading) return <span className="type-caption text-muted-foreground animate-pulse">Loading preview...</span>
  if (!content) return null

  const fm = content.frontmatter
  const hasFm = fm && Object.keys(fm).length > 0

  return (
    <div className="flex flex-col gap-1.5">
      {hasFm && (
        <div className="flex flex-col gap-0.5 bg-[rgba(130,130,160,0.05)] rounded px-2 py-1.5">
          {Object.entries(fm).slice(0, 8).map(([k, v]) => {
            const val = typeof v === 'string' ? v : typeof v === 'number' || typeof v === 'boolean' ? String(v) : Array.isArray(v) ? v.join(', ') : null
            if (!val) return null
            return (
              <div key={k} className="flex gap-1.5">
                <span className="type-caption text-muted-foreground shrink-0 w-[60px] truncate">{k}:</span>
                <span className="type-caption text-foreground truncate">{val}</span>
              </div>
            )
          })}
        </div>
      )}
      {content.body.trim() && (
        <pre className="type-caption text-muted-foreground m-0 leading-[1.5] whitespace-pre-wrap break-all font-mono bg-[rgba(0,0,0,0.15)] rounded px-2 py-1.5 max-h-[400px] overflow-y-auto">
          {content.body}
        </pre>
      )}
    </div>
  )
}

// Parse card markdown into sections { Glance, Summary, Status, Progress[] }
function parseCardSections(body: string): { glance?: string; summary?: string; status?: string; progress?: string[] } {
  const result: { glance?: string; summary?: string; status?: string; progress?: string[] } = {}
  const sections = body.split(/^##\s+/m)
  for (const section of sections) {
    const nl = section.indexOf('\n')
    if (nl === -1) continue
    const heading = section.slice(0, nl).trim().toLowerCase()
    const content = section.slice(nl + 1).trim()
    if (heading === 'glance') result.glance = content
    else if (heading === 'summary') result.summary = content
    else if (heading === 'status') result.status = content
    else if (heading === 'progress') {
      result.progress = content.split('\n').map(l => l.trim()).filter(l => l.startsWith('-')).map(l => l.slice(1).trim())
    }
  }
  return result
}

// Structured task preview — reads worklog.md for acceptance/status
function TaskPreviewStructured({ taskPath: _taskPath, worklogPath }: { taskPath: string; worklogPath: string }) {
  const [wl, setWl] = useState<{ frontmatter: Record<string, unknown> } | null>(null)

  useEffect(() => {
    setWl(null)
    import('@/lib/api.ts').then(api => api.fetchVaultFile(worklogPath))
      .then(data => setWl(data))
      .catch(() => {})
  }, [worklogPath])

  if (!wl) return <span className="type-caption text-muted-foreground animate-pulse">Loading...</span>

  const fm = wl.frontmatter as any
  const acceptance: { text: string; done: boolean }[] = fm?.intent?.acceptance || []
  const done = acceptance.filter(a => a.done).length
  const total = acceptance.length
  const statusDone: string = fm?.status?.done || ''
  const statusRemains: string = fm?.status?.remains || ''

  return (
    <div className="flex flex-col gap-2">
      {total > 0 && (
        <PreviewSection label={`Acceptance  ${done} / ${total}`}>
          <div className="flex flex-col gap-0.5">
            {acceptance.map((a, i) => (
              <div key={i} className="flex items-start gap-1.5">
                <span className={cn('type-micro shrink-0 mt-px', a.done ? 'text-green-400' : 'text-muted-foreground')}>{a.done ? '✓' : '○'}</span>
                <span className={cn('type-caption leading-snug', a.done ? 'text-muted-foreground line-through decoration-muted-foreground/40' : 'text-foreground')}>{a.text}</span>
              </div>
            ))}
          </div>
        </PreviewSection>
      )}
      {statusDone && (
        <PreviewSection label="Done">
          <MarkdownPreview value={statusDone} />
        </PreviewSection>
      )}
      {statusRemains && (
        <PreviewSection label="Remains">
          <MarkdownPreview value={statusRemains} />
        </PreviewSection>
      )}
    </div>
  )
}

// Session card preview — fetches card file, parses sections
function SessionCardPreview({ cardPath }: { cardPath: string }) {
  const [sections, setSections] = useState<ReturnType<typeof parseCardSections> | null>(null)
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    setSections(null)
    setMissing(false)
    import('@/lib/api.ts').then(api => api.fetchVaultFile(cardPath))
      .then(data => setSections(parseCardSections(data.body || '')))
      .catch(() => setMissing(true))
  }, [cardPath])

  if (missing) return null
  if (!sections) return <span className="type-caption text-muted-foreground animate-pulse">Loading card...</span>

  return (
    <div className="flex flex-col gap-2">
      {sections.glance && (
        <PreviewSection label="Glance">
          <MarkdownPreview value={sections.glance} />
        </PreviewSection>
      )}
      {sections.summary && (
        <PreviewSection label="Summary">
          <MarkdownPreview value={sections.summary} />
        </PreviewSection>
      )}
      {sections.status && (
        <PreviewSection label="Status">
          <MarkdownPreview value={sections.status} />
        </PreviewSection>
      )}
      {sections.progress && sections.progress.length > 0 && (
        <PreviewSection label="Progress">
          <div className="flex flex-col gap-0.5">
            {sections.progress.map((p, i) => (
              <span key={i} className="type-caption text-muted-foreground leading-snug">· {p}</span>
            ))}
          </div>
        </PreviewSection>
      )}
    </div>
  )
}

// Session chat preview — loads JSONL into chat store and renders ReadOnlyChatContainer
function SessionChatPreview({ sessionName, jsonlPath }: { sessionName: string; jsonlPath: string }) {
  const [loaded, setLoaded] = useState(false)
  const previewName = `__preview__${sessionName}`

  useEffect(() => {
    setLoaded(false)
    useChatStore.getState().loadHistoryFromJsonl(previewName, jsonlPath)
      .then(() => setLoaded(true))
      .catch(() => setLoaded(false))
    return () => {
      // Clean up preview session from store on unmount
      useChatStore.getState().removeSession(previewName)
    }
  }, [previewName, jsonlPath])

  if (!loaded) {
    return <span className="type-caption text-muted-foreground animate-pulse">Loading conversation...</span>
  }

  return (
    <div className="rounded border border-border overflow-hidden flex flex-col" style={{ maxHeight: 'calc(60vh - 100px)', minHeight: 200 }}>
      <style>{`.chat-preview-compact .my-1\\.5 > .ml-2 { display: none; } .chat-preview-compact .px-5 { padding-left: 0.5rem !important; padding-right: 0.5rem !important; } .chat-preview-compact .gap-3 { gap: 0.5rem !important; }`}</style>
      <div className="flex-1 min-h-0 overflow-y-auto type-label chat-preview-compact">
        <ReadOnlyChatContainer sessionName={previewName} />
      </div>
    </div>
  )
}

function OpenButton({ onClick, label }: { onClick: () => void; label?: string }) {
  return (
    <button
      onClick={onClick}
      className="flex-1 flex items-center justify-center gap-1 type-caption font-medium px-2 py-1 rounded
                 bg-[rgba(130,130,160,0.1)] text-foreground hover:bg-[rgba(130,130,160,0.2)]
                 transition-colors cursor-pointer border-none"
    >
      {label || 'Open'} →
    </button>
  )
}

// History preview with Card/Conversation tabs
function HistoryPreview({ h, onNavigatePM }: { h: HistorySearchResult; onNavigatePM?: () => void }) {
  const [tab, setTab] = useState<'card' | 'conversation'>('card')
  const cardPath = `State/session_cards/${h.name}.md`

  return (
    <div className="flex flex-col gap-2 h-full">
      {/* Header */}
      <div className="flex items-center gap-1.5 shrink-0">
        <Clock size={12} className="text-muted-foreground shrink-0" />
        {h.task_status && (
          <span className={cn('type-caption px-1.5 py-px rounded', h.task_status === 'done' ? 'bg-[rgba(16,185,129,0.15)] text-green-400' : 'bg-[rgba(130,130,160,0.08)] text-muted-foreground')}>
            {h.task_status}
          </span>
        )}
        {h.ended && <span className="type-caption text-muted-foreground">{h.ended}</span>}
      </div>
      <span className="type-body-sm font-semibold leading-snug shrink-0">{h.task_title || h.name}</span>
      <MetaRow items={[h.role, h.project_id, h.task_id]} />

      {/* Tab bar */}
      <div className="flex gap-0 shrink-0 border-b border-border">
        <button
          onClick={() => setTab('card')}
          className={cn(
            'type-micro px-3 py-1 border-b-2 transition-colors bg-transparent cursor-pointer',
            tab === 'card' ? 'border-accent text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          Summary
        </button>
        {h.jsonl_path && (
          <button
            onClick={() => setTab('conversation')}
            className={cn(
              'type-micro px-3 py-1 border-b-2 transition-colors bg-transparent cursor-pointer',
              tab === 'conversation' ? 'border-accent text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            Conversation
          </button>
        )}
      </div>

      {/* Tab content */}
      {tab === 'card' ? (
        <div className="flex flex-col gap-2 flex-1 overflow-y-auto">
          {onNavigatePM && (
            <div className="flex gap-1.5 shrink-0">
              <OpenButton onClick={onNavigatePM} label="Open" />
            </div>
          )}
          {/* Load card file for structured sections */}
          {cardPath
            ? <SessionCardPreview cardPath={cardPath} />
            : (
              <>
                {h.outcome && (
                  <PreviewSection label="Outcome">
                    <MarkdownPreview value={h.outcome} />
                  </PreviewSection>
                )}
                {h.summary && h.summary !== h.outcome && (
                  <PreviewSection label="Summary">
                    <MarkdownPreview value={h.summary} />
                  </PreviewSection>
                )}
                {h.next_step && (
                  <PreviewSection label="Next step">
                    <MarkdownPreview value={h.next_step} />
                  </PreviewSection>
                )}
              </>
            )
          }
        </div>
      ) : (
        <div className="flex-1 min-h-0 -mx-3 -mb-3">
          <SessionChatPreview sessionName={h.name} jsonlPath={h.jsonl_path!} />
        </div>
      )}
    </div>
  )
}

function PreviewPanel({ item, onNavigatePM, onOpenTab: _onOpenTab, showPMButton, showTabButton }: {
  item: PreviewItem | null
  onNavigatePM?: () => void
  onOpenTab?: () => void
  showPMButton?: boolean
  showTabButton?: boolean
}) {
  // Enrich live sessions from the session store
  const sessions = useSessionStore(s => s.sessions)
  const sessionStatuses = useSessionStore(s => s.sessionStatuses)

  if (!item) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <span className="type-micro">Select an item to preview</span>
      </div>
    )
  }

  switch (item.type) {
    case 'project': {
      const p = item.data
      return (
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-1.5">
            <StatusDot status={normalizeStatus(p.status) as any} size="sm" />
            <span className="type-micro text-muted-foreground">{p.status}</span>
          </div>
          <span className="type-body-sm font-semibold leading-snug">{p.title}</span>
          <MetaRow items={['project', p.id]} />
          {p.vision && (
            <PreviewSection label="Vision">
              <MarkdownPreview value={p.vision} />
            </PreviewSection>
          )}
          {(showPMButton || showTabButton) && (
            <div className="flex gap-1.5">
              {showPMButton && onNavigatePM && <OpenButton onClick={onNavigatePM} label="Go to PM" />}
            </div>
          )}
        </div>
      )
    }
    case 'task': {
      const t = item.data
      const taskPath = buildTaskFilePath(t.project, t.id)
      const worklogPath = taskPath.replace('/task.md', '/worklog.md')

      return (
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-1.5">
            <StatusDot status={normalizeStatus(t.status) as any} size="sm" />
            <span className="type-micro text-muted-foreground">{t.status}</span>
          </div>
          <span className="type-body-sm font-semibold leading-snug">{t.title}</span>
          <MetaRow items={[
            t.id,
            t.project,
            t.type !== 'task' && t.type,
            t.est_hours != null && `${t.est_hours}h est`,
          ]} />
          {showPMButton && onNavigatePM && (
            <div className="flex gap-1.5">
              <OpenButton onClick={onNavigatePM} label="Go to PM" />
            </div>
          )}
          {t.desc && (
            <PreviewSection label="Description">
              <MarkdownPreview value={t.desc} />
            </PreviewSection>
          )}
          <TaskPreviewStructured taskPath={taskPath} worklogPath={worklogPath} />
        </div>
      )
    }
    case 'session': {
      const s = item.data
      const liveSession = sessions.find(x => x.name === s.name)
      const liveStatus = sessionStatuses[s.name]
      const statusLabel = liveStatus || liveSession?.status || 'unknown'
      const isWorking = statusLabel === 'working'
      const cardPath = `State/session_cards/${s.name}.md`
      return (
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-1.5">
            <div className={cn('w-2 h-2 rounded-full shrink-0', isWorking ? 'bg-green-400 animate-pulse' : 'bg-green-400')} />
            <span className="type-micro" style={{ color: isWorking ? 'rgb(74,222,128)' : 'rgb(134,239,172)' }}>
              {statusLabel}
            </span>
          </div>
          <span className="type-body-sm font-semibold leading-snug">{s.task_title || s.name}</span>
          <MetaRow items={[s.role, s.project_id, s.task_id]} />
          <span className="type-caption font-mono text-muted-foreground">{s.name}</span>
          {liveSession && (liveSession.turns != null && liveSession.turns > 0) && (
            <div className="flex items-center gap-3">
              <span className="type-caption text-muted-foreground">{liveSession.turns} turns</span>
              {(liveSession.total_input_tokens || 0) > 0 && (
                <span className="type-caption text-muted-foreground">
                  {Math.round(((liveSession.total_input_tokens || 0) + (liveSession.total_output_tokens || 0)) / 1000)}K tokens
                </span>
              )}
            </div>
          )}
          {showPMButton && onNavigatePM && (
            <div className="flex gap-1.5 shrink-0">
              <OpenButton onClick={onNavigatePM} label="Resume" />
            </div>
          )}
          <SessionCardPreview cardPath={cardPath} />
        </div>
      )
    }
    case 'history': {
      const h = item.data
      return <HistoryPreview h={h} onNavigatePM={onNavigatePM} />
    }
    case 'file': {
      const f = item.data
      const ext = f.name.split('.').pop()?.toLowerCase() || ''
      const modified = new Date(f.mtime * 1000)
      const isText = ['md', 'txt', 'yaml', 'yml', 'json', 'ts', 'tsx', 'js', 'jsx', 'py', 'sh', 'css', 'html', 'toml', 'cfg', 'ini', 'csv'].includes(ext)
      return (
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-2">
            <FileText size={14} className="text-muted-foreground shrink-0" />
            <span className="type-body-sm font-semibold truncate">{f.name}</span>
          </div>
          <span className="type-caption font-mono text-muted-foreground break-all leading-relaxed">{f.path}</span>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="type-caption px-1.5 py-px rounded bg-[rgba(130,130,160,0.08)] text-muted-foreground uppercase">.{ext || '?'}</span>
            <span className="type-caption text-muted-foreground">
              {f.size < 1024 ? `${f.size} B` : f.size < 1048576 ? `${(f.size / 1024).toFixed(1)} KB` : `${(f.size / 1048576).toFixed(1)} MB`}
            </span>
            <span className="type-caption text-muted-foreground">{modified.toLocaleDateString()}</span>
          </div>
          {showPMButton && onNavigatePM && (
            <div className="flex gap-1.5">
              <OpenButton onClick={onNavigatePM} label="Go to PM" />
            </div>
          )}
          {isText && f.size < 500000 && (
            <PreviewSection label="Content">
              <FileContentPreview path={f.path} />
            </PreviewSection>
          )}
        </div>
      )
    }
    case 'semantic': {
      const s = item.data
      const isSessionDoc = ['session_card', 'session_search', 'receipt'].includes(s.doc_type)
        || (s.group_id || '').startsWith('session:')
      const isTaskDoc = ['task', 'domain', 'project'].includes(s.doc_type) && !!(s.entity_id && s.project_id)
      const sessionName = (s.group_id || '').startsWith('session:')
        ? s.group_id!.slice('session:'.length) : null
      const liveSession = sessionName ? sessions.find(x => x.name === sessionName) : null
      const buttonLabel = isSessionDoc
        ? (liveSession ? 'Resume' : 'Open')
        : isTaskDoc ? 'Go to PM' : 'Open'
      return (
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-2">
            <DocTypeIcon type={s.doc_type} />
            <span className="type-body-sm font-semibold truncate">{s.title || s.document_id.split('/').pop()}</span>
          </div>
          <MetaRow items={[docTypeLabel(s.doc_type), s.project_id, s.entity_id]} />
          <span className="type-caption font-mono text-muted-foreground break-all leading-relaxed">{s.document_id}</span>
          {showPMButton && onNavigatePM && (
            <div className="flex gap-1.5">
              <OpenButton onClick={onNavigatePM} label={buttonLabel} />
            </div>
          )}
          {/* Full document preview for semantic results */}
          {s.document_id && (
            <PreviewSection label="Content">
              <FileContentPreview path={s.document_id} />
            </PreviewSection>
          )}
        </div>
      )
    }
  }
}

// Format a date string (YYYY-MM-DD) or unix timestamp into "Apr 6" / "Apr 6 '25"
function formatDate(value: string | number | null | undefined): string | null {
  if (!value) return null
  let d: Date
  if (typeof value === 'number') {
    d = new Date(value * 1000)
  } else {
    // YYYY-MM-DD or ISO string
    d = new Date(value.includes('T') ? value : value + 'T00:00:00')
  }
  if (isNaN(d.getTime())) return null
  const now = new Date()
  const month = d.toLocaleString('en', { month: 'short' })
  const day = d.getDate()
  const year = d.getFullYear()
  return year === now.getFullYear() ? `${month} ${day}` : `${month} ${day} '${String(year).slice(2)}`
}

const statusMap: Record<string, string> = {
  active: 'active', executing: 'active', exec: 'active',
  working: 'working', idle: 'idle', waiting: 'waiting',
  blocked: 'blocked', error: 'error', done: 'done', todo: 'todo',
  propose: 'idle', conversation: 'waiting',
}
const normalizeStatus = (s: string) => statusMap[s.toLowerCase()] || 'unknown'

// Helpers for semantic results
function docTypeLabel(t: string): string {
  const labels: Record<string, string> = {
    task: 'Task', worklog: 'Worklog', artifact: 'Artifact', receipt: 'Receipt',
    session_card: 'Session', session_search: 'Session', verification: 'Check',
    agent_spec: 'Agent', briefing: 'Briefing', synthesis: 'Synthesis', goal: 'Goal',
    domain: 'Domain', project: 'Project', journal: 'Journal', paper: 'Paper',
  }
  return labels[t] || t
}

function DocTypeIcon({ type }: { type: string }) {
  switch (type) {
    case 'task': return <CheckSquare size={13} className="text-accent shrink-0" />
    case 'worklog': return <FileText size={13} className="text-blue-400 shrink-0" />
    case 'artifact': return <FileText size={13} className="text-purple-400 shrink-0" />
    case 'receipt': return <Clock size={13} className="text-muted-foreground shrink-0" />
    case 'session_card': case 'session_search': return <MonitorPlay size={13} className="text-green-400 shrink-0" />
    case 'agent_spec': return <Star size={13} className="text-amber-400 shrink-0" />
    case 'briefing': case 'synthesis': return <FileText size={13} className="text-cyan-400 shrink-0" />
    case 'paper': return <BookOpen size={13} className="text-amber-400 shrink-0" />
    default: return <FileText size={13} className="text-muted-foreground shrink-0" />
  }
}

// Copy entity button — copies @path for agent use
function CopyEntityButton({ path }: { path: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(`@${path}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <button
      onClick={handleCopy}
      className="p-0.5 rounded hover:bg-[rgba(130,130,160,0.15)] transition-colors shrink-0"
      title="Copy @reference for agent"
    >
      {copied
        ? <Check size={11} className="text-green-400" />
        : <Copy size={11} className="text-muted-foreground" />
      }
    </button>
  )
}


// Default collapsed count per group
const DEFAULT_VISIBLE = 3

// ---------------------------------------------------------------------------
// CollapsibleGroup — shows top N items, expandable
// ---------------------------------------------------------------------------

function CollapsibleGroup({
  label,
  icon: Icon,
  count,
  children,
  totalCount,
}: {
  label: string
  icon: typeof Search
  count: number
  children: React.ReactNode[]
  totalCount: number
}) {
  const STEP = 5
  const [visibleCount, setVisibleCount] = useState(DEFAULT_VISIBLE)
  const visible = children.slice(0, visibleCount)
  const remaining = totalCount - visibleCount

  return (
    <CommandGroup
      heading={
        <span className="flex items-center gap-1.5">
          <Icon size={12} className="text-muted-foreground" />
          <span>{label}</span>
          <span className="type-caption text-muted-foreground ml-1">({count})</span>
        </span>
      }
    >
      {visible}
      {remaining > 0 && (
        <button
          onClick={() => setVisibleCount(c => c + STEP)}
          className="flex items-center gap-1.5 w-full px-2 py-1 type-micro text-muted-foreground
                     hover:text-foreground hover:bg-[rgba(130,130,160,0.08)] transition-colors
                     cursor-pointer bg-transparent border-none rounded"
        >
          <ChevronDown size={11} className="shrink-0" />
          Show {Math.min(remaining, STEP)} more{remaining > STEP ? ` (${remaining} left)` : ''}
        </button>
      )}
      {visibleCount > DEFAULT_VISIBLE && (
        <button
          onClick={() => setVisibleCount(DEFAULT_VISIBLE)}
          className="flex items-center gap-1.5 w-full px-2 py-1 type-micro text-muted-foreground
                     hover:text-foreground hover:bg-[rgba(130,130,160,0.08)] transition-colors
                     cursor-pointer bg-transparent border-none rounded"
        >
          <ChevronRight size={11} className="shrink-0" />
          Show less
        </button>
      )}
    </CommandGroup>
  )
}


// ---------------------------------------------------------------------------
// GlobalSearch Dialog
// ---------------------------------------------------------------------------

export function GlobalSearch({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [query, setQuery] = useState('')
  // Keyword results (instant)
  const [kwResults, setKwResults] = useState<GlobalSearchResults | null>(null)
  // Semantic results (slower, richer) — only fired when user invokes AI (Enter on hint row)
  const [semanticResults, setSemanticResults] = useState<SemanticSearchResult[]>([])
  const [kwLoading, setKwLoading] = useState(false)
  const [semanticLoading, setSemanticLoading] = useState(false)
  // Whether the user has invoked AI search for the current query (suppresses the hint row).
  const [aiInvoked, setAiInvoked] = useState(false)
  const [preview, setPreview] = useState<PreviewItem | null>(null)
  const [mobilePreview, setMobilePreview] = useState(false)
  const kwAbortRef = useRef<AbortController | null>(null)
  const semAbortRef = useRef<AbortController | null>(null)
  const kwDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const semDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Auto-fire AI search after this long with no typing. Long enough that fast
  // typers never pay the GPU cost; short enough that a user who paused for
  // results gets them without a manual click.
  const AI_AUTOFIRE_MS = 2000
  const aiAutoFireRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const previewDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const setPreviewDebounced = useCallback((item: PreviewItem) => {
    if (previewDebounceRef.current) clearTimeout(previewDebounceRef.current)
    previewDebounceRef.current = setTimeout(() => setPreview(item), 120)
  }, [])


  // Cancel pending requests on close (but preserve results for next open)
  useEffect(() => {
    if (!open) {
      if (kwAbortRef.current) kwAbortRef.current.abort()
      if (semAbortRef.current) semAbortRef.current.abort()
      if (kwDebounceRef.current) clearTimeout(kwDebounceRef.current)
      if (semDebounceRef.current) clearTimeout(semDebounceRef.current)
      if (aiAutoFireRef.current) clearTimeout(aiAutoFireRef.current)
      if (previewDebounceRef.current) clearTimeout(previewDebounceRef.current)
      setKwLoading(false)
      setSemanticLoading(false)
      setMobilePreview(false)
    }
  }, [open])

  // Fire semantic search for the current query. Called by auto-fire (after
  // idle), the AI button click, or Shift+Enter.
  const invokeAI = useCallback((q: string) => {
    const trimmed = q.trim()
    if (!trimmed) return
    if (semAbortRef.current) semAbortRef.current.abort()
    if (semDebounceRef.current) clearTimeout(semDebounceRef.current)
    if (aiAutoFireRef.current) clearTimeout(aiAutoFireRef.current)
    setAiInvoked(true)
    setSemanticLoading(true)
    const controller = new AbortController()
    semAbortRef.current = controller
    ;(async () => {
      try {
        const data = await semanticSearch(trimmed, 100)
        if (!controller.signal.aborted) {
          setSemanticResults(data.results)
          setSemanticLoading(false)
        }
      } catch {
        if (!controller.signal.aborted) setSemanticLoading(false)
      }
    })()
  }, [])

  // Keyword on every keystroke (fast). Semantic is opt-in: auto-fires after
  // AI_AUTOFIRE_MS of idle, or manually via clicking the hint row.
  const doSearch = useCallback((q: string) => {
    // Cancel previous
    if (kwDebounceRef.current) clearTimeout(kwDebounceRef.current)
    if (semDebounceRef.current) clearTimeout(semDebounceRef.current)
    if (aiAutoFireRef.current) clearTimeout(aiAutoFireRef.current)
    if (kwAbortRef.current) kwAbortRef.current.abort()
    if (semAbortRef.current) semAbortRef.current.abort()

    // Query changed: reset semantic state so the AI hint reappears for the new query.
    setAiInvoked(false)
    setSemanticResults([])
    setSemanticLoading(false)

    if (!q.trim()) {
      setKwResults(null)
      setKwLoading(false)
      setPreview(null)
      return
    }

    // Keyword search only (200ms debounce, ~100-200ms server-side)
    setKwLoading(true)
    kwDebounceRef.current = setTimeout(async () => {
      const controller = new AbortController()
      kwAbortRef.current = controller
      try {
        const data = await unifiedSearch(q.trim(), { limit: 8 })
        if (!controller.signal.aborted) {
          setKwResults(data)
          setKwLoading(false)
          // Auto-preview first result
          const r = data.results
          if (r.projects.items[0]) setPreview({ type: 'project', data: r.projects.items[0] })
          else if (r.tasks.items[0]) setPreview({ type: 'task', data: r.tasks.items[0] })
          else if (r.sessions.items[0]) setPreview({ type: 'session', data: r.sessions.items[0] })
          else if (r.history.items[0]) setPreview({ type: 'history', data: r.history.items[0] })
        }
      } catch {
        if (!controller.signal.aborted) setKwLoading(false)
      }
    }, 200)

    // Auto-fire AI after the user stops typing. Reset on every keystroke so
    // fast typers never trigger the GPU mid-word.
    aiAutoFireRef.current = setTimeout(() => {
      invokeAI(q)
    }, AI_AUTOFIRE_MS)
  }, [invokeAI])

  // Shift+Enter triggers AI search. Captured at window level so it pre-empts
  // cmdk's default Enter handler (which would open the focused item).
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && e.shiftKey) {
        if (query.trim() && !aiInvoked && !semanticLoading) {
          e.preventDefault()
          e.stopPropagation()
          invokeAI(query)
        }
      }
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [open, query, aiInvoked, semanticLoading, invokeAI])

  const handleQueryChange = (value: string) => {
    setQuery(value)
    setMobilePreview(false)
    doSearch(value)
  }

  const close = () => onOpenChange(false)

  const isMobile = () => window.matchMedia('(max-width: 639px)').matches
  const handleSelect = (item: PreviewItem, navigate: () => void) => {
    if (isMobile()) {
      setPreview(item)
      setMobilePreview(true)
    } else {
      navigate()
    }
  }

  // Navigation helpers
  const extractPMTarget = (path: string): { project: string; taskId: string } | null => {
    const globalScratchMatch = path.match(/^Scratch\/([^/]+)\//)
    if (globalScratchMatch) return { project: '__scratch__', taskId: `scratch/${globalScratchMatch[1]}` }

    const pmMatch = path.match(/^projects\/([^/]+)\/(.+)/)
    if (!pmMatch) return null
    const project = pmMatch[1]
    const rest = pmMatch[2]
    // Match the LAST /Scratch/<slug>/ in the path — handles domain-nested
    // (projects/<P>/1_2/Scratch/<slug>/) and project-root (projects/<P>/Scratch/<slug>/)
    // uniformly. Type-first index resolves either form.
    const scratchMatches = [...rest.matchAll(/(?:^|\/)Scratch\/([^/]+)\//g)]
    if (scratchMatches.length > 0) {
      const slug = scratchMatches[scratchMatches.length - 1][1]
      return { project, taskId: `scratch/${slug}` }
    }
    const parts = rest.split('/')
    const numericParts: string[] = []
    for (const p of parts) {
      if (/^\d+(?:_\d+)*$/.test(p)) {
        numericParts.push(p.replace(/_/g, '.'))
      } else if (/^\d+_\d+_/.test(p)) {
        const m = p.match(/^(\d+(?:_\d+)*)_/)
        if (m) numericParts.push(m[1].replace(/_/g, '.'))
      } else {
        break
      }
    }
    if (numericParts.length > 0) return { project, taskId: numericParts[numericParts.length - 1] }
    return { project, taskId: '' }
  }

  const navigateProject = (id: string) => {
    void usePMStore.getState().openProject(id)
    close()
  }

  const navigateTask = (project: string, taskId: string) => {
    if (taskId) {
      void usePMStore.getState().goToTaskTarget(project, taskId)
    } else {
      void usePMStore.getState().openProject(project)
    }
    close()
  }

  const navigatePM = (path: string) => {
    const target = extractPMTarget(path)
    if (target) navigateTask(target.project, target.taskId)
  }

  const openInTab = (path: string) => {
    useTabStore.getState().openDocTab(path)
    close()
  }

  const navigateSession = (name: string) => {
    const liveSession = useSessionStore.getState().sessions.find(s => s.name === name)
    useSessionStore.getState().setActiveSession(name)
    useTabStore.getState().openAgentTab(name)
    const liveProjectId = liveSession
      ? extractProjectFromWorkingDir(liveSession.working_dir, useSessionStore.getState().vaultRoot)
      : null
    if (liveProjectId && liveSession?.task_id) {
      void usePMStore.getState().goToTaskTarget(liveProjectId, liveSession.task_id)
    }
    close()
  }

  const navigateHistory = (h: HistorySearchResult) => {
    if (h.jsonl_path) {
      useTabStore.getState().openAgentTab(h.name, {
        jsonlPath: h.jsonl_path,
        readOnly: true,
        ...(h.session_id ? { sessionUuid: h.session_id } : {}),
        ...(h.working_dir ? { resumeWorkingDir: h.working_dir } : {}),
      })
    }
    if (h.project_id && h.task_id) {
      void usePMStore.getState().goToTaskTarget(h.project_id, h.task_id)
    }
    close()
  }

  const resolveSessionTaskTarget = (sessionName: string | null, groupId?: string | null) => {
    if (groupId) {
      const semanticSibling = semanticResults.find(r =>
        r.group_id === groupId && !!r.project_id && !!r.entity_id,
      )
      if (semanticSibling?.project_id && semanticSibling.entity_id) {
        return { project: semanticSibling.project_id, taskId: semanticSibling.entity_id }
      }
    }

    if (sessionName) {
      const live = kw?.sessions.items.find(s => s.name === sessionName)
      if (live?.project_id && live.task_id) {
        return { project: live.project_id, taskId: live.task_id }
      }

      const history = kw?.history.items.find(h => h.name === sessionName)
      if (history?.project_id && history.task_id) {
        return { project: history.project_id, taskId: history.task_id }
      }
    }

    return null
  }

  const navigateSemanticSessionDoc = (sr: SemanticSearchResult) => {
    const sessionName = (sr.group_id || '').startsWith('session:')
      ? sr.group_id!.slice('session:'.length)
      : null
    const liveSession = sessionName
      ? useSessionStore.getState().sessions.find(x => x.name === sessionName)
      : null
    const taskTarget = resolveSessionTaskTarget(sessionName, sr.group_id)

    if (liveSession && sessionName) {
      navigateSession(sessionName)
      if (taskTarget) {
        void usePMStore.getState().goToTaskTarget(taskTarget.project, taskTarget.taskId)
      }
      return
    }

    if (sr.document_id) {
      void useTabStore.getState().openDocTab(sr.document_id)
      if (taskTarget) {
        void usePMStore.getState().goToTaskTarget(taskTarget.project, taskTarget.taskId)
      }
      close()
    } else if (sessionName) {
      // Fallback for older indexed docs missing document_id metadata.
      void useTabStore.getState().openDocTab(`State/session_cards/${sessionName}.md`)
      if (taskTarget) {
        void usePMStore.getState().goToTaskTarget(taskTarget.project, taskTarget.taskId)
      }
      close()
    } else {
      close()
    }
  }

  const navigateSemantic = (sr: SemanticSearchResult) => {
    if (sr.entity_id && sr.project_id) {
      navigateTask(sr.project_id, sr.entity_id)
    } else if (sr.group_id?.startsWith('session:')) {
      navigateSemanticSessionDoc(sr)
    } else {
      navigatePM(sr.document_id)
    }
  }

  // Results state
  const kw = kwResults?.results
  const hasKw = kwResults && kwResults.total > 0
  const hasSemantic = semanticResults.length > 0
  const hasResults = hasKw || hasSemantic
  const loading = kwLoading || semanticLoading
  const showEmpty = query.trim() && !loading && !hasResults

  // Group semantic results
  // Preview helpers
  const previewFor = (item: PreviewItem) => {
    switch (item.type) {
      case 'project': return { showPM: true, showTab: false }
      case 'task': return { showPM: true, showTab: false }
      case 'session': return { showPM: true, showTab: false }
      case 'history': return { showPM: true, showTab: false }
      case 'file': return { showPM: !!extractPMTarget(item.data.path), showTab: false }
      case 'semantic': return {
        showPM: !!(item.data.entity_id && item.data.project_id)
          || !!extractPMTarget(item.data.document_id)
          || (item.data.group_id || '').startsWith('session:'),
        showTab: false,
      }
    }
  }
  const pf = preview ? previewFor(preview) : { showPM: false, showTab: false }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[920px] p-0 gap-0 overflow-hidden max-h-[85vh] max-sm:max-w-full max-sm:w-full max-sm:h-[100dvh] max-sm:max-h-[100dvh] max-sm:m-0 max-sm:rounded-none max-sm:top-0 max-sm:translate-y-0">
        <DialogDescription className="sr-only">
          Search across tasks, sessions, files, and projects
        </DialogDescription>
        <Command shouldFilter={false} className="rounded-lg border-none">
          <div className="flex items-center">
            <CommandInput
              placeholder="Search tasks, sessions, papers..."
              value={query}
              onValueChange={handleQueryChange}
              autoFocus
              className="border-none focus:ring-0 h-11"
            />
            <div className="flex items-center gap-2 pr-3 shrink-0">
              {kwLoading && <Loader2 size={14} className="animate-spin text-muted-foreground" />}
              {/* AI search trigger — visible whenever there's a query. Sparkle when idle,
                  spinner while in flight, checkmark when complete. */}
              {query.trim() && (
                <button
                  type="button"
                  onClick={() => { if (!aiInvoked && !semanticLoading) invokeAI(query) }}
                  disabled={aiInvoked || semanticLoading}
                  title={
                    semanticLoading ? 'Searching with AI…'
                    : aiInvoked ? 'AI search complete'
                    : 'Search with AI (Shift+Enter)'
                  }
                  className={cn(
                    'flex items-center gap-1 px-2 py-1 rounded type-micro font-medium',
                    'border transition-colors',
                    semanticLoading
                      ? 'border-purple-400/40 bg-[rgba(167,139,250,0.10)] text-purple-200 cursor-default'
                      : aiInvoked
                      ? 'border-purple-400/20 bg-[rgba(167,139,250,0.04)] text-purple-300/70 cursor-default'
                      : 'border-purple-400/30 bg-[rgba(167,139,250,0.06)] text-purple-300 hover:bg-[rgba(167,139,250,0.15)] hover:border-purple-400/50 cursor-pointer',
                  )}
                >
                  {semanticLoading
                    ? <Loader2 size={12} className="animate-spin" />
                    : aiInvoked
                    ? <Check size={12} />
                    : <Sparkles size={12} />}
                  <span>AI</span>
                  {!semanticLoading && !aiInvoked && (
                    <kbd className="type-caption opacity-60 ml-1 font-mono">⇧↵</kbd>
                  )}
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row min-h-[200px] sm:min-h-[200px] max-sm:flex-1 max-sm:overflow-hidden">
            {/* Results list — unified categories from keyword + semantic */}
            <CommandList className={cn("max-h-[60vh] overflow-y-auto flex-1 min-w-0", mobilePreview && "max-sm:hidden")}>
              {showEmpty && <CommandEmpty>No results found</CommandEmpty>}

              {/* Tasks — keyword tasks first, then semantic tasks */}
              {(() => {
                const kwTasks = (kw?.tasks.items || []).map(t => (
                  <CommandItem
                    key={`task-${t.project}-${t.id}`}
                    value={`task-${t.project}-${t.id}`}
                    onSelect={() => handleSelect({ type: 'task', data: t }, () => navigateTask(t.project, t.id))}
                    onMouseEnter={() => setPreviewDebounced({ type: 'task', data: t })}
                    className="flex items-center gap-2 py-1.5 cursor-pointer"
                  >
                    <span className="type-caption font-mono text-muted-foreground w-[56px] shrink-0 truncate">{t.id}</span>
                    <span className="type-label truncate flex-1">{t.title}</span>
                    {formatDate(t.last_activity) && (
                      <span className="type-caption text-muted-foreground shrink-0">{formatDate(t.last_activity)}</span>
                    )}
                    <StatusDot status={normalizeStatus(t.status) as any} size="sm" />
                  </CommandItem>
                ))
                const semTasks = semanticResults
                  .filter(sr => ['task', 'domain', 'project'].includes(sr.doc_type))
                  .map(sr => (
                    <CommandItem
                      key={`sem-${sr.id}`}
                      value={`sem-${sr.id}`}
                      onSelect={() => handleSelect({ type: 'semantic', data: sr }, () => navigateSemantic(sr))}
                      onMouseEnter={() => setPreviewDebounced({ type: 'semantic', data: sr })}
                      className="flex items-center gap-2 py-1.5 cursor-pointer"
                    >
                      <DocTypeIcon type={sr.doc_type} />
                      <span className="type-label truncate flex-1">{sr.title || sr.document_id.split('/').pop()}</span>
                      {sr.mtime ? <span className="type-caption text-muted-foreground shrink-0">{formatDate(sr.mtime)}</span> : null}
                      <Sparkles size={9} className="text-purple-400 shrink-0" />
                    </CommandItem>
                  ))
                const all = [...kwTasks, ...semTasks]
                if (all.length === 0) return null
                return (
                  <CollapsibleGroup label="Tasks" icon={CheckSquare} count={all.length} totalCount={all.length}>
                    {all}
                  </CollapsibleGroup>
                )
              })()}

              {/* Sessions — keyword live sessions + keyword history + semantic sessions */}
              {(() => {
                const kwSessions = (kw?.sessions.items || []).map(s => (
                  <CommandItem
                    key={`session-${s.name}`}
                    value={`session-${s.name}`}
                    onSelect={() => handleSelect({ type: 'session', data: s }, () => navigateSession(s.name))}
                    onMouseEnter={() => setPreviewDebounced({ type: 'session', data: s })}
                    className="flex items-center gap-2 py-1.5 cursor-pointer"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
                    <span className="type-label truncate flex-1">{s.task_title || s.name}</span>
                    {s.role && <span className="type-caption text-muted-foreground shrink-0">{s.role}</span>}
                    <span className="type-caption text-green-400/70 shrink-0">active</span>
                  </CommandItem>
                ))
                const kwHistory = (kw?.history.items || []).map(h => (
                  <CommandItem
                    key={`history-${h.name}-${h.ended}`}
                    value={`history-${h.name}-${h.ended}`}
                    onSelect={() => handleSelect({ type: 'history', data: h }, () => navigateHistory(h))}
                    onMouseEnter={() => setPreviewDebounced({ type: 'history', data: h })}
                    className="flex items-center gap-2 py-1.5 cursor-pointer"
                  >
                    <Clock size={12} className="text-muted-foreground shrink-0" />
                    <span className="type-label truncate flex-1">{h.task_title || h.name}</span>
                    {h.ended && <span className="type-caption text-muted-foreground shrink-0">{formatDate(h.ended) || h.ended}</span>}
                  </CommandItem>
                ))
                const semSessions = semanticResults
                  .filter(sr => ['session_search', 'session_card', 'receipt'].includes(sr.doc_type))
                  .map(sr => (
                    <CommandItem
                      key={`sem-${sr.id}`}
                      value={`sem-${sr.id}`}
                      onSelect={() => handleSelect({ type: 'semantic', data: sr }, () => navigateSemantic(sr))}
                      onMouseEnter={() => setPreviewDebounced({ type: 'semantic', data: sr })}
                      className="flex items-center gap-2 py-1.5 cursor-pointer"
                    >
                      <MonitorPlay size={12} className="text-green-400 shrink-0" />
                      <span className="type-label truncate flex-1">{sr.title || sr.document_id.split('/').pop()}</span>
                      {sr.mtime ? <span className="type-caption text-muted-foreground shrink-0">{formatDate(sr.mtime)}</span> : null}
                      <Sparkles size={9} className="text-purple-400 shrink-0" />
                    </CommandItem>
                  ))
                const all = [...kwSessions, ...kwHistory, ...semSessions]
                if (all.length === 0) return null
                return (
                  <CollapsibleGroup label="Sessions" icon={MonitorPlay} count={all.length} totalCount={all.length}>
                    {all}
                  </CollapsibleGroup>
                )
              })()}

              {/* Papers — semantic only */}
              {(() => {
                const papers = semanticResults
                  .filter(sr => sr.doc_type === 'paper')
                  .map(sr => (
                    <CommandItem
                      key={`sem-${sr.id}`}
                      value={`sem-${sr.id}`}
                      onSelect={() => handleSelect({ type: 'semantic', data: sr }, () => navigateSemantic(sr))}
                      onMouseEnter={() => setPreviewDebounced({ type: 'semantic', data: sr })}
                      className="flex flex-col items-start gap-0.5 py-1.5 cursor-pointer"
                    >
                      <div className="flex items-center gap-2 w-full">
                        <BookOpen size={12} className="text-amber-400 shrink-0" />
                        <span className="type-label truncate flex-1">{sr.title || sr.document_id.split('/').pop()}</span>
                      </div>
                      {sr.text && <span className="type-micro text-muted-foreground truncate w-full pl-[20px]">{sr.text.slice(0, 100)}</span>}
                    </CommandItem>
                  ))
                if (papers.length === 0) return null
                return (
                  <CollapsibleGroup label="Papers" icon={BookOpen} count={papers.length} totalCount={papers.length}>
                    {papers}
                  </CollapsibleGroup>
                )
              })()}

              {/* Artifacts — semantic + keyword files */}
              {(() => {
                const semArtifacts = semanticResults
                  .filter(sr => ['artifact', 'worklog', 'verification'].includes(sr.doc_type))
                  .map(sr => (
                    <CommandItem
                      key={`sem-${sr.id}`}
                      value={`sem-${sr.id}`}
                      onSelect={() => handleSelect({ type: 'semantic', data: sr }, () => navigateSemantic(sr))}
                      onMouseEnter={() => setPreviewDebounced({ type: 'semantic', data: sr })}
                      className="flex flex-col items-start gap-0.5 py-1.5 cursor-pointer"
                    >
                      <div className="flex items-center gap-2 w-full">
                        <DocTypeIcon type={sr.doc_type} />
                        <span className="type-label truncate flex-1">{sr.title || sr.document_id.split('/').pop()}</span>
                        <CopyEntityButton path={sr.document_id} />
                      </div>
                      {sr.text && <span className="type-micro text-muted-foreground truncate w-full pl-[21px]">{sr.text.slice(0, 100)}</span>}
                    </CommandItem>
                  ))
                const kwFiles = (kw?.files.items || []).map(f => (
                  <CommandItem
                    key={`file-${f.path}`}
                    value={`file-${f.path}`}
                    onSelect={() => handleSelect({ type: 'file', data: f }, () => openInTab(f.path))}
                    onMouseEnter={() => setPreviewDebounced({ type: 'file', data: f })}
                    className="flex items-center gap-2 py-1.5 cursor-pointer"
                  >
                    <FileText size={12} className="text-muted-foreground shrink-0" />
                    <span className="type-label truncate flex-1">{f.path}</span>
                    {formatDate(f.mtime) && (
                      <span className="type-caption text-muted-foreground shrink-0">{formatDate(f.mtime)}</span>
                    )}
                  </CommandItem>
                ))
                const all = [...semArtifacts, ...kwFiles]
                if (all.length === 0) return null
                return (
                  <CollapsibleGroup label="Artifacts & Files" icon={FileText} count={all.length} totalCount={all.length}>
                    {all}
                  </CollapsibleGroup>
                )
              })()}

              {/* Other — semantic briefings, syntheses, goals, etc. */}
              {(() => {
                const other = semanticResults
                  .filter(sr => ['briefing', 'synthesis', 'goal', 'journal', 'agent_spec', 'queue'].includes(sr.doc_type))
                  .map(sr => (
                    <CommandItem
                      key={`sem-${sr.id}`}
                      value={`sem-${sr.id}`}
                      onSelect={() => handleSelect({ type: 'semantic', data: sr }, () => navigateSemantic(sr))}
                      onMouseEnter={() => setPreviewDebounced({ type: 'semantic', data: sr })}
                      className="flex items-center gap-2 py-1.5 cursor-pointer"
                    >
                      <DocTypeIcon type={sr.doc_type} />
                      <span className="type-label truncate flex-1">{sr.title || sr.document_id.split('/').pop()}</span>
                    </CommandItem>
                  ))
                if (other.length === 0) return null
                return (
                  <CollapsibleGroup label="Other" icon={FileText} count={other.length} totalCount={other.length}>
                    {other}
                  </CollapsibleGroup>
                )
              })()}

              {/* Projects — keyword only */}
              {kw && kw.projects.items.length > 0 && (
                <CollapsibleGroup label="Projects" icon={FolderKanban} count={kw.projects.total} totalCount={kw.projects.items.length}>
                  {kw.projects.items.map(p => (
                    <CommandItem
                      key={`project-${p.id}`}
                      value={`project-${p.id}`}
                      onSelect={() => handleSelect({ type: 'project', data: p }, () => navigateProject(p.id))}
                      onMouseEnter={() => setPreviewDebounced({ type: 'project', data: p })}
                      className="flex items-center gap-2 py-1.5 cursor-pointer"
                    >
                      <FolderKanban size={13} className="text-muted-foreground shrink-0" />
                      <span className="type-label font-medium truncate flex-1">{p.title}</span>
                      {formatDate(p.last_activity) && (
                        <span className="type-caption text-muted-foreground shrink-0">{formatDate(p.last_activity)}</span>
                      )}
                      <StatusDot status={normalizeStatus(p.status) as any} size="sm" />
                    </CommandItem>
                  ))}
                </CollapsibleGroup>
              )}

              {/* AI search state is shown in the input-row button (top right);
                  bottom-of-list hint removed. */}
            </CommandList>

            {/* Preview panel — wider, scrollable; full-screen on mobile when mobilePreview */}
            {(hasResults || mobilePreview) && (
              <div className={cn(
                "sm:w-[340px] sm:shrink-0 sm:border-l border-border p-3 overflow-y-auto sm:max-h-[60vh] flex flex-col",
                mobilePreview ? "max-sm:flex max-sm:flex-1" : "max-sm:hidden",
              )}>
                {/* Back button — mobile only */}
                <button
                  onClick={() => setMobilePreview(false)}
                  className="sm:hidden flex items-center gap-1 type-label text-muted-foreground hover:text-foreground mb-3 -ml-1"
                >
                  <ChevronLeft size={14} />
                  Back to results
                </button>
                <PreviewPanel
                  item={preview}
                  onNavigatePM={() => {
                    if (!preview) return
                    switch (preview.type) {
                      case 'project': navigateProject(preview.data.id); break
                      case 'task': navigateTask(preview.data.project, preview.data.id); break
                      case 'session': navigateSession(preview.data.name); break
                      case 'history': navigateHistory(preview.data); break
                      case 'file': navigatePM(preview.data.path); break
                      case 'semantic': navigateSemantic(preview.data); break
                    }
                  }}
                  onOpenTab={() => {
                    if (!preview) return
                    switch (preview.type) {
                      case 'file': openInTab(preview.data.path); break
                      case 'semantic': openInTab(preview.data.document_id); break
                      default: break
                    }
                  }}
                  showPMButton={pf.showPM}
                  showTabButton={pf.showTab}
                />
              </div>
            )}
          </div>

          {/* Footer */}
          {hasResults && (
            <div className="border-t border-border px-3 py-1.5 flex items-center justify-between">
              <span className="type-caption text-muted-foreground">
                {(kwResults?.total || 0) + semanticResults.length} results
                {semanticLoading && ' (AI searching…)'}
              </span>
              <span className="type-caption text-muted-foreground">
                ↑↓ navigate · ↵ open · esc close
              </span>
            </div>
          )}
        </Command>
      </DialogContent>
    </Dialog>
  )
}



// ---------------------------------------------------------------------------
// GlobalSearchTrigger — clickable bar for the home screen
// ---------------------------------------------------------------------------

export function GlobalSearchTrigger({ onClick }: { onClick: () => void }) {
  const isMac = navigator.platform?.toLowerCase().includes('mac')

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2 px-3 py-2 rounded-md',
        'bg-[rgba(255,255,255,0.03)] border border-border',
        'hover:border-[var(--color-border-strong)] hover:bg-[rgba(255,255,255,0.05)]',
        'transition-all duration-150 cursor-pointer text-left',
        'focus:outline-none focus:border-[var(--color-accent)]',
      )}
    >
      <Search size={14} className="text-muted-foreground shrink-0" />
      <span className="type-label text-muted-foreground flex-1">
        Search tasks, sessions, files...
      </span>
      <kbd className="type-caption text-muted-foreground bg-[rgba(255,255,255,0.06)] border border-border rounded px-1.5 py-0.5 font-mono">
        {isMac ? '⌘' : 'Ctrl+'}K
      </kbd>
    </button>
  )
}

// ---------------------------------------------------------------------------
// useGlobalSearchShortcut — Cmd+K / Ctrl+K handler
// ---------------------------------------------------------------------------

export function useGlobalSearchShortcut(onOpen: () => void) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        onOpen()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onOpen])
}
