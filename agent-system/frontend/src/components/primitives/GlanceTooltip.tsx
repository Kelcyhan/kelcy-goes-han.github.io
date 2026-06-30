/**
 * GlanceTooltip — hover-reveal portal tooltip for agent session rows.
 *
 * Caller provides `sections`; the component handles positioning (flips left
 * when right edge is tight, clamps bottom to viewport), portal rendering into
 * document.body, and show/hide on mouse enter/leave.
 *
 * Uses `.ag-glance` CSS classes from overrides.css.
 */

import { useState, useRef } from 'react'
import ReactDOM from 'react-dom'

export type GlanceSection =
  | { kind: 'text'; label: string; text: string; bold?: boolean }
  | { kind: 'list'; label: string; items: string[] }
  | { kind: 'files'; label: string; files: string[]; maxShown?: number }

export interface GlanceTooltipProps {
  children: React.ReactNode
  sections: GlanceSection[]
  /** Disable tooltip (e.g. when row is expanded and shows the data inline). */
  disabled?: boolean
}

export function GlanceTooltip({ children, sections, disabled }: GlanceTooltipProps) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  const visibleSections = sections.filter(s => {
    if (s.kind === 'text') return !!s.text
    if (s.kind === 'list') return s.items && s.items.length > 0
    if (s.kind === 'files') return s.files && s.files.length > 0
    return false
  })
  const hasContent = visibleSections.length > 0 && !disabled

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
          {visibleSections.map((s, i) => {
            if (s.kind === 'text') {
              return (
                <div key={i} className="ag-glance-section">
                  <div className="ag-glance-label">{s.label}</div>
                  <div className={`ag-glance-text${s.bold ? ' bold' : ''}`}>{s.text}</div>
                </div>
              )
            }
            if (s.kind === 'list') {
              return (
                <div key={i} className="ag-glance-section">
                  <div className="ag-glance-label">{s.label}</div>
                  {s.items.slice(0, 3).map((it, j) => (
                    <div key={j} className="ag-glance-text">• {it}</div>
                  ))}
                </div>
              )
            }
            const max = s.maxShown ?? 4
            return (
              <div key={i} className="ag-glance-section">
                <div className="ag-glance-label">{s.label}</div>
                {s.files.slice(0, max).map((f, j) => (
                  <div key={j} className="ag-glance-file">{f.split('/').pop()}</div>
                ))}
                {s.files.length > max && (
                  <div className="ag-glance-file">+{s.files.length - max} more</div>
                )}
              </div>
            )
          })}
        </div>,
        document.body
      )}
    </div>
  )
}
