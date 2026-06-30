/**
 * MentionAutocomplete — @-triggered search popup for the chat textarea.
 *
 * Uses the same dual-fire search as Cmd+K (GlobalSearch):
 *   Fire 1: keyword search (unifiedSearch) — fast, 200ms debounce
 *   Fire 2: semantic search (semanticSearch via Qdrant) — richer, 300ms debounce
 *
 * Features:
 * - Own search input (keystrokes don't leak to chat textarea)
 * - Multi-select: toggle checkmarks, insert all selected at once
 * - Results grouped like Cmd+K: Tasks, Sessions, Papers, Artifacts & Files
 *
 * Agentic mode code is preserved but hidden (not currently used).
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Search, Sparkles, Star, Circle, Loader2,
  CheckSquare, Square, CheckCircle, File, ListTodo, History,
  MonitorPlay, BookOpen, FileText, ChevronDown,
} from 'lucide-react'
import * as api from '@/lib/api.ts'
import type { GlobalSearchResults, SemanticSearchResult } from '@/lib/api.ts'
import { useSessionStore } from '@/stores/session-store.ts'
import type { Session } from '@/lib/types.ts'
import { buildTaskFilePath } from '@/lib/paths.ts'
import { ActionButton } from '@/components/primitives'

export type MentionSelection =
  | { kind: 'file'; path: string; replaceStart: number; replaceEnd: number }
  | { kind: 'session'; session: Session; replaceStart: number; replaceEnd: number }

interface MentionAutocompleteProps {
  text: string
  cursorPos: number
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  onSelect: (selection: MentionSelection) => void
  onClose: () => void
  chatContext?: string
}

function detectAtTrigger(text: string, cursorPos: number): number | null {
  if (cursorPos < 1) return null
  if (text[cursorPos - 1] === '@' && (cursorPos === 1 || /\s/.test(text[cursorPos - 2]))) {
    return cursorPos - 1
  }
  return null
}

// --- Agentic mode helpers (preserved, not currently used) ---
// @ts-ignore — preserved for future agentic mode
function _ConfidenceIcon({ confidence }: { confidence: string }) {
  if (confidence === 'high') return <Star size={12} className="text-amber-400 fill-amber-400 shrink-0" />
  if (confidence === 'medium') return <Circle size={12} className="text-muted-foreground shrink-0" />
  return <Circle size={10} className="text-muted-foreground/50 shrink-0" />
}

// @ts-ignore — preserved for future agentic mode
function _entityLabel(type: string): string {
  return ({ task: 'Task', worklog: 'Worklog', artifact: 'Artifact', receipt: 'Receipt',
    session: 'Session', goal: 'Goal', agent_spec: 'Agent', file: 'File',
    session_card: 'Session', domain: 'Domain', project: 'Project', verification: 'Check',
  } as Record<string, string>)[type] || type
}
// --- end agentic helpers ---

// Keep for backwards compat
export function findMentionTrigger(text: string, cursorPos: number): { query: string; start: number } | null {
  let i = cursorPos - 1
  while (i >= 0) {
    if (text[i] === '@' && (i === 0 || /\s/.test(text[i - 1]))) {
      const query = text.slice(i + 1, cursorPos)
      return !/\s/.test(query) ? { query, start: i } : null
    }
    if (/\s/.test(text[i])) return null
    i--
  }
  return null
}

// Semantic result doc type helpers (matching GlobalSearch)
function docTypeLabel(t: string): string {
  const labels: Record<string, string> = {
    task: 'Task', worklog: 'Worklog', artifact: 'Artifact', receipt: 'Receipt',
    session_card: 'Session', session_search: 'Session', verification: 'Check',
    agent_spec: 'Agent', briefing: 'Briefing', synthesis: 'Synthesis', goal: 'Goal',
    domain: 'Domain', project: 'Project', journal: 'Journal', paper: 'Paper',
  }
  return labels[t] || t
}

const DEFAULT_VISIBLE = 3

export function MentionAutocomplete({ text, cursorPos, textareaRef, onSelect, onClose: _onClose, chatContext: _chatContext }: MentionAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [atPosition, setAtPosition] = useState(-1)
  const [query, setQuery] = useState('')
  // Keyword results (fast)
  const [kwResults, setKwResults] = useState<GlobalSearchResults | null>(null)
  // Semantic results (slower, richer)
  const [semanticResults, setSemanticResults] = useState<SemanticSearchResult[]>([])
  const [kwLoading, setKwLoading] = useState(false)
  const [semanticLoading, setSemanticLoading] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  // Collapsible group state
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const inputRef = useRef<HTMLInputElement>(null)
  const kwDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const semDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sessions = useSessionStore(s => s.sessions)

  // Detect @ trigger
  useEffect(() => {
    if (isOpen) return
    const pos = detectAtTrigger(text, cursorPos)
    if (pos !== null) {
      setAtPosition(pos)
      setIsOpen(true)
      setQuery('')
      setKwResults(null)
      setSemanticResults([])
      setSelected(new Set())
      setExpandedGroups(new Set())
    }
  }, [text, cursorPos, isOpen])

  // Focus popup input
  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 50)
  }, [isOpen])

  // Intercept textarea keystrokes
  useEffect(() => {
    if (!isOpen) return
    const textarea = textareaRef.current
    if (!textarea) return

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault(); e.stopPropagation(); closePopup(); return
      }
      if (e.key === 'Enter') {
        if (document.activeElement === inputRef.current) {
          e.preventDefault(); return
        }
        e.preventDefault(); e.stopPropagation(); return
      }
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
        e.preventDefault(); e.stopPropagation()
        setQuery(q => q + e.key)
        inputRef.current?.focus()
        return
      }
      if (e.key === 'Backspace') {
        e.preventDefault(); e.stopPropagation()
        setQuery(q => q.length === 0 ? (closePopup(), q) : q.slice(0, -1))
        return
      }
    }

    textarea.addEventListener('keydown', handler, { capture: true })
    return () => textarea.removeEventListener('keydown', handler, { capture: true })
  }, [isOpen])

  // Dual-fire search: keyword (fast) + semantic (slower) — same as Cmd+K
  useEffect(() => {
    if (!isOpen) return
    if (kwDebounceRef.current) clearTimeout(kwDebounceRef.current)
    if (semDebounceRef.current) clearTimeout(semDebounceRef.current)
    const q = query.trim()
    if (q.length < 2) {
      setKwResults(null); setSemanticResults([]); setKwLoading(false); setSemanticLoading(false)
      return
    }

    // Fire 1: Keyword search (200ms debounce)
    setKwLoading(true)
    kwDebounceRef.current = setTimeout(async () => {
      try {
        const data = await api.unifiedSearch(q, { limit: 8 })
        setKwResults(data)
      } catch { setKwResults(null) }
      setKwLoading(false)
    }, 200)

    // Fire 2: Semantic search (300ms debounce)
    setSemanticLoading(true)
    semDebounceRef.current = setTimeout(async () => {
      try {
        const data = await api.semanticSearch(q, 50)
        setSemanticResults(data.results)
      } catch { setSemanticResults([]) }
      setSemanticLoading(false)
    }, 300)

    return () => {
      if (kwDebounceRef.current) clearTimeout(kwDebounceRef.current)
      if (semDebounceRef.current) clearTimeout(semDebounceRef.current)
    }
  }, [query, isOpen])

  const closePopup = useCallback(() => {
    setIsOpen(false); setQuery(''); setKwResults(null); setSemanticResults([]); setSelected(new Set())
    _onClose()
    textareaRef.current?.focus()
  }, [textareaRef, _onClose])

  const toggleSelect = useCallback((path: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }, [])

  const insertSelected = useCallback(() => {
    if (selected.size === 0) return
    const paths = Array.from(selected)
    const combined = paths.map(p => `@${p}`).join(' ')
    onSelect({ kind: 'file', path: combined.slice(1), replaceStart: atPosition, replaceEnd: atPosition + 1 })
    setIsOpen(false); setQuery(''); setSelected(new Set())
  }, [selected, atPosition, onSelect])

  const handleSingleSelect = useCallback((path: string) => {
    if (selected.size > 0) {
      toggleSelect(path)
    } else {
      onSelect({ kind: 'file', path, replaceStart: atPosition, replaceEnd: atPosition + 1 })
      setIsOpen(false); setQuery('')
    }
  }, [selected.size, toggleSelect, atPosition, onSelect])

  const handleSelectSession = useCallback((session: Session) => {
    onSelect({ kind: 'session', session, replaceStart: atPosition, replaceEnd: atPosition + 1 })
    setIsOpen(false); setQuery('')
  }, [atPosition, onSelect])

  if (!isOpen) return null

  // --- Build grouped results (same categories as Cmd+K) ---
  const kw = kwResults?.results
  const loading = kwLoading || semanticLoading
  const q = query.trim()

  const statusBadge = (status: string) => (
    <span className={`type-caption shrink-0 px-1.5 py-px rounded-full ${
      ['executing', 'working'].includes(status) ? 'bg-[rgba(59,184,122,0.15)] text-[var(--color-green)]'
      : status === 'done' ? 'bg-[rgba(130,130,160,0.08)] text-muted-foreground'
      : 'bg-[rgba(234,179,8,0.12)] text-yellow-400'
    }`}>{status}</span>
  )

  // Helper to render a selectable row
  const renderRow = (key: string, path: string, icon: React.ReactNode, label: string, badge?: React.ReactNode, subtitle?: string, onClick?: () => void) => {
    const isSelected = selected.has(path)
    return (
      <ActionButton
        key={key}
        variant="ghost"
        size="default"
        onClick={onClick || (() => handleSingleSelect(path))}
        onContextMenu={e => { e.preventDefault(); toggleSelect(path) }}
        className={`h-auto w-full justify-start rounded-md px-2 py-1.5 text-left ${isSelected ? 'bg-[rgba(130,130,160,0.12)]' : ''}`}
      >
        <div className="flex items-center gap-2">
          {selected.size > 0
            ? (isSelected
                ? <CheckSquare size={13} className="text-accent shrink-0" />
                : <Square size={13} className="text-muted-foreground shrink-0" />)
            : icon
          }
          <span className="type-label truncate flex-1">{label}</span>
          {badge}
        </div>
        {subtitle && (
          <div className="type-micro text-muted-foreground mt-0.5 pl-[21px] truncate">{subtitle}</div>
        )}
      </ActionButton>
    )
  }

  // Collapsible group component
  const renderGroup = (groupKey: string, label: string, icon: React.ReactNode, items: React.ReactNode[]) => {
    if (items.length === 0) return null
    const isExpanded = expandedGroups.has(groupKey)
    const visible = isExpanded ? items : items.slice(0, DEFAULT_VISIBLE)
    const remaining = items.length - DEFAULT_VISIBLE
    return (
      <div className="mb-1" key={groupKey}>
        <div className="type-caption text-muted-foreground uppercase tracking-wider px-1.5 py-1 flex items-center gap-1.5">
          {icon}
          <span>{label}</span>
          <span className="type-caption text-muted-foreground/60">({items.length})</span>
        </div>
        {visible}
        {!isExpanded && remaining > 0 && (
          <ActionButton
            variant="ghost"
            size="sm"
            onClick={() => setExpandedGroups(prev => new Set(prev).add(groupKey))}
            className="w-full justify-start gap-1.5 rounded px-2 py-1 text-muted-foreground"
          >
            <ChevronDown size={11} className="shrink-0" />
            +{remaining} more
          </ActionButton>
        )}
      </div>
    )
  }

  // --- Build category items (same structure as GlobalSearch) ---

  // Tasks: keyword tasks + semantic task/domain/project docs
  const taskItems: React.ReactNode[] = []
  for (const t of (kw?.tasks.items || [])) {
    const taskPath = buildTaskFilePath(t.project, t.id)
    taskItems.push(renderRow(
      `task-${t.project}-${t.id}`, taskPath,
      <ListTodo size={13} className="text-muted-foreground shrink-0" />,
      t.title, statusBadge(t.status),
    ))
  }
  for (const sr of semanticResults.filter(sr => ['task', 'domain', 'project'].includes(sr.doc_type))) {
    const path = sr.entity_id && sr.project_id ? buildTaskFilePath(sr.project_id, sr.entity_id) : sr.document_id
    // Skip duplicates already in keyword results
    if (kw?.tasks.items.some(t => buildTaskFilePath(t.project, t.id) === path)) continue
    taskItems.push(renderRow(
      `sem-${sr.id}`, path,
      <ListTodo size={13} className="text-muted-foreground shrink-0" />,
      sr.title || sr.document_id.split('/').pop() || '',
      <Sparkles size={9} className="text-purple-400 shrink-0" />,
    ))
  }

  // Sessions: keyword live + keyword history + semantic session docs
  const sessionItems: React.ReactNode[] = []
  for (const s of (kw?.sessions.items || [])) {
    const storeSession = sessions.find(ss => ss.name === s.name)
    if (storeSession) {
      sessionItems.push(renderRow(
        `session-${s.name}`, s.name,
        <div className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />,
        s.task_title || s.name,
        <span className="type-caption text-green-400/70 shrink-0">active</span>,
        undefined,
        () => handleSelectSession(storeSession),
      ))
    } else {
      const path = (s.task_id && s.project_id) ? buildTaskFilePath(s.project_id, s.task_id) : s.name
      sessionItems.push(renderRow(
        `session-${s.name}`, path,
        <MonitorPlay size={13} className="text-green-400 shrink-0" />,
        s.task_title || s.name,
        statusBadge(s.status),
      ))
    }
  }
  for (const h of (kw?.history.items || [])) {
    const path = h.jsonl_path || h.name
    sessionItems.push(renderRow(
      `history-${h.name}-${h.ended}`, path,
      <History size={13} className="text-muted-foreground shrink-0" />,
      h.task_title || h.name,
      h.ended ? <span className="type-caption text-muted-foreground shrink-0">{h.ended}</span> : undefined,
      h.outcome ? h.outcome.slice(0, 80) : undefined,
    ))
  }
  for (const sr of semanticResults.filter(sr => ['session_search', 'session_card', 'receipt'].includes(sr.doc_type))) {
    sessionItems.push(renderRow(
      `sem-${sr.id}`, sr.document_id,
      <MonitorPlay size={12} className="text-green-400 shrink-0" />,
      sr.title || sr.document_id.split('/').pop() || '',
      <Sparkles size={9} className="text-purple-400 shrink-0" />,
    ))
  }

  // Papers: semantic only
  const paperItems: React.ReactNode[] = []
  for (const sr of semanticResults.filter(sr => sr.doc_type === 'paper')) {
    paperItems.push(renderRow(
      `sem-${sr.id}`, sr.document_id,
      <BookOpen size={12} className="text-amber-400 shrink-0" />,
      sr.title || sr.document_id.split('/').pop() || '',
      undefined,
      sr.text ? sr.text.slice(0, 80) : undefined,
    ))
  }

  // Artifacts & Files: semantic artifacts/worklogs + keyword files
  const fileItems: React.ReactNode[] = []
  for (const sr of semanticResults.filter(sr => ['artifact', 'worklog', 'verification'].includes(sr.doc_type))) {
    fileItems.push(renderRow(
      `sem-${sr.id}`, sr.document_id,
      <FileText size={12} className="text-purple-400 shrink-0" />,
      sr.title || sr.document_id.split('/').pop() || '',
      <span className="type-caption text-muted-foreground shrink-0">{docTypeLabel(sr.doc_type)}</span>,
    ))
  }
  for (const f of (kw?.files.items || [])) {
    fileItems.push(renderRow(
      `file-${f.path}`, f.path,
      <File size={13} className="text-muted-foreground shrink-0" />,
      f.name,
      <span className="type-caption text-muted-foreground shrink-0 truncate max-w-[180px]">{f.path}</span>,
    ))
  }

  // Other: semantic briefings, goals, journals, etc.
  const otherItems: React.ReactNode[] = []
  for (const sr of semanticResults.filter(sr => ['briefing', 'synthesis', 'goal', 'journal', 'agent_spec'].includes(sr.doc_type))) {
    otherItems.push(renderRow(
      `sem-${sr.id}`, sr.document_id,
      <FileText size={12} className="text-muted-foreground shrink-0" />,
      sr.title || sr.document_id.split('/').pop() || '',
      <span className="type-caption text-muted-foreground shrink-0">{docTypeLabel(sr.doc_type)}</span>,
    ))
  }

  const hasResults = taskItems.length > 0 || sessionItems.length > 0 || paperItems.length > 0 || fileItems.length > 0 || otherItems.length > 0

  return (
    <div className="absolute bottom-full left-0 right-0 mb-1 z-50">
      <div className="mx-4 rounded-lg border border-[var(--color-border-glass)] bg-popover shadow-[var(--shadow-float)] overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 border-b border-[var(--color-border-glass)]">
          <Search size={13} className="text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Escape') { e.preventDefault(); closePopup() }
            }}
            placeholder="Search tasks, sessions, papers..."
            className="flex-1 bg-transparent border-none outline-none type-label text-foreground placeholder:text-muted-foreground"
            autoFocus
          />
          {loading && <Loader2 size={13} className="animate-spin text-muted-foreground shrink-0" />}
        </div>

        {/* Results */}
        <div className="max-h-[360px] overflow-y-auto">
          {q.length < 2 ? (
            <div className="py-4 text-center type-micro text-muted-foreground">
              Type to search...
            </div>
          ) : !hasResults && !loading ? (
            <div className="py-4 text-center type-micro text-muted-foreground">
              No results for &ldquo;{q}&rdquo;
            </div>
          ) : !hasResults && loading ? (
            <div className="py-5 text-center">
              <Loader2 size={16} className="animate-spin mx-auto mb-1.5 text-muted-foreground" />
              <div className="type-micro text-muted-foreground">Searching...</div>
            </div>
          ) : (
            <div className="p-1.5">
              {renderGroup('tasks', 'Tasks', <ListTodo size={10} />, taskItems)}
              {renderGroup('sessions', 'Sessions', <MonitorPlay size={10} />, sessionItems)}
              {renderGroup('papers', 'Papers', <BookOpen size={10} />, paperItems)}
              {renderGroup('files', 'Artifacts & Files', <FileText size={10} />, fileItems)}
              {renderGroup('other', 'Other', <FileText size={10} />, otherItems)}
              {semanticLoading && (
                <div className="px-2 py-1.5 flex items-center gap-1.5">
                  <Sparkles size={11} className="text-purple-400 animate-pulse" />
                  <span className="type-caption text-muted-foreground">Finding more with AI...</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-[var(--color-border-glass)] px-2.5 py-1 flex items-center justify-between">
          {selected.size > 0 ? (
            <ActionButton
              variant="back"
              size="sm"
              onClick={insertSelected}
              className="gap-1 text-accent hover:text-foreground"
            >
              <CheckCircle size={12} />
              Insert {selected.size} reference{selected.size > 1 ? 's' : ''}
            </ActionButton>
          ) : (
            <span className="type-caption text-muted-foreground">
              Click to insert · right-click to multi-select
            </span>
          )}
          <span className="type-caption text-muted-foreground">esc</span>
        </div>
      </div>
    </div>
  )
}
