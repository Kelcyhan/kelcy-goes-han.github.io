import { statusToGroup, groupColors } from "./status-utils"

/**
 * PMStatusDot — Simple colored dot for PM entity status.
 * Uses the 4-color system: grey (inactive), blue (active), orange (attention), green (complete).
 * NOT for agent session status — use StatusDot for that.
 */

export interface PMStatusDotProps {
  status: string
  size?: number
}

export function PMStatusDot({ status, size = 6 }: PMStatusDotProps) {
  const group = statusToGroup(status)
  const color = groupColors[group]
  return <span style={{ width: size, height: size, borderRadius: '50%', background: color, flexShrink: 0, display: 'inline-block' }} />
}
