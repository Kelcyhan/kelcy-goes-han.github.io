import { useCallback, useEffect, useState } from 'react'
import { usePMStore } from '@/stores/pm-store.ts'
import { useSessionStore } from '@/stores/session-store.ts'
import { useInboxStore } from '@/stores/inbox-store.ts'
import { ClerkAccountControls } from '@/components/auth/ClerkAccountControls.tsx'
import { displayPMNodeId, getPMAncestorIds } from '@/lib/paths.ts'
import { TreeOverlay } from './TreeOverlay.tsx'
import * as api from '@/lib/api.ts'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog.tsx'
import { ActionButton, AppIcon, IconButton } from '@/components/primitives'

/** Sensible fallback when nodeCache hasn't loaded the parent.title yet. */
function fallbackPMTitle(nodeId: string): string {
  if (nodeId === 'scratch') return 'Scratch'
  return displayPMNodeId(nodeId)
}

// Ancestor derivation delegates to paths.ts (single source of truth,
// shared with PMBreadcrumb). Handles scratch + numbered + legacy
// domain-nested alias forms uniformly.

interface TopBarProps {
  togglePm?: () => void
  toggleChat?: () => void
  pmCollapsed?: boolean
  chatCollapsed?: boolean
  settingsActive?: boolean
  onOpenSettings?: () => void
}

export function TopBar({
  togglePm,
  toggleChat,
  pmCollapsed = false,
  chatCollapsed = false,
  settingsActive = false,
  onOpenSettings,
}: TopBarProps = {}) {
  const [treeOpen, setTreeOpen] = useState(false)

  const activeProject = usePMStore(s => s.activeProject)
  const state = usePMStore(s => s.state)
  const currentNodeId = usePMStore(s => s.currentNodeId)
  const nodeCache = usePMStore(s => s.nodeCache)
  const loading = usePMStore(s => s.loading)
  const navigateToLevel = usePMStore(s => s.navigateToLevel)
  const goToTaskTarget = usePMStore(s => s.goToTaskTarget)
  const fetchState = usePMStore(s => s.fetchState)
  const fetchUserTasks = usePMStore(s => s.fetchUserTasks)

  const linkedTaskId = useSessionStore(s => s.linkedTaskId)
  const linkedProjectId = useSessionStore(s => s.linkedProjectId)

  const approvalCount = useInboxStore(s => s.approvalCount)
  const reviewCount = useInboxStore(s => s.reviewCount)
  const toggleQueue = useInboxStore(s => s.togglePanel)
  const fetchAll = useInboxStore(s => s.fetchAll)
  const fetchNotifications = useInboxStore(s => s.fetchNotifications)
  const fetchQueue = useInboxStore(s => s.fetchQueue)
  const pendingCount = approvalCount + reviewCount
  const hasApproval = approvalCount > 0

  // Inbox polling (moved here from the old QueueTicker / TabBar pair —
  // TopBar is now the only mount point that always renders, so it owns
  // the queue + notifications fetch loop)
  useEffect(() => {
    fetchAll()
    const notifInterval = setInterval(fetchNotifications, 3000)
    const queueInterval = setInterval(fetchQueue, 10000)
    return () => { clearInterval(notifInterval); clearInterval(queueInterval) }
  }, [fetchAll, fetchNotifications, fetchQueue])

  // Restart server (moved out of the old TabBar row)
  const [showRestartConfirm, setShowRestartConfirm] = useState(false)
  const [restarting, setRestarting] = useState(false)
  const handleRestart = useCallback(async () => {
    setShowRestartConfirm(false)
    setRestarting(true)
    try {
      await api.restartServer()
    } catch {
      // server dies mid-response sometimes
    }
    const poll = async () => {
      try {
        await api.fetchSessions()
        location.reload()
      } catch {
        setTimeout(poll, 600)
      }
    }
    setTimeout(poll, 800)
  }, [])

  const pmDrifted = linkedTaskId && currentNodeId !== linkedTaskId && linkedProjectId === activeProject

  const goHome = () => {
    usePMStore.setState({ activeProject: null, state: null })
  }

  const ancestors = currentNodeId ? getPMAncestorIds(currentNodeId) : []

  // Close tree overlay on outside click
  useEffect(() => {
    if (!treeOpen) return
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('.tree-overlay') && !target.closest('.bc-tree-btn')) {
        setTreeOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [treeOpen])

  return (
    <div className="top-bar">
      {togglePm && (
        <>
          <IconButton
            variant="appShell"
            size="sm"
            onClick={togglePm}
            title={pmCollapsed ? 'Show PM panel (⌘B)' : 'Hide PM panel (⌘B)'}
            aria-label={pmCollapsed ? 'Show PM panel' : 'Hide PM panel'}
          >
            <AppIcon name={pmCollapsed ? 'panel-left-open' : 'panel-left-close'} size={13} />
          </IconButton>
          <div className="app-shell-divider" aria-hidden="true" />
        </>
      )}
      {linkedTaskId && (
        <button
          className={`active-task-pill${pmDrifted ? '' : ' subtle'}`}
          onClick={() => {
            const targetProject = linkedProjectId || activeProject
            if (!targetProject) return
            void goToTaskTarget(targetProject, linkedTaskId)
          }}
          title="Navigate to active task"
        >
          <AppIcon name="back" size={10} />
          Active task
        </button>
      )}
      <nav className="bc-trail">
        {settingsActive ? (
          <button className="bc-link" onClick={goHome}>Locusly</button>
        ) : activeProject && state ? (
          <button className="bc-link" onClick={goHome}>Locusly</button>
        ) : (
          <span className="bc-current">Locusly</span>
        )}

        {settingsActive && (
          <>
            <AppIcon name="chevron-right" size={11} className="bc-sep" />
            <span className="bc-current">Settings</span>
          </>
        )}

        {!settingsActive && activeProject && state && (state.project || activeProject) && (
          <>
            <AppIcon name="chevron-right" size={11} className="bc-sep" />
            {currentNodeId ? (
              <button className="bc-link" onClick={() => navigateToLevel(null)}>
                {state.project || activeProject}
              </button>
            ) : (
              <span className="bc-current">{state.project || activeProject}</span>
            )}
          </>
        )}

        {ancestors.map(id => {
          const cached = activeProject ? nodeCache[activeProject]?.[id] : undefined
          const title = cached?.parent?.title || fallbackPMTitle(id)
          return (
            <span key={id} className="bc-segment">
              <AppIcon name="chevron-right" size={11} className="bc-sep" />
              <button className="bc-link" onClick={() => navigateToLevel(id)}>
                {title}
              </button>
            </span>
          )
        })}

        {currentNodeId && (
          <>
            <AppIcon name="chevron-right" size={11} className="bc-sep" />
            <span className="bc-current">
              {(() => {
                const current = activeProject ? nodeCache[activeProject]?.[currentNodeId]?.parent : undefined
                return current?.title || fallbackPMTitle(currentNodeId)
              })()}
            </span>
          </>
        )}
      </nav>

      <div className="bc-spacer" />

      <IconButton
        variant="appShell"
        size="sm"
        className="bc-tree-btn"
        onClick={() => {
          if (!activeProject) {
            const projects = usePMStore.getState().availableProjects
            if (projects.length > 0) {
              const p = projects[0].id
              usePMStore.setState({ activeProject: p })
              fetchState(p)
            }
          } else if (!state) {
            fetchState(activeProject)
          }
          setTreeOpen(!treeOpen)
        }}
        title="Browse hierarchy"
      >
        <AppIcon name="branch" size={13} />
      </IconButton>

      <IconButton
        variant="appShell"
        size="sm"
        className={hasApproval ? 'app-shell-pulse' : undefined}
        onClick={toggleQueue}
        title={pendingCount > 0 ? `${pendingCount} pending — open queue` : 'Open queue'}
      >
        <AppIcon name="inbox" size={13} />
        {pendingCount > 0 && (
          <span
            className={`absolute -right-0.5 -top-0.5 inline-flex h-3.5 min-w-3.5 items-center justify-center rounded-full px-0.5 text-[9px] font-bold leading-none ${hasApproval ? 'bg-[rgb(224,90,75)] text-white' : 'bg-[var(--color-status-attention)] text-foreground'}`}
          >
            {pendingCount}
          </span>
        )}
      </IconButton>

      <IconButton
        variant="appShell"
        size="sm"
        className={settingsActive ? 'bg-[var(--bg-card-hover)] text-foreground' : undefined}
        onClick={() => onOpenSettings?.()}
        title="Settings"
      >
        <AppIcon name="settings" size={13} />
      </IconButton>

      <IconButton
        variant="appShell"
        size="sm"
        onClick={() => !restarting && setShowRestartConfirm(true)}
        title={restarting ? 'Restarting…' : 'Restart server'}
        disabled={restarting}
        style={restarting ? { opacity: 0.5 } : undefined}
      >
        <AppIcon name="restart" size={13} className={restarting ? 'animate-spin' : ''} />
      </IconButton>

      {activeProject && (
        <IconButton
          variant="appShell"
          size="sm"
          onClick={() => { fetchState(activeProject); fetchUserTasks() }}
          title="Refresh"
        >
          <AppIcon name="refresh" size={13} className={loading ? 'animate-spin' : ''} />
        </IconButton>
      )}

      <ThemeButton />
      <ClerkAccountControls />

      {toggleChat && (
        <>
          <div className="app-shell-divider" aria-hidden="true" />
          <IconButton
            variant="appShell"
            size="sm"
            onClick={toggleChat}
            title={chatCollapsed ? 'Show chat panel (⌘J)' : 'Hide chat panel (⌘J)'}
            aria-label={chatCollapsed ? 'Show chat panel' : 'Hide chat panel'}
          >
            <AppIcon name={chatCollapsed ? 'panel-right-open' : 'panel-right-close'} size={13} />
          </IconButton>
        </>
      )}
      {treeOpen && activeProject && (
        <TreeOverlay
          projectId={activeProject}
          onNavigate={(nodeId) => {
            navigateToLevel(nodeId)
            setTreeOpen(false)
          }}
        />
      )}
      <Dialog open={showRestartConfirm} onOpenChange={open => !open && setShowRestartConfirm(false)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Restart server?</DialogTitle>
            <DialogDescription>
              The backend will be killed and restarted. Your open tabs will be restored automatically.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <ActionButton variant="toolbar" onClick={() => setShowRestartConfirm(false)}>Cancel</ActionButton>
            <ActionButton variant="destructive" onClick={handleRestart}>Restart</ActionButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ThemeButton() {
  const [mode, setMode] = useState(() => {
    try { return localStorage.getItem('theme-mode') || 'dark' } catch { return 'dark' }
  })

  useEffect(() => {
    const saved = mode
    if (saved === 'light' || saved === 'dark') {
      document.documentElement.setAttribute('data-theme', saved)
    }
  }, [])

  const toggle = () => {
    const next = mode === 'dark' ? 'light' : 'dark'
    document.documentElement.setAttribute('data-theme', next)
    try { localStorage.setItem('theme-mode', next) } catch { /* ignore */ }
    setMode(next)
  }

  return (
    <IconButton variant="appShell" size="sm" onClick={toggle} title={`Switch to ${mode === 'dark' ? 'light' : 'dark'} mode`}>
      <AppIcon name={mode === 'dark' ? 'sun' : 'moon'} size={13} />
    </IconButton>
  )
}
