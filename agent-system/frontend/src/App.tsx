import { useEffect, useCallback, useState, useRef } from 'react'
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle, type GroupImperativeHandle, type PanelImperativeHandle } from 'react-resizable-panels'
// @dnd-kit context removed — tab sharing uses HTML5 drag-and-drop directly
import { useSessionStore } from '@/stores/session-store.ts'
import { useTabStore, getDockviewApi } from '@/stores/tab-store.ts'
import * as api from '@/lib/api.ts'
import { usePMStore } from '@/stores/pm-store.ts'
import { connectUIEvents, disconnectUIEvents } from '@/stores/ui-events-store.ts'
import { setPanelSizes, registerPanelRestore, getLastNonCollapsedSizes, DEFAULT_PANEL_SIZES } from '@/stores/workspace-store.ts'
import { DockviewWorkspace } from '@/components/workspace/DockviewWorkspace.tsx'
import { PMWorkspace } from '@/components/pm/PMWorkspace.tsx'
import { SessionTabsFan } from '@/components/pm/SessionRail.tsx'
import { MobileSidePanel, NewOrchestratorButton } from '@/components/pm/SessionTabs.tsx'
import { QueuePanel } from '@/components/inbox/QueuePanel.tsx'
import { useInboxStore } from '@/stores/inbox-store.ts'
import { VoiceBar } from '@/components/voice/VoiceBar.tsx'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary.tsx'
import { GlobalSearch, useGlobalSearchShortcut } from '@/components/pm/GlobalSearch.tsx'
import { MobileSettings } from '@/components/auth/MobileSettings.tsx'
import { ClerkBridgePage } from '@/components/auth/ClerkBridgePage.tsx'
import { HelperWidget } from '@/components/helper/HelperWidget.tsx'
import { ConciergeWidget } from '@/components/concierge/ConciergeWidget.tsx'
import { TopBar } from '@/components/layout/TopBar.tsx'
import { LoggedOutBanner } from '@/components/layout/LoggedOutBanner.tsx'
import { AISettingsPage } from '@/components/settings/AISettingsPage.tsx'

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= breakpoint)
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`)
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [breakpoint])
  return isMobile
}

function MobileInboxButton() {
  const approvalCount = useInboxStore(s => s.approvalCount)
  const reviewCount = useInboxStore(s => s.reviewCount)
  const openPanel = useInboxStore(s => s.openPanel)
  if (approvalCount === 0 && reviewCount === 0) return null
  return (
    <button
      className="mobile-view-btn"
      onClick={openPanel}
      style={approvalCount > 0 ? { color: 'rgb(224,90,75)' } : undefined}
    >
      {approvalCount > 0 ? `🔴${approvalCount}` : `${reviewCount}`}
    </button>
  )
}

function DashboardApp() {
  const [mobileView, setMobileView] = useState<'pm' | 'workspace' | 'settings'>('pm')
  const [desktopView, setDesktopView] = useState<'workspace' | 'settings'>('workspace')
  const [sidePanelOpen, setSidePanelOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const queuePanelOpen = useInboxStore(s => s.panelOpen)
  const activeSession = useSessionStore(s => s.activeSession)
  const refreshSessions = useSessionStore(s => s.refreshSessions)
  const fetchProjects = usePMStore(s => s.fetchProjects)
  const isMobile = useIsMobile()
  useGlobalSearchShortcut(() => setSearchOpen(true))

  useEffect(() => {
    void refreshSessions()
    fetchProjects()
    const tick = () => {
      if (!document.hidden) void refreshSessions()
    }
    const onVisibilityChange = () => {
      if (!document.hidden) void refreshSessions()
    }
    const id = setInterval(tick, 10000)
    document.addEventListener('visibilitychange', onVisibilityChange)
    connectUIEvents()
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      disconnectUIEvents()
    }
  }, [refreshSessions, fetchProjects])


  // Auto-switch to workspace when a new tab opens on mobile
  useEffect(() => {
    if (!isMobile) return
    let prevCount = Object.keys(useTabStore.getState().tabData).length
    return useTabStore.subscribe(state => {
      const count = Object.keys(state.tabData).length
      if (count > prevCount) setMobileView('workspace')
      prevCount = count
    })
  }, [isMobile])

  useEffect(() => {
    if (!activeSession) return
    setDesktopView('workspace')
    if (isMobile) setMobileView('workspace')
  }, [activeSession, isMobile])

  const handleSelectSession = useCallback((name: string) => {
    setDesktopView('workspace')
    if (isMobile) setMobileView('workspace')
    const store = useSessionStore.getState()
    const isAlive = store.sessions.some(s => s.name === name)

    // Dead session: open a read-only tab with JSONL content instead of
    // switching workspace context (which would fail for a dead session).
    if (!isAlive) {
      api.fetchSessionMeta(name).then(meta => {
        if (meta.jsonl_path) {
          useTabStore.getState().openAgentTab(name, {
            readOnly: true,
            jsonlPath: meta.jsonl_path,
            sessionUuid: meta.claude_session_id,
            taskPath: meta.task_path,
            resumeWorkingDir: meta.working_dir,
            agentRole: meta.agent_role,
          })
        }
      }).catch(() => {
        // No metadata — open tab anyway so user sees a "not found" state
        // rather than nothing happening at all.
        useTabStore.getState().openAgentTab(name, { readOnly: true })
      })
      return
    }

    store.setActiveSession(name)
    // NOTE: Do NOT touch PM state or call openAgentTab here.
    // setActiveSession triggers a useEffect in DockviewWorkspace that calls
    // switchSession(), which saves the old workspace FIRST, then restores
    // the new one (including PM state). Changing PM state here would
    // contaminate the old workspace's snapshot.
  }, [])

  // PM/workspace panel sizes — imperative control for per-session persistence
  const panelGroupRef = useRef<GroupImperativeHandle>(null)
  const pmPanelRef = useRef<PanelImperativeHandle>(null)
  const chatPanelRef = useRef<PanelImperativeHandle>(null)
  const [pmCollapsed, setPmCollapsed] = useState(false)
  const [chatCollapsed, setChatCollapsed] = useState(false)
  useEffect(() => {
    registerPanelRestore((sizes) => {
      panelGroupRef.current?.setLayout(sizes)
    })
  }, [])

  const togglePm = useCallback(() => {
    const ref = pmPanelRef.current
    if (!ref) return
    if (ref.isCollapsed()) {
      // Expand via setLayout so we get the pre-collapse split back (library's
      // internal "last size" memory doesn't survive remount / reload).
      panelGroupRef.current?.setLayout(getLastNonCollapsedSizes() ?? DEFAULT_PANEL_SIZES)
    } else {
      ref.collapse()
    }
  }, [])

  const toggleChat = useCallback(() => {
    const ref = chatPanelRef.current
    if (!ref) return
    if (ref.isCollapsed()) {
      panelGroupRef.current?.setLayout(getLastNonCollapsedSizes() ?? DEFAULT_PANEL_SIZES)
    } else {
      ref.collapse()
    }
  }, [])

  // Cmd/Ctrl+B → toggle PM, Cmd/Ctrl+J → toggle chat (desktop only; input-safe).
  useEffect(() => {
    if (isMobile) return
    const handler = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.altKey) return
      // Don't intercept while typing in text inputs.
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      if (e.key === 'b' || e.key === 'B') {
        e.preventDefault()
        togglePm()
      } else if (e.key === 'j' || e.key === 'J') {
        e.preventDefault()
        toggleChat()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isMobile, togglePm, toggleChat])

  // Handle ?session=X URL param
  const sessionParamHandled = useRef(false)
  useEffect(() => {
    if (sessionParamHandled.current) return
    const params = new URLSearchParams(window.location.search)
    const sessionParam = params.get('session')
    if (!sessionParam) return
    sessionParamHandled.current = true

    params.delete('session')
    const qs = params.toString()
    window.history.replaceState({}, '', qs ? `${window.location.pathname}?${qs}` : window.location.pathname)

    let handled = false
    const timer = setInterval(() => {
      if (getDockviewApi() && useSessionStore.getState().sessions.length > 0) {
        clearInterval(timer)
        handled = true
        handleSelectSession(sessionParam)
      }
    }, 200)
    // Fallback: if sessions never load (e.g. all sessions are dead), fire anyway
    // after 5s — handleSelectSession handles dead sessions gracefully via meta API.
    setTimeout(() => {
      clearInterval(timer)
      if (!handled && getDockviewApi()) handleSelectSession(sessionParam)
    }, 5000)
  }, [handleSelectSession])

  return (
    <>
      <QueuePanel />
      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
      <HelperWidget />
      <ConciergeWidget />
      {!isMobile && <NewOrchestratorButton />}

      {isMobile ? (
        <div className="workspace">
          <MobileSidePanel
            open={sidePanelOpen}
            onClose={() => setSidePanelOpen(false)}
            onSelectSession={handleSelectSession}
          />
          <LoggedOutBanner onOpenSettings={() => setMobileView('settings')} />
          <VoiceBar />
          <div className="mobile-view-toggle">
            <button
              className="mobile-sessions-btn"
              onClick={() => setSidePanelOpen(true)}
              title="Sessions"
            >&#9776;</button>
            <button
              className={`mobile-view-btn ${mobileView === 'pm' ? 'active' : ''}`}
              onClick={() => setMobileView('pm')}
            >PM</button>
            <button
              className={`mobile-view-btn ${mobileView === 'workspace' ? 'active' : ''}`}
              onClick={() => setMobileView('workspace')}
            >Workspace</button>
            <button
              className="mobile-view-btn"
              onClick={() => setSearchOpen(true)}
              title="Search"
            >&#128269;</button>
            <button
              className={`mobile-view-btn ${mobileView === 'settings' ? 'active' : ''}`}
              onClick={() => setMobileView('settings')}
              title="Settings"
            >&#9881;</button>
            <MobileInboxButton />
          </div>
          <div className="mobile-panels">
            <div className={`workspace-panel-pm mobile-pane ${mobileView !== 'pm' ? 'mobile-pane-hidden' : ''}`}>
              <ErrorBoundary label="pm-dashboard">
                <PMWorkspace />
              </ErrorBoundary>
            </div>
            <div className={`workspace-panel-chat mobile-pane ${mobileView !== 'workspace' ? 'mobile-pane-hidden' : ''}`}>
              <DockviewWorkspace />
            </div>
            <div className={`mobile-pane ${mobileView !== 'settings' ? 'mobile-pane-hidden' : ''}`}>
              <MobileSettings />
            </div>
          </div>
        </div>
      ) : (
        <div className={`workspace-shell${queuePanelOpen ? ' queue-open' : ''}`}>
          <SessionTabsFan onSelectSession={handleSelectSession} />
          <div className="workspace-shadow">
          <div className="workspace">
            <LoggedOutBanner onOpenSettings={() => setDesktopView('settings')} />
            <TopBar
              togglePm={togglePm}
              toggleChat={toggleChat}
              pmCollapsed={pmCollapsed}
              chatCollapsed={chatCollapsed}
              settingsActive={desktopView === 'settings'}
              onOpenSettings={() => setDesktopView('settings')}
            />
            <VoiceBar />
            {desktopView === 'settings' ? (
              <div className="desktop-settings-view">
                <AISettingsPage
                  title="Settings / AI"
                  onBack={() => setDesktopView('workspace')}
                />
              </div>
            ) : (
              <PanelGroup
                groupRef={panelGroupRef}
                orientation="horizontal"
                className="workspace-panels"
                onLayoutChanged={setPanelSizes}
              >
                <Panel
                  id="pm"
                  defaultSize={58}
                  minSize={30}
                  collapsible
                  collapsedSize={0}
                  panelRef={pmPanelRef}
                  onResize={(size) => setPmCollapsed(size.asPercentage === 0)}
                  className="workspace-panel-pm"
                >
                  <ErrorBoundary label="pm-dashboard">
                    <PMWorkspace />
                  </ErrorBoundary>
                </Panel>

                <PanelResizeHandle className="workspace-resize-handle" />

                <Panel
                  id="chat"
                  defaultSize={42}
                  minSize={25}
                  collapsible
                  collapsedSize={0}
                  panelRef={chatPanelRef}
                  onResize={(size) => setChatCollapsed(size.asPercentage === 0)}
                  className="workspace-panel-chat"
                >
                  <DockviewWorkspace />
                </Panel>
              </PanelGroup>
            )}
          </div>
          </div>
        </div>
      )}
    </>
  )
}

export default function App() {
  return window.location.pathname.startsWith('/auth/clerk')
    ? <ClerkBridgePage />
    : <DashboardApp />
}
