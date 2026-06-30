import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the API module before importing the store
vi.mock('@/lib/api.ts', () => ({
  fetchPMState: vi.fn(),
  fetchPMProjects: vi.fn(),
  fetchUserTasks: vi.fn(),
  fetchChildren: vi.fn(),
  resolveTaskPath: vi.fn(),
  updateTaskFields: vi.fn(),
  updateGoal: vi.fn(),
  createGoal: vi.fn(),
  deleteGoal: vi.fn(),
  addTasksToGoal: vi.fn(),
  getAuthToken: vi.fn(() => null),
}))

import { usePMStore } from '../pm-store.ts'
import * as api from '@/lib/api.ts'

const mockedApi = vi.mocked(api)

function makeState(project: string) {
  return {
    state: {
      project,
      computed: '2026-03-21T00:00:00Z',
      status: 'active',
      vision: `${project} vision`,
      horizon: '',
      goals: [],
      domains: [
        {
          id: '1.2',
          title: `${project} Domain`,
          health: 'active',
          progress: { done: 1, total: 3 },
          active_tasks: [],
          todo_tasks: [],
          backlog_count: 0,
        },
      ],
      tasks_summary: { total: 5, by_status: { done: 2, executing: 1, todo: 2 } },
      alerts: [],
      planning: { sprint_focus: '', next_actions: [], parking_lot: [], decisions_pending: [] },
    },
    growth_stage: 'full_project',
    is_mock: false,
    source: 'state.yaml',
  }
}

function resetStore() {
  usePMStore.setState({
    state: null,
    activeProject: null,
    activeView: 'overview',
    loading: false,
    error: null,
    nodeCache: {},
    currentNodeId: null,
    navigationStack: [],
    expandedFolders: [],
    filePreview: null,
    growthStage: 'single_task',
    isMock: false,
    selectedGoalId: null,
    projectStateCache: {},
  })
}

describe('pm-store: fetchState project switching', () => {
  beforeEach(() => {
    resetStore()
    vi.clearAllMocks()
  })

  it('loads state for a project', async () => {
    mockedApi.fetchPMState.mockResolvedValue(makeState('AgentSystem'))

    await usePMStore.getState().fetchState('AgentSystem')

    const s = usePMStore.getState()
    expect(s.activeProject).toBe('AgentSystem')
    expect(s.state?.project).toBe('AgentSystem')
    expect(s.loading).toBe(false)
    expect(s.error).toBeNull()
  })

  it('preserves nodeCache on same-project refresh', async () => {
    // First load
    mockedApi.fetchPMState.mockResolvedValue(makeState('AgentSystem'))
    await usePMStore.getState().fetchState('AgentSystem')

    // Simulate cached node data (as if user navigated to domains)
    usePMStore.setState({
      nodeCache: {
        AgentSystem: {
          '__root__': { parent: { id: 'root', title: 'Root' }, children: [], mtime: 1 } as any,
          '1.2': { parent: { id: '1.2', title: 'Domain' }, children: [], mtime: 2 } as any,
        },
      },
      currentNodeId: '1.2',
      navigationStack: ['1.2'],
      expandedFolders: ['/some/path'],
    })

    // Refresh same project (polling / SSE trigger)
    mockedApi.fetchPMState.mockResolvedValue(makeState('AgentSystem'))
    await usePMStore.getState().fetchState('AgentSystem')

    const s = usePMStore.getState()
    expect(Object.keys(s.nodeCache.AgentSystem || {})).toHaveLength(2)
    expect(s.currentNodeId).toBe('1.2')
    expect(s.navigationStack).toEqual(['1.2'])
    expect(s.expandedFolders).toEqual(['/some/path'])
  })

  it('preserves per-project nodeCache when switching to a different project', async () => {
    // Load Project A
    mockedApi.fetchPMState.mockResolvedValue(makeState('AgentSystem'))
    await usePMStore.getState().fetchState('AgentSystem')

    // Simulate cached node data
    usePMStore.setState({
      nodeCache: {
        AgentSystem: {
          '__root__': { parent: { id: 'root' }, children: [], mtime: 1 } as any,
          '1.2': { parent: { id: '1.2' }, children: [], mtime: 2 } as any,
        },
      },
      currentNodeId: '1.2',
      navigationStack: ['1.2'],
      expandedFolders: ['/some/path'],
      filePreview: { path: '/test', name: 'test.md', type: 'file' as const, folderStack: [] },
    })

    // Switch to Project B
    mockedApi.fetchPMState.mockResolvedValue(makeState('SLMAgents'))
    await usePMStore.getState().fetchState('SLMAgents')

    const s = usePMStore.getState()
    expect(s.activeProject).toBe('SLMAgents')
    expect(s.state?.project).toBe('SLMAgents')
    // Project-local cache is preserved for fast cross-project revisits:
    expect(s.nodeCache.AgentSystem).toBeDefined()
    expect(s.nodeCache.SLMAgents).toBeUndefined()
    expect(s.currentNodeId).toBeNull()
    expect(s.navigationStack).toEqual([])
    expect(s.expandedFolders).toEqual([])
    expect(s.filePreview).toBeNull()
  })

  it('clears node state even when activeProject was pre-set by caller', async () => {
    // Load Project A
    mockedApi.fetchPMState.mockResolvedValue(makeState('AgentSystem'))
    await usePMStore.getState().fetchState('AgentSystem')

    // Simulate cached node data
    usePMStore.setState({
      nodeCache: { AgentSystem: { '__root__': { parent: { id: 'root' }, children: [], mtime: 1 } as any } },
      currentNodeId: '1.3',
      navigationStack: ['1.2', '1.3'],
    })

    // This is what HomeScreen does: set activeProject THEN effect triggers fetchState
    usePMStore.setState({ activeProject: 'SLMAgents' })
    mockedApi.fetchPMState.mockResolvedValue(makeState('SLMAgents'))
    await usePMStore.getState().fetchState('SLMAgents')

    const s = usePMStore.getState()
    expect(s.nodeCache.AgentSystem).toBeDefined()
    expect(s.currentNodeId).toBeNull()
    expect(s.navigationStack).toEqual([])
  })

  it('clears node state when going Home then selecting a new project', async () => {
    // Load Project A
    mockedApi.fetchPMState.mockResolvedValue(makeState('AgentSystem'))
    await usePMStore.getState().fetchState('AgentSystem')

    // Simulate cached node data
    usePMStore.setState({
      nodeCache: {
        AgentSystem: {
          '__root__': { parent: { id: 'root' }, children: [], mtime: 1 } as any,
          '1.2': { parent: { id: '1.2' }, children: [], mtime: 2 } as any,
        },
      },
      currentNodeId: '1.2',
      navigationStack: ['1.2'],
    })

    // goHome() — sets activeProject and state to null but does NOT clear node state
    usePMStore.setState({ activeProject: null, state: null })

    // Verify stale cache is still there after goHome
    expect(Object.keys(usePMStore.getState().nodeCache.AgentSystem || {})).toHaveLength(2)

    // Click new project → fetchState
    mockedApi.fetchPMState.mockResolvedValue(makeState('Hackathon'))
    await usePMStore.getState().fetchState('Hackathon')

    const s = usePMStore.getState()
    expect(s.activeProject).toBe('Hackathon')
    expect(s.state?.project).toBe('Hackathon')
    // Cache from AgentSystem stays warm in memory
    expect(s.nodeCache.AgentSystem).toBeDefined()
    expect(s.currentNodeId).toBeNull()
    expect(s.navigationStack).toEqual([])
  })

  it('handles first load (no prior state) without error', async () => {
    // No previous state at all — should not crash
    mockedApi.fetchPMState.mockResolvedValue(makeState('AgentSystem'))
    await usePMStore.getState().fetchState('AgentSystem')

    const s = usePMStore.getState()
    expect(s.state?.project).toBe('AgentSystem')
    expect(s.nodeCache).toEqual({})
  })
})

describe('pm-store: viewport restore and task targeting', () => {
  beforeEach(() => {
    resetStore()
    vi.clearAllMocks()
  })

  it('normalizes global scratch ids when navigating to a task target', async () => {
    mockedApi.fetchPMState.mockResolvedValue(makeState('__scratch__'))
    mockedApi.fetchChildren.mockResolvedValue({
      parent: { id: 'scratch/demo-task', title: 'Demo Task' },
      children: [],
      mtime: 123,
    } as any)

    await usePMStore.getState().goToTaskTarget('__scratch__', 'demo-task')

    expect(mockedApi.fetchChildren).toHaveBeenCalledWith('__scratch__', 'scratch/demo-task')
    expect(usePMStore.getState().currentNodeId).toBe('scratch/demo-task')
    expect(usePMStore.getState().navigationStack).toEqual(['scratch'])
  })

  it('restores a cross-project snapshot by loading the project first and replaying node navigation', async () => {
    mockedApi.fetchPMState.mockResolvedValue(makeState('__scratch__'))
    mockedApi.fetchChildren.mockResolvedValue({
      parent: { id: 'scratch/comp1023-midterm-review', title: 'COMP1023' },
      children: [],
      mtime: 456,
    } as any)

    await usePMStore.getState().restoreSnapshot({
      activeProject: '__scratch__',
      activeView: 'domains',
      currentNodeId: 'comp1023-midterm-review',
      navigationStack: [],
      expandedFolders: ['Scratch/comp1023-midterm-review/artifacts'],
      selectedGoalId: null,
      expandedWidgetId: null,
    })

    expect(mockedApi.fetchPMState).toHaveBeenCalledWith('__scratch__')
    expect(mockedApi.fetchChildren).toHaveBeenCalledWith('__scratch__', 'scratch/comp1023-midterm-review')
    const s = usePMStore.getState()
    expect(s.activeProject).toBe('__scratch__')
    expect(s.currentNodeId).toBe('scratch/comp1023-midterm-review')
    expect(s.navigationStack).toEqual(['scratch'])
    expect(s.expandedFolders).toEqual(['Scratch/comp1023-midterm-review/artifacts'])
  })

  it('restores a home snapshot without fetching project state', async () => {
    await usePMStore.getState().restoreSnapshot({
      activeProject: null,
      activeView: 'overview',
      currentNodeId: null,
      navigationStack: [],
      expandedFolders: [],
      selectedGoalId: null,
      expandedWidgetId: null,
    })

    expect(mockedApi.fetchPMState).not.toHaveBeenCalled()
    expect(usePMStore.getState().activeProject).toBeNull()
    expect(usePMStore.getState().state).toBeNull()
  })
})
