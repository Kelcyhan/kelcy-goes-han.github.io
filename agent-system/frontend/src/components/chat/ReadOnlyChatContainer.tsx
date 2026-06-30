import { Component, useEffect, useRef, useMemo, useState } from 'react'
import type { ReactNode, ErrorInfo } from 'react'
import { useChatStore, groupMessagesIntoTurns, findLastAnchorUuid, EMPTY_MESSAGES } from '@/stores/chat-store.ts'
import { TurnGroup } from '@/components/chat/TurnGroup.tsx'
import { ActionButton } from '@/components/primitives'

const COMPACT_TAIL_TURNS = 50

// Per-turn error boundary — renders fallback for bad messages without killing the whole view
class TurnErrorBoundary extends Component<
  { children: ReactNode; turnIndex: number },
  { error: Error | null }
> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[ROCC] Turn ${this.props.turnIndex} render error:`, error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="turn-group" style={{ padding: '8px 12px', opacity: 0.5 }}>
          <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--type-micro-size)', lineHeight: 'var(--type-micro-line)' }}>
            [Failed to render turn — {this.state.error.message}]
          </span>
        </div>
      )
    }
    return this.props.children
  }
}

interface ReadOnlyChatContainerProps {
  sessionName: string
  compact?: boolean
}

export function ReadOnlyChatContainer({ sessionName, compact }: ReadOnlyChatContainerProps) {
  const messages = useChatStore(s => s.sessions[sessionName]?.messages ?? EMPTY_MESSAGES)
  const headerInfo = useChatStore(s => s.sessions[sessionName]?.headerInfo ?? '')
  const allTurns = useMemo(() => groupMessagesIntoTurns(messages), [messages])
  const [showAll, setShowAll] = useState(false)
  const hiddenCount = compact && !showAll ? Math.max(0, allTurns.length - COMPACT_TAIL_TURNS) : 0
  const turns = hiddenCount > 0 ? allTurns.slice(-COMPACT_TAIL_TURNS) : allTurns
  const containerRef = useRef<HTMLDivElement>(null)

  // On initial load, anchor on the last non-bootstrap finalMsg (so SessionStart
  // hook scaffolding doesn't bury the real prior content). Fallback to bottom
  // if no anchor exists.
  useEffect(() => {
    if (messages.length === 0 || !containerRef.current) return
    const anchorUuid = findLastAnchorUuid(turns)
    requestAnimationFrame(() => {
      if (!containerRef.current) return
      if (anchorUuid) {
        const node = containerRef.current.querySelector(
          `[data-msg-uuid="${anchorUuid}"]`,
        ) as HTMLElement | null
        if (node) {
          node.scrollIntoView({ block: 'start' })
          return
        }
      }
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    })
  }, [messages.length, turns])

  const isFailed = headerInfo.toLowerCase().includes('failed')

  if (messages.length === 0) {
    return (
      <div className={`flex-1 min-h-0 relative flex flex-col ${compact ? 'chat-compact' : ''}`}>
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-5 py-4 flex items-center justify-center min-h-0">
          <span className="text-muted-foreground type-body-sm">
            {isFailed ? headerInfo : 'Loading past session...'}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className={`flex-1 min-h-0 relative flex flex-col ${compact ? 'chat-compact' : ''}`}>
      <div ref={containerRef} className="flex-1 overflow-y-auto overflow-x-hidden px-5 py-4 flex flex-col gap-3 min-h-0 bg-transparent">
        {hiddenCount > 0 && (
          <ActionButton
            variant="chip"
            size="chip"
            onClick={() => setShowAll(true)}
            className="self-center px-3 py-1"
          >
            Show earlier ({hiddenCount} hidden)
          </ActionButton>
        )}
        {turns.map((turn, i) => {
          const key = turn.userMsg?.uuid || turn.steps[0]?.uuid || turn.finalMsg?.uuid || `turn-${i}`
          return (
            <TurnErrorBoundary key={key} turnIndex={i}>
              <TurnGroup turn={turn} />
            </TurnErrorBoundary>
          )
        })}
      </div>
    </div>
  )
}
