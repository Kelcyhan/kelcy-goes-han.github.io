import { useEffect, useRef, useState } from 'react'
import { Bot, BotMessageSquare, BotOff, ExternalLink, Play, RotateCcw, AlertCircle } from 'lucide-react'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover.tsx'
import { ActionButton, StatusDot } from '@/components/primitives'
import { useSessionStore } from '@/stores/session-store.ts'
import { usePMStore } from '@/stores/pm-store.ts'
import * as api from '@/lib/api.ts'
import type { Session, SessionCard, PastAgent } from '@/lib/types.ts'
import { cn } from '@/lib/utils.ts'

const HOVER_DELAY_MS = 500

/**
 * All agent roles share a robot-style glyph. Vary glyph + color so each role
 * is visually distinct while still reading as "an agent".
 * - Bot:               default robot face (task-agent, default)
 * - BotMessageSquare:  robot-with-speech (conversational roles: concierge, helper)
 * - BotOff:            inactive/observer robot (shadow)
 */
function roleIcon(role: string | undefined) {
  switch (role) {
    case 'concierge':
    case 'helper':
      return BotMessageSquare
    case 'shadow':
      return BotOff
    default:
      return Bot // task-agent, chainlink, verifier, anything unknown
  }
}

const ROLE_COLOR: Record<string, string> = {
  'task-agent': 'var(--color-status-active)',     // blue
  'concierge':  'var(--color-green-deep, var(--color-status-complete))',
  'chainlink':  'var(--color-accent)',             // violet/accent
  'verifier':   'var(--color-status-complete)',    // green
  'shadow':     'var(--color-text-subtle)',        // dim grey
  'helper':     'var(--color-status-attention)',   // orange
}

function roleColor(role: string | undefined): string {
  return (role && ROLE_COLOR[role]) || 'var(--color-text-subtle)'
}

interface SessionChipProps {
  sessionname: string
  role?: string
}

interface SessionState {
  kind: 'live' | 'past' | 'unknown'
  live?: { session: Session; card?: SessionCard }
  past?: PastAgent
}

// Module-level past-agent cache (one fetch per chat session)
let pastCache: PastAgent[] | null = null
let pastFetchPromise: Promise<PastAgent[]> | null = null

async function lookupPastAgent(name: string): Promise<PastAgent | undefined> {
  if (!pastCache) {
    if (!pastFetchPromise) {
      pastFetchPromise = api.fetchPastAgents({ days: 30, limit: 200 })
        .then(r => { pastCache = r.sessions; return r.sessions })
        .catch(() => { pastCache = []; return [] })
    }
    await pastFetchPromise
  }
  return pastCache?.find(p => p.name === name)
}

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

export function SessionChip({ sessionname: name, role }: SessionChipProps) {
  const liveSessions = useSessionStore(s => s.sessions)
  const sessionCards = usePMStore(s => s.sessionCards)

  const [state, setState] = useState<SessionState>(() => {
    const live = liveSessions.find(s => s.name === name)
    if (live) return { kind: 'live', live: { session: live, card: sessionCards[name] } }
    return { kind: 'unknown' }
  })

  // If not live, attempt past lookup
  useEffect(() => {
    const live = liveSessions.find(s => s.name === name)
    if (live) {
      setState({ kind: 'live', live: { session: live, card: sessionCards[name] } })
      return
    }
    let cancelled = false
    lookupPastAgent(name).then(past => {
      if (cancelled) return
      if (past) setState({ kind: 'past', past })
      else setState({ kind: 'unknown' })
    })
    return () => { cancelled = true }
  }, [name, liveSessions, sessionCards])

  const [open, setOpen] = useState(false)
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const displayNamesMap = useSessionStore(s => s.displayNames)

  // Compute derived render values for ALL states so hooks above are unconditional.
  const isPast = state.kind === 'past'
  const session = state.live?.session
  const card = state.live?.card
  const past = state.past

  const cancelHover = () => { if (hoverTimerRef.current) { clearTimeout(hoverTimerRef.current); hoverTimerRef.current = null } }
  const onEnter = () => { cancelHover(); hoverTimerRef.current = setTimeout(() => setOpen(true), HOVER_DELAY_MS) }
  const onLeave = () => { cancelHover(); setOpen(false) }

  if (state.kind === 'unknown') {
    return (
      <ActionButton
        variant="chip"
        size="chip"
        disabled
        className="px-1.5 py-px rounded opacity-60 cursor-help disabled:pointer-events-auto"
        title="Session not found in active or past sessions"
      >
        <AlertCircle size={10} />
        <Bot size={10} />
        <span className="font-mono">{name}</span>
      </ActionButton>
    )
  }

  // Chip label: prefer the user-facing title used by the sidebar/tabs over
  // the dynamic card glance. Glance is reserved for popover content.
  const displayName = session ? displayNamesMap[session.name] : undefined
  const label = displayName
    || session?.task_title
    || past?.task_title
    || past?.shadow_glance
    || (past?.task_id ? `${past.task_id}` : past?.role)
    || name

  const status = isPast
    ? (past?.task_status === 'done' ? 'idle' : past?.task_status === 'dropped' ? 'closed' : past?.task_status === 'blocked' ? 'waiting' : 'idle')
    : (session?.status || 'idle')

  const resolvedRole = session?.agent_role || past?.role || role || undefined
  const RoleIcon = roleIcon(resolvedRole)

  const handleClick = () => {
    cancelHover()
    if (session) {
      useSessionStore.getState().setActiveSession(session.name)
    } else if (past) {
      // Past sessions don't auto-activate; just open the popover so user picks Resume/View Chat
      setOpen(true)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <ActionButton
          variant="chip"
          size="chip"
          onMouseEnter={onEnter}
          onMouseLeave={onLeave}
          onClick={handleClick}
          className={cn(
            'px-1.5 py-px rounded',
            isPast && 'opacity-80',
            '[&_svg]:shrink-0',
          )}
          title={name}
        >
          <StatusDot status={status} size="sm" />
          <RoleIcon size={11} style={{ color: roleColor(resolvedRole) }} />
          <span className="font-medium truncate max-w-[260px]">{label}</span>
        </ActionButton>
      </PopoverAnchor>
      <PopoverContent
        side="top"
        className="w-[340px] p-3"
        onMouseEnter={cancelHover}
        onMouseLeave={onLeave}
      >
        {state.kind === 'live' && session ? (
          <LivePopoverBody session={session} card={card} />
        ) : past ? (
          <PastPopoverBody past={past} />
        ) : null}
      </PopoverContent>
    </Popover>
  )
}

function LivePopoverBody({ session, card }: { session: Session; card?: SessionCard }) {
  const isWaiting = session.status === 'waiting_input'
  return (
    <div className="flex flex-col gap-2 type-micro">
      <div className="flex items-center gap-1.5">
        <StatusDot status={session.status} size="md" />
        <span className="font-semibold truncate">{session.task_title || session.name}</span>
      </div>
      <div className="type-caption text-muted-foreground flex flex-wrap gap-2">
        <span className="font-mono">{session.name}</span>
        {session.agent_role && <span>· {session.agent_role}</span>}
        {session.task_id && <span>· {session.task_id}</span>}
      </div>
      {isWaiting && session.final_message && (
        <div>
          <div className="type-caption font-semibold text-orange uppercase tracking-wider mb-1">Waiting for</div>
          <div className="type-micro leading-snug italic line-clamp-3">"{stripMarkdown(session.final_message).slice(0, 200)}"</div>
        </div>
      )}
      {card?.summary && (
        <div className="text-muted-foreground leading-snug line-clamp-3">{card.summary}</div>
      )}
      {card && card.progress.length > 0 && (
        <div>
          <div className="type-caption font-semibold text-muted-foreground uppercase tracking-wider mb-1">Progress</div>
          <ul className="space-y-0.5 text-muted-foreground leading-snug">
            {card.progress.slice(-3).map((p, i) => (
              <li key={i} className="flex gap-1.5"><span className="shrink-0">·</span><span className="line-clamp-1">{p}</span></li>
            ))}
          </ul>
        </div>
      )}
      <ActionButton
        variant="toolbarPrimary"
        size="toolbar"
        onClick={() => useSessionStore.getState().setActiveSession(session.name)}
        className="mt-1 gap-1"
      >
        <ExternalLink size={11} /> Open
      </ActionButton>
    </div>
  )
}

function PastPopoverBody({ past }: { past: PastAgent }) {
  const displayTitle = past.shadow_glance
    || (past.task_id ? `${past.task_id}${past.task_title ? ' — ' + past.task_title : ''}` : past.role || 'Agent')
  const canResume = !!(past.session_id && past.working_dir)
  return (
    <div className="flex flex-col gap-2 type-micro">
      <div className="flex items-center gap-1.5">
        <StatusDot status="closed" size="md" />
        <span className="font-semibold truncate">{displayTitle}</span>
      </div>
      <div className="type-caption text-muted-foreground flex flex-wrap gap-2">
        <span className="font-mono">{past.name}</span>
        {past.role && <span>· {past.role}</span>}
        {past.ended && <span>· ended {past.ended}</span>}
        {past.task_status && <span>· {past.task_status}</span>}
      </div>
      {(past.shadow_summary || past.summary) && (
        <div className="text-muted-foreground leading-snug line-clamp-3">
          {past.shadow_summary || past.summary}
        </div>
      )}
      {past.outcome && (
        <div>
          <div className="type-caption font-semibold text-muted-foreground uppercase tracking-wider mb-1">Outcome</div>
          <div className="leading-snug line-clamp-3">{past.outcome}</div>
        </div>
      )}
      {past.next_step && (
        <div>
          <div className="type-caption font-semibold text-muted-foreground uppercase tracking-wider mb-1">Next step</div>
          <div className="leading-snug line-clamp-2">{past.next_step}</div>
        </div>
      )}
      <div className="flex gap-2 mt-1">
        {canResume && (
          <ActionButton
            variant="toolbarPrimary"
            size="toolbar"
            onClick={() => {
              // Conservative: navigate to the session JSONL viewer rather than auto-spawn
              if (past.jsonl_path) {
                // No spawning from chip — open the chat view instead
                useSessionStore.getState().setActiveSession(past.name)
              }
            }}
            className="gap-1"
          >
            <RotateCcw size={11} /> Open
          </ActionButton>
        )}
        {past.jsonl_path && (
          <ActionButton
            variant="toolbar"
            size="toolbar"
            onClick={() => useSessionStore.getState().setActiveSession(past.name)}
            className="gap-1"
          >
            <Play size={11} /> View Chat
          </ActionButton>
        )}
      </div>
    </div>
  )
}
