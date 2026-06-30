import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import {
  DndContext,
  closestCorners,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { CSS } from '@dnd-kit/utilities'
import { useSessionStore } from '@/stores/session-store.ts'
import * as api from '@/lib/api.ts'
import { useActiveSession } from '@/hooks/useActiveSession.ts'
import { useWorkspaceStore } from '@/stores/workspace-store.ts'
import { useTabStore } from '@/stores/tab-store.ts'
import type { TabData } from '@/stores/tab-store.ts'
import { usePMStore } from '@/stores/pm-store.ts'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog.tsx'
import type { Session } from '@/lib/types.ts'
import type { HomeGroup } from '@/lib/api.ts'
import { displayPMNodeId } from '@/lib/paths.ts'
import { NewAgentModal } from '@/components/shared/Modal.tsx'
import { SessionGlanceTooltip } from '@/components/home/SessionGlanceTooltip.tsx'
import { ActionButton, AppIcon, IconButton } from '@/components/primitives'
import { extractProjectFromWorkingDir, extractTaskIdFromWorkingDir } from '@/stores/session-store.ts'

// Stable references — fresh array/object identity into dnd-kit on every
// render triggers its internal reducer each pass, which in prod builds can
// surface as React #185 "too many re-renders". Mirrors hotfix #2 in
// ActiveAgents.tsx.
const DND_MODIFIERS = [restrictToVerticalAxis]
const SORTABLE_GROUP_DATA = { kind: 'group' as const }
const HIDDEN_AGENT_ROLES = new Set(['chainlink', 'verifier', 'shadow'])

// ── Helpers ──────────────────────────────────────────────────────────

type DotStatus = 'working' | 'idle' | 'waiting' | 'unknown' | 'unread'

function statusClass(status?: string): DotStatus {
  if (status === 'working') return 'working'
  if (status === 'idle') return 'idle'
  if (status === 'waiting_input') return 'waiting'
  if (status === 'login_required') return 'waiting'
  return 'unknown'
}

function isRailLive(s: Session): boolean {
  return (
    s.status !== 'dead' &&
    s.status !== 'ended' &&
    !s.name.startsWith('helper_') &&
    !(s.agent_role && HIDDEN_AGENT_ROLES.has(s.agent_role))
  )
}

function normalizeSessionTaskId(session: Session, projectId: string | null, vaultRoot: string | null): string | null {
  const raw = session.task_id || extractTaskIdFromWorkingDir(session.working_dir, vaultRoot)
  if (!raw) return null
  if (projectId && raw.startsWith(`${projectId}/`)) return raw.slice(projectId.length + 1)
  return raw
}

function domainIdForTask(taskId: string | null): string | null {
  if (!taskId) return null
  const nestedScratch = taskId.match(/^(\d+(?:\.\d+)*)\/scratch\/.+$/)
  const numbered = nestedScratch ? nestedScratch[1] : taskId
  if (!/^\d+(?:\.\d+)*$/.test(numbered)) return taskId.startsWith('scratch/') ? 'scratch' : null
  const parts = numbered.split('.')
  return parts.length >= 2 ? parts.slice(0, 2).join('.') : numbered
}

function compareNodeIds(a: string | null, b: string | null): number {
  if (a === b) return 0
  if (!a) return -1
  if (!b) return 1
  const an = /^\d+(?:\.\d+)*$/.test(a)
  const bn = /^\d+(?:\.\d+)*$/.test(b)
  if (an && bn) {
    const ap = a.split('.').map(Number)
    const bp = b.split('.').map(Number)
    for (let i = 0; i < Math.max(ap.length, bp.length); i++) {
      const av = ap[i] ?? -1
      const bv = bp[i] ?? -1
      if (av !== bv) return av - bv
    }
    return 0
  }
  return a.localeCompare(b)
}

function labelForProject(projectId: string, projectTitles: Record<string, string>): string {
  return projectTitles[projectId] || (projectId === '__scratch__' ? 'Scratch' : projectId === '__unfiled__' ? 'Unfiled' : projectId)
}

function labelForDomain(projectId: string, domainId: string | null, domainTitles: Record<string, Record<string, string>>): string {
  if (!domainId) return 'Project root'
  if (domainId === 'scratch') return 'Scratch'
  const title = domainTitles[projectId]?.[domainId]
  return `${displayPMNodeId(domainId)}${title ? ` — ${title}` : ''}`
}

function labelForTask(taskId: string | null, taskTitle?: string | null): string {
  if (!taskId) return 'Project root'
  return `${displayPMNodeId(taskId)}${taskTitle ? ` — ${taskTitle}` : ''}`
}

function sessionSortTime(session: Session): number {
  const value = session.mtime
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const parsed = Date.parse(value)
    return Number.isNaN(parsed) ? 0 : parsed
  }
  return 0
}

interface RailHierarchyBucket {
  group: HomeGroup
  sessions: Session[]
  projectId: string
  domainId: string | null
  taskId: string | null
}

interface RailProjectTask {
  id: string
  label: string
  sessions: Session[]
}

interface RailProjectDomain {
  id: string
  label: string
  tasks: RailProjectTask[]
}

interface RailProjectNode {
  id: string
  label: string
  domains: RailProjectDomain[]
}

function buildHierarchyBuckets({
  sessions,
  vaultRoot,
  projectTitles,
  domainTitles,
}: {
  sessions: Session[]
  vaultRoot: string | null
  projectTitles: Record<string, string>
  domainTitles: Record<string, Record<string, string>>
}): RailHierarchyBucket[] {
  const buckets = new Map<string, RailHierarchyBucket>()

  for (const session of sessions) {
    const projectId = extractProjectFromWorkingDir(session.working_dir, session.vault_root || vaultRoot) || '__unfiled__'
    const taskId = normalizeSessionTaskId(session, projectId === '__unfiled__' ? null : projectId, session.vault_root || vaultRoot)
    const domainId = domainIdForTask(taskId)
    const taskLabel = labelForTask(taskId, session.task_title)
    const projectLabel = labelForProject(projectId, projectTitles)
    const domainLabel = domainId ? labelForDomain(projectId, domainId, domainTitles) : null
    const key = `${projectId}::${domainId || '__project__'}::${taskId || '__root__'}`
    const label = [projectLabel, domainLabel, taskLabel].filter(Boolean).join(' / ')

    if (!buckets.has(key)) {
      buckets.set(key, {
        group: {
          id: `hier:${key}`,
          label,
          kind: 'auto:other',
          collapsed: false,
          order: buckets.size,
        },
        sessions: [],
        projectId,
        domainId,
        taskId,
      })
    }
    buckets.get(key)!.sessions.push(session)
  }

  return [...buckets.values()]
    .sort((a, b) => {
      const projectCmp = a.projectId.localeCompare(b.projectId)
      if (projectCmp !== 0) return projectCmp
      const domainCmp = compareNodeIds(a.domainId, b.domainId)
      if (domainCmp !== 0) return domainCmp
      return compareNodeIds(a.taskId, b.taskId)
    })
    .map((bucket, idx) => ({
      ...bucket,
      group: { ...bucket.group, order: idx },
      sessions: [...bucket.sessions].sort((a, b) => {
        const aTime = sessionSortTime(a)
        const bTime = sessionSortTime(b)
        if (aTime !== bTime) return bTime - aTime
        return a.name.localeCompare(b.name)
      }),
    }))
}

function buildProjectTree(
  buckets: RailHierarchyBucket[],
  projectTitles: Record<string, string>,
  domainTitles: Record<string, Record<string, string>>,
): RailProjectNode[] {
  const projects = new Map<string, RailProjectNode>()

  for (const bucket of buckets) {
    const project = projects.get(bucket.projectId) || {
      id: bucket.projectId,
      label: labelForProject(bucket.projectId, projectTitles),
      domains: [],
    }
    if (!projects.has(bucket.projectId)) projects.set(bucket.projectId, project)

    const domainKey = bucket.domainId || '__project__'
    let domain = project.domains.find(d => d.id === domainKey)
    if (!domain) {
      domain = {
        id: domainKey,
        label: labelForDomain(bucket.projectId, bucket.domainId, domainTitles),
        tasks: [],
      }
      project.domains.push(domain)
    }

    const taskKey = bucket.taskId || '__root__'
    const firstSession = bucket.sessions[0]
    domain.tasks.push({
      id: taskKey,
      label: labelForTask(bucket.taskId, firstSession?.task_title),
      sessions: bucket.sessions,
    })
  }

  return [...projects.values()].map(project => ({
    ...project,
    domains: project.domains
      .sort((a, b) => compareNodeIds(a.id === '__project__' ? null : a.id, b.id === '__project__' ? null : b.id))
      .map(domain => ({
        ...domain,
        tasks: domain.tasks.sort((a, b) => compareNodeIds(a.id === '__root__' ? null : a.id, b.id === '__root__' ? null : b.id)),
      })),
  }))
}

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

function StatusShape({ status, wrapping }: { status: DotStatus; wrapping?: boolean }) {
  const size = 10
  const cx = size / 2
  const cy = size / 2
  const r = 3.5

  const color =
    status === 'working' ? 'var(--color-status-active)' :
    status === 'idle' ? 'var(--color-status-complete)' :
    status === 'waiting' ? 'var(--color-status-attention)' :
    status === 'unread' ? 'var(--color-status-active)' :
    'var(--color-status-inactive)'

  if (wrapping) {
    const accent = 'var(--color-accent)'
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rail-shape">
        <circle cx={cx} cy={cy} r={r - 0.5} fill="none" stroke={accent} strokeWidth={1.3} />
        <circle cx={cx} cy={cy} r={r - 0.5} fill="none" stroke={accent} strokeWidth={1.3} opacity="0.6">
          <animate attributeName="r" from={r - 0.5} to={r + 1} dur="1.2s" repeatCount="indefinite" />
          <animate attributeName="opacity" from="0.6" to="0" dur="1.2s" repeatCount="indefinite" />
        </circle>
      </svg>
    )
  }

  let shape: React.ReactNode
  if (status === 'working') {
    shape = (
      <>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={1.2} opacity={0.3} />
        <path d={`M ${cx} ${cy - r} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke={color} strokeWidth={1.3} strokeLinecap="round">
          <animateTransform attributeName="transform" type="rotate" from={`0 ${cx} ${cy}`} to={`360 ${cx} ${cy}`} dur="0.8s" repeatCount="indefinite" />
        </path>
      </>
    )
  } else if (status === 'idle') {
    shape = <circle cx={cx} cy={cy} r={r - 0.5} fill="none" stroke={color} strokeWidth={1.3} />
  } else if (status === 'unread') {
    shape = <circle cx={cx} cy={cy} r={r} fill={color} />
  } else if (status === 'waiting') {
    shape = <rect x={cx - 2.8} y={cy - 2.8} width={5.6} height={5.6} rx={0.5} fill={color} transform={`rotate(45 ${cx} ${cy})`} />
  } else {
    shape = <line x1={cx - 2.5} y1={cy} x2={cx + 2.5} y2={cy} stroke={color} strokeWidth={1.5} strokeLinecap="round" />
  }

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={`rail-shape${status === 'unread' ? ' animate-dot-pulse' : ''}`}>
      {shape}
    </svg>
  )
}

// ── Inline rename input ──────────────────────────────────────────────

function InlineRenameInput({ value, onSave, onCancel }: {
  value: string; onSave: (v: string) => void; onCancel: () => void
}) {
  const [text, setText] = useState(value)
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    ref.current?.focus()
    ref.current?.select()
  }, [])

  const commit = () => {
    const trimmed = text.trim()
    if (trimmed && trimmed !== value) onSave(trimmed)
    else onCancel()
  }

  return (
    <input
      ref={ref}
      className="rail-rename-input"
      value={text}
      onChange={e => setText(e.target.value)}
      onKeyDown={e => {
        if (e.key === 'Enter') commit()
        else if (e.key === 'Escape') onCancel()
        e.stopPropagation()
      }}
      onClick={e => e.stopPropagation()}
      onBlur={commit}
    />
  )
}

// ── Close confirmation dialog ────────────────────────────────────────

function CloseConfirmDialog({ sessionName, open, onOpenChange, onConfirm }: {
  sessionName: string; open: boolean; onOpenChange: (open: boolean) => void; onConfirm: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Close &ldquo;{sessionName}&rdquo;?</DialogTitle>
          <DialogDescription>The agent will finish its current thought and save a session receipt.</DialogDescription>
        </DialogHeader>
        <div className="rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
          You can resume this session later from the task&apos;s worklog.
        </div>
        <DialogFooter>
          <ActionButton variant="toolbar" onClick={() => onOpenChange(false)}>Cancel</ActionButton>
          <ActionButton variant="destructive" onClick={() => { onConfirm(); onOpenChange(false) }}>Close</ActionButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Native HTML drop target: tab-sharing only. Session-to-session
// reordering now flows through @dnd-kit (see SortableSession below).

function handleTabShareDrop(e: React.DragEvent, targetName: string): boolean {
  const tabPanelId = e.dataTransfer.getData('tab-panel-id')
  if (tabPanelId) {
    e.preventDefault()
    const liveTab = useTabStore.getState().tabData[tabPanelId]
    if (liveTab) {
      useTabStore.getState().shareTabToSession(tabPanelId, targetName)
    } else {
      const json = e.dataTransfer.getData('tab-data-json')
      if (json) {
        try {
          const tabData = JSON.parse(json) as TabData
          useTabStore.getState().shareTabDataToSession(tabData, targetName)
        } catch { /* ignore */ }
      }
    }
    return true
  }
  return false
}

interface SubAgentSummary {
  verifiers: Session[]
  shadows: Session[]
}

function buildSubAgentMap(sessions: Session[]): Record<string, SubAgentSummary> {
  const map: Record<string, SubAgentSummary> = {}
  for (const s of sessions) {
    const parent = (s as any).parent_session || s.orchestrator_session
    if (!parent) continue
    if (s.agent_role !== 'verifier' && s.agent_role !== 'shadow') continue
    const entry = map[parent] || (map[parent] = { verifiers: [], shadows: [] })
    if (s.agent_role === 'verifier') entry.verifiers.push(s)
    else entry.shadows.push(s)
  }
  return map
}

function subAgentNeedsAttention(agents: Session[]): boolean {
  return agents.some(a => a.status === 'waiting_input' || a.status === 'login_required')
}

// ── localStorage-backed sidebar-only group collapse ──────────────────

const SIDEBAR_COLLAPSE_KEY = 'sidebar:group-collapse'
const PINNED_SESSIONS_KEY = 'session-rail:pinned-sessions'

function loadSidebarCollapse(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(SIDEBAR_COLLAPSE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed as Record<string, boolean> : {}
  } catch { return {} }
}

function saveSidebarCollapse(state: Record<string, boolean>) {
  try { localStorage.setItem(SIDEBAR_COLLAPSE_KEY, JSON.stringify(state)) } catch { /* ignore */ }
}

function loadPinnedSessionNames(): string[] {
  try {
    const raw = localStorage.getItem(PINNED_SESSIONS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(v => typeof v === 'string') : []
  } catch { return [] }
}

function savePinnedSessionNames(names: string[]) {
  try { localStorage.setItem(PINNED_SESSIONS_KEY, JSON.stringify(names)) } catch { /* ignore */ }
}

// ── @dnd-kit wrappers ────────────────────────────────────────────────

function SortableRailSession({
  sessionName,
  children,
}: {
  sessionName: string
  children: React.ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `s:${sessionName}`,
  })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="rail-session-slot"
    >
      {children}
    </div>
  )
}

function EmptyGroupDropZone({ groupId }: { groupId: string }) {
  const { setNodeRef, isOver } = useDroppable({ id: `empty:${groupId}` })
  return (
    <div
      ref={setNodeRef}
      className={`rail-empty-drop${isOver ? ' drop-target' : ''}`}
    >
      Drop a session here
    </div>
  )
}

function SortableRailGroup({
  group,
  bucketIdx,
  fanExpanded,
  collapsed,
  isEmpty,
  onToggleCollapsed,
  isRenaming,
  onStartRename,
  onCommitRename,
  onCancelRename,
  onDelete,
  children,
}: {
  group: HomeGroup
  bucketIdx: number
  fanExpanded: boolean
  collapsed: boolean
  isEmpty: boolean
  onToggleCollapsed: () => void
  isRenaming: boolean
  onStartRename: () => void
  onCommitRename: (label: string) => void
  onCancelRename: () => void
  onDelete: () => void
  children: React.ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `g:${group.id}`,
    data: SORTABLE_GROUP_DATA,
  })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }
  const canEdit = group.kind === 'user'
  const canSort = group.kind === 'user'
  const stopDrag = { onPointerDown: (e: React.PointerEvent) => e.stopPropagation() }
  return (
    <div ref={setNodeRef} style={style} className="rail-group">
      {fanExpanded ? (
        <div
          className="rail-label"
          style={canSort ? undefined : { cursor: 'default' }}
          {...(canSort ? attributes : {})}
          {...(canSort ? listeners : {})}
          title={canSort ? 'Drag to reorder group' : undefined}
        >
          <span
            className="rail-label-chev"
            onPointerDown={e => e.stopPropagation()}
            onClick={e => { e.stopPropagation(); onToggleCollapsed() }}
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            <AppIcon name={collapsed ? 'chevron-right' : 'chevron-down'} size={11} />
          </span>
          {isRenaming ? (
            <div {...stopDrag} className="rail-label-rename-wrap">
              <InlineRenameInput
                value={group.label}
                onSave={onCommitRename}
                onCancel={onCancelRename}
              />
            </div>
          ) : (
            <>
              <span
                className="rail-label-text"
                onDoubleClick={canEdit ? (e => { e.stopPropagation(); onStartRename() }) : undefined}
              >{group.label}</span>
              {canEdit && (
                <>
                  <span
                    className="rail-label-rename"
                    {...stopDrag}
                    onClick={e => { e.stopPropagation(); onStartRename() }}
                    title="Rename group"
                  >
                    <AppIcon name="file" size={10} />
                  </span>
                  <span
                    className="rail-label-delete"
                    {...stopDrag}
                    onClick={e => { e.stopPropagation(); onDelete() }}
                    title="Delete group (sessions return to auto buckets)"
                  >
                    <AppIcon name="trash" size={10} />
                  </span>
                </>
              )}
            </>
          )}
        </div>
      ) : (
        bucketIdx > 0 && <hr className="rail-divider" />
      )}
      {fanExpanded && collapsed ? null : (
        <>
          {children}
          {isEmpty && canEdit && fanExpanded && <EmptyGroupDropZone groupId={group.id} />}
        </>
      )}
    </div>
  )
}

// ── Main rail component ──────────────────────────────────────────────

interface SessionTabsProps {
  onSelectSession: (name: string) => void
}

export function SessionTabsFan({ onSelectSession }: SessionTabsProps) {
  const sessions = useSessionStore(s => s.sessions)
  const { activeSession } = useActiveSession()
  const isWrappingUp = useSessionStore(s => s.isWrappingUp)
  const wrapupAgeSeconds = useSessionStore(s => s.wrapupAgeSeconds)
  const doKillSession = useSessionStore(s => s.doKillSession)
  const stoppedWorkingAt = useSessionStore(s => s.stoppedWorkingAt)
  const lastViewed = useSessionStore(s => s.lastViewed)
  const getDisplayTitle = useSessionStore(s => s.getDisplayTitle)
  const setDisplayName = useSessionStore(s => s.setDisplayName)

  const vaultRoot = useSessionStore(s => s.vaultRoot)
  const availableProjects = usePMStore(s => s.availableProjects)
  const projectStateCache = usePMStore(s => s.projectStateCache)
  const fetchProjects = usePMStore(s => s.fetchProjects)

  const [sidebarCollapse, setSidebarCollapse] = useState<Record<string, boolean>>(() => loadSidebarCollapse())
  const toggleSidebarCollapse = useCallback((groupId: string) => {
    setSidebarCollapse(prev => {
      const next = { ...prev, [groupId]: !prev[groupId] }
      saveSidebarCollapse(next)
      return next
    })
  }, [])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // Tick every second so wrapupAgeSeconds triggers re-render near the 180s threshold
  const [, setTick] = useState(0)
  useEffect(() => {
    const anyWrapping = sessions.some(s => isWrappingUp(s))
    if (!anyWrapping) return
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [sessions, isWrappingUp])
  const fanExpanded = useWorkspaceStore(s => s.fanExpanded)
  const toggleFanExpanded = useWorkspaceStore(s => s.toggleFanExpanded)
  const [closeConfirmSession, setCloseConfirmSession] = useState<string | null>(null)
  const [showNewModal, setShowNewModal] = useState(false)
  const [renamingSession, setRenamingSession] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<string | null>(null)
  const [workspaceMode, setWorkspaceMode] = useState<'active' | 'projects'>('active')
  const [workspaceQuery, setWorkspaceQuery] = useState('')
  const [pinnedSessionNames, setPinnedSessionNames] = useState<string[]>(() => loadPinnedSessionNames())

  useEffect(() => {
    if (availableProjects.length === 0) {
      fetchProjects().catch(() => {})
    }
  }, [availableProjects.length, fetchProjects])

  // Fetch session cards on mount
  useEffect(() => {
    if (Object.keys(usePMStore.getState().sessionCards).length === 0) {
      api.fetchSessionCards()
        .then(data => usePMStore.setState({ sessionCards: data.cards }))
        .catch(() => {})
    }
  }, [])

  const projectTitles = useMemo(() => {
    const titles: Record<string, string> = {}
    for (const p of availableProjects) titles[p.id] = p.title || p.id
    for (const [projectId, response] of Object.entries(projectStateCache)) {
      titles[projectId] = response.state.project || titles[projectId] || projectId
    }
    titles.__scratch__ = 'Scratch'
    titles.__unfiled__ = 'Unfiled'
    return titles
  }, [availableProjects, projectStateCache])

  const domainTitles = useMemo(() => {
    const titles: Record<string, Record<string, string>> = {}
    for (const [projectId, response] of Object.entries(projectStateCache)) {
      titles[projectId] = {}
      for (const domain of response.state.domains || []) {
        titles[projectId][domain.id] = domain.title
      }
    }
    return titles
  }, [projectStateCache])

  const visibleBuckets = useMemo(
    () => buildHierarchyBuckets({
      sessions: sessions.filter(isRailLive),
      vaultRoot,
      projectTitles,
      domainTitles,
    }),
    [sessions, vaultRoot, projectTitles, domainTitles],
  )
  const pinnedSessionSet = useMemo(() => new Set(pinnedSessionNames), [pinnedSessionNames])

  useEffect(() => {
    const liveNames = new Set(sessions.filter(isRailLive).map(s => s.name))
    setPinnedSessionNames(prev => {
      const next = prev.filter(name => liveNames.has(name))
      if (next.length === prev.length) return prev
      savePinnedSessionNames(next)
      return next
    })
  }, [sessions])

  const sessionMatchesWorkspaceQuery = useCallback((session: Session, bucketLabel: string, query: string) => {
    if (!query) return true
    const displayTitle = getDisplayTitle(session)
    return [
      bucketLabel,
      session.name,
      displayTitle,
      session.task_title || '',
      session.agent_role || '',
      session.status || '',
    ].join(' ').toLowerCase().includes(query)
  }, [getDisplayTitle])

  const isActiveModeSession = useCallback((session: Session) => (
    session.name === activeSession ||
    session.status === 'working' ||
    session.status === 'waiting_input' ||
    session.status === 'login_required' ||
    session.status === 'idle'
  ), [activeSession])

  const displayedBuckets = useMemo(() => {
    const query = workspaceQuery.trim().toLowerCase()

    return visibleBuckets
      .map(bucket => {
        let filteredSessions = bucket.sessions

        if (workspaceMode === 'active') {
          filteredSessions = filteredSessions.filter(s => isActiveModeSession(s) && !pinnedSessionSet.has(s.name))
        }

        if (query) {
          filteredSessions = filteredSessions.filter(s => sessionMatchesWorkspaceQuery(s, bucket.group.label, query))
        }

        return { ...bucket, sessions: filteredSessions }
      })
      .filter(bucket => bucket.sessions.length > 0)
  }, [visibleBuckets, workspaceMode, workspaceQuery, pinnedSessionSet, isActiveModeSession, sessionMatchesWorkspaceQuery])

  const pinnedActiveSessions = useMemo(() => {
    if (workspaceMode !== 'active') return []
    const query = workspaceQuery.trim().toLowerCase()
    const byName = new Map<string, { session: Session; bucketLabel: string }>()
    for (const bucket of visibleBuckets) {
      for (const session of bucket.sessions) {
        if (pinnedSessionSet.has(session.name) && isActiveModeSession(session) && sessionMatchesWorkspaceQuery(session, bucket.group.label, query)) {
          byName.set(session.name, { session, bucketLabel: bucket.group.label })
        }
      }
    }
    return pinnedSessionNames
      .map(name => byName.get(name)?.session)
      .filter((session): session is Session => !!session)
  }, [workspaceMode, workspaceQuery, visibleBuckets, pinnedSessionSet, pinnedSessionNames, isActiveModeSession, sessionMatchesWorkspaceQuery])

  const groupIds = useMemo(() => displayedBuckets.map(b => `g:${b.group.id}`), [displayedBuckets])
  const sessionIdsByGroup = useMemo(() => {
    const m: Record<string, string[]> = {}
    for (const b of displayedBuckets) {
      m[b.group.id] = b.sessions.map(s => `s:${s.name}`)
    }
    return m
  }, [displayedBuckets])
  const projectTree = useMemo(
    () => buildProjectTree(displayedBuckets, projectTitles, domainTitles),
    [displayedBuckets, projectTitles, domainTitles],
  )
  const subAgentMap = useMemo(() => buildSubAgentMap(sessions), [sessions])

  const handleSelect = useCallback((name: string) => {
    onSelectSession(name)
  }, [onSelectSession])

  const handleClose = useCallback((name: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setCloseConfirmSession(name)
  }, [])

  const togglePinnedSession = useCallback((name: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setPinnedSessionNames(prev => {
      const next = prev.includes(name) ? prev.filter(n => n !== name) : [name, ...prev]
      savePinnedSessionNames(next)
      return next
    })
  }, [])

  const handleRailClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement
    if (target.closest('.rail-dot, .rail-card, .app-rail-new-agent, .rail-label, .rail-new-group, .rail-label-rename, .rail-rename-input, button, [role="dialog"]')) return
    toggleFanExpanded()
  }, [toggleFanExpanded])

  // Cross-group displacement animation during drag is restricted to the safe
  // path: target group has existing sessions (overId starts with `s:`) AND
  // source group will remain non-empty after the move. Skipping the optimistic
  // update for the dangerous paths prevents the React #185 ping-pong:
  //   - Target is empty (overId=`empty:`): optimistic move would unmount the
  //     target's EmptyGroupDropZone mid-drag. dnd-kit re-resolves the `over`
  //     and may flip back to a now-mounted source EmptyGroupDropZone, triggering
  //     another optimistic move in reverse → unbounded loop through dnd-kit's
  //     useRect (bundle line 3637 col 20321) → React #185.
  //   - Source has only this session AND is user-kind: after the move, source
  //     becomes empty and its EmptyGroupDropZone MOUNTS. Same ping-pong risk.
  // Drops into the empty zone still work via handleDragEnd's `empty:` branch.
  const handleDragOver = useCallback((e: DragOverEvent) => {
    if (!e.over) return
    const activeId = String(e.active.id)
    const overId = String(e.over.id)
    if (activeId === overId || !activeId.startsWith('s:')) return
  }, [])

  const handleDragEnd = useCallback((e: DragEndEvent) => {
    if (!e.over) return
    const activeId = String(e.active.id)
    const overId = String(e.over.id)
    if (activeId === overId) return
  }, [])

  const stopDrag = { onPointerDown: (e: React.PointerEvent) => e.stopPropagation() }

  const renderRailSession = (s: Session) => {
    const isWrapping = isWrappingUp(s)
    const age = wrapupAgeSeconds(s)
    const canForceClose = isWrapping && age !== null && age > 180
    const sc = dotStatus(s, activeSession, stoppedWorkingAt, lastViewed)
    const isActive = s.name === activeSession
    const displayTitle = getDisplayTitle(s)
    const isDragTarget = dragOver === s.name
    const isPinned = pinnedSessionSet.has(s.name)
    const subs = subAgentMap[s.name]
    const verifierCount = subs?.verifiers.length || 0
    const shadowCount = subs?.shadows.length || 0
    const verifierAttention = subs ? subAgentNeedsAttention(subs.verifiers) : false
    const shadowAttention = subs ? subAgentNeedsAttention(subs.shadows) : false

    const handleSubAgentClick = (agent: Session | undefined, e: React.MouseEvent) => {
      e.stopPropagation()
      if (agent) handleSelect(agent.name)
    }

    return (
      <SortableRailSession key={s.name} sessionName={s.name}>
        {/* Collapsed: status dot */}
        <SessionGlanceTooltip session={s}>
          <div
            className={`rail-dot${isActive ? ' active' : ''}${isDragTarget ? ' drop-target' : ''}`}
            onClick={() => handleSelect(s.name)}
            onDragOver={e => { e.preventDefault(); setDragOver(s.name) }}
            onDragLeave={() => setDragOver(null)}
            onDrop={e => { setDragOver(null); handleTabShareDrop(e, s.name) }}
          >
            <StatusShape status={sc} wrapping={isWrapping} />
            {canForceClose ? (
              <span
                className="rail-dot-close"
                data-force-close
                {...stopDrag}
                onClick={e => { e.stopPropagation(); api.killSession(s.name).catch(() => {}) }}
                title="Force close (stuck > 3 min)"
              >
                <AppIcon name="zap" size={8} />
              </span>
            ) : (
              <span
                className="rail-dot-close"
                {...stopDrag}
                onClick={e => handleClose(s.name, e)}
                title={isWrapping ? 'Wrapping up\u2026' : 'Close'}
                style={isWrapping ? { opacity: 0.35, pointerEvents: 'none' } : undefined}
              >
                {'\u00D7'}
              </span>
            )}
          </div>
        </SessionGlanceTooltip>

        {/* Expanded: card */}
        <SessionGlanceTooltip session={s}>
          <div
            className={`rail-card${isActive ? ' active' : ''}${isDragTarget ? ' drop-target' : ''}`}
            onClick={() => handleSelect(s.name)}
            onDragOver={e => { e.preventDefault(); setDragOver(s.name) }}
            onDragLeave={() => setDragOver(null)}
            onDrop={e => { setDragOver(null); handleTabShareDrop(e, s.name) }}
          >
            <StatusShape status={sc} wrapping={isWrapping} />
            <div className="rail-card-text">
              {renamingSession === s.name ? (
                <div {...stopDrag}>
                  <InlineRenameInput
                    value={displayTitle}
                    onSave={v => { setDisplayName(s.name, v); setRenamingSession(null) }}
                    onCancel={() => setRenamingSession(null)}
                  />
                </div>
              ) : (
                <>
                  <div className="rail-card-name">{displayTitle}</div>
                  {isWrapping && (
                    <div className="rail-card-wrapup">
                      {canForceClose ? `stuck \u00B7 ${age}s` : 'wrapping up\u2026'}
                    </div>
                  )}
                </>
              )}
            </div>
            {verifierCount > 0 && (
              <span
                className={`rail-subagent-chip verifier${verifierAttention ? ' attention' : ''}`}
                {...stopDrag}
                onClick={e => handleSubAgentClick(subs?.verifiers[0], e)}
                title={`${verifierCount} verifier${verifierCount > 1 ? 's' : ''}`}
              >V{verifierCount > 1 ? verifierCount : ''}</span>
            )}
            {shadowCount > 0 && (
              <span
                className={`rail-subagent-chip shadow${shadowAttention ? ' attention' : ''}`}
                {...stopDrag}
                onClick={e => handleSubAgentClick(subs?.shadows[0], e)}
                title={`${shadowCount} shadow${shadowCount > 1 ? 's' : ''}`}
              >S{shadowCount > 1 ? shadowCount : ''}</span>
            )}
            <span
              className={`rail-card-pin${isPinned ? ' active' : ''}`}
              {...stopDrag}
              onClick={e => togglePinnedSession(s.name, e)}
              title={isPinned ? 'Unpin from Active' : 'Pin to Active'}
            >
              <AppIcon name="pin" size={11} />
            </span>
            {renamingSession !== s.name && (
              <span
                className="rail-card-rename"
                {...stopDrag}
                onClick={e => { e.stopPropagation(); setRenamingSession(s.name) }}
                title="Rename"
              >
                <AppIcon name="edit" size={11} />
              </span>
            )}
            {canForceClose ? (
              <span
                className="rail-card-close"
                data-force-close
                {...stopDrag}
                onClick={e => { e.stopPropagation(); api.killSession(s.name).catch(() => {}) }}
                title="Force close (stuck > 3 min)"
              >
                <AppIcon name="zap" size={11} />
              </span>
            ) : (
              <span
                className="rail-card-close"
                {...stopDrag}
                onClick={e => handleClose(s.name, e)}
                title={isWrapping ? 'Wrapping up\u2026' : 'Close'}
                style={isWrapping ? { opacity: 0.35, pointerEvents: 'none' } : undefined}
              >
                {'\u00D7'}
              </span>
            )}
          </div>
        </SessionGlanceTooltip>
      </SortableRailSession>
    )
  }

  return (
    <div className={`session-rail${fanExpanded ? ' expanded' : ''}`} onClick={handleRailClick}>
      <div className="rail-top" onClick={e => e.stopPropagation()}>
        <IconButton
          variant="appShell"
          size="sm"
          onClick={() => toggleFanExpanded()}
          title={fanExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
          aria-label={fanExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          <AppIcon name={fanExpanded ? 'panel-left-close' : 'panel-left-open'} size={13} />
        </IconButton>
      </div>
      {fanExpanded && (
        <div className="rail-workspace-head" onClick={e => e.stopPropagation()}>
          <div className="rail-workspace-title">
            <div>
              <span className="rail-workspace-kicker">Session Rail</span>
              <strong>Agent Workspace</strong>
            </div>
            <span className="rail-workspace-density">expanded</span>
          </div>
          <div className="rail-workspace-mode" role="tablist" aria-label="Session workspace mode">
            <button
              type="button"
              className={workspaceMode === 'active' ? 'active' : ''}
              onClick={() => setWorkspaceMode('active')}
            >
              Active
            </button>
            <button
              type="button"
              className={workspaceMode === 'projects' ? 'active' : ''}
              onClick={() => setWorkspaceMode('projects')}
            >
              Projects
            </button>
          </div>
          <div className="rail-workspace-search">
            <AppIcon name="search" size={12} />
            <input
              value={workspaceQuery}
              onChange={e => setWorkspaceQuery(e.target.value)}
              placeholder="Search sessions, tasks"
            />
            {workspaceQuery && (
              <button type="button" onClick={() => setWorkspaceQuery('')} title="Clear search">
                <AppIcon name="x" size={11} />
              </button>
            )}
          </div>
        </div>
      )}
      <div className="rail-scroll">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          modifiers={DND_MODIFIERS}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          {fanExpanded && workspaceMode === 'projects' ? (
            <div className="rail-project-tree">
              {projectTree.map(project => (
                <section key={project.id} className="rail-project">
                  <div className="rail-project-title">
                    <AppIcon name="folder" size={13} />
                    <span>{project.label}</span>
                  </div>
                  {project.domains.map(domain => (
                    <div key={domain.id} className="rail-project-domain">
                      <div className="rail-project-domain-title">{domain.label}</div>
                      {domain.tasks.map(task => (
                        <div key={task.id} className="rail-project-task">
                          <div className="rail-project-task-title">{task.label}</div>
                          <SortableContext items={task.sessions.map(s => `s:${s.name}`)} strategy={verticalListSortingStrategy}>
                            <div className="rail-project-sessions">
                              {task.sessions.map(s => renderRailSession(s))}
                            </div>
                          </SortableContext>
                        </div>
                      ))}
                    </div>
                  ))}
                </section>
              ))}
            </div>
          ) : (
            <>
              {fanExpanded && workspaceMode === 'active' && pinnedActiveSessions.length > 0 && (
                <section className="rail-pinned-section">
                  <div className="rail-pinned-title">
                    <AppIcon name="pin" size={11} />
                    <span>Pinned</span>
                  </div>
                  <SortableContext items={pinnedActiveSessions.map(s => `s:${s.name}`)} strategy={verticalListSortingStrategy}>
                    <div className="rail-pinned-list">
                      {pinnedActiveSessions.map(s => renderRailSession(s))}
                    </div>
                  </SortableContext>
                </section>
              )}
              <SortableContext items={groupIds} strategy={verticalListSortingStrategy}>
                {displayedBuckets.map((bucket, bucketIdx) => {
                  const sessionIds = sessionIdsByGroup[bucket.group.id] ?? []
                  return (
                    <SortableRailGroup
                      key={bucket.group.id}
                      group={bucket.group}
                      bucketIdx={bucketIdx}
                      fanExpanded={fanExpanded}
                      collapsed={!!sidebarCollapse[bucket.group.id]}
                      isEmpty={bucket.sessions.length === 0}
                      onToggleCollapsed={() => toggleSidebarCollapse(bucket.group.id)}
                      isRenaming={false}
                      onStartRename={() => {}}
                      onCommitRename={() => {}}
                      onCancelRename={() => {}}
                      onDelete={() => {}}
                    >
                      <SortableContext items={sessionIds} strategy={verticalListSortingStrategy}>
                        {bucket.sessions.map(s => renderRailSession(s))}
                      </SortableContext>
                    </SortableRailGroup>
                  )
                })}
              </SortableContext>
            </>
          )}
        </DndContext>
      </div>

      <div className="rail-bottom">
        <ActionButton
          variant="appShell"
          size="appShell"
          className={`app-rail-new-agent ${fanExpanded ? 'w-full justify-start px-2' : 'w-8 justify-center px-0'} overflow-hidden`}
          onClick={() => setShowNewModal(true)}
        >
          <AppIcon name="plus" size={14} />
          <span className={fanExpanded ? 'inline' : 'hidden'}>New Agent</span>
        </ActionButton>
      </div>

      {closeConfirmSession && (
        <CloseConfirmDialog
          sessionName={sessions.find(s => s.name === closeConfirmSession)?.task_title || closeConfirmSession}
          open={!!closeConfirmSession}
          onOpenChange={open => { if (!open) setCloseConfirmSession(null) }}
          onConfirm={() => doKillSession(closeConfirmSession)}
        />
      )}
      {showNewModal && <NewAgentModal onClose={() => setShowNewModal(false)} />}
    </div>
  )
}
