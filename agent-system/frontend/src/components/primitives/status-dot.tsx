import { cn } from "@/lib/utils"
import { toAgentSessionStatus, agentSessionColors, type AgentSessionStatus } from "./status-utils"

/**
 * StatusDot — Agent session status indicator (NOT for PM entity status).
 * Uses PMStatusDot for PM entity status instead.
 *
 * 4 agent session states (colors from status-utils.ts):
 *   active (needs approval) → filled circle, orange
 *   working                 → loading spinner, blue
 *   idle                    → hollow circle, green
 *   closed                  → horizontal dash, grey
 */

export type { AgentSessionStatus }

const sizes = { sm: 6, md: 7, lg: 8 } as const

export interface StatusDotProps extends React.HTMLAttributes<HTMLSpanElement> {
  status?: string | null
  size?: 'sm' | 'md' | 'lg'
  /**
   * When true, render a pulsing ring in the accent color instead of the status dot.
   * Used to signal "wrapping up" — transient in-progress state across all kill sites.
   */
  wrapping?: boolean
}

export function StatusDot({ status, size = 'md', wrapping, className, ...props }: StatusDotProps) {
  const sessionState = toAgentSessionStatus(status || 'closed')
  const color = agentSessionColors[sessionState]
  const s = sizes[size]
  // Accent color reads as "transient in-progress" not "error"
  const wrappingColor = 'var(--color-accent)'

  return (
    <span
      className={cn("inline-flex items-center justify-center flex-shrink-0", className)}
      style={{ width: s, height: s }}
      {...props}
    >
      <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} fill="none" xmlns="http://www.w3.org/2000/svg">
        {wrapping ? (
          <>
            <circle cx={s/2} cy={s/2} r={s/2 - 1} stroke={wrappingColor} strokeWidth={1.5} fill="none" />
            <circle cx={s/2} cy={s/2} r={s/2 - 1} stroke={wrappingColor} strokeWidth={1.5} fill="none" opacity="0.6">
              <animate attributeName="r" from={s/2 - 1} to={s/2 + 1} dur="1.2s" repeatCount="indefinite" />
              <animate attributeName="opacity" from="0.6" to="0" dur="1.2s" repeatCount="indefinite" />
            </circle>
          </>
        ) : (
          <>
            {sessionState === 'active' && (
              <circle cx={s/2} cy={s/2} r={s/2} fill={color} />
            )}
            {sessionState === 'working' && (
              <circle cx={s/2} cy={s/2} r={s/2 - 1} stroke={color} strokeWidth={1.5} fill="none"
                strokeDasharray={`${(s - 2) * Math.PI * 0.75} ${(s - 2) * Math.PI * 0.25}`}
              >
                <animateTransform attributeName="transform" type="rotate"
                  from={`0 ${s/2} ${s/2}`} to={`360 ${s/2} ${s/2}`} dur="1s" repeatCount="indefinite" />
              </circle>
            )}
            {sessionState === 'idle' && (
              <circle cx={s/2} cy={s/2} r={s/2 - 1} stroke={color} strokeWidth={1.5} fill="none" />
            )}
            {sessionState === 'closed' && (
              <rect x={0} y={s/2 - 1} width={s} height={2.5} rx={1.25} fill={color} />
            )}
          </>
        )}
      </svg>
    </span>
  )
}

const statusDotVariants = () => ""
export { statusDotVariants }
