import { create } from 'zustand'
import * as api from '@/lib/api.ts'
import { normalizePMTaskId } from '@/lib/paths.ts'
import { useHomeStore } from '@/stores/home-store.tsx'

// Module-level SSE connection (non-reactive, avoids re-renders)
let _eventSource: EventSource | null = null
// Debounce timer for SSE-triggered refreshes.  During active agent work the
// server sends pm_changed events every ~500 ms.  Without debouncing, each
// event fires 3+ API calls plus N component re-fetches.  We coalesce rapid
// events and only refresh once the stream has been quiet for 1.5 s.
let _sseDebounceTimer: ReturnType<typeof setTimeout> | null = null
// State data pushed from server via SSE (avoids refetch)
let _pendingStateData: any = null
// Debounce timer for session-card-triggered node refreshes.
// When a session ends, the card disappears from session_cards_changed but
// the node cache still shows it as active.  A short debounced refresh
// picks up the server's updated session state (active→past transition).
let _sessionRefreshTimer: ReturnType<typeof setTimeout> | null = null

// --- State types mirroring state.yaml ---

export interface TaskRef {
  id: string
  title: string
  domain?: string
  status: string
  goal?: string
  goals?: string[]
  started?: string
  blocked_by?: string[]
}

export interface SubGoal {
  id: string
  title: string
  status: string
  progress: { done: number; total: number }
  backlog_count: number
  tasks: TaskRef[]
}

export interface Milestone {
  id: string
  title: string
  steps: string[]
  status: string  // done | in_progress | not_started
}

export interface TimelineEntry {
  step_id: string
  title: string
  earliest_start: string
  earliest_finish: string
  latest_start: string
  latest_finish: string
  slack_hours: number
  critical: boolean
}

export interface TaggedTask {
  id: string
  title: string
  status: string
  est_hours: number | null
  in_sequence: boolean
  goals: string[]
}

export interface TaggedBacklog {
  title: string
  est_hours: number | null
  source: string
  goals: string[]
}

export interface SequenceStep {
  id: string
  title: string
  depends_on: string[]
}

export interface GoalObservation {
  date: string
  note: string
}

export interface GoalDecision {
  date: string
  decision: string
  context?: string
}

export interface Goal {
  id: string
  title: string
  target: string
  status: string
  progress: { done: number; total: number }
  done_when: (string | { text: string; done: boolean })[]
  sub: SubGoal[]                        // legacy compat
  milestones?: Milestone[]              // v4
  timeline?: TimelineEntry[]            // v4 — CPM schedule
  sequence?: SequenceStep[]             // v4 — raw DAG structure with depends_on
  tagged_tasks?: TaggedTask[]           // v4 — tasks serving this goal
  tagged_backlog?: TaggedBacklog[]      // v4 — backlog items serving this goal
  buffer_hours?: number | null          // v4 — schedule buffer
  critical_path?: string[]             // v4 — step IDs on critical path
  schedule_status?: string             // v4 — ON_SCHEDULE | AT_RISK | BEHIND
  observations?: GoalObservation[]     // v4 — observation log
  decisions?: GoalDecision[]           // v4 — decision log
  references?: string[]                // v4 — reference links
}

export interface BacklogItem {
  title: string
  desc?: string
  goal?: string
  size?: string
  added?: string
}

export interface DomainContext {
  purpose?: string
  background?: string[]
  decisions?: string[]
  references?: string[]
}

export interface Domain {
  id: string
  title: string
  desc?: string
  health: string
  progress: { done: number; total: number }
  focus?: string
  last_activity?: string
  priorities?: string[]
  open_questions?: string[]
  active_tasks: TaskRef[]
  todo_tasks: TaskRef[]
  backlog_count: number
  context?: DomainContext
  backlog?: BacklogItem[]
}

export interface Alert {
  type: string
  severity?: string
  urgency?: string           // v4: critical | high | medium | low
  detail: string             // legacy
  message?: string           // v4 (same content as detail)
  goal?: string
  sub_goal?: string | null
  domain?: string
  entity?: string
  task?: string
  tasks?: string[]
}

export interface PlanningInfo {
  sprint_focus: string
  next_actions: { domain: string; action: string; why: string }[]
  parking_lot: string[]
  decisions_pending: string[]
}

export interface ProjectState {
  project: string
  computed: string
  status: string
  vision: string
  horizon: string
  goals: Goal[]
  domains: Domain[]
  tasks_summary: {
    total: number
    by_status: Record<string, number>
  }
  alerts: Alert[]
  planning: PlanningInfo
}

export interface UserTask {
  id: string
  type: string
  title: string
  task_id?: string
  context?: string
  urgency: string
  status: string
  session_name?: string
  files?: string[]
  created?: string
  resolved?: string
  resolution?: string
  html_url?: string
  html_stale?: boolean
}

export type GrowthStage = 'single_task' | 'with_children' | 'with_domains' | 'full_project'

export type PMView = 'overview' | 'domains' | 'tasks' | 'goals' | 'alerts'

export interface ProjectStateResponse {
  state: ProjectState
  growth_stage: string
  is_mock: boolean
  source?: string
}

/** Subset of PM state that is saved/restored per session. */
export interface PMSnapshot {
  activeProject: string | null
  activeView: PMView
  currentNodeId: string | null
  navigationStack: string[]
  expandedFolders: string[]
  selectedGoalId: string | null
  expandedWidgetId?: string | null
}

// --- Node browser types (children endpoint) ---

export interface FileInfo {
  name: string
  path: string
  type: 'file' | 'folder'
  size?: number
  mtime?: number
  count?: number
  plan_progress?: { done: number; total: number }
  has_plan?: boolean
  has_log?: boolean
}

export interface SessionInfo {
  name: string
  status: string   // 'active' | 'past'
  role: string
  model?: string
  uuid?: string    // Claude session UUID (for past sessions)
  date?: string    // creation date (for past sessions)
  turns?: number   // turn count (for past sessions)
  jsonl_path?: string  // for loading past session chat
  working_dir?: string // original session cwd (needed for --resume)
  task_id?: string // which subtask this session belongs to (for sub_sessions)
}

export interface DoneWhenItem {
  text: string
  done: boolean
}

export interface NodeContext {
  purpose: string
  background: string[]
  decisions: string[]
  references: string[]
}

export interface NodeDetail {
  id: string
  title: string
  type?: 'task' | 'domain' | 'project'
  desc?: string
  status: string
  path: string
  objective?: string
  done_when?: DoneWhenItem[]
  outcome?: string
  goal?: string
  owner?: string | string[]
  autonomy?: string
  deps?: string[]
  started?: string
  updated?: string
  files: FileInfo[]
  sessions: SessionInfo[]
  past_sessions?: SessionInfo[]
  session_ids?: string[]
  backlog?: BacklogItem[]
  // Domain-specific
  context?: NodeContext
  open_questions?: string[]
  focus?: string
  priorities?: string[]
  horizon?: string
  health?: string
  last_activity?: string
}

export interface ChildCard {
  id: string
  title: string
  type?: string           // 'task' | 'domain' | 'project' (backend sends fm.type, defaults to 'task')
  desc?: string
  status: string
  started?: string
  updated?: string
  /** When set, this task lives in <project>/archive/ — was physically archived
   * via api.archiveTask. Value is the YYYY-MM-DD date of archival. */
  archived?: string
  /** Original project-relative path before the task was moved to archive/. */
  archived_from?: string
  goal?: string
  goals?: string[]
  goal_summary?: Record<string, number> | null
  has_children: boolean
  has_plan?: boolean
  has_log?: boolean
  plan_progress?: { done: number; total: number }
  deps?: string[]
  order?: number
  path?: string
  files: FileInfo[]
  sessions: SessionInfo[]
  past_sessions?: SessionInfo[]
  sub_sessions?: SessionInfo[]
  session_ids?: string[]
}

export interface ChildrenResponse {
  parent: NodeDetail
  children: ChildCard[]
  /** Archived tasks (from <project>/archive/) whose archived_from path resolves
   * to a direct child of this parent. Independent of `children`. */
  archived_children?: ChildCard[]
  mtime?: number
}

type NodeCacheByProject = Record<string, Record<string, ChildrenResponse>>

function getProjectNodeCache(nodeCache: NodeCacheByProject, project: string | null | undefined): Record<string, ChildrenResponse> {
  if (!project) return {}
  return nodeCache[project] || {}
}

function updateProjectNodeCache(
  nodeCache: NodeCacheByProject,
  project: string,
  updater: (projectCache: Record<string, ChildrenResponse>) => Record<string, ChildrenResponse>,
): NodeCacheByProject {
  const current = nodeCache[project] || {}
  return {
    ...nodeCache,
    [project]: updater(current),
  }
}

function nestedScratchParent(nodeId: string): string | null {
  const m = nodeId.match(/^(\d+(?:\.\d+)*)\/scratch\/.+$/)
  return m ? m[1] : null
}

function deriveNavigationStack(nodeId: string | null): string[] {
  if (!nodeId || nodeId === 'scratch') return []
  if (nodeId.startsWith('scratch/')) return ['scratch']
  const nestedParent = nestedScratchParent(nodeId)
  if (nestedParent) {
    // Walk the parent chain (e.g. parent "1.2.3" → ['1.2', '1.2.3'])
    const parts = nestedParent.split('.')
    const stack: string[] = []
    for (let i = 2; i <= parts.length; i++) {
      stack.push(parts.slice(0, i).join('.'))
    }
    return stack
  }
  const parts = nodeId.split('.')
  const stack: string[] = []
  for (let i = 2; i < parts.length; i++) {
    stack.push(parts.slice(0, i).join('.'))
  }
  return stack
}

interface PMStore {
  // State data
  state: ProjectState | null
  growthStage: GrowthStage
  isMock: boolean
  loading: boolean
  error: string | null

  // Active project
  activeProject: string | null
  availableProjects: { id: string; title: string; type: string; status: string; vision: string; has_state: boolean }[]
  projectStateCache: Record<string, ProjectStateResponse>

  // User task queue
  userTasks: UserTask[]
  pendingCount: number
  blockingCount: number

  // Active view within PM tab
  activeView: PMView

  // Goal detail navigation
  selectedGoalId: string | null

  // Node browser state
  navigationStack: string[]           // stack of node IDs for back navigation
  currentNodeId: string | null        // currently viewed node (null = project root)
  expandedFolders: string[]           // folder paths expanded in FileSection
  nodeCache: NodeCacheByProject  // cached API responses keyed by project, then node id
  nodeLoading: boolean
  nodeError: string | null
  filePreview: {
    path: string
    name: string
    type: 'file' | 'folder'
    folderStack: { path: string; name: string; type: 'file' | 'folder' }[]
  } | null
  pendingNodeTab: 'plan' | 'log' | null  // requested tab after navigation

  // Actions
  fetchState: (project: string) => Promise<void>
  fetchProjects: () => Promise<void>
  prewarmProjectStates: (projectIds?: string[]) => Promise<void>
  openProject: (projectId: string) => Promise<void>
  deleteProject: (projectId: string) => Promise<void>
  goHome: () => void
  fetchUserTasks: () => Promise<void>
  resolveUserTask: (taskId: string, resolution?: string, status?: 'resolved' | 'dismissed') => Promise<void>
  setActiveView: (view: PMView) => void
  selectGoal: (goalId: string) => void
  clearSelectedGoal: () => void
  openTaskDoc: (taskId: string) => Promise<void>

  // Folder expansion (lifted from FileSection for snapshot persistence)
  toggleFolder: (path: string) => void
  setExpandedFolders: (folders: string[]) => void

  // Node browser actions
  navigateToWorklog: (path: string, preferredTab?: 'plan' | 'log') => Promise<boolean>
  goToTaskTarget: (projectId: string, taskId: string, preferredTab?: 'plan' | 'log') => Promise<void>
  navigateTo: (nodeId: string) => Promise<void>
  navigateBack: () => void
  navigateToRoot: () => void
  navigateToBreadcrumb: (nodeId: string) => void
  navigateToLevel: (nodeId: string | null) => void
  openFilePreview: (path: string, name: string, type?: 'file' | 'folder') => void
  closeFilePreview: () => void
  navigateFilePreview: (path: string, name: string, type: 'file' | 'folder') => void
  navigateFileBack: () => void
  refreshCurrentNode: () => Promise<void>
  silentRefreshCurrentNode: () => Promise<void>
  updateTaskFields: (taskId: string, fields: { goal?: string | null; goals?: string[]; deps?: string[]; status?: string; title?: string; desc?: string; objective?: string; outcome?: string; owner?: string[]; done_when?: { text: string; done: boolean }[]; context?: Partial<NodeContext>; open_questions?: string[]; focus?: string; priorities?: string[]; horizon?: string }) => Promise<void>
  updateGoal: (goalId: string, fields: { sequence?: { id: string; title?: string; depends_on?: string[] }[]; milestones?: { id: string; title?: string; steps?: string[] }[]; done_when?: { text: string; done: boolean }[]; title?: string; target?: string; status?: string; observations?: { date: string; note: string }[]; decisions?: { date: string; decision: string; context?: string }[]; references?: string[]; tagged_backlog?: { title: string; est_hours?: number }[] }) => Promise<void>
  createGoal: (fields: { title: string; description?: string; target?: string; done_when?: string[] }) => Promise<string | null>
  deleteGoal: (goalId: string, untagTasks?: boolean) => Promise<void>
  addTasksToGoal: (goalId: string, taskIds: string[], milestoneId?: string) => Promise<void>

  // Session cards (pushed via SSE from shadow agents)
  sessionCards: Record<string, import('@/lib/types.ts').SessionCard>

  // SSE — real-time push from file watcher
  sseConnected: boolean
  sseRefreshCounter: number
  sseConnect: (project: string) => void
  sseDisconnect: () => void

  // Drag & drop reordering
  reorderChildren: (parentId: string, orderedIds: string[]) => Promise<void>
  moveTask: (taskId: string, newParentId: string) => Promise<{ old_id: string; new_id: string } | null>

  // Snapshot methods for workspace persistence
  getSnapshot: () => PMSnapshot
  restoreSnapshot: (snapshot: PMSnapshot | undefined) => void
}

export const usePMStore = create<PMStore>()((set, get) => ({
  state: null,
  growthStage: 'single_task',
  isMock: false,
  loading: false,
  error: null,

  activeProject: null,
  availableProjects: [],
  projectStateCache: {},

  userTasks: [],
  pendingCount: 0,
  blockingCount: 0,

  activeView: 'overview',

  // Goal detail navigation
  selectedGoalId: null,

  // Node browser state
  navigationStack: [],
  currentNodeId: null,
  expandedFolders: [],
  nodeCache: {},
  nodeLoading: false,
  nodeError: null,
  filePreview: null,
  pendingNodeTab: null,
  sessionCards: {},
  sseConnected: false,
  sseRefreshCounter: 0,

  fetchState: async (project) => {
    // Clear stale node browser state when switching to a different project.
    // Compare against last successfully fetched project (state.project) rather
    // than activeProject, since some callers pre-set activeProject before
    // calling fetchState.  Use strict inequality (no null guard) so that
    // goHome() → new project also clears: goHome sets state=null, so
    // prevProject=undefined, and undefined !== 'NewProject' triggers clearing.
    // First load (undefined !== project) clears harmlessly (cache is empty).
    const prevProject = get().state?.project
    const isProjectSwitch = prevProject !== project
      && !(project === '__scratch__' && prevProject === 'Scratch')

    const cachedResponse = get().projectStateCache[project]
    const projectSwitchState = isProjectSwitch ? {
      currentNodeId: null,
      navigationStack: [],
      expandedFolders: [],
      filePreview: null,
      selectedGoalId: null,
    } : {}

    if (cachedResponse) {
      set({
        activeProject: project,
        state: cachedResponse.state,
        growthStage: cachedResponse.growth_stage as GrowthStage,
        isMock: cachedResponse.is_mock,
        loading: false,
        error: null,
        ...projectSwitchState,
      })
    } else {
      set({
        loading: true,
        error: null,
        activeProject: project,
        ...projectSwitchState,
      })
    }
    try {
      const data = await api.fetchPMState(project)
      const rootChildren = await api.fetchChildren(project).catch(() => null)
      set({
        state: data.state,
        growthStage: data.growth_stage as GrowthStage,
        isMock: data.is_mock,
        loading: false,
        projectStateCache: {
          ...get().projectStateCache,
          [project]: data,
        },
        ...(rootChildren
          ? {
              nodeCache: updateProjectNodeCache(get().nodeCache, project, projectCache => ({
                ...projectCache,
                __root__: rootChildren,
              })),
            }
          : {}),
      })
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to load state',
      })
    }
  },

  fetchProjects: async () => {
    try {
      const data = await api.fetchPMProjects()
      set({ availableProjects: data.projects })
      void get().prewarmProjectStates(
        data.projects.filter(p => p.has_state).map(p => p.id),
      )
    } catch {
      // silently fail — projects list is non-critical
    }
  },

  deleteProject: async (projectId) => {
    await api.deleteProject({ project: projectId })
    set(s => {
      const { [projectId]: _removed, ...remainingCache } = s.projectStateCache
      return {
        availableProjects: s.availableProjects.filter(p => p.id !== projectId),
        projectStateCache: remainingCache,
        activeProject: s.activeProject === projectId ? null : s.activeProject,
      }
    })
  },

  prewarmProjectStates: async (projectIds) => {
    const ids = projectIds ?? get().availableProjects.filter(p => p.has_state).map(p => p.id)
    const missing = ids.filter(id => !get().projectStateCache[id])
    if (missing.length === 0) return

    await Promise.allSettled(missing.map(async id => {
      const data = await api.fetchPMState(id)
      set(s => ({
        projectStateCache: {
          ...s.projectStateCache,
          [id]: data,
        },
      }))
    }))
  },

  openProject: async (projectId) => {
    if (get().activeProject === projectId) {
      set({
        activeView: 'overview',
        selectedGoalId: null,
        filePreview: null,
        currentNodeId: null,
        navigationStack: [],
        expandedFolders: [],
      })
      return
    }
    await get().fetchState(projectId)
    set({
      activeView: 'overview',
      selectedGoalId: null,
      filePreview: null,
      currentNodeId: null,
      navigationStack: [],
      expandedFolders: [],
    })
  },

  goHome: () => {
    set({
      activeProject: null,
      state: null,
      activeView: 'overview',
      currentNodeId: null,
      navigationStack: [],
      expandedFolders: [],
      filePreview: null,
      selectedGoalId: null,
      loading: false,
      error: null,
    })
  },

  fetchUserTasks: async () => {
    try {
      const data = await api.fetchUserTasks()
      set({
        userTasks: data.tasks,
        pendingCount: data.pending_count,
        blockingCount: data.blocking_count,
      })
    } catch {
      // silently fail
    }
  },

  resolveUserTask: async (taskId, resolution, status) => {
    try {
      await api.resolveUserTask(taskId, resolution, status)
      await get().fetchUserTasks()
    } catch (err) {
      console.error('Failed to resolve user task:', err)
    }
  },

  setActiveView: (view) => {
    set({ activeView: view })
  },

  selectGoal: (goalId) => {
    set({ selectedGoalId: goalId })
  },

  clearSelectedGoal: () => {
    set({ selectedGoalId: null })
  },

  openTaskDoc: async (taskId) => {
    const project = get().activeProject
    if (!project) return
    try {
      const { path } = await api.resolveTaskPath(project, taskId)
      const { useTabStore } = await import('./tab-store.ts')
      useTabStore.getState().openDocTab(path)
    } catch (err) {
      console.warn(`Could not resolve task path for ${taskId}:`, err)
    }
  },

  // --- Folder expansion (persisted via PMSnapshot) ---

  toggleFolder: (path: string) => {
    const folders = get().expandedFolders
    const idx = folders.indexOf(path)
    if (idx >= 0) {
      set({ expandedFolders: folders.filter((_, i) => i !== idx) })
    } else {
      set({ expandedFolders: [...folders, path] })
    }
  },

  setExpandedFolders: (folders: string[]) => {
    set({ expandedFolders: folders })
  },

  // --- Node browser actions ---

  navigateToWorklog: async (path: string, preferredTab?: 'plan' | 'log') => {
    const { extractProjectFromPath, extractTaskIdFromPath } = await import('@/lib/paths.ts')
    const projectId = extractProjectFromPath(path)
    const taskId = extractTaskIdFromPath(path)
    if (!projectId || !taskId) return false

    await get().goToTaskTarget(projectId, taskId, preferredTab)
    return true
  },

  goToTaskTarget: async (projectId, taskId, preferredTab) => {
    const normalizedTaskId = normalizePMTaskId(projectId, taskId)
    const { activeProject, projectStateCache } = get()

    if (activeProject !== projectId) {
      const cached = projectStateCache[projectId]
      if (cached) {
        set({
          activeProject: projectId,
          state: cached.state,
          growthStage: cached.growth_stage as GrowthStage,
          isMock: cached.is_mock,
          loading: false,
          error: null,
          currentNodeId: null,
          navigationStack: [],
          expandedFolders: [],
          filePreview: null,
          selectedGoalId: null,
        })
        // Refresh root state in background; cached root lets task navigation continue immediately.
        void get().fetchState(projectId)
      } else {
        await get().fetchState(projectId)
      }
    }

    if (preferredTab) {
      set({ pendingNodeTab: preferredTab })
    }

    await get().navigateTo(normalizedTaskId)
  },

  navigateTo: async (nodeId: string) => {
    const { activeProject, nodeCache } = get()
    if (!activeProject) return
    const normalizedNodeId = normalizePMTaskId(activeProject, nodeId)
    const projectNodeCache = getProjectNodeCache(nodeCache, activeProject)

    // Derive correct ancestor stack from node ID structure
    const newStack: string[] = deriveNavigationStack(normalizedNodeId)

    set({
      currentNodeId: normalizedNodeId,
      navigationStack: newStack,
      filePreview: null,
      expandedFolders: [],
      activeView: 'domains',
      nodeError: null,
    })

    const cached = projectNodeCache[normalizedNodeId]

    if (cached) {
      // Show cached data immediately. Server handles mtime-based cache
      // validation — fetchChildren returns cached response in ~1-5ms when
      // files haven't changed, so a background refresh is cheap.
      api.fetchChildren(activeProject, normalizedNodeId).then(data => {
        if (data.mtime !== cached.mtime) {
          set(s => ({
            nodeCache: updateProjectNodeCache(s.nodeCache, activeProject, projectCache => ({
              ...projectCache,
              [normalizedNodeId]: data,
            })),
          }))
        }
      }).catch(() => {})
      return
    }

    set({ nodeLoading: true })
    try {
      const data = await api.fetchChildren(activeProject, normalizedNodeId)
      set(s => ({
        nodeCache: updateProjectNodeCache(s.nodeCache, activeProject, projectCache => ({
          ...projectCache,
          [normalizedNodeId]: data,
        })),
        nodeLoading: false,
        nodeError: null,
      }))
    } catch (err) {
      console.error('Failed to fetch node:', normalizedNodeId, err)
      const message = err instanceof Error ? err.message : 'Task not found'
      set({ nodeLoading: false, nodeError: message })
    }
  },

  navigateBack: () => {
    const { currentNodeId } = get()
    if (!currentNodeId) return

    // Handle scratch IDs
    if (currentNodeId.startsWith('scratch/')) {
      set({ currentNodeId: 'scratch', navigationStack: [], expandedFolders: [], filePreview: null })
      return
    }
    if (currentNodeId === 'scratch') {
      set({ currentNodeId: null, navigationStack: [], expandedFolders: [], filePreview: null })
      return
    }

    // Nested scratch (e.g. "1.2/scratch/foo") → go to the parent domain
    const nestedParent = nestedScratchParent(currentNodeId)
    if (nestedParent) {
      set({ currentNodeId: nestedParent, navigationStack: deriveNavigationStack(nestedParent), expandedFolders: [], filePreview: null })
      return
    }

    // Go to parent based on node ID structure
    const parts = currentNodeId.split('.')
    if (parts.length <= 2) {
      // Root child (e.g. "1.2") → go to root
      set({ currentNodeId: null, navigationStack: [], expandedFolders: [], filePreview: null })
    } else {
      const parentId = parts.slice(0, -1).join('.')
      const parentStack: string[] = []
      for (let i = 2; i < parts.length - 1; i++) {
        parentStack.push(parts.slice(0, i).join('.'))
      }
      set({ currentNodeId: parentId, navigationStack: parentStack, expandedFolders: [], filePreview: null })
    }
  },

  navigateToRoot: () => {
    set({ currentNodeId: null, navigationStack: [], expandedFolders: [], filePreview: null })
  },

  navigateToBreadcrumb: (nodeId: string) => {
    const { navigationStack } = get()
    // Find nodeId in stack and truncate
    const idx = navigationStack.indexOf(nodeId)
    if (idx >= 0) {
      set({
        currentNodeId: nodeId,
        navigationStack: navigationStack.slice(0, idx),
        expandedFolders: [],
        filePreview: null,
      })
    }
  },

  navigateToLevel: (nodeId: string | null) => {
    if (!nodeId) {
      set({ currentNodeId: null, navigationStack: [], expandedFolders: [], filePreview: null })
      return
    }
    // Handle scratch IDs
    if (nodeId === 'scratch') {
      set({ currentNodeId: 'scratch', navigationStack: [], expandedFolders: [], filePreview: null })
      return
    }
    if (nodeId.startsWith('scratch/')) {
      set({ currentNodeId: nodeId, navigationStack: ['scratch'], expandedFolders: [], filePreview: null })
      return
    }
    set({ currentNodeId: nodeId, navigationStack: deriveNavigationStack(nodeId), expandedFolders: [], filePreview: null })
  },

  openFilePreview: (path: string, name: string, type?: 'file' | 'folder') => {
    set({ filePreview: { path, name, type: type || 'file', folderStack: [] } })
  },

  closeFilePreview: () => {
    set({ filePreview: null })
  },

  navigateFilePreview: (path: string, name: string, type: 'file' | 'folder') => {
    const { filePreview } = get()
    if (!filePreview) return
    // Push current location onto folder stack
    const newStack = [...filePreview.folderStack, { path: filePreview.path, name: filePreview.name, type: filePreview.type }]
    set({ filePreview: { path, name, type, folderStack: newStack } })
  },

  navigateFileBack: () => {
    const { filePreview } = get()
    if (!filePreview) return
    if (filePreview.folderStack.length === 0) {
      // Back to card grid
      set({ filePreview: null })
      return
    }
    const newStack = [...filePreview.folderStack]
    const prev = newStack.pop()!
    set({ filePreview: { path: prev.path, name: prev.name, type: prev.type, folderStack: newStack } })
  },

  refreshCurrentNode: async () => {
    const { activeProject, currentNodeId } = get()
    if (!activeProject) return

    set({ nodeLoading: true })
    try {
      const data = await api.fetchChildren(activeProject, currentNodeId || undefined)
      const cacheKey = currentNodeId || '__root__'
      set(s => ({
        nodeCache: updateProjectNodeCache(s.nodeCache, activeProject, projectCache => ({
          ...projectCache,
          [cacheKey]: data,
        })),
        nodeLoading: false,
      }))
    } catch (err) {
      console.error('Failed to refresh node:', err)
      set({ nodeLoading: false })
    }
  },

  silentRefreshCurrentNode: async () => {
    const { activeProject, currentNodeId } = get()
    if (!activeProject) return
    try {
      const data = await api.fetchChildren(activeProject, currentNodeId || undefined)
      const cacheKey = currentNodeId || '__root__'
      set(s => ({
        nodeCache: updateProjectNodeCache(s.nodeCache, activeProject, projectCache => ({
          ...projectCache,
          [cacheKey]: data,
        })),
      }))
    } catch {
      // Silent — don't disrupt UI on background refresh failure
    }
  },

  reorderChildren: async (parentId: string, orderedIds: string[]) => {
    const { activeProject, currentNodeId, nodeCache } = get()
    if (!activeProject) return
    const cacheKey = currentNodeId || '__root__'
    const projectNodeCache = getProjectNodeCache(nodeCache, activeProject)
    const cached = projectNodeCache[cacheKey]
    if (cached) {
      const idOrder = new Map(orderedIds.map((id, i) => [id, i]))
      const reordered = [...cached.children].sort((a, b) => {
        const oa = idOrder.get(a.id) ?? 999
        const ob = idOrder.get(b.id) ?? 999
        return oa - ob
      })
      set(s => ({
        nodeCache: updateProjectNodeCache(s.nodeCache, activeProject, projectCache => ({
          ...projectCache,
          [cacheKey]: { ...cached, children: reordered },
        })),
      }))
    }
    try {
      await api.reorderTasks(activeProject, parentId, orderedIds)
      get().silentRefreshCurrentNode()
    } catch (err) {
      console.error('Failed to reorder tasks:', err)
      get().silentRefreshCurrentNode()
    }
  },

  moveTask: async (taskId: string, newParentId: string) => {
    const { activeProject } = get()
    if (!activeProject) return null
    try {
      const result = await api.moveTask(activeProject, taskId, newParentId)
      set(s => {
        const next = { ...s.nodeCache }
        delete next[activeProject]
        return { nodeCache: next }
      })
      await get().refreshCurrentNode()
      if (activeProject) get().fetchState(activeProject)
      return { old_id: result.old_task_id, new_id: result.new_task_id }
    } catch (err) {
      console.error('Failed to move task:', err)
      return null
    }
  },

  updateTaskFields: async (taskId: string, fields: { goal?: string | null; deps?: string[]; status?: string; title?: string; desc?: string; objective?: string; outcome?: string; owner?: string[]; done_when?: { text: string; done: boolean }[]; context?: Partial<NodeContext>; open_questions?: string[]; focus?: string; priorities?: string[]; horizon?: string }) => {
    const { activeProject, currentNodeId, nodeCache } = get()
    if (!activeProject) return

    // Optimistic update: patch cached node data immediately so UI feels instant
    const cacheKey = currentNodeId || '__root__'
    const projectNodeCache = getProjectNodeCache(nodeCache, activeProject)
    const cached = projectNodeCache[cacheKey]
    if (cached) {
      const patchNode = (node: any) => {
        if (node.id !== taskId) return node
        const patched = { ...node }
        if ('title' in fields) patched.title = fields.title
        if ('desc' in fields) patched.desc = fields.desc
        if ('objective' in fields) patched.objective = fields.objective
        if ('outcome' in fields) patched.outcome = fields.outcome
        if ('status' in fields) patched.status = fields.status
        if ('goal' in fields) patched.goal = fields.goal
        if ('owner' in fields) patched.owner = fields.owner
        if ('deps' in fields) patched.deps = fields.deps
        if ('done_when' in fields) patched.done_when = fields.done_when
        if ('context' in fields) patched.context = { ...(patched.context || {}), ...fields.context }
        if ('open_questions' in fields) patched.open_questions = fields.open_questions
        if ('focus' in fields) patched.focus = fields.focus
        if ('priorities' in fields) patched.priorities = fields.priorities
        if ('horizon' in fields) patched.horizon = fields.horizon
        return patched
      }
      const optimistic = {
        ...cached,
        parent: patchNode(cached.parent),
        children: cached.children.map(patchNode),
      }
      set(s => ({
        nodeCache: updateProjectNodeCache(s.nodeCache, activeProject, projectCache => ({
          ...projectCache,
          [cacheKey]: optimistic,
        })),
      }))
    }

    // Fire API call in background, then silently refresh to get server-confirmed state
    try {
      await api.updateTaskFields(activeProject, taskId, fields)
      // Background refresh — don't wipe cache (optimistic data stays visible)
      get().silentRefreshCurrentNode()
      if (fields.status) {
        get().fetchState(activeProject)
      }
    } catch (err) {
      console.error('Failed to update task fields:', err)
      // Revert optimistic update by fetching fresh data
      get().silentRefreshCurrentNode()
    }
  },

  updateGoal: async (goalId: string, fields) => {
    const { activeProject } = get()
    if (!activeProject) return
    try {
      await api.updateGoal(activeProject, goalId, fields)
      // Refresh state to pick up regenerated state.yaml
      get().fetchState(activeProject)
    } catch (err) {
      console.error('Failed to update goal:', err)
    }
  },

  createGoal: async (fields) => {
    const { activeProject } = get()
    if (!activeProject) return null
    try {
      const result = await api.createGoal(activeProject, fields)
      get().fetchState(activeProject)
      return result.goal_id
    } catch (err) {
      console.error('Failed to create goal:', err)
      return null
    }
  },

  deleteGoal: async (goalId, untagTasks = false) => {
    const { activeProject } = get()
    if (!activeProject) return
    try {
      await api.deleteGoal(activeProject, goalId, untagTasks)
      if (get().selectedGoalId === goalId) {
        set({ selectedGoalId: null })
      }
      get().fetchState(activeProject)
    } catch (err) {
      console.error('Failed to delete goal:', err)
    }
  },

  addTasksToGoal: async (goalId, taskIds, milestoneId) => {
    const project = get().activeProject
    if (!project) return
    await api.addTasksToGoal(project, goalId, taskIds, milestoneId)
    await get().fetchState(project)
  },

  // --- SSE — real-time push from file watcher ---

  sseConnect: (project: string) => {
    get().sseDisconnect()

    const token = api.getAuthToken()
    const params = new URLSearchParams()
    if (project) params.set('project', project)
    if (token) params.set('token', token)

    const es = new EventSource(`/api/pm/events?${params.toString()}`)

    es.onopen = () => { set({ sseConnected: true }) }

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'session_cards_changed' && data.cards) {
          const prevCards = get().sessionCards
          set({ sessionCards: data.cards })

          // Detect session set changes (session appeared/disappeared).
          // When a session ends, its card file may be removed → triggers
          // this event.  Refresh node data so the PM card grid transitions
          // the session from active→past without a full page reload.
          const prevNames = Object.keys(prevCards)
          const newNames = Object.keys(data.cards as Record<string, unknown>)
          if (prevNames.length !== newNames.length
              || prevNames.some(n => !(data.cards as Record<string, unknown>)[n])) {
            if (_sessionRefreshTimer) clearTimeout(_sessionRefreshTimer)
            _sessionRefreshTimer = setTimeout(() => {
              _sessionRefreshTimer = null
              get().silentRefreshCurrentNode()
            }, 1000)
          }
        } else if (data.type === 'pm_changed') {
          // Debounce: coalesce rapid events (agent writes many files in
          // sequence) and only refresh after 1.5 s of quiet.  This avoids
          // firing 8+ API calls per event during active agent work.
          if (_sseDebounceTimer) clearTimeout(_sseDebounceTimer)

          // If the SSE event carries state data (server rebuilt it already),
          // store it for use in the debounced handler to avoid a refetch.
          if (data.state) {
            _pendingStateData = data.state
          }

          _sseDebounceTimer = setTimeout(async () => {
            _sseDebounceTimer = null
            const { activeProject, currentNodeId } = get()
            if (!activeProject) return

            const updates: Record<string, unknown> = { sseRefreshCounter: get().sseRefreshCounter + 1 }

            // Use server-pushed state data if available (avoids /state fetch entirely)
            if (_pendingStateData) {
              const pushed = _pendingStateData
              _pendingStateData = null
              updates.state = pushed.state
              updates.growthStage = pushed.growth_stage
            } else {
              // Fallback: fetch state from API (mtime-cached on server, fast)
              try {
                const stateResult = await api.fetchPMState(activeProject)
                updates.state = stateResult.state
                updates.growthStage = stateResult.growth_stage
              } catch { /* ignore */ }
            }

            // Fetch user tasks + current node children in parallel
            // (these are mtime-cached on server, typically <5ms)
            const [tasksResult, childrenResult] = await Promise.allSettled([
              api.fetchUserTasks(),
              api.fetchChildren(activeProject, currentNodeId || undefined),
            ])

            if (tasksResult.status === 'fulfilled') {
              updates.userTasks = tasksResult.value.tasks
              updates.pendingCount = tasksResult.value.pending_count
              updates.blockingCount = tasksResult.value.blocking_count
            }
            if (childrenResult.status === 'fulfilled') {
              const cacheKey = currentNodeId || '__root__'
              updates.nodeCache = updateProjectNodeCache(get().nodeCache, activeProject, projectCache => ({
                ...projectCache,
                [cacheKey]: childrenResult.value,
              }))
            }

            set(updates as any)

            // Refresh inbox store (separate, non-critical)
            import('@/stores/inbox-store.ts').then(m => m.useInboxStore.getState().fetchQueue())
          }, 1500)
        }
      } catch { /* ignore parse errors */ }
    }

    es.onerror = () => {
      set({ sseConnected: false })
      // EventSource auto-reconnects — browser handles this
    }

    _eventSource = es
  },

  sseDisconnect: () => {
    if (_sessionRefreshTimer) {
      clearTimeout(_sessionRefreshTimer)
      _sessionRefreshTimer = null
    }
    if (_sseDebounceTimer) {
      clearTimeout(_sseDebounceTimer)
      _sseDebounceTimer = null
    }
    if (_eventSource) {
      _eventSource.close()
      _eventSource = null
    }
    set({ sseConnected: false })
  },

  getSnapshot: () => ({
    activeProject: get().activeProject,
    activeView: get().activeView,
    currentNodeId: get().currentNodeId,
    navigationStack: [...get().navigationStack],
    expandedFolders: [...get().expandedFolders],
    selectedGoalId: get().selectedGoalId,
    expandedWidgetId: useHomeStore.getState().expandedWidgetId,
  }),

  restoreSnapshot: (snapshot) => {
    if (!snapshot) return

    const activeProject = snapshot.activeProject ?? null
    const currentNodeId = normalizePMTaskId(activeProject, snapshot.currentNodeId)
    const expandedFolders = snapshot.expandedFolders || []
    const selectedGoalId = snapshot.selectedGoalId ?? null

    if ('expandedWidgetId' in snapshot) {
      useHomeStore.setState({ expandedWidgetId: snapshot.expandedWidgetId ?? null })
    }

    if (!activeProject) {
      get().goHome()
      set({
        activeView: snapshot.activeView,
        expandedFolders,
        selectedGoalId,
      })
      return
    }

    const cachedProject = get().projectStateCache[activeProject]
    const nextUpdates: Record<string, unknown> = {
      activeProject,
      activeView: snapshot.activeView,
      currentNodeId: currentNodeId ?? null,
      navigationStack: snapshot.navigationStack?.length ? snapshot.navigationStack : deriveNavigationStack(currentNodeId),
      expandedFolders,
      selectedGoalId,
      filePreview: null,
      pendingNodeTab: null,
      loading: !cachedProject,
      error: null,
    }

    if (cachedProject) {
      nextUpdates.state = cachedProject.state
      nextUpdates.growthStage = cachedProject.growth_stage as GrowthStage
      nextUpdates.isMock = cachedProject.is_mock
      nextUpdates.loading = false
    }

    set(nextUpdates as any)

    // Refresh project root in the background without resetting the restored
    // node/stack. Using fetchState() here would clear currentNodeId on project
    // switches and reintroduce the visible PM jump.
    void api.fetchPMState(activeProject).then(data => {
      const current = get()
      if (current.activeProject !== activeProject) return
      set(s => ({
        state: data.state,
        growthStage: data.growth_stage as GrowthStage,
        isMock: data.is_mock,
        loading: false,
        error: null,
        projectStateCache: {
          ...s.projectStateCache,
          [activeProject]: data,
        },
      }))
    }).catch(() => {
      const current = get()
      if (current.activeProject !== activeProject) return
      set({ loading: false })
    })

    // Warm the restored node in the background without mutating the restored
    // viewport state. Using navigateTo() here would reset expanded folders and
    // reapply node navigation synchronously.
    if (currentNodeId) {
      const existing = getProjectNodeCache(get().nodeCache, activeProject)[currentNodeId]
      void api.fetchChildren(activeProject, currentNodeId).then(data => {
        const current = get()
        if (current.activeProject !== activeProject || current.currentNodeId !== currentNodeId) return
        if (existing && existing.mtime === data.mtime) return
        set(s => ({
          nodeCache: updateProjectNodeCache(s.nodeCache, activeProject, projectCache => ({
            ...projectCache,
            [currentNodeId]: data,
          })),
        }))
      }).catch(() => {})
    }
  },
}))
