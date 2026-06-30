import React, { useState, useEffect, useMemo, useRef, memo, useCallback } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { ChildCard } from '@/stores/pm-store.ts'
import { usePMStore } from '@/stores/pm-store.ts'
import { useSessionStore } from '@/stores/session-store.ts'
import * as api from '@/lib/api.ts'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog.tsx'
import { Button } from '@/components/ui/button.tsx'
import { AppIcon, PMBadge, Text, StatusBadge, SegmentedControl, IconButton, statusToGroup, groupColors, pmStatusLabel, type AppIconName } from '@/components/primitives'
import type { FileInfo } from '@/stores/pm-store.ts'
import { displayPMNodeId } from '@/lib/paths.ts'
import { SpawnSessionButton } from './shared.tsx'
import { ActiveAgents } from '@/components/home/ActiveAgents.tsx'
import { PastAgents } from '@/components/home/PastAgents.tsx'
import { CreateTaskDialog } from './CreateTaskDialog.tsx'
import { FileColumn } from './FileColumn.tsx'

const HIDDEN_AGENT_ROLES = new Set(['chainlink', 'verifier', 'shadow'])

function isVisibleLiveAgentSession(session: { status?: string; agent_role?: string | null }) {
  return session.status !== 'dead'
    && session.status !== 'ended'
    && !(session.agent_role && HIDDEN_AGENT_ROLES.has(session.agent_role))
}

/** Format file size in human-readable form */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}K`
  return `${(bytes / (1024 * 1024)).toFixed(1)}M`
}


// Note (2026-05-17): the legacy status-blind bucket lived here as
// _ARCHIVED_STATUSES = new Set(['done', 'shelved', 'dropped']). Removed because
// completed tasks should stay in the main grid; only physically-archived items
// (from <project>/archive/) populate the Archived bucket now.

function statusCardClass(status: string, type?: string): string {
  const group = statusToGroup(status)
  if (type === 'domain') {
    return `entity-card domain-card entity-card-domain status-${status}`
  }
  if (type === 'project') {
    return `entity-card project-card entity-card-project status-${status}`
  }
  return `entity-card task-card entity-card-task task-border-${group} status-${status}`
}

/** Inline style with --stripe-color for project (top) and domain (left) cards */
function stripeStyle(status: string): React.CSSProperties {
  const color = groupColors[statusToGroup(status)]
  return { '--stripe-color': color } as React.CSSProperties
}

function EntityMark({ type, status }: { type?: string; status?: string }) {
  const entityType = type === 'project' || type === 'domain' ? type : 'task'
  const group = status ? statusToGroup(status) : 'inactive'
  return (
    <AppIcon name={entityType} size={22} className={`flat-entity-mark flat-entity-mark-${entityType} flat-entity-mark-${group}`} />
  )
}

function segmentIcon(name: AppIconName) {
  return function SegmentAppIcon({ size, className }: { size?: number; className?: string }) {
    return <AppIcon name={name} size={size} className={className} />
  }
}

// --- Tab types ---

type CardTab = 'detail' | 'files' | 'agent' | 'more' | 'plan' | 'log'

// 'detail' intentionally omitted — dropped from child-card tabs on 2026-05-17
// (consistent with the earlier NodeHeader Detail drop). The DetailTabPanel and
// its 'detail' branch in TabPanels are unreachable as a result, kept in place
// for future reactivation in a different surface.
const TAB_CONFIG: { id: CardTab; label: string; icon: ReturnType<typeof segmentIcon> }[] = [
  { id: 'files', label: 'Files', icon: segmentIcon('files') },
  { id: 'agent', label: 'Agent', icon: segmentIcon('agent') },
  { id: 'more', label: 'More', icon: segmentIcon('more') },
]

const PARENT_TAB_CONFIG: { id: CardTab; label: string; icon: ReturnType<typeof segmentIcon> }[] = [
  { id: 'files', label: 'Files', icon: segmentIcon('files') },
  { id: 'agent', label: 'Agent', icon: segmentIcon('agent') },
  { id: 'plan', label: 'Plan', icon: segmentIcon('plan') },
  { id: 'log', label: 'Log', icon: segmentIcon('worklog') },
]

// SessionPopoverRow and SessionList replaced by AgentColumn component

// --- Tab panels ---

function DetailTabPanel({ card }: { card: ChildCard }) {
  const goals = card.goals && card.goals.length > 0 ? card.goals : card.goal ? [card.goal] : []
  const hasGoals = goals.length > 0
  const hasGoalSummary = card.goal_summary && Object.keys(card.goal_summary).length > 0

  if (!hasGoals && !hasGoalSummary) {
    return <Text as="div" variant="caption" tone="muted" className="italic py-1">No additional details</Text>
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Goals */}
      {hasGoals && (
        <div className="flex items-center gap-1 flex-wrap">
          {goals.slice(0, 3).map(g => {
            const goalId = g.includes('/') ? g.split('/')[0] : g
            const milestoneId = g.includes('/') ? g.split('/')[1] : null
            return (
              <PMBadge key={g} variant="goal" size="sm" className="cursor-pointer"
                onClick={(e: React.MouseEvent) => { e.stopPropagation(); usePMStore.getState().selectGoal(goalId) }}>
                {goalId}{milestoneId ? `/${milestoneId}` : ''}
              </PMBadge>
            )
          })}
          {goals.length > 3 && <Text variant="caption" tone="muted">+{goals.length - 3} more</Text>}
        </div>
      )}

      {/* Domain goal aggregation */}
      {hasGoalSummary && (
        <div className="flex items-center gap-1 flex-wrap">
          <Text variant="caption" tone="muted">Goals:</Text>
          {Object.entries(card.goal_summary!).map(([goalId, count], i) => (
            <Text key={goalId} variant="caption" tone="muted">
              {i > 0 && <span className="mx-0.5">&middot;</span>}
              <span className="cursor-pointer hover:text-accent-foreground"
                onClick={(e) => { e.stopPropagation(); usePMStore.getState().selectGoal(goalId) }}>
                {goalId} ({count})
              </span>
            </Text>
          ))}
        </div>
      )}
    </div>
  )
}

export function CardFileTable({ files }: { files: FileInfo[]; nodePath?: string }) {
  const openFilePreview = usePMStore(s => s.openFilePreview)
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set())
  const [folderContents, setFolderContents] = useState<Record<string, { name: string; type: 'file' | 'dir'; size?: number }[]>>({})

  const handleOpen = (path: string, name: string, type: string) => {
    if (type === 'folder') {
      // Toggle folder expansion
      setExpandedDirs(prev => {
        const next = new Set(prev)
        if (next.has(path)) {
          next.delete(path)
        } else {
          next.add(path)
          // Fetch folder contents if not already loaded
          if (!folderContents[path]) {
            api.fetchVaultDirectory(path).then(data => {
              setFolderContents(prev => ({ ...prev, [path]: data.entries }))
            }).catch(() => {})
          }
        }
        return next
      })
    } else {
      openFilePreview(path, name, type as 'file' | 'folder')
    }
  }

  return (
    <div>
      <table className="card-file-table">
        <thead>
          <tr>
            <th>Name</th>
            <th style={{ width: 52 }}></th>
          </tr>
        </thead>
        <tbody>
          {files.map(file => (
            <React.Fragment key={file.path}>
              <tr>
                <td>
                  <span className="ft-name" onClick={() => handleOpen(file.path, file.name, file.type)}>
                    {file.type === 'folder' && (
                      <span className={`card-ft-fold ${expandedDirs.has(file.path) ? 'expanded' : ''}`}>
                        <AppIcon name="chevron-right" size={10} />
                      </span>
                    )}
                    {file.type === 'folder'
                      ? <AppIcon name="folder" size={12} className="text-[var(--color-text-subtle)] shrink-0" />
                      : <AppIcon name="file" size={12} className="text-[var(--color-text-subtle)] shrink-0" />}
                    {file.name}
                    {file.type === 'folder' && file.count != null && (
                      <span className="ft-meta ml-1">({file.count})</span>
                    )}
                    {file.plan_progress && (
                      <span className="ft-meta ml-1">({file.plan_progress.done}/{file.plan_progress.total})</span>
                    )}
                  </span>
                </td>
                <td className="ft-actions" style={{ textAlign: 'right' }}>
                  {file.type === 'file' && (
                    <>
                      <IconButton variant="appShell" size="file" title="Open" onClick={() => handleOpen(file.path, file.name, file.type)}>
                        <AppIcon name="eye" size={11} />
                      </IconButton>
                      <IconButton variant="appShell" size="file" title="Download" onClick={() => {
                        const a = document.createElement('a')
                        a.href = api.downloadVaultUrl(file.path)
                        a.download = file.name
                        a.click()
                      }}>
                        <AppIcon name="download" size={11} />
                      </IconButton>
                    </>
                  )}
                </td>
              </tr>
              {/* Expanded folder children */}
              {file.type === 'folder' && expandedDirs.has(file.path) && folderContents[file.path] && (
                folderContents[file.path].map(child => {
                  const childPath = `${file.path}/${child.name}`
                  return (
                    <tr key={childPath} className="ft-sub">
                      <td>
                        <span className="ft-name" onClick={() => handleOpen(childPath, child.name, child.type === 'dir' ? 'folder' : 'file')}>
                          {child.type === 'dir'
                            ? <AppIcon name="folder" size={12} className="text-[var(--color-text-subtle)] shrink-0" />
                            : <AppIcon name="file" size={12} className="text-[var(--color-text-subtle)] shrink-0" />}
                          {child.name}
                          {child.size != null && child.type !== 'dir' && (
                            <span className="ft-meta ml-1">{formatSize(child.size)}</span>
                          )}
                        </span>
                      </td>
                      <td className="ft-actions" style={{ textAlign: 'right' }}>
                        {child.type !== 'dir' && (
                          <>
                            <IconButton variant="appShell" size="file" title="Open" onClick={() => handleOpen(childPath, child.name, 'file')}>
                              <AppIcon name="eye" size={11} />
                            </IconButton>
                            <IconButton variant="appShell" size="file" title="Download" onClick={() => {
                              const a = document.createElement('a')
                              a.href = api.downloadVaultUrl(childPath)
                              a.download = child.name
                              a.click()
                            }}>
                              <AppIcon name="download" size={11} />
                            </IconButton>
                          </>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
      <div className="card-file-foot">{files.length} items</div>
    </div>
  )
}

function FilesTabPanel({ card }: { card: ChildCard }) {
  if (card.files.length === 0) {
    return <Text as="div" variant="micro" tone="muted" className="py-2">No files</Text>
  }
  return (
    <div onClick={(e) => e.stopPropagation()}>
      <FileColumn files={card.files} nodePath={card.path || ''} mode="detail" />
    </div>
  )
}

function MoreTabPanel({ card, onArchive, onDelete }: { card: ChildCard; onArchive?: (id: string, title: string) => void; onDelete?: (id: string, title: string) => void }) {
  const hasActions = onArchive || onDelete
  return (
    <div className="flex flex-col gap-1">
      {onArchive && (
        <button
          className="flex items-center gap-1.5 type-micro text-amber-400 hover:text-amber-300 bg-transparent border-none cursor-pointer px-1 py-1 rounded hover:bg-[var(--bg-ingrained)]"
          onClick={(e) => { e.stopPropagation(); onArchive(card.id, card.title) }}
        >
          <AppIcon name="archive" size={12} /> Archive
        </button>
      )}
      {onDelete && (
        <button
          className="flex items-center gap-1.5 type-micro text-red-400 hover:text-red-300 bg-transparent border-none cursor-pointer px-1 py-1 rounded hover:bg-[var(--bg-ingrained)]"
          onClick={(e) => { e.stopPropagation(); onDelete(card.id, card.title) }}
        >
          <AppIcon name="trash" size={12} /> Delete
        </button>
      )}
      {!hasActions && (
        <Text as="div" variant="caption" tone="muted" className="italic py-1">No actions available</Text>
      )}
    </div>
  )
}

// --- Plan & Log tab panels (lazy-fetched) ---

function PlanTabPanel({ card }: { card: ChildCard }) {
  const [plan, setPlan] = useState<api.PlanData | null>(null)
  const [loading, setLoading] = useState(true)
  const project = card.path?.split('/')[1] || ''

  useEffect(() => {
    if (!project || !card.id) return
    setLoading(true)
    api.fetchPlan(project, card.id)
      .then(setPlan)
      .catch(() => setPlan(null))
      .finally(() => setLoading(false))
  }, [project, card.id])

  if (loading) return <Text as="div" variant="caption" tone="muted" className="py-2">Loading...</Text>
  if (!plan) return <Text as="div" variant="caption" tone="muted" className="italic py-1">No plan yet</Text>

  const steps = Array.isArray(plan.steps) ? plan.steps : []
  if (steps.length === 0) {
    return <Text as="div" variant="caption" tone="muted" className="italic py-1">Plan has no steps</Text>
  }

  const handleToggle = async (idx: number, checked: boolean) => {
    try {
      const result = await api.togglePlanStep(project, card.id, idx, checked)
      setPlan(prev => prev ? {
        ...prev,
        steps: (prev.steps ?? []).map((s, i) => i === idx ? { ...s, done: checked } : s),
        progress: result.progress,
      } : null)
    } catch { /* ignore */ }
  }

  return (
    <div className="flex flex-col gap-1.5">
      {plan.current_status?.next && (
        <div className="type-caption text-[var(--color-accent)] flex items-center gap-1 mb-0.5">
          <span className="font-semibold">Next:</span> {plan.current_status.next}
        </div>
      )}
      {steps.map((step, i) => (
        <label key={i} className="flex items-start gap-1.5 type-micro cursor-pointer hover:bg-[var(--bg-ingrained)] rounded px-1 py-0.5" onClick={e => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={step.done}
            onChange={(e) => handleToggle(i, e.target.checked)}
            className="mt-[2px] accent-[var(--color-accent)]"
          />
          <span className={step.done ? 'line-through text-[var(--color-text-subtle)]' : 'text-[var(--color-text-muted)]'}>
            {step.text}
          </span>
        </label>
      ))}
    </div>
  )
}

function LogTabPanel({ card }: { card: ChildCard }) {
  const [log, setLog] = useState<api.LogData | null>(null)
  const [loading, setLoading] = useState(true)
  const project = card.path?.split('/')[1] || ''

  useEffect(() => {
    if (!project || !card.id) return
    setLoading(true)
    api.fetchLog(project, card.id)
      .then(setLog)
      .catch(() => setLog(null))
      .finally(() => setLoading(false))
  }, [project, card.id])

  if (loading) return <Text as="div" variant="caption" tone="muted" className="py-2">Loading...</Text>
  if (!log) return <Text as="div" variant="caption" tone="muted" className="italic py-1">No log yet</Text>

  const entries = Array.isArray(log.entries) ? log.entries : []
  if (entries.length === 0 && !log.resume_brief) {
    return <Text as="div" variant="caption" tone="muted" className="italic py-1">Log has no entries</Text>
  }

  return (
    <div className="flex flex-col gap-1">
      {log.resume_brief?.next && (
        <div className="type-caption text-[var(--color-accent)] mb-0.5">
          <span className="font-semibold">Next:</span> {log.resume_brief.next}
        </div>
      )}
      {entries.slice(0, 5).map((entry, i) => (
        <div key={i} className="type-micro py-0.5 border-b border-[var(--color-border-subtle)] last:border-0">
          <div className="font-medium text-[var(--color-text)]">{entry.heading}</div>
          {entry.body && (
            <Text as="div" variant="caption" tone="subtle" className="whitespace-pre-wrap mt-0.5 line-clamp-2">{entry.body}</Text>
          )}
        </div>
      ))}
      {entries.length > 5 && (
        <Text as="div" variant="caption" tone="subtle" className="italic">+{entries.length - 5} more entries</Text>
      )}
    </div>
  )
}

// --- Agent tab panel: spawn button + embedded ActiveAgents + PastAgents ---

function AgentTabPanel({ card }: { card: ChildCard }) {
  const taskPath = card.path ?? ''
  const taskId = card.id ?? ''
  const vaultRoot = useSessionStore(s => s.vaultRoot)
  const activeProject = usePMStore(s => s.activeProject)
  const absPath = taskPath && vaultRoot ? `${vaultRoot.replace(/\/$/, '')}/${taskPath}` : ''
  const projectRoot = activeProject && vaultRoot ? `${vaultRoot.replace(/\/$/, '')}/projects/${activeProject}/` : ''
  const sessionFilter = useCallback(
    (s: { working_dir?: string; task_id?: string | null; task_path?: string | null }) => {
      if (taskId && s.task_id && (s.task_id === taskId || s.task_id.startsWith(taskId + '.'))) {
        if (taskPath && s.task_path?.startsWith(taskPath + '/')) return true
        if (taskPath && s.task_path === `${taskPath}/task.md`) return true
        if (projectRoot && s.working_dir?.startsWith(projectRoot)) return true
      }
      if (!s.working_dir) return false
      if (taskPath && s.working_dir.startsWith(taskPath)) return true
      if (absPath && s.working_dir.startsWith(absPath)) return true
      return false
    },
    [taskPath, absPath, taskId, projectRoot],
  )
  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-end">
        <SpawnSessionButton
          taskPath={taskPath}
          small
          onSpawned={() => usePMStore.getState().refreshCurrentNode()}
        />
      </div>
      <ActiveAgents
        readOnly
        compactMode
        suppressGroupHeaders
        filter={sessionFilter}
        emptyState={null}
      />
      <PastAgents
        projectId={activeProject ?? undefined}
        defaultDays={365}
        compactMode
        suppressDayGrouping
        workingDirPrefixes={taskPath ? [taskPath] : undefined}
        taskIdPrefixes={taskId ? [taskId] : undefined}
        emptyState={
          <Text as="div" variant="micro" tone="muted" className="italic py-2 text-center">
            No past agents for this task.
          </Text>
        }
      />
    </div>
  )
}

// --- Shared tab panel renderer & action bar ---

function TabPanels({ card, activeTab, onArchive, onDelete }: {
  card: ChildCard; activeTab: CardTab
  onArchive?: (id: string, title: string) => void
  onDelete?: (id: string, title: string) => void
}) {
  return (
    <div className="ec-detail" onClick={(e) => e.stopPropagation()}>
      <div className={`tab-panel ${activeTab === 'detail' ? 'active' : ''}`}>
        {activeTab === 'detail' && <DetailTabPanel card={card} />}
      </div>
      <div className={`tab-panel ${activeTab === 'files' ? 'active' : ''}`}>
        {activeTab === 'files' && <FilesTabPanel card={card} />}
      </div>
      <div className={`tab-panel ${activeTab === 'agent' ? 'active' : ''}`}>
        {activeTab === 'agent' && <AgentTabPanel card={card} />}
      </div>
      <div className={`tab-panel ${activeTab === 'more' ? 'active' : ''}`}>
        {activeTab === 'more' && <MoreTabPanel card={card} onArchive={onArchive} onDelete={onDelete} />}
      </div>
      <div className={`tab-panel ${activeTab === 'plan' ? 'active' : ''}`}>
        {activeTab === 'plan' && <PlanTabPanel card={card} />}
      </div>
      <div className={`tab-panel ${activeTab === 'log' ? 'active' : ''}`}>
        {activeTab === 'log' && <LogTabPanel card={card} />}
      </div>
    </div>
  )
}

function ActionBar({ isExpanded, activeTab, setActiveTab, onToggleExpand, tabs, dimmedTabs }: {
  isExpanded?: boolean; activeTab: CardTab
  setActiveTab: (tab: CardTab) => void
  onToggleExpand?: () => void
  tabs?: typeof TAB_CONFIG
  dimmedTabs?: Set<CardTab>
}) {
  const config = tabs || TAB_CONFIG
  return (
    <SegmentedControl
      variant="cardTabs"
      className="ec-tabs"
      iconSize={10}
      stopPropagation
      value={isExpanded ? activeTab : undefined}
      items={config.map(tab => ({
        id: tab.id,
        label: tab.label,
        icon: tab.icon,
        dimmed: dimmedTabs?.has(tab.id),
      }))}
      onValueChange={(id) => {
        const tabId = id as CardTab
        if (isExpanded && activeTab === tabId) {
          onToggleExpand?.()
        } else {
          setActiveTab(tabId)
          if (!isExpanded) onToggleExpand?.()
        }
      }}
    />
  )
}

// --- Card content (expandable) ---

export const CardContent = memo(function CardContent({
  card,
  isDragging,
  isExpanded,
  isOverlay,
  onToggleExpand,
  onArchive,
  onDelete,
}: {
  card: ChildCard
  isDragging?: boolean
  isExpanded?: boolean
  isOverlay?: boolean  // stays true during collapse animation to keep position:absolute
  onToggleExpand?: (id: string) => void
  onArchive?: (id: string, title: string) => void
  onDelete?: (id: string, title: string) => void
}) {
  const navigateTo = usePMStore(s => s.navigateTo)
  const [activeTab, setActiveTab] = useState<CardTab>('files')
  const lastClickRef = useRef<number>(0)
  const isParent = card.has_children

  // If the currently-active tab is Plan/Log but the card no longer reports
  // renderable content for it (e.g. after a server refresh), fall back to files.
  useEffect(() => {
    if (activeTab === 'plan' && !card.has_plan) setActiveTab('files')
    else if (activeTab === 'log' && !card.has_log) setActiveTab('files')
  }, [card.has_plan, card.has_log, activeTab])

  const handleClick = () => {
    if (isDragging) return
    const now = Date.now()
    const timeSinceLastClick = now - lastClickRef.current
    lastClickRef.current = now
    if (timeSinceLastClick < 350) { navigateTo(card.id); return }
    if (onToggleExpand) onToggleExpand(card.id)
  }

  const handleTabToggle = useCallback(() => {
    if (onToggleExpand) onToggleExpand(card.id)
  }, [onToggleExpand, card.id])

  const handleNavigateClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    navigateTo(card.id)
  }

  const activeSessions = (card.sessions || []).filter(isVisibleLiveAgentSession)
  const allActiveCount = activeSessions.length + (card.sub_sessions || []).filter(isVisibleLiveAgentSession).length

  // --- Parent card layout (demo.html v6: domain / project) ---
  if (isParent) {
    const isProject = card.type === 'project'
    const progress = card.plan_progress
    const pct = progress && progress.total > 0 ? (progress.done / progress.total) * 100 : 0
    const isDone = progress ? progress.done === progress.total : false
    const goals = card.goals && card.goals.length > 0 ? card.goals : card.goal ? [card.goal] : []

    // Content-aware tab gating: hide Plan/Log when the worklog doesn't carry
    // renderable plan/log sections (server's has_plan/has_log signal). This
    // naturally hides them on domains/projects (no worklog) and on tasks whose
    // worklog lacks plan/log YAML structure.
    const parentTabs = PARENT_TAB_CONFIG.filter(t => {
      if (t.id === 'plan') return !!card.has_plan
      if (t.id === 'log') return !!card.has_log
      return true
    })
    const parentDimmed = new Set<CardTab>()

    return (
      <div
        className={`group cursor-pointer ${statusCardClass(card.status, card.type)} ${(isOverlay ?? isExpanded) ? 'ec-expanded ec-parent-expanded' : ''} ${isDragging ? 'shadow-lg scale-[1.02] opacity-90' : ''}`}
        style={stripeStyle(card.status)}
        onClick={handleClick}
      >
        {/* Project header */}
        {isProject && (
          <div className="proj-hdr" onClick={handleNavigateClick}>
            <EntityMark type={card.type} status={card.status} />
            <span className="pc-id">{displayPMNodeId(card.id)}</span>
            <span className="pc-title">{card.title}</span>
            <button className="pc-go" onClick={handleNavigateClick} title="Enter">
              <AppIcon name="chevron-right" size={12} />
            </button>
          </div>
        )}

        {/* Card main (.cm) */}
        <div className="pc-cm">
          {/* Domain: identity row */}
          {!isProject && (
            <div className="pc-ci">
              <EntityMark type={card.type} status={card.status} />
              <span className="pc-id">{card.id === 'scratch' ? '' : displayPMNodeId(card.id)}</span>
              <span className="pc-title">{card.title}</span>
              <button className="pc-go" onClick={handleNavigateClick} title="Enter">
                <AppIcon name="chevron-right" size={12} />
              </button>
            </div>
          )}

          {/* Hero description */}
          {card.desc && <div className="pc-hero">{card.desc}</div>}

          {/* Metrics row */}
          <div className="pc-metrics">
            {progress && progress.total > 0 && (
              <div className="pc-pw">
                <div className="pc-pb">
                  <div
                    className={`pc-pf ${isDone ? 'c-done' : card.type === 'domain' ? 'c-dom' : 'c-active'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="pc-pl">{progress.done}/{progress.total}</span>
              </div>
            )}
            {allActiveCount > 0 && (
              <span className="pc-pill pc-pill-agent"><span className="pc-adot" /> {allActiveCount}</span>
            )}
          </div>
        </div>

        {/* Card footer */}
        <div className="pc-cf">
          <StatusBadge status={card.status} label={pmStatusLabel(card.status)} size="sm" />
          {goals.length > 0 && (
            <span className="flex items-center gap-1">
              <AppIcon name="goal" size={10} /> {goals[0].split('/')[0]}
            </span>
          )}
        </div>

        {/* Expandable panels */}
        <div className={`ec-panel ${isExpanded ? 'show' : ''}`}>
          <TabPanels card={card} activeTab={activeTab} onArchive={onArchive} onDelete={onDelete} />
        </div>

        {/* Action bar — parent tabs: Files/Agent + Plan/Log only when renderable */}
        <ActionBar
          isExpanded={isExpanded} activeTab={activeTab} setActiveTab={setActiveTab}
          onToggleExpand={handleTabToggle} tabs={parentTabs} dimmedTabs={parentDimmed}
        />
      </div>
    )
  }

  // --- Leaf/task card layout ---
  return (
    <div
      className={`group cursor-pointer ${statusCardClass(card.status, card.type)} ${(isOverlay ?? isExpanded) ? 'ec-expanded' : ''} ${isDragging ? 'shadow-lg scale-[1.02] opacity-90' : ''}`}
      onClick={handleClick}
    >
      <div className="p-[10px_12px] flex flex-col gap-1">
        <div className="flex items-center gap-[5px]">
          <EntityMark type={card.type} status={card.status} />
          <Text variant="caption" tone="subtle" font="mono">{displayPMNodeId(card.id)}</Text>
          <Text variant="label" weight="semibold" truncate className={`flex-1 whitespace-nowrap ${card.status === 'dropped' ? 'line-through' : ''}`}>
            {card.title}
          </Text>
          {allActiveCount > 0 && (
            <span className="task-live-pill"><span className="pc-adot" /> {allActiveCount}</span>
          )}
        </div>
        {card.desc && (
          <Text as="div" variant="micro" tone="muted" truncate className="whitespace-nowrap">
            {card.desc}
          </Text>
        )}
        <div className="flex items-center gap-1.5 mt-0.5">
          <StatusBadge status={card.status} label={pmStatusLabel(card.status)} size="sm" />
          {card.plan_progress && card.plan_progress.total > 0 && (
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              <div className="flex-1 h-[3px] rounded-full bg-[var(--bg-ingrained)] overflow-hidden">
                <div
                  className="h-full rounded-full transition-[width] duration-300"
                  style={{
                    width: `${(card.plan_progress.done / card.plan_progress.total) * 100}%`,
                    background: card.plan_progress.done === card.plan_progress.total
                      ? 'var(--color-status-complete)'
                      : 'var(--color-status-active)',
                  }}
                />
              </div>
              <Text variant="caption" tone="subtle" font="mono" className="shrink-0">
                {card.plan_progress.done}/{card.plan_progress.total}
              </Text>
            </div>
          )}
          {card.deps && card.deps.length > 0 && card.status !== 'done' && (
            <Text variant="caption" tone="danger" className="flex items-center gap-0.5 shrink-0">
              <AppIcon name="lock" size={9} /> {card.deps.map(d => d.split('/').pop()).join(', ')}
            </Text>
          )}
        </div>
        {(card.started || card.updated) && (
          <Text as="div" variant="caption" tone="subtle" className="flex items-center gap-2 mt-0.5">
            {card.started && <span>started: {card.started}</span>}
            {card.updated && <span>updated: {card.updated}</span>}
          </Text>
        )}
      </div>
      <div className={`ec-panel ${isExpanded ? 'show' : ''}`}>
        <TabPanels card={card} activeTab={activeTab} onArchive={onArchive} onDelete={onDelete} />
      </div>
      <ActionBar isExpanded={isExpanded} activeTab={activeTab} setActiveTab={setActiveTab} onToggleExpand={handleTabToggle} />
    </div>
  )
})

// --- Sortable wrapper ---

function SortableCard({ card, isExpanded, isOverlay, onToggleExpand, onArchive, onDelete }: {
  card: ChildCard
  isExpanded?: boolean
  isOverlay?: boolean
  onToggleExpand?: (id: string) => void
  onArchive?: (id: string, title: string) => void
  onDelete?: (id: string, title: string) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className="relative group/sortable">
      <div
        {...attributes}
        {...listeners}
        className="absolute left-0 top-0 bottom-0 w-6 flex items-center justify-center cursor-grab active:cursor-grabbing opacity-0 group-hover/sortable:opacity-100 transition-opacity z-10"
        title="Drag to reorder"
        onClick={(e) => e.stopPropagation()}
      >
        <AppIcon name="grip" size={14} className="text-muted-foreground" />
      </div>
      <div className="pl-4">
        <CardContent card={card} isExpanded={isExpanded} isOverlay={isOverlay} onToggleExpand={onToggleExpand} onArchive={onArchive} onDelete={onDelete} />
      </div>
    </div>
  )
}

function StaticCard({ card, isExpanded, onToggleExpand, onArchive, onDelete }: {
  card: ChildCard
  isExpanded?: boolean
  onToggleExpand?: (id: string) => void
  onArchive?: (id: string, title: string) => void
  onDelete?: (id: string, title: string) => void
}) {
  const slotRef = useRef<HTMLDivElement>(null)
  const [slotHeight, setSlotHeight] = useState<number | undefined>(undefined)
  const [isOverlay, setIsOverlay] = useState(false)

  useEffect(() => {
    if (isExpanded) {
      setIsOverlay(true)
    } else if (isOverlay) {
      const timer = setTimeout(() => {
        setIsOverlay(false)
        setSlotHeight(undefined)
      }, 400)
      return () => clearTimeout(timer)
    }
  }, [isExpanded])

  const handleToggle = useCallback((id: string) => {
    if (!isExpanded && slotRef.current) {
      setSlotHeight(slotRef.current.offsetHeight)
    }
    onToggleExpand?.(id)
  }, [isExpanded, onToggleExpand])

  return (
    <div ref={slotRef} className="relative" style={slotHeight ? { minHeight: slotHeight } : undefined}>
      <CardContent card={card} isExpanded={isExpanded} isOverlay={isOverlay} onToggleExpand={handleToggle} onArchive={onArchive} onDelete={onDelete} />
    </div>
  )
}

// --- Drop zones for cross-level moves ---

export function MoveToParentDropZone() {
  const { isOver, setNodeRef } = useDroppable({ id: '__move_to_parent__' })
  return (
    <div
      ref={setNodeRef}
      className={`flex items-center justify-center gap-2 rounded-md border-2 border-dashed py-2 px-4 type-label type-medium transition-all duration-200 ${
        isOver
          ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
          : 'border-[var(--color-border-subtle)] text-muted-foreground'
      }`}
    >
      <AppIcon name="move-up" size={14} />
      Move to parent level
    </div>
  )
}

function MoveIntoCardDropZone({ cardId, cardTitle }: { cardId: string; cardTitle: string }) {
  const { isOver, setNodeRef } = useDroppable({ id: `__move_into__${cardId}` })
  return (
    <div
      ref={setNodeRef}
      className={`absolute inset-0 rounded-md z-20 flex items-center justify-center transition-all duration-200 ${
        isOver
          ? 'border-2 border-dashed border-[var(--color-accent)] bg-[var(--color-accent)]/10'
          : 'border-2 border-dashed border-transparent'
      }`}
    >
      {isOver && (
        <div className="flex items-center gap-1.5 type-micro text-[var(--color-accent)] type-medium bg-card/90 px-2 py-1 rounded">
          <AppIcon name="move-into" size={12} />
          Move into {cardTitle}
        </div>
      )}
    </div>
  )
}

// Drop zone over the Archived section header — drag a card into it to physically
// archive it (api.archiveTask moves the folder to <project>/archive/).
function ArchivedSection({
  archived, expanded, setExpanded, expandedCardId, onToggleExpand, onArchive, onDelete, isDragActive,
}: {
  archived: ChildCard[]
  expanded: boolean
  setExpanded: (v: boolean) => void
  expandedCardId: string | null
  onToggleExpand: (id: string) => void
  onArchive?: (id: string, title: string) => void
  onDelete?: (id: string, title: string) => void
  isDragActive: boolean
}) {
  const { isOver, setNodeRef } = useDroppable({ id: '__archive__' })
  const hasArchived = archived.length > 0

  // When a drag is active we show the section even if it's empty, so the user
  // has a visible drop target. Otherwise hide it entirely when empty.
  if (!hasArchived && !isDragActive) return null

  return (
    <div ref={setNodeRef} className="mt-2">
      <button
        className={`flex items-center gap-2 w-full bg-none border-none cursor-pointer pt-3 pb-1 type-micro transition-colors ${
          isOver
            ? 'text-[var(--color-accent)]'
            : 'text-muted-foreground hover:text-foreground'
        }`}
        onClick={() => setExpanded(!expanded)}
      >
        <span className={`flex-1 h-px ${isOver ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-border-subtle)]'}`} />
        <span className="flex items-center gap-1 whitespace-nowrap font-medium">
          <AppIcon name="archive" size={11} />
          {isOver ? 'Drop to archive' : `Archived (${archived.length})`}
          <AppIcon name={expanded ? 'chevron-down' : 'chevron-right'} size={12} />
        </span>
        <span className={`flex-1 h-px ${isOver ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-border-subtle)]'}`} />
      </button>
      {hasArchived && expanded && (
        <div className={`grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3 items-start rounded-md p-2 transition-colors ${
          isOver ? 'bg-[var(--color-accent)]/5' : ''
        }`}>
          {archived.map(card => (
            <StaticCard
              key={card.id}
              card={card}
              isExpanded={expandedCardId === card.id}
              onToggleExpand={onToggleExpand}
              onArchive={onArchive}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
      {!hasArchived && isOver && (
        <div className="rounded-md border-2 border-dashed border-[var(--color-accent)] bg-[var(--color-accent)]/10 py-6 px-4 flex items-center justify-center type-label text-[var(--color-accent)] type-medium mt-1">
          <AppIcon name="archive" size={14} className="mr-1.5" />
          Drop to archive
        </div>
      )}
    </div>
  )
}

function SortableCardWithMoveZone({ card, isDragActive, draggedId, isExpanded, onToggleExpand, onArchive, onDelete }: {
  card: ChildCard
  isDragActive: boolean
  draggedId: string | null
  isExpanded?: boolean
  onToggleExpand?: (id: string) => void
  onArchive?: (id: string, title: string) => void
  onDelete?: (id: string, title: string) => void
}) {
  const showMoveZone = isDragActive && card.has_children && card.id !== draggedId
  const slotRef = useRef<HTMLDivElement>(null)
  const [slotHeight, setSlotHeight] = useState<number | undefined>(undefined)
  const [isOverlay, setIsOverlay] = useState(false)

  // On collapse: keep overlay (position:absolute) during panel close animation, then clear
  useEffect(() => {
    if (isExpanded) {
      setIsOverlay(true)
    } else if (isOverlay) {
      const timer = setTimeout(() => {
        setIsOverlay(false)
        setSlotHeight(undefined)
      }, 400)
      return () => clearTimeout(timer)
    }
  }, [isExpanded])

  const handleToggle = useCallback((id: string) => {
    if (!isExpanded && slotRef.current) {
      setSlotHeight(slotRef.current.offsetHeight)
    }
    onToggleExpand?.(id)
  }, [isExpanded, onToggleExpand])

  return (
    <div ref={slotRef} className="relative" style={slotHeight ? { minHeight: slotHeight } : undefined}>
      <SortableCard card={card} isExpanded={isExpanded} isOverlay={isOverlay} onToggleExpand={handleToggle} onArchive={onArchive} onDelete={onDelete} />
      {showMoveZone && <MoveIntoCardDropZone cardId={card.id} cardTitle={card.title} />}
    </div>
  )
}

// --- Undo toast ---

export interface MoveUndoInfo {
  taskId: string
  oldParentId: string
  newId: string
  message: string
}

export function UndoToast({ info, onUndo, onDismiss }: { info: MoveUndoInfo; onUndo: () => void; onDismiss: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 6000)
    return () => clearTimeout(timer)
  }, [onDismiss])

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-card border border-border rounded-lg shadow-lg px-4 py-2.5 type-body-sm">
      <span>{info.message}</span>
      <button
        className="text-[var(--color-accent)] type-semibold hover:underline cursor-pointer bg-transparent border-none type-body-sm"
        onClick={onUndo}
      >
        Undo
      </button>
      <button
        className="text-muted-foreground hover:text-foreground cursor-pointer bg-transparent border-none"
        onClick={onDismiss}
      >
        <AppIcon name="x" size={14} />
      </button>
    </div>
  )
}

// --- Main grid ---

interface ChildCardGridProps {
  cards: ChildCard[]
  /** Server-provided list of physically-archived items belonging to this parent. */
  archivedCards?: ChildCard[]
  isDragActive?: boolean
  draggedId?: string | null
  project?: string
  parentId?: string
  parentTitle?: string
}

export function ChildCardGrid({ cards, archivedCards, isDragActive, draggedId, project, parentId, parentTitle }: ChildCardGridProps) {
  const [archivedExpanded, setArchivedExpanded] = useState(true)
  const [showCreateTask, setShowCreateTask] = useState(false)
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null)
  const [confirmAction, setConfirmAction] = useState<{ type: 'archive' | 'delete'; id: string; title: string } | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  const handleArchive = useCallback((id: string, title: string) => setConfirmAction({ type: 'archive', id, title }), [])
  const handleDelete = useCallback((id: string, title: string) => setConfirmAction({ type: 'delete', id, title }), [])

  // Only one card expanded at a time
  const handleToggleExpand = useCallback((id: string) => {
    setExpandedCardId(prev => prev === id ? null : id)
  }, [])

  const executeAction = async () => {
    if (!confirmAction || !project) return
    setActionLoading(true)
    try {
      if (confirmAction.type === 'archive') {
        await api.archiveTask({ project, task_id: confirmAction.id })
      } else {
        await api.deleteTask({ project, task_id: confirmAction.id })
      }
      usePMStore.getState().silentRefreshCurrentNode()
    } catch (err) {
      console.error(`Failed to ${confirmAction.type} task:`, err)
    } finally {
      setActionLoading(false)
      setConfirmAction(null)
    }
  }

  // Active grid = ALL children passed in (status-blind). The bottom bucket is
  // driven by the server-provided archivedCards list — i.e. items physically
  // moved to <project>/archive/ via api.archiveTask. Completed (status=done)
  // tasks stay in the main grid with their status badge — they're no longer
  // auto-bucketed by status.
  const activeCards = cards
  const archived = archivedCards ?? []
  const activeIds = useMemo(() => activeCards.map(c => c.id), [activeCards])

  return (
    <>
      <SortableContext items={activeIds} strategy={rectSortingStrategy}>
        {activeCards.length === 0 && project && (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <Text variant="bodySm" tone="muted">No tasks here yet</Text>
            <button
              className="flex items-center gap-1.5 type-label text-accent bg-transparent border border-accent rounded-md px-3 py-1.5 cursor-pointer hover:bg-[rgba(255,255,255,0.05)] transition-colors"
              onClick={() => setShowCreateTask(true)}
            >
              <AppIcon name="plus" size={14} />
              Create the first task
            </button>
          </div>
        )}
        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3 items-start">
          {activeCards.map(card => (
            <SortableCardWithMoveZone
              key={card.id}
              card={card}
              isDragActive={!!isDragActive}
              draggedId={draggedId ?? null}
              isExpanded={expandedCardId === card.id}
              onToggleExpand={handleToggleExpand}
              onArchive={handleArchive}
              onDelete={handleDelete}
            />
          ))}
          {/* Ghost card — "New task" */}
          {project && activeCards.length > 0 && (
            <div
              className="border-2 border-dashed border-[var(--color-border-subtle)] rounded-md p-3 flex items-center justify-center gap-2 cursor-pointer transition-all duration-150 hover:border-[var(--color-accent)] hover:text-accent text-muted-foreground min-h-[80px]"
              onClick={() => setShowCreateTask(true)}
            >
              <AppIcon name="plus" size={16} />
              <Text variant="bodySm" weight="medium">New task</Text>
            </div>
          )}
        </div>
      </SortableContext>
      <ArchivedSection
        archived={archived}
        expanded={archivedExpanded}
        setExpanded={setArchivedExpanded}
        expandedCardId={expandedCardId}
        onToggleExpand={handleToggleExpand}
        onArchive={handleArchive}
        onDelete={handleDelete}
        isDragActive={!!isDragActive}
      />

      {/* Create task dialog */}
      {project && (
        <CreateTaskDialog
          open={showCreateTask}
          onOpenChange={setShowCreateTask}
          context={{ project, parentId, parentTitle }}
        />
      )}

      {/* Archive / Delete confirmation dialog */}
      {confirmAction && (
        <Dialog open onOpenChange={(open) => { if (!open) setConfirmAction(null) }}>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle>
                {confirmAction.type === 'archive' ? 'Archive' : 'Delete'} "{confirmAction.title}"?
              </DialogTitle>
              <DialogDescription>
                {confirmAction.type === 'archive'
                  ? 'The task will be moved to the project archive and removed from the active tree. You can find it later in archive/.'
                  : 'This will permanently remove the task and all its files. This cannot be undone.'}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmAction(null)} disabled={actionLoading}>
                Cancel
              </Button>
              <Button
                variant={confirmAction.type === 'delete' ? 'destructive' : 'default'}
                onClick={executeAction}
                disabled={actionLoading}
              >
                {actionLoading
                  ? (confirmAction.type === 'archive' ? 'Archiving...' : 'Deleting...')
                  : (confirmAction.type === 'archive' ? 'Archive' : 'Delete')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}

// Re-exports for CardGridView
export { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragOverlay, sortableKeyboardCoordinates }
export type { DragStartEvent, DragEndEvent }
