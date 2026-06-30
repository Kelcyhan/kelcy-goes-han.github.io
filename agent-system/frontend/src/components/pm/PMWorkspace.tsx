import { useEffect } from 'react'
import { usePMStore } from '@/stores/pm-store.ts'
import { useSessionStore } from '@/stores/session-store.ts'
import { useVoiceStore } from '@/stores/voice-store.ts'
import { ActionButton, AppIcon, IconButton } from '@/components/primitives'

import { PMBreadcrumb } from './PMBreadcrumb.tsx'
import { HomeScreen } from './HomeScreen.tsx'
import { CardGridView } from './CardGridView.tsx'
import { GoalDetail } from './goals/GoalDetail.tsx'

export function PMWorkspace() {
  const activeProject = usePMStore(s => s.activeProject)
  const state = usePMStore(s => s.state)
  const loading = usePMStore(s => s.loading)
  const error = usePMStore(s => s.error)
  const selectedGoalId = usePMStore(s => s.selectedGoalId)
  const fetchState = usePMStore(s => s.fetchState)
  const fetchUserTasks = usePMStore(s => s.fetchUserTasks)
  const silentRefreshCurrentNode = usePMStore(s => s.silentRefreshCurrentNode)
  const sseConnected = usePMStore(s => s.sseConnected)
  const sseConnect = usePMStore(s => s.sseConnect)
  const sseDisconnect = usePMStore(s => s.sseDisconnect)
  void useSessionStore(s => s.activeSession) // subscribe to session changes
  const linkedProjectId = useSessionStore(s => s.linkedProjectId)
  const linkedTaskId = useSessionStore(s => s.linkedTaskId)
  const currentNodeId = usePMStore(s => s.currentNodeId)
  const goToTaskTarget = usePMStore(s => s.goToTaskTarget)
  const goHomeStore = usePMStore(s => s.goHome)
  const phase = useVoiceStore(s => s.phase)
  const voiceAvailable = useVoiceStore(s => s.available)
  const fetchVoiceStatus = useVoiceStore(s => s.fetchStatus)
  const startVoice = useVoiceStore(s => s.start)

  useEffect(() => { fetchVoiceStatus() }, [fetchVoiceStatus])

  // Fetch projects list and user tasks on mount
  useEffect(() => {
    usePMStore.getState().fetchProjects()
    fetchUserTasks()
  }, [fetchUserTasks])

  // SSE connection — real-time push from file watcher
  useEffect(() => {
    if (!activeProject) return
    sseConnect(activeProject)
    return () => { sseDisconnect() }
  }, [activeProject, sseConnect, sseDisconnect])

  // Visibility-aware polling fallback
  useEffect(() => {
    if (!activeProject) return
    const pollInterval = sseConnected ? 30000 : 10000

    const poll = () => {
      fetchUserTasks()
      if (!sseConnected) {
        fetchState(activeProject)
        silentRefreshCurrentNode()
      }
    }

    let intervalId: ReturnType<typeof setInterval> | null = document.hidden
      ? null
      : setInterval(poll, pollInterval)

    const onVisibilityChange = () => {
      if (document.hidden) {
        if (intervalId) { clearInterval(intervalId); intervalId = null }
      } else {
        poll()
        intervalId = setInterval(poll, pollInterval)
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      if (intervalId) clearInterval(intervalId)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [activeProject, sseConnected, fetchState, fetchUserTasks, silentRefreshCurrentNode])

  const goHome = () => {
    goHomeStore()
  }

  // Header element reused across states
  const header = (
    <>
      <div className="flex items-center gap-0 shrink-0 pr-2.5 pb-1 pl-2.5 pt-[calc(8px+env(safe-area-inset-top))]">
        <div className="flex min-w-0 flex-1 items-center pl-1 text-foreground">
          <PMBreadcrumb projectName={state?.project} projectId={activeProject} onGoHome={goHome} />
        </div>
        {linkedTaskId && !(currentNodeId === linkedTaskId && linkedProjectId === activeProject) && (
          <button
            className="flex items-center gap-1 px-1.5 py-0.5 rounded-full border border-[var(--color-border-subtle)] bg-transparent type-micro text-muted-foreground cursor-pointer hover:border-[var(--color-accent)] hover:text-accent-foreground transition-colors shrink-0 mr-1"
            onClick={async () => {
              const targetProject = linkedProjectId || activeProject
              if (!targetProject) return
              await goToTaskTarget(targetProject, linkedTaskId)
            }}
            title="Navigate to active task"
          >
            <AppIcon name="back" size={10} />
            Active task
          </button>
        )}
        {voiceAvailable && phase === 'idle' && (
          <IconButton variant="ghost" shape="round" onClick={startVoice} title="Start voice">
            <AppIcon name="mic" size={15} />
          </IconButton>
        )}
      </div>
    </>
  )

  // ── No project selected: Home screen ──
  if (!activeProject || !state) {
    if (activeProject && loading) {
      return (
        <div className="flex flex-col h-full overflow-hidden" data-pm-workspace>
          {header}
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <AppIcon name="refresh" size={20} className="animate-spin" />
            <span>Loading project state...</span>
          </div>
        </div>
      )
    }

    if (activeProject && error) {
      return (
        <div className="flex flex-col h-full overflow-hidden" data-pm-workspace>
          {header}
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <AppIcon name="x" size={20} />
            <span>{error}</span>
            <ActionButton variant="secondary" onClick={() => fetchState(activeProject)}>
              Retry
            </ActionButton>
          </div>
        </div>
      )
    }

    return (
      <div className="flex flex-col h-full overflow-hidden" data-pm-workspace>
        {header}

        <div className="flex-1 overflow-y-auto">
          <HomeScreen />
        </div>
      </div>
    )
  }

  // ── Project selected ──
  // If a goal is selected (e.g. from Goals widget), show GoalDetail.
  // Otherwise show the domain grid directly (no tabs).
  return (
    <div className="flex flex-col h-full overflow-hidden" data-pm-workspace>
      {header}

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5">
          {selectedGoalId ? <GoalDetail goalId={selectedGoalId} /> : <CardGridView />}
        </div>
      </div>
    </div>
  )
}
