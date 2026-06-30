import { create } from 'zustand'
import type { DockviewApi } from 'dockview'
import type { VaultFile } from '@/lib/types.ts'
import * as api from '@/lib/api.ts'
import { useSessionStore } from '@/stores/session-store.ts'
import { normalizeVaultPath, workingDirPrefix } from '@/lib/paths.ts'

// ─── Tab data types (metadata only, not layout) ─────────────────────

/** Session scope: which session(s) a tab belongs to.
 * - string: visible only in that session
 * - string[]: shared — visible in all listed sessions
 * - null/undefined: global — visible in all sessions
 */
export type SessionScope = string | string[] | null

export interface AgentTabData {
  type: 'agent'
  sessionName: string
  sessionScope?: SessionScope
  innerTab: 'chat' | 'terminal'
  jsonlPath?: string    // for past sessions — loads from JSONL file
  readOnly?: boolean    // past sessions are read-only until resumed
  sessionUuid?: string  // Claude session UUID (for resume)
  taskPath?: string     // vault-relative task path (for resume working_dir)
  resumeWorkingDir?: string // original session cwd (absolute, for --resume)
  agentRole?: string    // agent role (concierge, task-agent, etc.) for resume routing
}

export interface DocTabData {
  type: 'doc'
  sessionScope?: SessionScope
  currentPath: string
  history: string[]
  future: string[]
  sourceTabId?: string
  content: VaultFile | null
  loading: boolean
  error: string | null
  editMode: boolean
  editContent: string | null
  editFrontmatter: string | null
  isDirty: boolean
  saving: boolean
  scrollTop?: number  // last saved scroll position
}

export interface PMTabData {
  type: 'pm'
  sessionScope?: SessionScope
  projectId: string
}

export interface CompileError {
  line: number | null
  message: string
  full_context: string
}

export interface CiteEntry {
  key: string
  title?: string
  author?: string
  year?: string
}

export interface LatexTabData {
  type: 'latex'
  sessionScope?: SessionScope
  filePath: string
  content: string | null
  cleanContent: string | null  // last content fetched from server (for dirty detection)
  loading: boolean
  error: string | null
  isDirty: boolean
  saving: boolean
  pdfUrl: string | null
  compileState: 'idle' | 'compiling' | 'success' | 'error'
  compileLog: string | null
  compileErrors: CompileError[]
  bibEntries: CiteEntry[]
}

export interface BrowserTabData {
  type: 'browser'
  sessionScope?: SessionScope
}

export type TabData = AgentTabData | DocTabData | PMTabData | LatexTabData | BrowserTabData

// ─── Dockview API ref ───────────────────────────────────────────────
// Canonical ref lives in workspace-store. Local mirror for zero-overhead
// internal access (12+ call sites in tab actions).

import { useWorkspaceStore, queueTabShare } from '@/stores/workspace-store.ts'

let _dockviewApi: DockviewApi | null = null

export function setDockviewApi(api: DockviewApi | null) {
  _dockviewApi = api
  useWorkspaceStore.getState().setDockviewApi(api)
}

export function getDockviewApi(): DockviewApi | null {
  return _dockviewApi
}

// ─── Helpers ────────────────────────────────────────────────────────

/** Strip transient fields from DocTabData for persistence. */
function stripDocTransient(data: DocTabData): DocTabData {
  const { content: _, loading: _l, error: _e, saving: _s,
          editMode: _em, editContent: _ec, editFrontmatter: _ef, isDirty: _id,
          ...rest } = data
  return { ...rest, content: null, loading: true, error: null,
    saving: false, editMode: false, editContent: null, editFrontmatter: null, isDirty: false } as DocTabData
}

function makeId() {
  return Math.random().toString(36).slice(2, 9)
}

function basename(path: string): string {
  return path.split('/').pop() || path
}

/** Check if a tab should be visible in the given session context. */
export function isTabVisibleInSession(tab: TabData, activeSession: string | null): boolean {
  if (!activeSession) return true // no session → show all
  const scope = tab.sessionScope
  if (scope == null) return true // global tab
  if (Array.isArray(scope)) return scope.includes(activeSession)
  return scope === activeSession
}

async function loadDocContent(
  path: string,
  wdPrefix?: string,
): Promise<{ content: VaultFile | null; error: string | null; resolvedPath: string }> {
  try {
    const data = await api.fetchVaultFile(path)
    return { content: data, error: null, resolvedPath: path }
  } catch (err) {
    if (wdPrefix && !path.startsWith('/') && !path.startsWith(wdPrefix)) {
      const altPath = (wdPrefix.endsWith('/') ? wdPrefix : wdPrefix + '/') + path
      try {
        const data = await api.fetchVaultFile(altPath)
        return { content: data, error: null, resolvedPath: altPath }
      } catch { /* fall through */ }
    }
    return { content: null, error: err instanceof Error ? err.message : 'Failed to load', resolvedPath: path }
  }
}

/** Get vault-relative working_dir prefix for a given session.
 *  Prefers task_path directory (specific task folder) over working_dir (project root). */
function _wdPrefix(sessionName?: string): string {
  const { sessions, vaultRoot } = useSessionStore.getState()
  const name = sessionName
  if (!name) return ''
  const session = sessions.find(s => s.name === name)
  // Use task_path directory for better relative path resolution
  if (session?.task_path) {
    const dir = session.task_path.substring(0, session.task_path.lastIndexOf('/'))
    if (dir) return dir
  }
  return workingDirPrefix(session?.working_dir, vaultRoot)
}

// ─── Store ──────────────────────────────────────────────────────────

interface TabStore {
  /** Per-panel metadata. Key = dockview panel id. */
  tabData: Record<string, TabData>

  openAgentTab: (sessionName: string, opts?: { jsonlPath?: string; readOnly?: boolean; sessionUuid?: string; taskPath?: string; resumeWorkingDir?: string; agentRole?: string }) => void
  openDocTab: (path: string, forceNew?: boolean, preferredTab?: 'plan' | 'log') => Promise<void>
  openPMTab: (projectId: string) => void
  openLatexTab: (path: string) => Promise<void>
  openBrowserTab: () => void
  setLatexContent: (panelId: string, content: string) => void
  saveLatexFile: (panelId: string) => Promise<void>
  compileLatex: (panelId: string) => Promise<void>
  setLatexPdf: (panelId: string, url: string | null) => void
  setLatexBib: (panelId: string, entries: CiteEntry[]) => void
  /** Silently refetch content for a latex tab (skip if dirty/saving). */
  refreshLatex: (panelId: string) => Promise<void>
  navigateDoc: (panelId: string, path: string) => Promise<void>
  goBack: (panelId: string) => Promise<void>
  goForward: (panelId: string) => Promise<void>
  removeTabData: (id: string) => void
  setInnerTab: (panelId: string, inner: 'chat' | 'terminal') => void
  enterEditMode: (panelId: string) => void
  exitEditMode: (panelId: string) => void
  setEditContent: (panelId: string, content: string) => void
  saveDoc: (panelId: string) => Promise<void>
  /** Silently refetch content for a doc tab (no loading flash). */
  refreshDoc: (panelId: string) => Promise<void>
  /** Save the scroll position for a doc tab. */
  setDocScroll: (panelId: string, scrollTop: number) => void

  /** Share a tab to another session (adds to sessionScope array). */
  shareTabToSession: (panelId: string, targetSession: string) => void
  /** Share a tab from saved workspace data directly (for non-active session tabs). */
  shareTabDataToSession: (tabData: TabData, targetSession: string) => void

  /** Return a persistence-safe snapshot of tabData (transient doc fields stripped). */
  getTabSnapshot: () => Record<string, TabData>
  /** Replace tabData from a previously saved snapshot. */
  restoreTabSnapshot: (snapshot: Record<string, TabData>) => void
}

export const useTabStore = create<TabStore>((set, get) => ({
  tabData: {},

  openAgentTab: (sessionName, opts) => {
    const dv = _dockviewApi
    if (!dv) return

    // Check for existing agent panel
    for (const panel of dv.panels) {
      const data = get().tabData[panel.id]
      if (data?.type === 'agent' && data.sessionName === sessionName) {
        panel.api.setActive()
        return
      }
    }

    const id = makeId()
    // Agent tabs are scoped to their own session.
    // Past (read-only) sessions opened for reference are scoped to the active session instead.
    const { activeSession } = useSessionStore.getState()
    const scope = opts?.readOnly ? (activeSession ?? sessionName) : sessionName

    const data: AgentTabData = {
      type: 'agent',
      sessionName,
      sessionScope: scope,
      innerTab: 'chat',
      jsonlPath: opts?.jsonlPath,
      readOnly: opts?.readOnly,
      sessionUuid: opts?.sessionUuid,
      taskPath: opts?.taskPath,
      resumeWorkingDir: opts?.resumeWorkingDir,
      agentRole: opts?.agentRole,
    }
    set(s => ({ tabData: { ...s.tabData, [id]: data } }))

    // Position in the active group
    const ref = dv.activePanel
    const title = opts?.readOnly ? `📜 ${sessionName}` : sessionName
    dv.addPanel({
      id,
      component: 'agent',
      title,
      params: { tabId: id, sessionName },
      ...(ref ? { position: { referencePanel: ref.id, direction: 'within' } } : {}),
    })
  },

  openDocTab: async (path, forceNew = false, preferredTab?) => {
    const dv = _dockviewApi
    if (!dv) return

    const vaultRoot = useSessionStore.getState().vaultRoot
    const normalized = normalizeVaultPath(path, vaultRoot)

    // Intercept task.md / worklog.md → redirect to PM node browser
    const filename = normalized.split('/').pop() ?? ''
    if (filename === 'task.md' || filename === 'worklog.md') {
      const { usePMStore } = await import('./pm-store.ts')
      const { extractTaskIdFromPath, extractProjectFromPath } = await import('@/lib/paths.ts')
      let redirected = false

      // Try path-based extraction first
      const taskId = extractTaskIdFromPath(normalized)
      const projectId = extractProjectFromPath(normalized)
      if (taskId && projectId) {
        set({ tabData: get().tabData }) // ensure store is ready
        await usePMStore.getState().goToTaskTarget(
          projectId,
          taskId,
          filename === 'worklog.md' ? preferredTab : undefined,
        )
        redirected = true
      }

      // Fallback: use active session's task_id (handles Scratch paths)
      if (!redirected) {
        const { sessions, activeSession } = useSessionStore.getState()
        const session = sessions.find(s => s.name === activeSession)
        if (session?.task_id) {
          const sessProject = session.task_path?.match(/^projects\/([^/]+)/)?.[1]
          if (sessProject) {
            await usePMStore.getState().goToTaskTarget(sessProject, session.task_id)
            redirected = true
          }
        }
      }

      if (redirected) return
    }

    if (!forceNew) {
      for (const panel of dv.panels) {
        const data = get().tabData[panel.id]
        if (data?.type === 'doc' && data.currentPath === normalized) {
          panel.api.setActive()
          // Silently refetch in case file changed on disk
          get().refreshDoc(panel.id)
          return
        }
      }
    }

    // Track which agent panel opened this doc
    const activeData = dv.activePanel ? get().tabData[dv.activePanel.id] : null
    const sourceTabId = (!forceNew && activeData?.type === 'agent') ? dv.activePanel!.id : undefined

    // Doc tabs are scoped to the active session at time of opening
    const { activeSession } = useSessionStore.getState()

    const id = makeId()
    const data: DocTabData = {
      type: 'doc', currentPath: normalized,
      sessionScope: activeSession,
      history: [], future: [], sourceTabId,
      content: null, loading: true, error: null,
      editMode: false, editContent: null, editFrontmatter: null, isDirty: false, saving: false,
    }
    set(s => ({ tabData: { ...s.tabData, [id]: data } }))

    // Office files need renderer: 'always' to keep iframe alive across tab switches
    const ext = normalized.split('.').pop()?.toLowerCase() || ''
    const officeExts = new Set([
      'docx','xlsx','pptx','doc','xls','ppt','odt','ods','odp','rtf',
    ])
    const isOffice = officeExts.has(ext)

    const ref = dv.activePanel
    dv.addPanel({
      id,
      component: 'doc',
      title: basename(normalized),
      params: { tabId: id },
      ...(ref ? { position: { referencePanel: ref.id, direction: 'within' } } : {}),
      ...(isOffice ? { renderer: 'always' as const } : {}),
    })

    if (isOffice) {
      set(s => {
        const existing = s.tabData[id] as DocTabData | undefined
        if (!existing) return s
        return { tabData: { ...s.tabData, [id]: { ...existing, content: null, loading: false, error: null } } }
      })
      return
    }

    // Find the session name of the source agent for working_dir resolution
    const agentSession = sourceTabId && get().tabData[sourceTabId]?.type === 'agent'
      ? (get().tabData[sourceTabId] as AgentTabData).sessionName
      : undefined
    const wdp = _wdPrefix(agentSession)
    const { content, error, resolvedPath } = await loadDocContent(normalized, wdp)
    set(s => {
      const existing = s.tabData[id] as DocTabData | undefined
      if (!existing) return s
      return { tabData: { ...s.tabData, [id]: { ...existing, content, loading: false, error, currentPath: resolvedPath } } }
    })
    // Update panel title if path resolved differently
    if (resolvedPath !== normalized) {
      dv.getPanel(id)?.api.setTitle(basename(resolvedPath))
    }
  },

  openPMTab: (projectId) => {
    const dv = _dockviewApi
    if (!dv) return

    for (const panel of dv.panels) {
      const data = get().tabData[panel.id]
      if (data?.type === 'pm' && data.projectId === projectId) {
        panel.api.setActive()
        return
      }
    }

    const id = makeId()
    const data: PMTabData = { type: 'pm', projectId }
    set(s => ({ tabData: { ...s.tabData, [id]: data } }))

    const ref = dv.activePanel
    dv.addPanel({
      id,
      component: 'pm',
      title: `PM: ${projectId}`,
      params: { tabId: id },
      ...(ref ? { position: { referencePanel: ref.id, direction: 'within' } } : {}),
    })
  },

  navigateDoc: async (panelId, path) => {
    const data = get().tabData[panelId]
    if (!data || data.type !== 'doc') return
    const doc = data as DocTabData

    const vaultRoot = useSessionStore.getState().vaultRoot
    const normalized = normalizeVaultPath(path, vaultRoot)

    set(s => ({
      tabData: { ...s.tabData, [panelId]: {
        ...doc,
        history: [...doc.history, doc.currentPath],
        future: [],
        currentPath: normalized,
        content: null, loading: true, error: null,
        editMode: false, editContent: null, editFrontmatter: null, isDirty: false,
        sourceTabId: undefined,
      } as DocTabData }
    }))

    _dockviewApi?.getPanel(panelId)?.api.setTitle(basename(normalized))

    const wdp = _wdPrefix()
    const { content, error, resolvedPath } = await loadDocContent(normalized, wdp)
    set(s => {
      const existing = s.tabData[panelId] as DocTabData | undefined
      if (!existing) return s
      return { tabData: { ...s.tabData, [panelId]: { ...existing, content, loading: false, error, currentPath: resolvedPath } } }
    })
    if (resolvedPath !== normalized) {
      _dockviewApi?.getPanel(panelId)?.api.setTitle(basename(resolvedPath))
    }
  },

  goBack: async (panelId) => {
    const data = get().tabData[panelId]
    if (!data || data.type !== 'doc') return
    const doc = data as DocTabData

    if (doc.history.length > 0) {
      const prev = doc.history[doc.history.length - 1]
      set(s => ({
        tabData: { ...s.tabData, [panelId]: {
          ...doc,
          history: doc.history.slice(0, -1),
          future: [doc.currentPath, ...doc.future],
          currentPath: prev,
          content: null, loading: true, error: null,
        } as DocTabData }
      }))
      _dockviewApi?.getPanel(panelId)?.api.setTitle(basename(prev))

      const { content, error } = await loadDocContent(prev)
      set(s => {
        const existing = s.tabData[panelId] as DocTabData | undefined
        if (!existing) return s
        return { tabData: { ...s.tabData, [panelId]: { ...existing, content, loading: false, error } } }
      })
    } else if (doc.sourceTabId) {
      // Return to the agent tab that opened this doc
      const sourceId = doc.sourceTabId
      set(s => ({
        tabData: { ...s.tabData, [panelId]: { ...doc, sourceTabId: undefined } as DocTabData }
      }))
      _dockviewApi?.getPanel(sourceId)?.api.setActive()
    }
  },

  goForward: async (panelId) => {
    const data = get().tabData[panelId]
    if (!data || data.type !== 'doc') return
    const doc = data as DocTabData
    if (doc.future.length === 0) return

    const next = doc.future[0]
    set(s => ({
      tabData: { ...s.tabData, [panelId]: {
        ...doc,
        future: doc.future.slice(1),
        history: [...doc.history, doc.currentPath],
        currentPath: next,
        content: null, loading: true, error: null,
      } as DocTabData }
    }))
    _dockviewApi?.getPanel(panelId)?.api.setTitle(basename(next))

    const { content, error } = await loadDocContent(next)
    set(s => {
      const existing = s.tabData[panelId] as DocTabData | undefined
      if (!existing) return s
      return { tabData: { ...s.tabData, [panelId]: { ...existing, content, loading: false, error } } }
    })
  },

  removeTabData: (id) => {
    set(s => {
      const { [id]: _, ...rest } = s.tabData
      return { tabData: rest }
    })
  },

  setInnerTab: (panelId, inner) => {
    set(s => {
      const data = s.tabData[panelId]
      if (!data || data.type !== 'agent') return s
      return { tabData: { ...s.tabData, [panelId]: { ...data, innerTab: inner } } }
    })
  },

  enterEditMode: (panelId) => {
    const data = get().tabData[panelId]
    if (!data || data.type !== 'doc') return
    const doc = data as DocTabData
    const body = doc.content?.body ?? ''
    const fm = doc.content?.frontmatter
    const fmBlock = fm && Object.keys(fm).length > 0
      ? '---\n' + Object.entries(fm).map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`).join('\n') + '\n---\n'
      : null
    set(s => ({
      tabData: { ...s.tabData, [panelId]: { ...doc, editMode: true, editContent: body, editFrontmatter: fmBlock, isDirty: false } }
    }))
  },

  exitEditMode: (panelId) => {
    set(s => {
      const data = s.tabData[panelId]
      if (!data || data.type !== 'doc') return s
      return { tabData: { ...s.tabData, [panelId]: { ...data, editMode: false, editContent: null, editFrontmatter: null, isDirty: false } } }
    })
  },

  setEditContent: (panelId, content) => {
    set(s => {
      const data = s.tabData[panelId]
      if (!data || data.type !== 'doc') return s
      return { tabData: { ...s.tabData, [panelId]: { ...data, editContent: content, isDirty: true } } }
    })
  },

  saveDoc: async (panelId) => {
    const data = get().tabData[panelId]
    if (!data || data.type !== 'doc') return
    const doc = data as DocTabData
    if (doc.editContent === null) return

    const fullContent = doc.editFrontmatter
      ? doc.editFrontmatter + doc.editContent
      : doc.editContent

    set(s => ({
      tabData: { ...s.tabData, [panelId]: { ...doc, saving: true } }
    }))
    try {
      await api.saveVaultFile(doc.currentPath, fullContent)
      const { content, error } = await loadDocContent(doc.currentPath)
      set(s => ({
        tabData: { ...s.tabData, [panelId]: {
          ...(s.tabData[panelId] as DocTabData),
          content, error, loading: false, saving: false, editMode: false, editContent: null, isDirty: false,
        } }
      }))
    } catch (err) {
      set(s => ({
        tabData: { ...s.tabData, [panelId]: { ...(s.tabData[panelId] as DocTabData), saving: false } }
      }))
      throw err
    }
  },

  setDocScroll: (panelId, scrollTop) => {
    set(s => {
      const data = s.tabData[panelId]
      if (!data || data.type !== 'doc') return s
      return { tabData: { ...s.tabData, [panelId]: { ...data, scrollTop } } }
    })
  },

  refreshDoc: async (panelId) => {
    const data = get().tabData[panelId]
    if (!data || data.type !== 'doc') return
    const doc = data as DocTabData
    // Don't refresh while editing or saving — would discard user's changes
    if (doc.editMode || doc.saving || doc.loading) return

    try {
      const fresh = await api.fetchVaultFile(doc.currentPath)
      // Only update if content actually changed (avoid unnecessary re-renders)
      if (fresh.body !== doc.content?.body ||
          JSON.stringify(fresh.frontmatter) !== JSON.stringify(doc.content?.frontmatter)) {
        set(s => {
          const current = s.tabData[panelId] as DocTabData | undefined
          if (!current || current.editMode) return s
          return { tabData: { ...s.tabData, [panelId]: { ...current, content: fresh, error: null } } }
        })
      }
    } catch {
      // Silent — don't disrupt the tab on background refresh failure
    }
  },

  // ─── LaTeX tab methods ──────────────────────────────────────────

  openLatexTab: async (path) => {
    const dv = _dockviewApi
    if (!dv) return

    const vaultRoot = useSessionStore.getState().vaultRoot
    const normalized = normalizeVaultPath(path, vaultRoot)

    // Reuse existing latex tab for same file
    for (const panel of dv.panels) {
      const data = get().tabData[panel.id]
      if (data?.type === 'latex' && (data as LatexTabData).filePath === normalized) {
        panel.api.setActive()
        return
      }
    }

    const { activeSession } = useSessionStore.getState()
    const id = makeId()
    const data: LatexTabData = {
      type: 'latex', filePath: normalized,
      sessionScope: activeSession,
      content: null, cleanContent: null, loading: true, error: null,
      isDirty: false, saving: false,
      pdfUrl: null, compileState: 'idle',
      compileLog: null, compileErrors: [],
      bibEntries: [],
    }
    set(s => ({ tabData: { ...s.tabData, [id]: data } }))

    const ref = dv.activePanel
    dv.addPanel({
      id,
      component: 'latex',
      title: `📄 ${basename(normalized)}`,
      params: { tabId: id },
      ...(ref ? { position: { referencePanel: ref.id, direction: 'within' } } : {}),
    })

    // Load file content
    try {
      const file = await api.fetchVaultFile(normalized)
      const rawContent = file.body || ''
      set(s => {
        const existing = s.tabData[id] as LatexTabData | undefined
        if (!existing) return s
        return { tabData: { ...s.tabData, [id]: { ...existing, content: rawContent, cleanContent: rawContent, loading: false } } }
      })
    } catch (err) {
      set(s => {
        const existing = s.tabData[id] as LatexTabData | undefined
        if (!existing) return s
        return { tabData: { ...s.tabData, [id]: { ...existing, loading: false, error: err instanceof Error ? err.message : 'Failed to load' } } }
      })
    }
  },

  openBrowserTab: () => {
    const dv = _dockviewApi
    if (!dv) return
    // Reuse existing browser tab
    for (const panel of dv.panels) {
      const data = get().tabData[panel.id]
      if (data?.type === 'browser') {
        panel.api.setActive()
        return
      }
    }
    const id = makeId()
    const data: BrowserTabData = { type: 'browser' }
    set(s => ({ tabData: { ...s.tabData, [id]: data } }))
    const ref = dv.activePanel
    dv.addPanel({
      id,
      component: 'browser',
      title: '⊡ Browser',
      params: { tabId: id },
      ...(ref ? { position: { referencePanel: ref.id, direction: 'within' } } : {}),
    })
  },

  setLatexContent: (panelId, content) => {
    set(s => {
      const data = s.tabData[panelId]
      if (!data || data.type !== 'latex') return s
      const tex = data as LatexTabData
      // Only mark dirty if content differs from last server-fetched version
      const isDirty = content !== tex.cleanContent
      return { tabData: { ...s.tabData, [panelId]: { ...data, content, isDirty } } }
    })
  },

  saveLatexFile: async (panelId) => {
    const data = get().tabData[panelId]
    if (!data || data.type !== 'latex') return
    const tex = data as LatexTabData
    if (tex.content === null) return

    set(s => ({ tabData: { ...s.tabData, [panelId]: { ...tex, saving: true } } }))
    try {
      await api.saveVaultFile(tex.filePath, tex.content)
      set(s => ({
        tabData: { ...s.tabData, [panelId]: { ...(s.tabData[panelId] as LatexTabData), saving: false, isDirty: false, cleanContent: (s.tabData[panelId] as LatexTabData).content } }
      }))
    } catch (err) {
      set(s => ({
        tabData: { ...s.tabData, [panelId]: { ...(s.tabData[panelId] as LatexTabData), saving: false } }
      }))
      throw err
    }
  },

  compileLatex: async (panelId) => {
    const data = get().tabData[panelId]
    if (!data || data.type !== 'latex') return
    const tex = data as LatexTabData

    // Save first if dirty
    if (tex.isDirty && tex.content !== null) {
      await get().saveLatexFile(panelId)
    }

    set(s => ({
      tabData: { ...s.tabData, [panelId]: { ...(s.tabData[panelId] as LatexTabData), compileState: 'compiling' as const, compileLog: null, compileErrors: [] } }
    }))

    try {
      const result = await api.compileLatex(tex.filePath)

      if (result.ok && result.pdf_path) {
        // Success — server saved PDF, use vault preview URL
        const previewUrl = api.vaultPreviewUrl(result.pdf_path) + '&t=' + Date.now()
        set(s => ({
          tabData: { ...s.tabData, [panelId]: { ...(s.tabData[panelId] as LatexTabData), compileState: 'success' as const, pdfUrl: previewUrl, compileLog: null, compileErrors: [] } }
        }))
      } else {
        // Error
        set(s => ({
          tabData: { ...s.tabData, [panelId]: { ...(s.tabData[panelId] as LatexTabData), compileState: 'error' as const, compileLog: result.log || '', compileErrors: result.errors || [] } }
        }))
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Compilation failed'
      const userMsg = msg.includes('503')
        ? 'pdflatex is not installed on this server. Install TeX Live to enable compilation.'
        : msg
      set(s => ({
        tabData: { ...s.tabData, [panelId]: { ...(s.tabData[panelId] as LatexTabData), compileState: 'error' as const, compileLog: userMsg, compileErrors: [] } }
      }))
    }
  },

  setLatexPdf: (panelId, url) => {
    set(s => {
      const data = s.tabData[panelId]
      if (!data || data.type !== 'latex') return s
      return { tabData: { ...s.tabData, [panelId]: { ...data, pdfUrl: url } } }
    })
  },

  setLatexBib: (panelId, entries) => {
    set(s => {
      const data = s.tabData[panelId]
      if (!data || data.type !== 'latex') return s
      return { tabData: { ...s.tabData, [panelId]: { ...data, bibEntries: entries } } }
    })
  },

  refreshLatex: async (panelId) => {
    const data = get().tabData[panelId]
    if (!data || data.type !== 'latex') return
    const tex = data as LatexTabData
    // Don't refresh while user has unsaved edits or is saving
    if (tex.isDirty || tex.saving || tex.loading) return

    try {
      const fresh = await api.fetchVaultFile(tex.filePath)
      const freshContent = fresh.body || ''
      // Only update if content actually changed
      if (freshContent !== tex.content) {
        set(s => {
          const current = s.tabData[panelId] as LatexTabData | undefined
          if (!current || current.isDirty) return s
          return { tabData: { ...s.tabData, [panelId]: { ...current, content: freshContent, cleanContent: freshContent, isDirty: false } } }
        })
      }
    } catch {
      // Silent — don't disrupt the editor on background refresh failure
    }
  },

  shareTabToSession: (panelId, targetSession) => {
    const tab = get().tabData[panelId]
    if (!tab) {
      console.warn('[shareTabToSession] panelId not found in live tabData:', panelId,
        '— use shareTabDataToSession for saved workspace tabs')
      return
    }
    const scope = tab.sessionScope
    let newScope: SessionScope
    if (Array.isArray(scope)) {
      if (scope.includes(targetSession)) return // already shared
      newScope = [...scope, targetSession]
    } else if (typeof scope === 'string') {
      if (scope === targetSession) return
      newScope = [scope, targetSession]
    } else {
      // null/undefined (global) — scope to active + target
      const active = useSessionStore.getState().activeSession
      newScope = active ? [active, targetSession] : [targetSession]
    }
    const updatedTab = { ...tab, sessionScope: newScope }
    set(s => ({ tabData: { ...s.tabData, [panelId]: updatedTab } }))

    // Queue the tab to be opened when switching to the target session
    queueTabShare(targetSession, updatedTab)
    console.info('[shareTabToSession] queued share:', tab.type, '→', targetSession)
  },

  shareTabDataToSession: (tab, targetSession) => {
    // For tabs from saved (non-active) workspaces — no live panelId to update.
    // Just queue the share for when the target session becomes active.
    queueTabShare(targetSession, tab)
    console.info('[shareTabDataToSession] queued share:', tab.type, '→', targetSession)
  },

  getTabSnapshot: () => {
    const { tabData } = get()
    const snapshot: Record<string, TabData> = {}
    for (const [id, data] of Object.entries(tabData)) {
      if (data.type === 'doc') {
        snapshot[id] = stripDocTransient(data as DocTabData)
      } else if (data.type === 'latex') {
        const tex = data as LatexTabData
        snapshot[id] = {
          ...tex,
          content: null, loading: true, error: null, saving: false,
          compileLog: null, compileErrors: [],
          // Preserve pdfUrl and compileState — PDF is on disk, URL still valid
          pdfUrl: tex.pdfUrl,
          compileState: tex.pdfUrl ? 'success' : 'idle',
        } as LatexTabData
      } else {
        snapshot[id] = data
      }
    }
    return snapshot
  },

  restoreTabSnapshot: (snapshot) => {
    set({ tabData: snapshot })
  },
}))

export function tabLabel(panelId: string): string {
  const data = useTabStore.getState().tabData[panelId]
  if (!data) return 'Tab'
  if (data.type === 'agent') return data.sessionName
  if (data.type === 'pm') return `PM: ${data.projectId}`
  if (data.type === 'latex') return basename(data.filePath)
  if (data.type === 'doc') return basename(data.currentPath)
  return 'Browser'
}
