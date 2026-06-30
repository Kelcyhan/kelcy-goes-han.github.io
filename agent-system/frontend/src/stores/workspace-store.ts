import { create } from 'zustand'
import type { DockviewApi } from 'dockview'
import { useTabStore } from '@/stores/tab-store.ts'
import type { TabData, AgentTabData } from '@/stores/tab-store.ts'
import { usePMStore } from '@/stores/pm-store.ts'
import type { PMSnapshot } from '@/stores/pm-store.ts'
import { useSessionStore, extractProjectFromWorkingDir, extractTaskIdFromWorkingDir } from '@/stores/session-store.ts'
import { useChatStore } from '@/stores/chat-store.ts'
import { useWidgetSnapshotStore } from '@/stores/widget-snapshot-store.ts'
import type { WidgetSnapshot } from '@/stores/widget-snapshot-store.ts'
import { fetchVaultFile } from '@/lib/api.ts'
import type { DocTabData, LatexTabData } from '@/stores/tab-store.ts'

// ─── Types ──────────────────────────────────────────────────────────

/** Per-session saved workspace state. */
export interface SessionWorkspace {
  layout: object
  tabData: Record<string, TabData>
  pmSnapshot?: PMSnapshot
  scrollPositions: Record<string, number>
  panelSizes?: { [id: string]: number }
  /** Snapshot of the last non-collapsed PM/chat split, so expand() returns here after reload. */
  lastNonCollapsedSizes?: { [id: string]: number }
  widgetSnapshots?: Record<string, WidgetSnapshot>
}

/** Default PM/chat split (matches Panel defaultSize in App.tsx). */
export const DEFAULT_PANEL_SIZES: { [id: string]: number } = { pm: 58, chat: 42 }

const SESSION_WS_PREFIX = 'agent-session-ws-'
const MAX_PERSISTED_WORKSPACES = 20

/** Remove oldest workspace entries from localStorage when over the limit. */
function prunePersistedWorkspaces(keepKey?: string) {
  try {
    const entries: { key: string; raw: string }[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(SESSION_WS_PREFIX) && key !== keepKey) {
        entries.push({ key, raw: localStorage.getItem(key) || '' })
      }
    }
    if (entries.length < MAX_PERSISTED_WORKSPACES) return
    // Sort by raw length ascending — remove largest entries first to free space fastest
    entries.sort((a, b) => b.raw.length - a.raw.length)
    const toRemove = entries.length - MAX_PERSISTED_WORKSPACES + 1 // +1 for the new entry
    for (let i = 0; i < toRemove; i++) {
      localStorage.removeItem(entries[i].key)
    }
  } catch { /* ignore */ }
}

// ─── Module-level state (non-reactive, high-frequency access) ───────
//
// These are intentionally NOT Zustand reactive state:
// - _workspaces: large blobs, never rendered, only accessed imperatively
// - _scrollPositions: written at scroll frequency (~60fps), read imperatively
// - _switching: synchronous flag checked in event handlers

/** In-memory cache of per-session workspace snapshots. */
const _workspaces: Record<string, SessionWorkspace> = {}

/** Chat scroll positions per session name. Written at scroll frequency. */
const _scrollPositions: Record<string, number> = {}

/** Flag to suppress panel-removal cleanup during session switch. */
let _switching = false

/** Last-known PM/workspace panel sizes (updated by App.tsx onLayoutChanged). */
let _panelSizes: { [id: string]: number } | null = null

/** Last split where neither panel was collapsed — restore target for expand. */
let _lastNonCollapsedSizes: { [id: string]: number } | null = null

/** Imperative setter registered by App.tsx to restore panel sizes. */
let _restorePanelLayout: ((sizes: { [id: string]: number }) => void) | null = null

/** Called by App.tsx to track panel size changes. */
export function setPanelSizes(sizes: { [id: string]: number }) {
  _panelSizes = sizes
  // Snapshot only when neither side is collapsed — this is what expand() should restore to.
  const hasCollapsed = Object.values(sizes).some(v => v === 0)
  if (!hasCollapsed) _lastNonCollapsedSizes = { ...sizes }
}

/** Last split where neither side was collapsed (for expand target). */
export function getLastNonCollapsedSizes(): { [id: string]: number } | null {
  return _lastNonCollapsedSizes ? { ..._lastNonCollapsedSizes } : null
}

/** Called by App.tsx to register the imperative setLayout function. */
export function registerPanelRestore(fn: (sizes: { [id: string]: number }) => void) {
  _restorePanelLayout = fn
}

/** Get saved tab data for a non-active session (from memory cache or localStorage). */
export function getSavedTabData(sessionName: string): Record<string, TabData> | null {
  const key = _wsKey(sessionName)
  // Check in-memory cache first
  let ws = _workspaces[key] ?? null
  if (!ws) {
    try {
      const raw = localStorage.getItem(SESSION_WS_PREFIX + key)
      if (raw) ws = JSON.parse(raw)
    } catch { /* ignore */ }
  }
  // Fallback to individual session key if group key not found
  if (!ws && key !== sessionName) {
    ws = _workspaces[sessionName] ?? null
    if (!ws) {
      try {
        const raw = localStorage.getItem(SESSION_WS_PREFIX + sessionName)
        if (raw) ws = JSON.parse(raw)
      } catch { /* ignore */ }
    }
  }
  return ws?.tabData ?? null
}

/** Pending tab shares — tabs that should be opened when switching to a target session. */
interface PendingShare {
  targetSession: string
  tabType: 'agent' | 'doc' | 'latex'
  path: string        // file path for doc/latex, session name for agent
  readOnly?: boolean
  sessionName?: string  // for agent tabs
}

const PENDING_SHARES_KEY = 'pending-tab-shares'

function getPendingShares(): PendingShare[] {
  try {
    return JSON.parse(localStorage.getItem(PENDING_SHARES_KEY) || '[]')
  } catch { return [] }
}

function setPendingShares(shares: PendingShare[]) {
  try { localStorage.setItem(PENDING_SHARES_KEY, JSON.stringify(shares)) } catch { /* ignore */ }
}

/** Queue a tab to be opened when switching to the target session. */
export function queueTabShare(targetSession: string, tab: TabData) {
  const pending = getPendingShares()
  let entry: PendingShare
  if (tab.type === 'agent') {
    const a = tab as AgentTabData
    entry = { targetSession, tabType: 'agent', path: a.sessionName, sessionName: a.sessionName, readOnly: a.readOnly }
  } else if (tab.type === 'doc') {
    entry = { targetSession, tabType: 'doc', path: (tab as DocTabData).currentPath }
  } else if (tab.type === 'latex') {
    entry = { targetSession, tabType: 'latex', path: (tab as LatexTabData).filePath }
  } else {
    return // unsupported type
  }
  // Deduplicate
  if (!pending.some(p => p.targetSession === entry.targetSession && p.tabType === entry.tabType && p.path === entry.path)) {
    pending.push(entry)
    setPendingShares(pending)
    console.info('[queueTabShare] queued:', entry.tabType, entry.path, '→', targetSession, '| total pending:', pending.length)
  } else {
    console.info('[queueTabShare] deduplicated (already queued):', entry.tabType, entry.path, '→', targetSession)
  }
}

/** Open any pending shared tabs for the given session. Called after workspace restore. */
export function openPendingShares(sessionName: string) {
  const pending = getPendingShares()
  const forThis = pending.filter(p => p.targetSession === sessionName)
  if (forThis.length === 0) return

  console.info('[openPendingShares]', sessionName, '— found', forThis.length, 'pending:', forThis)

  for (const p of forThis) {
    try {
      if (p.tabType === 'doc') {
        useTabStore.getState().openDocTab(p.path)
      } else if (p.tabType === 'latex') {
        useTabStore.getState().openLatexTab(p.path)
      } else if (p.tabType === 'agent') {
        useTabStore.getState().openAgentTab(p.path, { readOnly: p.readOnly })
      }
      console.info('[openPendingShares] opened', p.tabType, p.path)
    } catch (err) {
      console.error('[openPendingShares] failed to open', p.tabType, p.path, err)
    }
  }

  // Remove processed entries
  const remaining = pending.filter(p => p.targetSession !== sessionName)
  setPendingShares(remaining)
}

/** Viewport rect of the clicked session card (consumed once by animation trigger). */
let _clickedCardRect: DOMRect | null = null

/** Store the clicked card's viewport rect (called from SessionTabs on click). */
export function setClickedCardRect(rect: DOMRect | null) {
  _clickedCardRect = rect
}

/** Consume the clicked card rect (returns it once, then clears). */
export function getClickedCardRect(): DOMRect | null {
  const rect = _clickedCardRect
  _clickedCardRect = null
  return rect
}

// ─── Private helpers ────────────────────────────────────────────────

/** Resolve the workspace storage key for a session: group ID if grouped, else session name. */
function _wsKey(sessionName: string): string {
  const group = useSessionStore.getState().getGroupForSession(sessionName)
  return group ? `group-${group.id}` : sessionName
}

/**
 * Remove stale workspace entries for sessions that no longer exist.
 * Called after session list refresh to prevent localStorage from filling up.
 */
export function pruneWorkspaces(liveSessionNames: string[]) {
  try {
    const liveSet = new Set(liveSessionNames)
    const toDelete: string[] = []

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key?.startsWith(SESSION_WS_PREFIX)) continue

      const sessionKey = key.slice(SESSION_WS_PREFIX.length)
      if (sessionKey.startsWith('group-')) {
        // Group workspace key: anchor session name follows 'group-'
        const anchorName = sessionKey.slice(6)
        if (!liveSet.has(anchorName)) toDelete.push(key)
      } else {
        // Individual session workspace
        if (!liveSet.has(sessionKey)) toDelete.push(key)
      }
    }

    for (const key of toDelete) {
      localStorage.removeItem(key)
      delete _workspaces[key.slice(SESSION_WS_PREFIX.length)]
    }
  } catch { /* ignore */ }
}

/** Reload content for all doc and latex tabs (after layout restore). */
function reloadTabContent() {
  const { tabData } = useTabStore.getState()
  for (const [id, data] of Object.entries(tabData)) {
    if (data.type === 'doc') {
      const doc = data as DocTabData
      fetchVaultFile(doc.currentPath).then(content => {
        useTabStore.setState(s => ({
          tabData: { ...s.tabData, [id]: { ...s.tabData[id] as DocTabData, content, loading: false, error: null } }
        }))
      }).catch(err => {
        useTabStore.setState(s => ({
          tabData: { ...s.tabData, [id]: { ...s.tabData[id] as DocTabData, loading: false, error: err.message } }
        }))
      })
    } else if (data.type === 'latex') {
      const tex = data as LatexTabData
      fetchVaultFile(tex.filePath).then(file => {
        useTabStore.setState(s => ({
          tabData: { ...s.tabData, [id]: { ...s.tabData[id] as LatexTabData, content: file.body || '', cleanContent: file.body || '', loading: false, error: null, isDirty: false } }
        }))
      }).catch(err => {
        useTabStore.setState(s => ({
          tabData: { ...s.tabData, [id]: { ...s.tabData[id] as LatexTabData, loading: false, error: err.message } }
        }))
      })
    }
  }
}

/** Ensure chat state exists for the active agent panel. */
function ensureActiveChat(api: DockviewApi) {
  const { tabData } = useTabStore.getState()
  const activePanel = api.activePanel
  if (activePanel) {
    const activeData = tabData[activePanel.id]
    if (activeData?.type === 'agent' && !(activeData as AgentTabData).readOnly) {
      useChatStore.getState().ensureSession((activeData as AgentTabData).sessionName)
    }
  }
}

// ─── Store ──────────────────────────────────────────────────────────

interface WorkspaceStore {
  // NOTE: dockviewApi is stored as a mutable ref via direct assignment in
  // setDockviewApi(), not via Zustand's set(). This avoids triggering reactive
  // updates for what is essentially a ref — dockview's API object is imperative
  // and never rendered. Access it via get().dockviewApi in store actions.
  dockviewApi: DockviewApi | null

  setDockviewApi: (api: DockviewApi | null) => void

  /** Save the current workspace state for the given session. */
  saveSessionWorkspace: (sessionName: string) => void

  /** Restore a previously saved session workspace. Returns true if restored. */
  restoreSessionWorkspace: (sessionName: string | null) => boolean

  /** Check whether a saved workspace exists for the given session. */
  hasWorkspace: (sessionName: string) => boolean

  /** Handle full session switch: save old, clear, restore new. */
  switchSession: (prevSession: string | null, newSession: string | null) => void

  /** Check if a session switch is in progress (for panel removal suppression). */
  isSwitching: () => boolean

  /** Get a chat scroll position. */
  getScrollPosition: (sessionName: string) => number | undefined

  /** Set a chat scroll position. */
  setScrollPosition: (sessionName: string, scrollTop: number) => void

  /** Toggle rail expansion. Returns new expanded state. */
  toggleFanExpanded: () => boolean

  /** Whether the session rail is currently expanded. */
  fanExpanded: boolean

  /** Which session's card is expanded (shared between fan + active card). */
  expandedSession: string | null
  setExpandedSession: (name: string | null) => void

  /** Session currently being restored/switched; used to hide intermediate paint. */
  restoringSession: string | null
  setRestoringSession: (name: string | null) => void
}

export const useWorkspaceStore = create<WorkspaceStore>((set, get) => ({
  dockviewApi: null,
  fanExpanded: false,
  expandedSession: null,
  restoringSession: null,

  setDockviewApi: (api) => {
    (get() as { dockviewApi: DockviewApi | null }).dockviewApi = api
  },

  setRestoringSession: (name) => set({ restoringSession: name }),

  saveSessionWorkspace: (sessionName) => {
    const api = get().dockviewApi
    if (!api) return

    // Capture the live scrollTop from any mounted chat containers before
    // snapshotting. This is more reliable than waiting for hide/unmount
    // observers, which can miss the final position during fast session switches.
    try {
      document.querySelectorAll<HTMLElement>('[data-chat-scroll-session]').forEach(el => {
        const name = el.dataset.chatScrollSession
        if (!name) return
        _scrollPositions[name] = el.scrollTop
      })
    } catch { /* ignore DOM access issues */ }

    const key = _wsKey(sessionName)
    const workspace: SessionWorkspace = {
      layout: api.toJSON(),
      tabData: useTabStore.getState().getTabSnapshot(),
      pmSnapshot: usePMStore.getState().getSnapshot(),
      scrollPositions: { ..._scrollPositions },
      panelSizes: _panelSizes ? { ..._panelSizes } : undefined,
      lastNonCollapsedSizes: _lastNonCollapsedSizes ? { ..._lastNonCollapsedSizes } : undefined,
      widgetSnapshots: useWidgetSnapshotStore.getState().getAllSnapshots(),
    }

    _workspaces[key] = workspace
    try {
      const storageKey = SESSION_WS_PREFIX + key
      prunePersistedWorkspaces(storageKey)
      localStorage.setItem(storageKey, JSON.stringify(workspace))
    } catch { /* ignore storage quota errors */ }
  },

  restoreSessionWorkspace: (sessionName) => {
    const api = get().dockviewApi
    if (!api || !sessionName) return false

    const key = _wsKey(sessionName)

    // Check in-memory cache first, then localStorage
    let saved = _workspaces[key] ?? null
    if (!saved) {
      try {
        const raw = localStorage.getItem(SESSION_WS_PREFIX + key)
        if (raw) {
          saved = JSON.parse(raw)
          if (saved) _workspaces[key] = saved
        }
      } catch { /* corrupted — ignore */ }
    }

    // Fallback: try individual session key if group key not found
    if (!saved && key !== sessionName) {
      saved = _workspaces[sessionName] ?? null
      if (!saved) {
        try {
          const raw = localStorage.getItem(SESSION_WS_PREFIX + sessionName)
          if (raw) saved = JSON.parse(raw)
        } catch { /* ignore */ }
      }
    }

    if (!saved) return false

    useTabStore.getState().restoreTabSnapshot(saved.tabData)
    try {
      api.clear()
      api.fromJSON(saved.layout as Parameters<typeof api.fromJSON>[0])
    } catch {
      useTabStore.getState().restoreTabSnapshot({})
      return false
    }

    if (saved.panelSizes) {
      _panelSizes = { ...saved.panelSizes }
      if (_restorePanelLayout) _restorePanelLayout(saved.panelSizes)
    }

    // Restore the pre-collapse snapshot separately so expand() after reload
    // (or after switching to a session saved in a collapsed state) returns
    // to the user's prior custom split rather than the default.
    if (saved.lastNonCollapsedSizes) {
      _lastNonCollapsedSizes = { ...saved.lastNonCollapsedSizes }
    }

    if (saved.scrollPositions) {
      Object.assign(_scrollPositions, saved.scrollPositions)
    }

    reloadTabContent()
    ensureActiveChat(api)
    usePMStore.getState().restoreSnapshot(saved.pmSnapshot)

    useWidgetSnapshotStore.getState().restoreAllSnapshots(saved.widgetSnapshots || {})

    return true
  },

  hasWorkspace: (sessionName) => {
    const key = _wsKey(sessionName)
    if (_workspaces[key]) return true
    try {
      if (localStorage.getItem(SESSION_WS_PREFIX + key) !== null) return true
    } catch { /* ignore */ }
    // Fallback to individual key
    if (key !== sessionName) {
      if (_workspaces[sessionName]) return true
      try { return localStorage.getItem(SESSION_WS_PREFIX + sessionName) !== null } catch { return false }
    }
    return false
  },

  switchSession: (prevSession, newSession) => {
    const api = get().dockviewApi
    if (!api) return

    // If switching within the same group → no workspace change needed
    if (prevSession && newSession) {
      const prevGroup = useSessionStore.getState().getGroupForSession(prevSession)
      const newGroup = useSessionStore.getState().getGroupForSession(newSession)
      if (prevGroup && newGroup && prevGroup.id === newGroup.id) {
        // Still process pending shares even for same-group switches
        openPendingShares(newSession)
        return // same group — workspace stays, only activeSession changes
      }
    }

    _switching = true
    try {
      if (prevSession) {
        get().saveSessionWorkspace(prevSession)
      }

      api.clear()
      useTabStore.getState().restoreTabSnapshot({})
      useWidgetSnapshotStore.getState().restoreAllSnapshots({})

      if (newSession) {
        const group = useSessionStore.getState().getGroupForSession(newSession)
        const groupKey = group ? `group-${group.id}` : null

        // For groups: check if a merged group workspace already exists
        let restored = false
        if (groupKey && (_workspaces[groupKey] || (() => { try { return localStorage.getItem(SESSION_WS_PREFIX + groupKey) !== null } catch { return false } })())) {
          restored = get().restoreSessionWorkspace(newSession)
        } else if (group) {
          // First time activating this group — merge individual workspaces
          // Collect tabs from all member sessions' individual workspaces
          const mergedTabs: Record<string, TabData> = {}
          const mergedScrolls: Record<string, number> = {}
          let pmSnapshot: PMSnapshot | undefined
          let anchorPanelSizes: { [id: string]: number } | undefined
          let anchorLastNonCollapsed: { [id: string]: number } | undefined

          for (const memberName of group.sessions) {
            const ws = _workspaces[memberName]
              ?? (() => { try { const r = localStorage.getItem(SESSION_WS_PREFIX + memberName); return r ? JSON.parse(r) : null } catch { return null } })()
            if (!ws) continue
            // Merge tab data from this member
            if (ws.tabData) Object.assign(mergedTabs, ws.tabData)
            if (ws.scrollPositions) Object.assign(mergedScrolls, ws.scrollPositions)
            // Use anchor's PM snapshot and panel sizes
            if (memberName === group.anchorSession) {
              if (ws.pmSnapshot) pmSnapshot = ws.pmSnapshot
              if (ws.panelSizes) anchorPanelSizes = ws.panelSizes
              if (ws.lastNonCollapsedSizes) anchorLastNonCollapsed = ws.lastNonCollapsedSizes
            }
          }

          if (Object.keys(mergedTabs).length > 0) {
            // Restore merged tabs (without layout — let dockview auto-layout)
            useTabStore.getState().restoreTabSnapshot(mergedTabs)
            for (const [, data] of Object.entries(mergedTabs)) {
              if (data.type === 'agent') {
                const agentData = data as AgentTabData
                useTabStore.getState().openAgentTab(agentData.sessionName, {
                  readOnly: agentData.readOnly,
                  jsonlPath: agentData.jsonlPath,
                })
              } else if (data.type === 'doc') {
                const docData = data as DocTabData
                useTabStore.getState().openDocTab(docData.currentPath)
              } else if (data.type === 'latex') {
                const texData = data as LatexTabData
                useTabStore.getState().openLatexTab(texData.filePath)
              }
            }
            Object.assign(_scrollPositions, mergedScrolls)
            if (pmSnapshot) usePMStore.getState().restoreSnapshot(pmSnapshot)
            if (anchorPanelSizes) {
              _panelSizes = { ...anchorPanelSizes }
              if (_restorePanelLayout) _restorePanelLayout(anchorPanelSizes)
            }
            if (anchorLastNonCollapsed) _lastNonCollapsedSizes = { ...anchorLastNonCollapsed }
            restored = true
          }
        } else {
          // Standalone session — normal restore
          restored = get().restoreSessionWorkspace(newSession)
        }

        if (!restored || api.panels.length === 0) {
          // No saved workspace at all — open agent tabs for all members
          if (group) {
            group.sessions.forEach(s => useTabStore.getState().openAgentTab(s))
          } else {
            useTabStore.getState().openAgentTab(newSession)
          }
        }

        // Navigate PM for first visits (no saved workspace restored).
        // This runs AFTER the old workspace is saved, so PM state is clean.
        if (!restored) {
          const { linkedProjectId, linkedTaskId, sessions, vaultRoot } = useSessionStore.getState()
          let projectId = linkedProjectId
          let taskId = linkedTaskId

          // Group-aware: navigate to the LCA of all members' task IDs
          if (group && group.sessions.length > 1) {
            const memberTaskIds = group.sessions.map(n => {
              const s = sessions.find(x => x.name === n)
              return s?.working_dir ? extractTaskIdFromWorkingDir(s.working_dir, vaultRoot) : null
            }).filter(Boolean) as string[]
            if (memberTaskIds.length > 1) {
              const parents = memberTaskIds.map(id => id.split('.').slice(0, -1).join('.'))
              const allSiblings = parents.every(p => p === parents[0])
              if (allSiblings && parents[0]) {
                taskId = parents[0]
              } else {
                const sorted = [...memberTaskIds].sort((a, b) => a.length - b.length)
                const shortest = sorted[0]
                if (sorted.every(id => id.startsWith(shortest))) taskId = shortest
              }
            }
            const anchor = sessions.find(s => s.name === group.anchorSession)
            if (anchor) projectId = extractProjectFromWorkingDir(anchor.working_dir, vaultRoot)
          }

          const pm = usePMStore.getState()
          if (projectId && taskId) {
            void pm.goToTaskTarget(projectId, taskId)
          } else if (projectId) {
            void pm.openProject(projectId)
          } else if (taskId) {
            void pm.navigateTo(taskId)
          }
        }
      }
      // Open any tabs that were shared to this session
      if (newSession) openPendingShares(newSession)
    } finally {
      _switching = false
    }
  },

  isSwitching: () => _switching,

  getScrollPosition: (sessionName) => _scrollPositions[sessionName],

  setScrollPosition: (sessionName, scrollTop) => {
    _scrollPositions[sessionName] = scrollTop
  },

  toggleFanExpanded: () => {
    const next = !get().fanExpanded
    set({ fanExpanded: next })
    return next
  },

  setExpandedSession: (name) => {
    set({ expandedSession: name })
  },
}))
