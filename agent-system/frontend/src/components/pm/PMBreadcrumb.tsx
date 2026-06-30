import { ChevronRight, RefreshCw } from 'lucide-react'
import { usePMStore } from '@/stores/pm-store.ts'
import { displayPMNodeId, getPMAncestorIds } from '@/lib/paths.ts'
import { useHomeStore } from '@/stores/home-store.tsx'

// Ancestor derivation delegates to paths.ts (single source of truth, handles
// scratch + numbered + legacy domain-nested alias forms uniformly).

interface PMBreadcrumbProps {
  projectName?: string | null
  projectId?: string | null
  onGoHome?: () => void
}

export function PMBreadcrumb({ projectName, projectId, onGoHome }: PMBreadcrumbProps) {
  const state = usePMStore(s => s.state)
  const activeProject = usePMStore(s => s.activeProject)
  const currentNodeId = usePMStore(s => s.currentNodeId)
  const nodeCache = usePMStore(s => s.nodeCache)
  const projectNodeCache = activeProject ? (nodeCache[activeProject] || {}) : {}
  const filePreview = usePMStore(s => s.filePreview)
  const selectedGoalId = usePMStore(s => s.selectedGoalId)
  const loading = usePMStore(s => s.loading)
  const navigateToLevel = usePMStore(s => s.navigateToLevel)
  const fetchState = usePMStore(s => s.fetchState)
  const fetchUserTasks = usePMStore(s => s.fetchUserTasks)
  const openProject = usePMStore(s => s.openProject)
  const expandedWidgetId = useHomeStore(s => s.expandedWidgetId)
  const registry = useHomeStore(s => s.registry)
  const collapseWidget = useHomeStore(s => s.collapseWidget)

  const ancestors = currentNodeId ? getPMAncestorIds(currentNodeId) : []
  const widgetDef = expandedWidgetId ? registry.find(def => def.id === expandedWidgetId) : null
  const goal = selectedGoalId ? state?.goals?.find(g => g.id === selectedGoalId) : null

  const goDashboardHome = () => {
    if (projectId) {
      onGoHome?.()
      return
    }
    if (expandedWidgetId) {
      collapseWidget()
    }
  }

  const segments: Array<{ key: string; label: string; onClick?: () => void; active?: boolean; title?: string }> = []

  if (!projectId) {
    if (widgetDef) {
      segments.push({ key: 'root', label: 'Locusly', onClick: goDashboardHome })
      segments.push({ key: 'widget', label: widgetDef.title, active: true })
    } else {
      segments.push({ key: 'root', label: 'Locusly', active: true })
    }
  } else {
    segments.push({ key: 'root', label: 'Locusly', onClick: goDashboardHome })

    if (selectedGoalId) {
      segments.push({
        key: 'project',
        label: projectName || projectId,
        onClick: () => { void openProject(projectId) },
      })
      segments.push({ key: 'goals', label: 'Goals' })
      segments.push({
        key: 'goal',
        label: goal ? `${goal.id} ${goal.title}` : selectedGoalId,
        active: true,
      })
    } else {
      const projectLabel = projectName || projectId
      if (!currentNodeId && !filePreview) {
        segments.push({ key: 'project', label: projectLabel, active: true })
      } else {
        segments.push({
          key: 'project',
          label: projectLabel,
          onClick: () => { void openProject(projectId) },
        })
      }

      for (const id of ancestors) {
        if (id === 'scratch' && projectId === '__scratch__') continue
        const title = projectNodeCache[id]?.parent?.title || (id === 'scratch' ? 'Scratch' : displayPMNodeId(id))
        const segLabel = id === 'scratch' ? title : `${displayPMNodeId(id)} ${title}`
        segments.push({
          key: id,
          label: segLabel,
          onClick: () => navigateToLevel(id),
          title: segLabel,
        })
      }

      if (currentNodeId) {
        const currentTitle = projectNodeCache[currentNodeId]?.parent?.title || (currentNodeId === 'scratch' ? 'Scratch' : displayPMNodeId(currentNodeId))
        const currentLabel = currentNodeId === 'scratch' ? currentTitle : `${displayPMNodeId(currentNodeId)} ${currentTitle}`
        if (filePreview) {
          segments.push({
            key: 'current-node',
            label: currentLabel,
            onClick: () => navigateToLevel(currentNodeId),
          })
          segments.push({
            key: 'file',
            label: filePreview.name,
            active: true,
            title: filePreview.path,
          })
        } else {
          segments.push({
            key: 'current-node',
            label: currentLabel,
            active: true,
          })
        }
      } else if (filePreview) {
        segments.push({
          key: 'file',
          label: filePreview.name,
          active: true,
          title: filePreview.path,
        })
      }
    }
  }

  const visibleSegments = (() => {
    if (segments.length <= 4) return segments
    const head = segments.slice(0, 2)
    const tail = segments.slice(-2)
    return [
      ...head,
      { key: 'ellipsis', label: '...', title: segments.slice(2, -2).map(s => s.label).join(' > ') },
      ...tail,
    ]
  })()

  return (
    <nav className="flex min-w-0 items-center gap-0.5 text-sm">
      <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-hidden">
      {visibleSegments.map((segment, index) => (
        <span key={segment.key} className="flex min-w-0 items-center gap-0.5 overflow-hidden">
          {index > 0 && <ChevronRight size={13} className="shrink-0 text-[var(--color-text-subtle)]" />}
          {segment.onClick ? (
            <button
              className="min-w-0 max-w-[18rem] truncate bg-transparent border-none p-0 text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
              onClick={segment.onClick}
              title={segment.title || segment.label}
            >
              {segment.label}
            </button>
          ) : (
            <span
              className={`min-w-0 max-w-[18rem] truncate ${segment.active ? 'font-medium text-foreground' : 'text-muted-foreground'}`}
              title={segment.title || segment.label}
            >
              {segment.label}
            </span>
          )}
        </span>
      ))}
      </div>

      {projectId && (
        <button
          className="bg-none border-none text-muted-foreground cursor-pointer p-0.5 rounded-sm flex items-center transition-colors duration-150 hover:text-accent-foreground ml-1 shrink-0"
          onClick={() => { fetchState(projectId); fetchUserTasks() }}
          title="Refresh"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
        </button>
      )}
    </nav>
  )
}
