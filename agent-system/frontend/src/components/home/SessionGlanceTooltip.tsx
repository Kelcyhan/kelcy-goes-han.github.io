import { useRef, useState } from 'react'
import ReactDOM from 'react-dom'
import type { Session } from '@/lib/types.ts'
import { useSessionStore } from '@/stores/session-store.ts'
import { usePMStore } from '@/stores/pm-store.ts'

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

interface Props {
  session: Session
  children: React.ReactNode
  disabled?: boolean
}

export function SessionGlanceTooltip({ session, children, disabled }: Props) {
  const card = usePMStore(s => s.sessionCards[session.name])
  const getDisplayTitle = useSessionStore(s => s.getDisplayTitle)
  const displayTitle = getDisplayTitle(session)
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  const hasContent = !!(card?.glance || card?.status || session.final_message)

  return (
    <div
      ref={ref}
      onMouseEnter={() => {
        if (disabled || !hasContent) return
        const rect = ref.current?.getBoundingClientRect()
        if (rect) setPos({ x: rect.right + 8, y: rect.top })
      }}
      onMouseLeave={() => setPos(null)}
    >
      {children}
      {pos && !disabled && ReactDOM.createPortal(
        <div
          className="max-w-[280px] p-2.5 rounded-md border bg-popover text-popover-foreground shadow-md"
          style={{ position: 'fixed', left: pos.x, top: pos.y, zIndex: 9999, pointerEvents: 'none' }}
        >
          <div className="type-label font-semibold leading-snug mb-1.5 pb-1 border-b border-[var(--color-border-subtle)]">
            {displayTitle}
          </div>
          {card?.glance && (
            <div className="mb-1">
              <div className="type-caption font-semibold text-muted-foreground mb-0.5">Glance</div>
              <div className="type-micro font-semibold leading-snug">{card.glance}</div>
            </div>
          )}
          {card?.status && (
            <div className="mb-1">
              <div className="type-caption font-semibold text-muted-foreground mb-0.5">Status</div>
              <div className="type-caption leading-snug text-muted-foreground">{stripMarkdown(card.status).slice(0, 150)}</div>
            </div>
          )}
          {session.final_message && (
            <div className="mb-1">
              <div className="type-caption font-semibold text-muted-foreground mb-0.5">Activity</div>
              <div className="type-caption leading-snug text-muted-foreground">{stripMarkdown(session.final_message).slice(0, 150)}</div>
            </div>
          )}
          <div className="mt-1 pt-1 border-t border-[var(--color-border-subtle)] type-caption font-mono text-muted-foreground leading-tight break-all">
            {session.name}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
