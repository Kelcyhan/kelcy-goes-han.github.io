/**
 * AgentColumn — Agent panel for both parent columns and leaf card tabs.
 *
 * - "New Agent" button at top
 * - Active rows: status dot + name + token cost
 * - Past rows: status dot + name + time
 * - Hover any row → glance tooltip
 */

import { useState, useRef } from 'react'
import ReactDOM from 'react-dom'
import { Play } from 'lucide-react'
import type { SessionInfo } from '@/stores/pm-store.ts'
import { usePMStore } from '@/stores/pm-store.ts'
import { useSessionStore } from '@/stores/session-store.ts'
import { useTabStore } from '@/stores/tab-store.ts'
import { StatusDot } from '@/components/primitives/status-dot.tsx'
import { ActionButton } from '@/components/primitives/action-button.tsx'
import { formatTokens } from '@/lib/markdown.ts'
import * as api from '@/lib/api.ts'
import { useNewSessionGate } from '@/components/auth/useNewSessionGate.ts'

// ── Helpers ──

function isUserFacing(s: SessionInfo): boolean {
  if (s.role === 'verifier' || s.role === 'worker') return false
  if (s.name?.startsWith('verifier_') || s.name?.startsWith('worker_')) return false
  return true
}

function liveStatusLabel(liveStatus?: string): string {
  if (!liveStatus) return 'active'
  switch (liveStatus) {
    case 'streaming': return 'working'
    case 'waiting_input': return 'conversation'
    case 'idle': return 'idle'
    case 'error': return 'error'
    case 'ended': return 'done'
    default: return liveStatus
  }
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

function getSessionDisplayName(session: SessionInfo): string {
  const store = useSessionStore.getState()
  const liveSession = store.sessions.find(s => s.name === session.name)
  if (liveSession) {
    const title = store.getDisplayTitle(liveSession)
    if (title && title !== liveSession.name) return title
  }
  return session.name || session.uuid || 'session'
}

function getSessionDotStatus(session: SessionInfo, isActive: boolean): string {
  if (!isActive) return 'done'
  const liveSession = useSessionStore.getState().sessions.find(s => s.name === session.name)
  return liveStatusLabel(liveSession?.status)
}

function getTokenCost(session: SessionInfo): string | null {
  const liveSession = useSessionStore.getState().sessions.find(s => s.name === session.name)
  if (!liveSession) return null
  const total = (liveSession.total_input_tokens || 0) + (liveSession.total_output_tokens || 0)
  if (total === 0) return null
  return formatTokens(total)
}

// ── Glance tooltip (portal) ──

function GlanceTooltip({ children, session, isActive }: { children: React.ReactNode; session: SessionInfo; isActive: boolean }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  const card = usePMStore(s => s.sessionCards[session.name])
  const liveSession = useSessionStore(s => s.sessions.find(ls => ls.name === session.name))

  const glance = card?.glance
  const summary = card?.summary
  const progress = card?.progress
  const filesEdited = card?.files_edited
  const finalMsg = liveSession?.final_message

  const hasContent = glance || summary || (progress && progress.length > 0) || (filesEdited && filesEdited.length > 0) || finalMsg

  return (
    <div
      ref={ref}
      onMouseEnter={() => {
        if (!hasContent) return
        const rect = ref.current?.getBoundingClientRect()
        if (rect) {
          const spaceRight = window.innerWidth - rect.right
          const x = spaceRight > 300 ? rect.right + 8 : rect.left - 288
          setPos({ x, y: Math.min(rect.top, window.innerHeight - 200) })
        }
      }}
      onMouseLeave={() => setPos(null)}
    >
      {children}
      {pos && hasContent && ReactDOM.createPortal(
        <div
          className="ag-glance"
          style={{ position: 'fixed', left: pos.x, top: pos.y, zIndex: 9999, pointerEvents: 'none' }}
        >
          {glance && (
            <div className="ag-glance-section">
              <div className="ag-glance-label">{isActive ? 'Glance' : 'Outcome'}</div>
              <div className="ag-glance-text bold">{glance}</div>
            </div>
          )}
          {summary && (
            <div className="ag-glance-section">
              <div className="ag-glance-label">Summary</div>
              <div className="ag-glance-text">{stripMarkdown(summary).slice(0, 200)}</div>
            </div>
          )}
          {isActive && progress && progress.length > 0 && (
            <div className="ag-glance-section">
              <div className="ag-glance-label">Progress</div>
              {progress.slice(-3).map((p, i) => (
                <div key={i} className="ag-glance-text">• {stripMarkdown(p).slice(0, 80)}</div>
              ))}
            </div>
          )}
          {!glance && !summary && finalMsg && (
            <div className="ag-glance-section">
              <div className="ag-glance-label">Activity</div>
              <div className="ag-glance-text">{stripMarkdown(finalMsg).slice(0, 150)}</div>
            </div>
          )}
          {filesEdited && filesEdited.length > 0 && (
            <div className="ag-glance-section">
              <div className="ag-glance-label">Files ({filesEdited.length})</div>
              {filesEdited.slice(0, 4).map((f, i) => (
                <div key={i} className="ag-glance-file">{f.split('/').pop()}</div>
              ))}
              {filesEdited.length > 4 && <div className="ag-glance-file">+{filesEdited.length - 4} more</div>}
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  )
}

// ── Session row ──

function SessionRow({ session, isActive }: { session: SessionInfo; isActive: boolean }) {
  const displayName = getSessionDisplayName(session)
  const dotStatus = getSessionDotStatus(session, isActive)

  // Active: token cost. Past: date.
  const trailing = isActive ? getTokenCost(session) : (session.date || null)

  const handleClick = () => {
    useSessionStore.getState().setActiveSession(session.name)
    useTabStore.getState().openAgentTab(session.name)
  }

  return (
    <GlanceTooltip session={session} isActive={isActive}>
      <div className="ag-row" onClick={handleClick}>
        <StatusDot status={dotStatus} size="sm" />
        <span className="ag-row-name">{displayName}</span>
        {trailing && <span className="ag-row-trail">{trailing}</span>}
      </div>
    </GlanceTooltip>
  )
}

// ── New Agent button ──

function NewAgentButton({ taskPath, onSpawned }: { taskPath: string; onSpawned?: () => void }) {
  const [submitting, setSubmitting] = useState(false)
  const newSessionGate = useNewSessionGate()

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setSubmitting(true)
    try {
      const result = await api.spawnTaskAgent({
        working_dir: taskPath,
        conversation: true,
      })
      useSessionStore.getState().setActiveSession(result.session_name)
      useTabStore.getState().openAgentTab(result.session_name)
      onSpawned?.()
    } catch (err) {
      console.error('Failed to spawn agent:', err)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ActionButton
      variant="panel"
      size="panel"
      className="mb-1 w-full gap-1 font-semibold"
      onClick={handleClick}
      disabled={submitting || newSessionGate.disabled}
      title={newSessionGate.disabled ? newSessionGate.tooltip : undefined}
    >
      <Play size={10} /> {submitting ? 'Starting…' : 'New Agent'}
    </ActionButton>
  )
}

// ── Main component ──

export interface AgentColumnProps {
  sessions: SessionInfo[]
  pastSessions?: SessionInfo[]
  subSessions?: SessionInfo[]
  taskPath?: string
  collapsible?: boolean
  defaultCollapsed?: boolean
  compact?: boolean
  onSpawned?: () => void
}

export function AgentColumn({
  sessions,
  pastSessions = [],
  subSessions = [],
  taskPath,
  collapsible: _collapsible = false,
  defaultCollapsed: _defaultCollapsed = false,
  compact: _compact = false,
  onSpawned,
}: AgentColumnProps) {
  const activeSessions = sessions.filter(s => s.status === 'active' && isUserFacing(s))
  const filteredPast = pastSessions.filter(isUserFacing)
  const activeSubSessions = subSessions.filter(s => s.status === 'active' && isUserFacing(s))
  const pastSubSessions = subSessions.filter(s => s.status !== 'active' && isUserFacing(s))

  const allActive = [...activeSessions, ...activeSubSessions]
  const allPast = [...filteredPast, ...pastSubSessions]
  const refreshNode = onSpawned || (() => usePMStore.getState().refreshCurrentNode())

  return (
    <div className="ag-panel">
      {/* New Agent button */}
      {taskPath && (
        <NewAgentButton taskPath={taskPath} onSpawned={refreshNode} />
      )}

      {/* Active sessions */}
      {allActive.map(s => (
        <SessionRow key={s.name} session={s} isActive />
      ))}

      {/* Past sessions */}
      {allPast.length > 0 && (
        <>
          <div className="ag-pl">Past</div>
          {allPast.map((s, i) => (
            <SessionRow key={s.uuid || s.name || i} session={s} isActive={false} />
          ))}
        </>
      )}

      {/* Empty state */}
      {allActive.length === 0 && allPast.length === 0 && !taskPath && (
        <div className="ag-empty">No sessions yet</div>
      )}
    </div>
  )
}

export default AgentColumn
