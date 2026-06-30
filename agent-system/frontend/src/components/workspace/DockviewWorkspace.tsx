import { useCallback, useRef, useEffect, useLayoutEffect } from 'react'
import { DockviewReact } from 'dockview'
import type { DockviewReadyEvent, IDockviewPanelProps, DockviewApi } from 'dockview'
import { useTabStore, setDockviewApi } from '@/stores/tab-store.ts'
import type { AgentTabData, DocTabData, LatexTabData } from '@/stores/tab-store.ts'
import { useSessionStore } from '@/stores/session-store.ts'
import { usePMStore } from '@/stores/pm-store.ts'
import { useWorkspaceStore, getClickedCardRect as consumeClickOrigin, openPendingShares } from '@/stores/workspace-store.ts'
import { AgentView } from '@/components/workspace/AgentView.tsx'
import { DocView } from '@/components/workspace/DocView.tsx'
import { LatexView } from '@/components/workspace/LatexView.tsx'
import { BrowserView } from '@/components/workspace/BrowserView.tsx'
import { WorkspaceTab } from '@/components/workspace/WorkspaceTab.tsx'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary.tsx'
import { useChatStore } from '@/stores/chat-store.ts'
import * as api from '@/lib/api.ts'

const ACTIVE_SESSION_KEY = 'agent-active-session'

// ─── Panel components ───────────────────────────────────────────────

function AgentPanel({ params }: IDockviewPanelProps<{ tabId: string; sessionName: string }>) {
  const data = useTabStore(s => s.tabData[params.tabId])
  if (!data || data.type !== 'agent') return null
  return (
    <ErrorBoundary label={(data as AgentTabData).sessionName}>
      <AgentView panelId={params.tabId} sessionName={(data as AgentTabData).sessionName} tab={data as AgentTabData} />
    </ErrorBoundary>
  )
}

function DocPanel({ params }: IDockviewPanelProps<{ tabId: string }>) {
  const data = useTabStore(s => s.tabData[params.tabId])
  if (!data || data.type !== 'doc') return null
  return (
    <ErrorBoundary label="doc-panel">
      <DocView panelId={params.tabId} tab={data as DocTabData} />
    </ErrorBoundary>
  )
}

function LatexPanel({ params }: IDockviewPanelProps<{ tabId: string }>) {
  const data = useTabStore(s => s.tabData[params.tabId])
  if (!data || data.type !== 'latex') return null
  return (
    <ErrorBoundary label="latex-panel">
      <LatexView panelId={params.tabId} tab={data as LatexTabData} />
    </ErrorBoundary>
  )
}

function BrowserPanel() {
  return <BrowserView />
}

// Legacy PM panel — kept for backward compatibility with saved layouts.
function PMPanel() {
  return (
    <div className="p-6 text-[var(--color-text-muted)] text-center">
      <p>PM views have moved to the left pane.</p>
      <p className="text-xs mt-2">You can close this tab.</p>
    </div>
  )
}

const COMPONENTS = { agent: AgentPanel, doc: DocPanel, pm: PMPanel, latex: LatexPanel, browser: BrowserPanel }

// ─── Workspace component ────────────────────────────────────────────

/** Trigger the shuffle-down entrance animation on the workspace element. */
function triggerEntranceAnimation(el: HTMLElement) {
  // Cancel any in-progress animation
  el.getAnimations().forEach(a => a.cancel())
  el.classList.remove('paper-entering')
  // Force reflow so the animation restarts cleanly
  void el.offsetHeight
  el.classList.add('paper-entering')
  el.addEventListener('animationend', (e) => {
    if (e.target === el) el.classList.remove('paper-entering')
  }, { once: true })
}

export function DockviewWorkspace() {
  const apiRef = useRef<DockviewApi | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const activeSession = useSessionStore(s => s.activeSession)
  const prevSessionRef = useRef<string | null>(null)
  const hasAnyTabs = useTabStore(s => Object.keys(s.tabData).length > 0)
  const ws = useWorkspaceStore

  // Restore PM snapshot early — before dockview initializes (which can take
  // seconds on mobile). Without this, PM shows the HomeScreen first and then
  // jumps to the saved project once onReady fires, causing a jarring flash.
  useLayoutEffect(() => {
    try {
      const lastSession = localStorage.getItem(ACTIVE_SESSION_KEY)
      if (!lastSession) return
      const group = useSessionStore.getState().getGroupForSession(lastSession)
      const key = group ? `group-${group.id}` : lastSession
      const raw = localStorage.getItem('agent-session-ws-' + key)
      if (!raw) return
      const saved = JSON.parse(raw)
      if (saved?.pmSnapshot) {
        usePMStore.getState().restoreSnapshot(saved.pmSnapshot)
      }
    } catch { /* ignore — onReady restore is the fallback */ }
  }, [])

  const onReady = useCallback((event: DockviewReadyEvent) => {
    const api = event.api
    apiRef.current = api
    setDockviewApi(api)

    // Initialize prevSessionRef from persisted active session so that when the user
    // clicks the same session they had before reload, the wipe is skipped.
    let lastSession: string | null = null
    try {
      lastSession = localStorage.getItem(ACTIVE_SESSION_KEY)
      if (lastSession) prevSessionRef.current = lastSession
    } catch { /* ignore */ }

    // Restore the last session's workspace (single code path via workspace-store)
    if (lastSession) {
      ws.getState().restoreSessionWorkspace(lastSession)
    }

    // Clean up tabData when panels are removed (user closes a tab)
    api.onDidRemovePanel(panel => {
      if (ws.getState().isSwitching()) return
      const data = useTabStore.getState().tabData[panel.id]
      useTabStore.getState().removeTabData(panel.id)
      if (data?.type === 'agent') {
        useChatStore.getState().removeSession((data as AgentTabData).sessionName)
      }
    })

    // Refresh doc tab content when it becomes active
    api.onDidActivePanelChange(panel => {
      if (panel) {
        const d = useTabStore.getState().tabData[panel.id]
        if (d?.type === 'doc') {
          useTabStore.getState().refreshDoc(panel.id)
        } else if (d?.type === 'latex') {
          useTabStore.getState().refreshLatex(panel.id)
        }
      }
    })

    // Save current session before page unload (crash protection)
    window.addEventListener('beforeunload', () => {
      const session = useSessionStore.getState().activeSession
      if (session) ws.getState().saveSessionWorkspace(session)
    })
  }, [])

  // Session switch: delegate to workspace-store, then animate entrance
  useEffect(() => {
    if (!apiRef.current) return
    const prev = prevSessionRef.current
    if (prev === activeSession) return
    prevSessionRef.current = activeSession

    // Check if this switch was triggered by a card click (vs. programmatic/reload)
    const wasClick = !!consumeClickOrigin()

    // Check if switching within the same group (workspace stays, no animation)
    const sameGroup = (() => {
      if (!prev || !activeSession) return false
      const prevGroup = useSessionStore.getState().getGroupForSession(prev)
      const newGroup = useSessionStore.getState().getGroupForSession(activeSession)
      return prevGroup != null && newGroup != null && prevGroup.id === newGroup.id
    })()

    ws.getState().switchSession(prev, activeSession)

    // Ensure the clicked session's agent tab is visible and active
    if (activeSession && apiRef.current) {
      const tabData = useTabStore.getState().tabData
      let found = false
      for (const [id, data] of Object.entries(tabData)) {
        if (data.type === 'agent' && (data as AgentTabData).sessionName === activeSession) {
          const panel = apiRef.current.getPanel(id)
          if (panel) {
            panel.api.setActive()
            found = true
            break
          }
        }
      }
      if (!found) {
        useTabStore.getState().openAgentTab(activeSession)
      }
    }

    // Process any pending tab shares (safety net — also called inside switchSession,
    // but this ensures dockview is fully settled)
    if (activeSession) {
      requestAnimationFrame(() => openPendingShares(activeSession))
    }

    // Animate entrance on .workspace-shadow (PM + chat + shadow together)
    // Skip animation for same-group switches (workspace doesn't change)
    if (activeSession && wasClick && !sameGroup && wrapperRef.current) {
      const shellEl = wrapperRef.current.closest('.workspace-shell') as HTMLElement | null
      if (shellEl) {
        triggerEntranceAnimation(shellEl)
      }
    }
  }, [activeSession])

  // Auto-save current session every 30s (crash protection)
  useEffect(() => {
    const interval = setInterval(() => {
      const session = useSessionStore.getState().activeSession
      if (session) ws.getState().saveSessionWorkspace(session)
    }, 30_000)
    return () => clearInterval(interval)
  }, [])

  // Listen for open-agent-tab events from widgets (e.g. paper discovery chat/analyze)
  useEffect(() => {
    const handler = async (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail?.sessionName) {
        const name = detail.sessionName as string
        const store = useSessionStore.getState()
        const isAlive = store.sessions.some(s => s.name === name)
        if (isAlive) {
          useTabStore.getState().openAgentTab(name)
          return
        }
        try {
          const meta = await api.fetchSessionMeta(name)
          useTabStore.getState().openAgentTab(name, {
            readOnly: true,
            jsonlPath: meta.jsonl_path,
            sessionUuid: meta.claude_session_id,
            taskPath: meta.task_path,
            resumeWorkingDir: meta.working_dir,
            agentRole: meta.agent_role,
          })
        } catch {
          useTabStore.getState().openAgentTab(name, { readOnly: true })
        }
      }
    }
    window.addEventListener('open-agent-tab', handler)
    return () => window.removeEventListener('open-agent-tab', handler)
  }, [])

  // Refresh all open doc tabs when SSE signals file changes on disk
  const sseRefreshCounter = usePMStore(s => s.sseRefreshCounter)
  useEffect(() => {
    if (sseRefreshCounter === 0) return
    const tabData = useTabStore.getState().tabData
    for (const [id, data] of Object.entries(tabData)) {
      if (data.type === 'doc') {
        useTabStore.getState().refreshDoc(id)
      } else if (data.type === 'latex') {
        useTabStore.getState().refreshLatex(id)
      }
    }
  }, [sseRefreshCounter])

  return (
    <div className="dockview-wrapper" ref={wrapperRef}>
      {!hasAnyTabs && (
        <div className="tab-empty">
          <div className="tab-empty-hint">
            Select a session from the sidebar to get started.
          </div>
        </div>
      )}
      <DockviewReact
        className="dockview-theme-dark"
        onReady={onReady}
        components={COMPONENTS}
        defaultTabComponent={WorkspaceTab}
      />
    </div>
  )
}
