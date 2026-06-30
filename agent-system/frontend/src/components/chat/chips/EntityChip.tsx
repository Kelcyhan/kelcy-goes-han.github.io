import { useEffect, useRef, useState } from 'react'
import { ExternalLink, AlertCircle } from 'lucide-react'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover.tsx'

const HOVER_DELAY_MS = 500
import { ActionButton, EntityIcon, PMBadge } from '@/components/primitives'
import {
  statusToGroup,
  groupBadgeVariants,
  entityStatusLabel,
} from '@/components/primitives/status-utils'
import { usePMStore, type NodeDetail } from '@/stores/pm-store.ts'
import { useSessionStore } from '@/stores/session-store.ts'
import { extractTaskIdFromPath, extractProjectFromPath } from '@/lib/paths.ts'
import * as api from '@/lib/api.ts'
import { cn } from '@/lib/utils.ts'

/**
 * EntityChip — renders a clickable inline chip for a project/domain/task ref.
 *
 * Variants are dispatched on `parent.type` from the PM cache:
 *   - project → no numeric ID, project title only, accent color
 *   - domain  → "1.2 — Title", domain palette
 *   - task    → "1.2.3 — Title", task palette
 *
 * For task.md / worklog.md path-based refs, opens PM with preferredTab='log'
 * when the source filename was worklog.md.
 */

interface EntityChipProps {
  // From remark plugin's hProperties — all strings
  taskid?: string
  project?: string
  path?: string         // for pm-file refs (task.md / worklog.md with path)
  filename?: string     // task.md or worklog.md
  source?: string       // 'task-ref' | 'folder-id' | 'scratch' | 'pm-file'
}

function resolveProject(payloadProject: string | undefined): string | null {
  if (payloadProject) return payloadProject
  const { sessions, activeSession } = useSessionStore.getState()
  const session = sessions.find(s => s.name === activeSession)
  const sessionProject = session?.task_path?.match(/^projects\/([^/]+)/)?.[1] || null
  if (sessionProject) return sessionProject
  const pm = usePMStore.getState()
  if (pm.activeProject && pm.activeProject !== '__scratch__') return pm.activeProject
  if (pm.availableProjects.length === 1) return pm.availableProjects[0].id
  return null
}

function resolveTaskIdFromPath(path: string | undefined): { taskid: string | null; project: string | null } {
  if (!path) return { taskid: null, project: null }
  const taskid = extractTaskIdFromPath(path)
  const project = extractProjectFromPath(path)
  return { taskid, project }
}

export function EntityChip(props: EntityChipProps) {
  const { source, filename, path: srcPath } = props
  const preferredTab: 'log' | undefined = filename === 'worklog.md' ? 'log' : undefined

  // Resolve taskid + project (path-based refs need extra extraction)
  let taskid = props.taskid ?? null
  let project = props.project ?? null

  if (!taskid && srcPath) {
    const resolved = resolveTaskIdFromPath(srcPath)
    taskid = resolved.taskid
    project ??= resolved.project
  }

  // Fall back to session/PM context for the project
  if (taskid && !project) {
    const { sessions, activeSession } = useSessionStore.getState()
    const session = sessions.find(s => s.name === activeSession)
    // For scratch refs, prefer __scratch__ virtual project if no explicit context
    if (taskid.startsWith('scratch/')) {
      project = session?.task_path?.match(/^projects\/([^/]+)/)?.[1] || resolveProject(undefined) || '__scratch__'
    } else {
      project = resolveProject(undefined)
    }
  }

  if (!taskid || !project) {
    return <UnresolvedChip text={srcPath || props.taskid || filename || '?'} reason="No task ID / project resolvable" />
  }

  return <ResolvedEntityChip taskid={taskid} project={project} preferredTab={preferredTab} sourceFilename={filename} source={source} />
}

interface ResolvedProps {
  taskid: string
  project: string
  preferredTab?: 'log' | 'plan' | undefined
  sourceFilename?: string
  source?: string
}

function ResolvedEntityChip({ taskid, project, preferredTab, sourceFilename, source }: ResolvedProps) {
  const nodeCache = usePMStore(s => s.nodeCache)
  const cached = nodeCache[project]?.[taskid]
  const parent: NodeDetail | undefined = cached?.parent

  const [fetched, setFetched] = useState<NodeDetail | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Cache-miss fetch (on demand — when chip mounts and no cache)
  useEffect(() => {
    if (parent || fetched || error) return
    let cancelled = false
    api.fetchChildren(project, taskid).then(data => {
      if (cancelled) return
      setFetched(data.parent as NodeDetail)
      // Also seed the store cache so future chips hit immediately
      usePMStore.setState(s => {
        const projCache = s.nodeCache[project] || {}
        return {
          nodeCache: {
            ...s.nodeCache,
            [project]: { ...projCache, [taskid]: data as any },
          },
        }
      })
    }).catch(err => {
      if (cancelled) return
      setError(err?.message || 'Not found')
    })
    return () => { cancelled = true }
  }, [project, taskid, parent, fetched, error])

  const detail = parent || fetched
  const entityType = (detail?.type || 'task') as 'project' | 'domain' | 'task'
  const status = detail?.status || ''
  const title = detail?.title

  const navigate = async () => {
    await usePMStore.getState().goToTaskTarget(project, taskid, preferredTab)
  }

  // Loading placeholder
  if (!detail && !error) {
    return (
      <ActionButton
        variant="chip"
        size="chip"
        onClick={navigate}
        className="px-1.5 py-px rounded text-muted-foreground hover:text-foreground"
        title={`${project}/${taskid}`}
      >
        <EntityIcon type="task" size={11} />
        <span className="font-mono opacity-70">{taskid}</span>
      </ActionButton>
    )
  }

  if (error) {
    return <UnresolvedChip text={`${project}/${taskid}`} reason={error} />
  }

  // Build label per variant
  const label = buildLabel(entityType, taskid, title, source)
  const showStatusBadge = !!status

  const cancelHover = () => { if (hoverTimerRef.current) { clearTimeout(hoverTimerRef.current); hoverTimerRef.current = null } }
  const onEnter = () => { cancelHover(); hoverTimerRef.current = setTimeout(() => setOpen(true), HOVER_DELAY_MS) }
  const onLeave = () => { cancelHover(); setOpen(false) }
  const handleClick = () => { cancelHover(); setOpen(false); void navigate() }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <ActionButton
          variant="chip"
          size="chip"
          onClick={handleClick}
          onMouseEnter={onEnter}
          onMouseLeave={onLeave}
          className={cn(
            'px-1.5 py-px rounded text-foreground',
            '[&_svg]:shrink-0',
          )}
          title={sourceFilename ? `${project}/${taskid} — ${sourceFilename}` : `${project}/${taskid}`}
        >
          <EntityIcon type={entityType} status={status} size={11} />
          <span className="font-medium">{label}</span>
          {sourceFilename === 'worklog.md' && (
            <span className="type-caption uppercase tracking-wide text-muted-foreground">log</span>
          )}
          {showStatusBadge && (
            <PMBadge variant={groupBadgeVariants[statusToGroup(status)]} className="type-caption px-1 py-0">
              {entityStatusLabel(status, entityType)}
            </PMBadge>
          )}
        </ActionButton>
      </PopoverAnchor>
      <PopoverContent
        side="top"
        className="w-[300px] p-3"
        onMouseEnter={cancelHover}
        onMouseLeave={onLeave}
      >
        <EntityPopoverBody detail={detail!} entityType={entityType} project={project} navigate={navigate} preferredTab={preferredTab} />
      </PopoverContent>
    </Popover>
  )
}

function buildLabel(entityType: string, taskid: string, title: string | undefined, source: string | undefined): string {
  if (entityType === 'project') {
    return title || taskid
  }
  if (source === 'scratch') {
    return title || taskid.replace('scratch/', '')
  }
  return title ? `${taskid} — ${title}` : taskid
}

function EntityPopoverBody({ detail, entityType, project, navigate, preferredTab }: {
  detail: NodeDetail
  entityType: string
  project: string
  navigate: () => Promise<void>
  preferredTab?: 'log' | 'plan'
}) {
  const status = detail.status
  const lastActivity = (detail as any).last_activity || detail.updated
  return (
    <div className="flex flex-col gap-2 type-micro">
      <div className="flex items-center gap-1.5">
        <EntityIcon type={entityType} status={status} size={13} />
        <span className="font-semibold text-foreground truncate">{detail.title || detail.id}</span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 text-muted-foreground type-caption">
        <span className="font-mono">{project}/{detail.id}</span>
        {status && (
          <PMBadge variant={groupBadgeVariants[statusToGroup(status)]} className="type-caption px-1 py-0">
            {entityStatusLabel(status, entityType)}
          </PMBadge>
        )}
      </div>
      {detail.desc && (
        <div className="text-muted-foreground leading-snug line-clamp-3">{detail.desc}</div>
      )}
      <DetailMeta detail={detail} entityType={entityType} />
      {lastActivity && (
        <div className="type-caption text-muted-foreground">Last activity: {lastActivity}</div>
      )}
      <ActionButton
        variant="toolbarPrimary"
        size="toolbar"
        onClick={navigate}
        className="mt-1 gap-1"
      >
        <ExternalLink size={11} /> Open in PM{preferredTab === 'log' ? ' (log)' : ''}
      </ActionButton>
    </div>
  )
}

function DetailMeta({ detail, entityType }: { detail: NodeDetail; entityType: string }) {
  if (entityType === 'project') {
    return (
      <div className="type-caption text-muted-foreground">
        {(detail as any).vision && <div className="line-clamp-2"><span className="font-semibold">Vision:</span> {(detail as any).vision}</div>}
      </div>
    )
  }
  if (entityType === 'domain') {
    const priorities = detail.priorities || []
    return (
      <div className="type-caption text-muted-foreground space-y-1">
        {detail.focus && <div><span className="font-semibold">Focus:</span> {detail.focus}</div>}
        {priorities.length > 0 && (
          <div>
            <span className="font-semibold">Priorities:</span>{' '}
            {priorities.slice(0, 3).join(' • ')}
          </div>
        )}
      </div>
    )
  }
  // task
  return (
    <div className="type-caption text-muted-foreground space-y-1">
      {detail.goal && <div><span className="font-semibold">Goal:</span> {detail.goal}</div>}
      {detail.deps && detail.deps.length > 0 && (
        <div><span className="font-semibold">Deps:</span> {detail.deps.join(', ')}</div>
      )}
      {detail.sessions && detail.sessions.length > 0 && (
        <div><span className="font-semibold">Active sessions:</span> {detail.sessions.length}</div>
      )}
    </div>
  )
}

function UnresolvedChip({ text, reason }: { text: string; reason: string }) {
  return (
    <ActionButton
      variant="chip"
      size="chip"
      disabled
      className="px-1.5 py-px rounded opacity-60 cursor-help disabled:pointer-events-auto"
      title={reason}
    >
      <AlertCircle size={10} />
      <span className="font-mono truncate max-w-[180px]">{text}</span>
    </ActionButton>
  )
}
