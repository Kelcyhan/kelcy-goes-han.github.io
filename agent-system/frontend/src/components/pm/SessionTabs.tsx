import { useState, useRef, useEffect } from 'react'
import { Plus, Zap } from 'lucide-react'
import { useSessionStore } from '@/stores/session-store.ts'
import * as api from '@/lib/api.ts'
import type { SessionGroup } from '@/stores/session-store.ts'
import { useActiveSession } from '@/hooks/useActiveSession.ts'
import { StatusDot } from '@/components/primitives'
import type { Session } from '@/lib/types.ts'
import { NewAgentModal } from '@/components/shared/Modal.tsx'
import { useNewSessionGate } from '@/components/auth/useNewSessionGate.ts'

type DotStatus = 'working' | 'idle' | 'waiting' | 'unknown' | 'unread'

function statusClass(status?: string): DotStatus {
  if (status === 'working') return 'working'
  if (status === 'idle') return 'idle'
  if (status === 'waiting_input') return 'waiting'
  if (status === 'login_required') return 'waiting'
  return 'unknown'
}

/** Compute dot status, overriding to 'unread' if session finished and user hasn't viewed. */
function dotStatus(
  session: { name: string; status?: string },
  activeSession: string | null,
  stoppedWorkingAt: Record<string, number>,
  lastViewed: Record<string, number>,
): DotStatus {
  const stoppedAt = stoppedWorkingAt[session.name]
  if (stoppedAt && session.name !== activeSession && stoppedAt > (lastViewed[session.name] || 0)) {
    return 'unread'
  }
  return statusClass(session.status)
}

/** Renders the close control for a session tab — force-close icon after 180s wrapup, X otherwise. */
function CloseAffordance({
  sessionName,
  isWrapping,
  canForceClose,
  onKill,
}: {
  sessionName: string
  isWrapping: boolean
  canForceClose: boolean
  onKill: () => void
}) {
  if (canForceClose) {
    return (
      <span
        onClick={e => { e.stopPropagation(); api.killSession(sessionName).catch(() => {}) }}
        className="session-card-close"
        data-force-close
        title="Force close (stuck > 3 min)"
      >
        <Zap size={10} />
      </span>
    )
  }
  return (
    <span
      onClick={e => { e.stopPropagation(); if (!isWrapping) onKill() }}
      className="session-card-close"
      title={isWrapping ? 'Wrapping up\u2026' : 'Close'}
      style={isWrapping ? { opacity: 0.35, pointerEvents: 'none' } : undefined}
    >
      {'\u00D7'}
    </span>
  )
}

// ── Display items: flatten sessions into a renderable list ──────────

type DisplayItem =
  | { type: 'standalone'; session: Session }
  | { type: 'group-parent'; session: Session; group: SessionGroup; children: Session[] }
  | { type: 'group-child'; session: Session; group: SessionGroup }
  | { type: 'placeholder'; session: Session; group: SessionGroup | null }

function buildDisplayItems(
  sessions: Session[],
  groups: Record<string, SessionGroup>,
  activeSession: string | null,
): DisplayItem[] {
  const sessionMap = new Map(sessions.map(s => [s.name, s]))
  const rendered = new Set<string>()
  const items: DisplayItem[] = []

  // Find the active group (if any)
  const activeGroup = activeSession
    ? Object.values(groups).find(g => g.sessions.includes(activeSession))
    : null

  for (const s of sessions) {
    if (rendered.has(s.name)) continue
    // Belt-and-suspenders: skip internal sessions that slipped past the store filter
    if (s.name.startsWith('shadow_') || s.name.startsWith('helper_')) continue

    const group = Object.values(groups).find(g => g.sessions.includes(s.name))

    if (group && s.name === group.anchorSession) {
      // This is the anchor of a group — render the whole group
      const isGroupActive = activeGroup?.id === group.id

      if (isGroupActive) {
        // Only anchor gets a placeholder — children are shown inside expanded card
        for (const memberName of group.sessions) {
          rendered.add(memberName)
        }
        const anchor = sessionMap.get(s.name)
        if (anchor) items.push({ type: 'placeholder', session: anchor, group })
      } else {
        // Render as group card with children
        const children: Session[] = []
        for (const memberName of group.sessions) {
          rendered.add(memberName)
          const member = sessionMap.get(memberName)
          if (member && memberName !== s.name) children.push(member)
        }
        items.push({ type: 'group-parent', session: s, group, children })
      }
    } else if (group) {
      // Non-anchor group member — skip (rendered by its anchor)
      continue
    } else {
      // Standalone session
      rendered.add(s.name)
      if (activeSession === s.name) {
        items.push({ type: 'placeholder', session: s, group: null })
      } else {
        items.push({ type: 'standalone', session: s })
      }
    }
  }

  return items
}

// ── Child card (smaller, indented) ──────────────────────────────────

function GroupChildCard({
  session,
  isWrapping,
  canForceClose,
  onSelect,
  onKill,
}: {
  session: Session
  isWrapping: boolean
  canForceClose: boolean
  onSelect: () => void
  onKill: () => void
}) {
  const activeSession = useSessionStore(s => s.activeSession)
  const stoppedWorkingAt = useSessionStore(s => s.stoppedWorkingAt)
  const lastViewed = useSessionStore(s => s.lastViewed)
  const sc = dotStatus(session, activeSession, stoppedWorkingAt, lastViewed)
  const getDisplayTitle = useSessionStore(s => s.getDisplayTitle)
  const displayTitle = getDisplayTitle(session)

  return (
    <div
      onClick={onSelect}
      className="session-card-child group/tab"
    >
      <StatusDot status={sc} size="sm" wrapping={isWrapping} className="shrink-0" />
      <span className="session-card-title">{displayTitle}</span>
      <CloseAffordance
        sessionName={session.name}
        isWrapping={isWrapping}
        canForceClose={canForceClose}
        onKill={onKill}
      />
    </div>
  )
}

// ── New Orchestrator button (standalone, outside fan) ────────────────

export function NewOrchestratorButton() {
  const [show, setShow] = useState(false)
  const { disabled, tooltip } = useNewSessionGate()
  return (
    <>
      <div
        className={`new-orchestrator-btn${disabled ? ' is-disabled' : ''}`}
        onClick={() => { if (!disabled) setShow(true) }}
        title={disabled ? tooltip : undefined}
        aria-disabled={disabled}
      >
        <Plus size={12} />
        New Orchestrator
      </div>
      {show && <NewAgentModal onClose={() => setShow(false)} />}
    </>
  )
}


// ── Mobile side panel (swipe-in session list) ───────────────────────

interface MobileSidePanelProps {
  open: boolean
  onClose: () => void
  onSelectSession: (name: string) => void
}

export function MobileSidePanel({ open, onClose, onSelectSession }: MobileSidePanelProps) {
  const sessions = useSessionStore(s => s.sessions)
  const groups = useSessionStore(s => s.groups)
  const { activeSession } = useActiveSession()
  const isWrappingUp = useSessionStore(s => s.isWrappingUp)
  const wrapupAgeSeconds = useSessionStore(s => s.wrapupAgeSeconds)
  const doKillSession = useSessionStore(s => s.doKillSession)
  const getDisplayTitle = useSessionStore(s => s.getDisplayTitle)
  const stoppedWorkingAt = useSessionStore(s => s.stoppedWorkingAt)
  const lastViewed = useSessionStore(s => s.lastViewed)

  // Tick every second so the force-close icon appears once wrapup age crosses 180s
  const [, setTick] = useState(0)
  useEffect(() => {
    const anyWrapping = sessions.some(s => isWrappingUp(s))
    if (!anyWrapping) return
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [sessions, isWrappingUp])
  const panelRef = useRef<HTMLDivElement>(null)
  const dragStartX = useRef<number | null>(null)
  const dragCurrentX = useRef<number>(0)

  const items = buildDisplayItems(sessions, groups, null) // no placeholders on mobile

  const handleSelect = (name: string) => {
    onSelectSession(name)
    onClose()
  }

  // Touch gesture: swipe left to close
  const onTouchStart = (e: React.TouchEvent) => {
    dragStartX.current = e.touches[0].clientX
    panelRef.current?.classList.add('dragging')
  }

  const onTouchMove = (e: React.TouchEvent) => {
    if (dragStartX.current === null) return
    const dx = e.touches[0].clientX - dragStartX.current
    // Only allow dragging left (negative)
    const clampedDx = Math.min(0, dx)
    dragCurrentX.current = clampedDx
    if (panelRef.current) {
      panelRef.current.style.transform = `translateX(${clampedDx}px)`
    }
  }

  const onTouchEnd = () => {
    panelRef.current?.classList.remove('dragging')
    if (panelRef.current) {
      panelRef.current.style.transform = ''
    }
    // Close if dragged more than 30% of panel width
    if (dragStartX.current !== null && dragCurrentX.current < -60) {
      onClose()
    }
    dragStartX.current = null
    dragCurrentX.current = 0
  }

  if (sessions.length === 0) return null

  return (
    <>
      <div
        className={`mobile-side-panel-backdrop ${open ? 'open' : ''}`}
        onClick={onClose}
      />
      <div
        ref={panelRef}
        className={`mobile-side-panel ${open ? 'open' : ''}`}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div className="mobile-side-panel-header">Sessions</div>
        {items.map(item => {
          if (item.type === 'placeholder' || item.type === 'standalone') {
            const s = item.session
            const isActive = s.name === activeSession
            const isWrapping = isWrappingUp(s)
            const age = wrapupAgeSeconds(s)
            const canForceClose = isWrapping && age !== null && age > 180
            const sc = dotStatus(s, activeSession, stoppedWorkingAt, lastViewed)

            return (
              <div key={s.name}>
                <div
                  onClick={() => handleSelect(s.name)}
                  className={`session-card ${isActive ? 'active' : ''} group/tab`}
                  title={s.name}
                >
                  <StatusDot status={sc} size="sm" wrapping={isWrapping} className="shrink-0" />
                  <span className="session-card-title">{getDisplayTitle(s)}</span>
                  {isWrapping && !canForceClose && (
                    <span className="type-caption text-[var(--color-accent)] opacity-80 shrink-0">wrapping\u2026</span>
                  )}
                  {canForceClose && (
                    <span className="type-caption text-[var(--color-accent)] opacity-80 shrink-0">stuck \u00B7 {age}s</span>
                  )}
                  <CloseAffordance
                    sessionName={s.name}
                    isWrapping={isWrapping}
                    canForceClose={canForceClose}
                    onKill={() => doKillSession(s.name)}
                  />
                </div>
              </div>
            )
          }

          if (item.type === 'group-parent') {
            const s = item.session
            const isActive = activeSession === s.name || item.children.some(c => c.name === activeSession)
            const isWrapping = isWrappingUp(s)
            const age = wrapupAgeSeconds(s)
            const canForceClose = isWrapping && age !== null && age > 180
            const sc = dotStatus(s, activeSession, stoppedWorkingAt, lastViewed)

            return (
              <div key={`group-${item.group.id}`}>
                <div
                  onClick={() => handleSelect(s.name)}
                  className={`session-card ${isActive ? 'active' : ''} group/tab`}
                  title={s.name}
                >
                  <StatusDot status={sc} size="sm" wrapping={isWrapping} className="shrink-0" />
                  <span className="session-card-title">{getDisplayTitle(s)}</span>
                  <span className="session-group-badge">{item.group.sessions.length}</span>
                  <CloseAffordance
                    sessionName={s.name}
                    isWrapping={isWrapping}
                    canForceClose={canForceClose}
                    onKill={() => doKillSession(s.name)}
                  />
                </div>
                {item.children.map(child => {
                  const childIsWrapping = isWrappingUp(child)
                  const childAge = wrapupAgeSeconds(child)
                  const childCanForceClose = childIsWrapping && childAge !== null && childAge > 180
                  return (
                    <GroupChildCard
                      key={child.name}
                      session={child}
                      isWrapping={childIsWrapping}
                      canForceClose={childCanForceClose}
                      onSelect={() => handleSelect(child.name)}
                      onKill={() => doKillSession(child.name)}
                    />
                  )
                })}
              </div>
            )
          }

          return null
        })}
      </div>
    </>
  )
}
