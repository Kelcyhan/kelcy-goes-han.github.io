import { useState, useRef, useCallback, useEffect, memo } from 'react'
import { ExternalLink, X, Zap } from 'lucide-react'
import type { Session } from '@/lib/types.ts'
import { useSessionStore } from '@/stores/session-store.ts'
import { useTabStore } from '@/stores/tab-store.ts'
import { usePMStore } from '@/stores/pm-store.ts'
import { SegmentedControl, StatusDot } from '@/components/primitives'
import { toAgentSessionStatus } from '@/components/primitives/status-utils.ts'
import * as api from '@/lib/api.ts'
import { SessionGlanceTooltip } from '@/components/home/SessionGlanceTooltip.tsx'
import { ChatContainer } from '@/components/chat/ChatContainer.tsx'
import { InputBar } from '@/components/chat/InputBar.tsx'
import type { InputBarHandle } from '@/components/chat/InputBar.tsx'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog.tsx'
import { Button } from '@/components/ui/button.tsx'

type AgentTab = 'summary' | 'chat'

function borderClass(status: string | undefined): string {
  const s = toAgentSessionStatus(status || 'closed')
  if (s === 'active') return 'task-border-attention'
  if (s === 'working') return 'task-border-active'
  return 'task-border-inactive'
}

function roleLabel(session: Session): string {
  const r = session.agent_role
  if (r === 'task-agent') return 'task-agent'
  if (r === 'domain-agent') return 'domain-agent'
  if (r === 'concierge') return 'concierge'
  return r || 'agent'
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

// --- Summary panel -----------------------------------------------------------

function SummaryPanel({ session }: { session: Session }) {
  const card = usePMStore(s => s.sessionCards[session.name])
  const fallback = session.final_message ? stripMarkdown(session.final_message).slice(0, 500) : null

  return (
    <div className="flex flex-col gap-2">
      {card?.progress && card.progress.length > 0 && (
        <ul className="list-disc pl-4 m-0 type-label leading-relaxed text-foreground">
          {card.progress.map((b, i) => (
            <li key={i} className="my-0.5">{b}</li>
          ))}
        </ul>
      )}
      {!card?.progress?.length && card?.summary && (
        <div className="type-label leading-relaxed text-foreground whitespace-pre-wrap">
          {card.summary}
        </div>
      )}
      {!card && fallback && (
        <div className="type-label leading-relaxed text-foreground whitespace-pre-wrap">
          {fallback}
        </div>
      )}
      {!card?.progress?.length && !card?.summary && !fallback && (
        <div className="type-micro text-muted-foreground italic">No summary yet.</div>
      )}
      {card?.status && (
        <div className="type-caption text-muted-foreground mt-1">
          Shadow: <span className="font-mono">{card.status}</span>
        </div>
      )}
    </div>
  )
}

// --- Chat panel --------------------------------------------------------------

function ChatPanel({ sessionName }: { sessionName: string }) {
  const inputBarRef = useRef<InputBarHandle>(null)
  return (
    <div className="flex flex-col h-full min-h-0 chat-compact">
      <div className="flex-1 min-h-0 flex flex-col">
        <ChatContainer sessionName={sessionName} inputBarRef={inputBarRef} compact />
      </div>
      <div className="border-t border-[var(--color-border-subtle)]">
        <InputBar ref={inputBarRef} sessionName={sessionName} />
      </div>
    </div>
  )
}

// --- Renameable title --------------------------------------------------------

function RenameableTitle({ session, title }: { session: Session; title: string }) {
  const elRef = useRef<HTMLSpanElement>(null)
  const [editing, setEditing] = useState(false)
  const editingRef = useRef(false)
  editingRef.current = editing

  useEffect(() => {
    if (!editing && elRef.current && elRef.current.textContent !== title) {
      elRef.current.textContent = title
    }
  }, [title, editing])

  const begin = () => {
    setEditing(true)
    requestAnimationFrame(() => {
      const el = elRef.current
      if (!el) return
      el.focus()
      const range = document.createRange()
      range.selectNodeContents(el)
      const sel = window.getSelection()
      sel?.removeAllRanges()
      sel?.addRange(range)
    })
  }

  const save = () => {
    const el = elRef.current
    if (!el) return
    const newTitle = (el.textContent || '').trim()
    setEditing(false)
    if (newTitle === title) {
      el.textContent = title
      return
    }
    // Display-name override only — session.name stays immutable, task YAML /
    // folder untouched. Works for every session type (concierge, task-agent,
    // helper) per dashboard/docs/session-display-names.md.
    useSessionStore.getState().setDisplayName(session.name, newTitle || null)
  }

  const cancel = () => {
    const el = elRef.current
    if (el) el.textContent = title
    setEditing(false)
  }

  return (
    <span
      ref={elRef}
      className="lac-title type-label font-semibold flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap"
      contentEditable={editing ? 'plaintext-only' : false}
      suppressContentEditableWarning
      onDoubleClick={(e) => { e.stopPropagation(); begin() }}
      onClick={(e) => { if (editing) e.stopPropagation() }}
      onKeyDown={(e) => {
        if (!editing) return
        e.stopPropagation()
        if (e.key === 'Enter') { e.preventDefault(); save() }
        else if (e.key === 'Escape') { e.preventDefault(); cancel() }
      }}
      onBlur={() => { if (editing) save() }}
      title="Double-click to rename"
    >
      {title}
    </span>
  )
}

// --- Card --------------------------------------------------------------------

interface LiveAgentCardProps {
  session: Session
  compactMode?: boolean
}

export const LiveAgentCard = memo(function LiveAgentCard({ session, compactMode }: LiveAgentCardProps) {
  const [activeTabs, setActiveTabs] = useState<Set<AgentTab>>(new Set())
  const [closeConfirm, setCloseConfirm] = useState(false)
  const lastClickRef = useRef(0)

  const setActiveSession = useSessionStore(s => s.setActiveSession)
  const openAgentTab = useTabStore(s => s.openAgentTab)
  const doKillSession = useSessionStore(s => s.doKillSession)
  const isWrapping = useSessionStore(s => s.isWrappingUp(session))
  const wrapupAge = useSessionStore(s => s.wrapupAgeSeconds(session))
  const canForceClose = isWrapping && wrapupAge !== null && wrapupAge > 180

  // Tick while wrapping so the force-close affordance appears past 180s
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!isWrapping) return
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [isWrapping])

  const isExpanded = activeTabs.size > 0
  const displayStatus = session.status
  const getDisplayTitle = useSessionStore(s => s.getDisplayTitle)
  const title = getDisplayTitle(session)
  const card = usePMStore(s => s.sessionCards[session.name])
  const glanceText = card?.glance || session.task_title || session.final_message || ''

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

  const handleCardClick = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.ec-tabs')) return
    if ((e.target as HTMLElement).closest('.ec-detail')) return
    if ((e.target as HTMLElement).closest('.lac-open')) return
    if ((e.target as HTMLElement).closest('.lac-close')) return
    const now = Date.now()
    const dt = now - lastClickRef.current
    lastClickRef.current = now
    if (dt < 350) {
      setActiveSession(session.name)
      openAgentTab(session.name)
      return
    }
    expandDefault()
  }, [session.name, setActiveSession, openAgentTab, expandDefault])

  const handleOpen = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setActiveSession(session.name)
    openAgentTab(session.name)
  }, [session.name, setActiveSession, openAgentTab])

  return (
    <SessionGlanceTooltip session={session} disabled={isExpanded}>
    <div
      className={`group cursor-pointer entity-card task-card live-agent-card ${borderClass(displayStatus)} ${isExpanded ? 'ec-expanded' : ''}`}
      onClick={handleCardClick}
    >
      <div className="p-[10px_12px] flex flex-col gap-1">
        <div className="flex items-center gap-[5px] min-w-0">
          <StatusDot status={displayStatus} size="md" wrapping={isWrapping} />
          <RenameableTitle session={session} title={title} />
          {isWrapping && (
            <span className="type-caption text-[var(--color-accent)] opacity-80 shrink-0">
              {canForceClose ? `stuck \u00B7 ${wrapupAge}s` : 'wrapping\u2026'}
            </span>
          )}
          {!isExpanded && glanceText && !isWrapping && !compactMode && (
            <span className="type-micro text-[var(--color-text-muted)] truncate min-w-0 flex-1 shrink">
              {glanceText}
            </span>
          )}
          <button
            className="lac-open shrink-0"
            onClick={handleOpen}
            title="Open full session view"
          >
            <ExternalLink size={12} />
          </button>
          {canForceClose ? (
            <button
              className="lac-close shrink-0"
              onClick={(e) => { e.stopPropagation(); api.killSession(session.name).catch(() => {}) }}
              title="Force close (stuck > 3 min)"
              style={{ color: 'var(--color-accent)' }}
            >
              <Zap size={12} />
            </button>
          ) : (
            <button
              className="lac-close shrink-0"
              onClick={(e) => { e.stopPropagation(); if (!isWrapping) setCloseConfirm(true) }}
              title={isWrapping ? 'Wrapping up\u2026' : 'Close session'}
              style={isWrapping ? { opacity: 0.35, pointerEvents: 'none' } : undefined}
            >
              <X size={12} />
            </button>
          )}
        </div>
        {isExpanded && glanceText && (
          <div className="type-micro text-[var(--color-text-muted)] leading-[1.4]">
            {glanceText}
          </div>
        )}
        {isExpanded && !compactMode && (
          <div className="flex items-center gap-1.5 mt-0.5 type-caption text-[var(--color-text-muted)]">
            <span>{roleLabel(session)}</span>
          </div>
        )}
      </div>

      <div className={`ec-panel ${isExpanded ? 'show' : ''}`}>
        <div className="ec-detail" onClick={(e) => e.stopPropagation()}>
          <div className={`tab-panel tp-summary ${activeTabs.has('summary') ? 'active' : ''}`}>
            {activeTabs.has('summary') && <SummaryPanel session={session} />}
          </div>
          <div className={`tab-panel tp-chat ${activeTabs.has('chat') ? 'active' : ''}`}>
            {activeTabs.has('chat') && <ChatPanel sessionName={session.name} />}
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
          { id: 'chat', label: 'Chat' },
        ]}
        onValueChange={(id) => toggleTab(id as AgentTab)}
      />

      <Dialog open={closeConfirm} onOpenChange={setCloseConfirm}>
        <DialogContent className="sm:max-w-[400px]" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Close &ldquo;{title}&rdquo;?</DialogTitle>
            <DialogDescription>The agent will finish its current thought and save a session receipt.</DialogDescription>
          </DialogHeader>
          <div className="rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
            You can resume this session later from the task&apos;s worklog.
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseConfirm(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => { doKillSession(session.name); setCloseConfirm(false) }}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </SessionGlanceTooltip>
  )
})
