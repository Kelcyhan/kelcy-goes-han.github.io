/**
 * status-utils.ts — SINGLE SOURCE OF TRUTH for the design system's status & entity type definitions.
 *
 * Two separate systems defined here:
 *
 * 1. PM STATUS (entity status) — 4-color system for project/domain/task cards:
 *    Grey (inactive) | Blue (active) | Orange (attention) | Green (complete)
 *    Presentation: stripe color on cards, colored dot, tinted badge
 *
 * 2. AGENT SESSION STATUS — 4-state system for running agent sessions:
 *    Orange filled (active/needs approval) | Blue spinner (working) | Green hollow (idle) | Grey dash (closed)
 *
 * Entity types (project/domain/task) define:
 *    - Icon: Layers / Folder / ClipboardList
 *    - Stripe position: top / left / none
 *    - Color: accent / active / subtle
 *
 * ALL components import from here. No scattered color/status definitions elsewhere.
 */

// ════════════════════════════════════════════════════════════
// PM STATUS SYSTEM
// ════════════════════════════════════════════════════════════

export type StatusGroup = 'inactive' | 'active' | 'attention' | 'complete'

export type EntityType = 'project' | 'domain' | 'task'

/** Map any raw status string to one of 4 visual groups */
export function statusToGroup(status: string): StatusGroup {
  switch (status) {
    case 'todo': case 'shelved': case 'stable': case 'paused':
    case 'inactive': case 'idle': case 'unknown':
    case 'dropped': case 'error':
      return 'inactive'
    case 'propose': case 'executing': case 'working':
    case 'active': case 'conversation': case 'unread':
      return 'active'
    case 'blocked': case 'waiting': case 'stalled':
      return 'attention'
    case 'done': case 'complete':
      return 'complete'
    default:
      return 'inactive'
  }
}

/** CSS custom property colors for each PM status group */
export const groupColors: Record<StatusGroup, string> = {
  inactive:  'var(--color-status-inactive)',   // grey  #8B8B9A
  active:    'var(--color-status-active)',      // blue  #3B82F6
  attention: 'var(--color-status-attention)',   // orange #E8952D
  complete:  'var(--color-status-complete)',    // green #34A853
}

/** CSS custom property background tints for each PM status group */
export const groupBgColors: Record<StatusGroup, string> = {
  inactive:  'var(--status-inactive-bg)',
  active:    'var(--status-active-bg)',
  attention: 'var(--status-attention-bg)',
  complete:  'var(--status-complete-bg)',
}

/** PMBadge variant mapping (matches pm-badge.tsx variant names) */
export const groupBadgeVariants: Record<StatusGroup, 'gray' | 'blue' | 'amber' | 'green'> = {
  inactive:  'gray',
  active:    'blue',
  attention: 'amber',
  complete:  'green',
}

// ── PM Status Labels ──

/** Generic PM-level label — hides agent workflow internals */
export function pmStatusLabel(status: string): string {
  switch (status) {
    case 'todo':                              return 'Not started'
    case 'shelved': case 'paused': case 'idle': return 'On hold'
    case 'dropped':                           return 'Dropped'
    default: break
  }
  const group = statusToGroup(status)
  switch (group) {
    case 'inactive':  return 'Not started'
    case 'active':    return 'Active'
    case 'attention': return 'Needs attention'
    case 'complete':  return 'Done'
    default:          return 'Not started'
  }
}

/** Entity-type-aware status labels */
const entityLabels: Record<EntityType, Record<StatusGroup, string>> = {
  project: { inactive: 'Paused',       active: 'Active', attention: 'Needs attention', complete: 'Complete' },
  domain:  { inactive: 'Stable',       active: 'Active', attention: 'Stalled',         complete: 'Complete' },
  task:    { inactive: 'Not started',   active: 'Active', attention: 'Needs attention', complete: 'Done' },
}

/** Get entity-type-aware label. Falls back to generic PM label if type unknown. */
export function entityStatusLabel(status: string, entityType?: string): string {
  const group = statusToGroup(status)
  const type = entityType as EntityType
  if (type && entityLabels[type]) {
    return entityLabels[type][group]
  }
  return pmStatusLabel(status)
}

/** Progress-aware status string for tasks with done_when criteria */
export function progressLabel(
  status: string,
  progress?: { done: number; total: number } | null,
  entityType?: string,
): string {
  const label = entityStatusLabel(status, entityType)
  if (!progress || progress.total === 0) return label
  const group = statusToGroup(status)
  if (group === 'active' || group === 'attention') {
    return `${label} (${progress.done}/${progress.total})`
  }
  return label
}

// ── PM Status Options (for dropdowns) ──

/** Canonical PM status options — used by all status dropdowns */
export const PM_STATUS_OPTIONS = [
  { value: 'todo',    label: 'Not started',     group: 'inactive'  as StatusGroup },
  { value: 'active',  label: 'Active',          group: 'active'    as StatusGroup },
  { value: 'blocked', label: 'Needs attention',  group: 'attention' as StatusGroup },
  { value: 'done',    label: 'Done',            group: 'complete'  as StatusGroup },
  { value: 'shelved', label: 'On hold',         group: 'inactive'  as StatusGroup },
  { value: 'dropped', label: 'Dropped',         group: 'inactive'  as StatusGroup },
] as const

/** Goal-specific status options */
export const GOAL_STATUS_OPTIONS = [
  { value: 'in_progress',          label: 'In Progress', group: 'active'    as StatusGroup },
  { value: 'done',                 label: 'Done',        group: 'complete'  as StatusGroup },
  { value: 'pending',              label: 'Pending',     group: 'attention' as StatusGroup },
  { value: 'pending_confirmation', label: 'Pending',     group: 'attention' as StatusGroup },
  { value: 'archived',            label: 'Archived',    group: 'inactive'  as StatusGroup },
] as const

// ════════════════════════════════════════════════════════════
// ENTITY TYPE SYSTEM
// ════════════════════════════════════════════════════════════

export type StripePosition = 'top' | 'left' | 'none'

export interface EntityTypeConfig {
  /** Lucide icon name (import from lucide-react) */
  icon: 'Layers' | 'Folder' | 'ClipboardList'
  /** CSS color for the icon */
  iconColor: string
  /** Where the status stripe appears on cards */
  stripe: StripePosition
}

/** Entity type visual configuration — icon, color, stripe position */
export const entityTypeConfig: Record<EntityType, EntityTypeConfig> = {
  project: { icon: 'Layers',        iconColor: 'var(--color-accent)',        stripe: 'top' },
  domain:  { icon: 'Folder',        iconColor: 'var(--color-status-active)', stripe: 'left' },
  task:    { icon: 'ClipboardList',  iconColor: 'var(--color-text-subtle)',   stripe: 'none' },
}

/** Get entity type config with fallback to task */
export function getEntityTypeConfig(type?: string): EntityTypeConfig {
  return entityTypeConfig[(type as EntityType)] || entityTypeConfig.task
}

// ════════════════════════════════════════════════════════════
// AGENT SESSION STATUS SYSTEM (separate from PM status)
// ════════════════════════════════════════════════════════════

export type AgentSessionStatus = 'active' | 'working' | 'idle' | 'closed'

/** Map raw agent status strings to the 4 session states */
export function toAgentSessionStatus(status: string): AgentSessionStatus {
  switch (status) {
    case 'active': case 'propose': case 'waiting': case 'blocked': case 'attention':
      return 'active'
    case 'working': case 'executing': case 'running':
      return 'working'
    case 'idle': case 'done': case 'complete': case 'stable':
      return 'idle'
    case 'closed': case 'dead': case 'dropped': case 'error': case 'stopped':
      return 'closed'
    default:
      return 'closed'
  }
}

/** Agent session status colors — CSS custom properties from tokens.css */
export const agentSessionColors: Record<AgentSessionStatus, string> = {
  active:  'var(--color-status-attention)',  // orange — needs approval
  working: 'var(--color-status-active)',     // blue   — working
  idle:    'var(--color-status-complete)',   // green  — idle
  closed:  'var(--color-status-inactive)',   // grey   — closed
}
