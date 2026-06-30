import { create } from 'zustand'
import type { Session, SessionStatus } from '@/lib/types.ts'
import * as api from '@/lib/api.ts'

let refreshSessionsInFlight: Promise<void> | null = null

export interface SessionGroup {
  id: string                    // = anchor session name
  sessions: string[]            // ordered list of session names
  anchorSession: string         // determines default task
}

interface SessionStore {
  sessions: Session[]
  vaultRoot: string | null
  sessionStatuses: Record<string, SessionStatus>
  knownNames: Set<string> | null
  newNames: Set<string>
  wrappingUp: Set<string>
  pastAgentsRevision: number
  draftInput: Record<string, string>
  groups: Record<string, SessionGroup>

  /** The explicitly selected session (context switcher). */
  activeSession: string | null
  /** Task node ID linked to the active session (for PM navigation). */
  linkedTaskId: string | null
  /** Project ID linked to the active session (for PM project switching). */
  linkedProjectId: string | null

  refreshSessions: () => Promise<void>
  setSessionStatus: (name: string, status: SessionStatus) => void
  setDraftInput: (session: string, text: string) => void
  setSessionTurns: (name: string, turns: number) => void
  doKillSession: (name: string) => Promise<void>
  doCreateSession: (prompt: string, model?: string, runtime?: string) => Promise<string | null>
  clearNewName: (name: string) => void
  setActiveSession: (name: string | null) => void
  getGroupForSession: (name: string | null) => SessionGroup | null
  createGroup: (anchor: string, dragged: string) => void
  addToGroup: (groupId: string, sessionName: string) => void

  /** User-defined display names (overrides task_title for UI). */
  displayNames: Record<string, string>
  setDisplayName: (sessionName: string, displayName: string | null) => void
  /** Resolve display title: displayName > task_title > tmux name. */
  getDisplayTitle: (session: Session) => string

  /** True if the session is currently being wrapped up (local optimistic OR server-confirmed). */
  isWrappingUp: (session: Session) => boolean
  /** Seconds since wrapup started, or null if not wrapping up. Uses server timestamp. */
  wrapupAgeSeconds: (session: Session) => number | null

  /** Timestamps of when user last clicked on each session. */
  lastViewed: Record<string, number>
  /** Timestamps of when each session first transitioned from working to non-working. */
  stoppedWorkingAt: Record<string, number>
  /** Returns true if a session finished work and the user hasn't viewed it since. */
  isSessionUnread: (name: string) => boolean
}

/**
 * Extract the project folder name (e.g. "AgentSystem") from a session's working_dir.
 * Working dirs under projects look like: /path/to/vault/projects/AgentSystem/1_2_foo/...
 */
export function extractProjectFromWorkingDir(workingDir?: string, vaultRoot?: string | null): string | null {
  if (!workingDir) return null
  const relative = vaultRoot && workingDir.startsWith(vaultRoot)
    ? workingDir.slice(vaultRoot.length).replace(/^\//, '')
    : workingDir
  if (relative === 'Scratch' || relative.startsWith('Scratch/')) return '__scratch__'
  const match = relative.match(/^projects\/([^/]+)/)
  return match ? match[1] : null
}

/**
 * Extract a task node ID (e.g. "1.2.3.15") from a session's working_dir.
 * Working dirs look like: /path/to/vault/projects/Project/1_2_foo/1_2_3_bar/1_2_3_15_name
 * The last folder segment's leading numeric prefix (digits separated by underscores)
 * is converted to dot-separated task ID.
 */
export function extractTaskIdFromWorkingDir(workingDir?: string, vaultRoot?: string | null): string | null {
  if (!workingDir) return null
  const relative = vaultRoot && workingDir.startsWith(vaultRoot)
    ? workingDir.slice(vaultRoot.length).replace(/^\//, '')
    : workingDir
  // Vault-root scratch (Scratch/<slug>/) — match first
  const vaultScratchMatch = relative.match(/^Scratch\/([^/]+)(?:\/|$)/)
  if (vaultScratchMatch) return `scratch/${vaultScratchMatch[1]}`
  // Project-tree scratch (anywhere): use the LAST /Scratch/<slug>/ segment.
  // Handles project-root and legacy domain-nested uniformly under Option 2.
  const scratchMatches = [...relative.matchAll(/(?:^|\/)Scratch\/([^/]+)(?:\/|$)/g)]
  if (scratchMatches.length > 0) {
    return `scratch/${scratchMatches[scratchMatches.length - 1][1]}`
  }
  const lastSegment = relative.split('/').pop()
  if (!lastSegment) return null
  // New convention: ID-only folder like "1_2_3" (pure digits+underscores)
  if (/^\d+(?:_\d+)*$/.test(lastSegment)) {
    return lastSegment.replace(/_/g, '.')
  }
  // Old convention: slug-based folder like "1_2_3_name"
  const match = lastSegment.match(/^(\d+(?:_\d+)*)_/)
  if (!match) return null
  return match[1].replace(/_/g, '.')
}

/** Returns true for sessions that should never appear in the user-facing panel. */
function isInternalSession(name: string): boolean {
  return name.startsWith('shadow_')
}

function loadPersistedGroups(): Record<string, SessionGroup> {
  try {
    const raw = localStorage.getItem('session-groups')
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

function persistGroups(groups: Record<string, SessionGroup>) {
  try { localStorage.setItem('session-groups', JSON.stringify(groups)) } catch { /* ignore */ }
}

/** Auto-detect parent→child relationships and create groups. */
function autoGroupSessions(
  sessions: Session[],
  existingGroups: Record<string, SessionGroup>,
): Record<string, SessionGroup> {
  const groups = { ...existingGroups }
  const liveNames = new Set(sessions.map(s => s.name))

  // Clean dead sessions from groups, promote anchor if needed
  for (const [id, group] of Object.entries(groups)) {
    group.sessions = group.sessions.filter(n => liveNames.has(n))
    if (group.sessions.length === 0) {
      delete groups[id]
    } else if (!group.sessions.includes(group.anchorSession)) {
      group.anchorSession = group.sessions[0]
    }
  }

  // Find sessions with orchestrator_session (verifiers, workers, chainlinks)
  // Task-agents are always top-level — even if spawned by a concierge, they
  // should not be collapsed under it. Only ephemeral sub-agents get auto-grouped.
  for (const s of sessions) {
    if (!s.orchestrator_session) continue
    if (s.agent_role === 'task-agent') continue
    const parentName = s.orchestrator_session
    if (!liveNames.has(parentName)) continue

    // Check if child is already in a group
    const childGroup = Object.values(groups).find(g => g.sessions.includes(s.name))
    if (childGroup) continue

    // Check if parent is already in a group
    const parentGroup = Object.values(groups).find(g => g.sessions.includes(parentName))
    if (parentGroup) {
      parentGroup.sessions.push(s.name)
    } else {
      groups[parentName] = {
        id: parentName,
        sessions: [parentName, s.name],
        anchorSession: parentName,
      }
    }
  }

  // Auto-group shadow sessions under their parent (forward: parent has shadow_session field)
  for (const s of sessions) {
    if (!s.shadow_session) continue
    const shadowName = s.shadow_session
    if (!liveNames.has(shadowName)) continue

    const shadowGroup = Object.values(groups).find(g => g.sessions.includes(shadowName))
    if (shadowGroup) continue

    const parentGroup = Object.values(groups).find(g => g.sessions.includes(s.name))
    if (parentGroup) {
      parentGroup.sessions.push(shadowName)
    } else {
      groups[s.name] = {
        id: s.name,
        sessions: [s.name, shadowName],
        anchorSession: s.name,
      }
    }
  }

  // Reverse lookup: shadow-named sessions that weren't grouped above
  for (const s of sessions) {
    if (!s.name.startsWith('shadow_')) continue
    const alreadyGrouped = Object.values(groups).find(g => g.sessions.includes(s.name))
    if (alreadyGrouped) continue

    // Find the parent whose shadow_session field matches this session's name
    const parent = sessions.find(p => p.shadow_session === s.name)
    if (!parent) continue

    const parentGroup = Object.values(groups).find(g => g.sessions.includes(parent.name))
    if (parentGroup) {
      parentGroup.sessions.push(s.name)
    } else {
      groups[parent.name] = {
        id: parent.name,
        sessions: [parent.name, s.name],
        anchorSession: parent.name,
      }
    }
  }

  // Auto-group search-agent sessions under the concierge
  const concierge = sessions.find(s => s.name.startsWith('concierge_'))
  if (concierge) {
    for (const s of sessions) {
      if (!s.name.startsWith('search-agent')) continue
      const alreadyGrouped = Object.values(groups).find(g => g.sessions.includes(s.name))
      if (alreadyGrouped) continue

      const conciergeGroup = Object.values(groups).find(g => g.sessions.includes(concierge.name))
      if (conciergeGroup) {
        conciergeGroup.sessions.push(s.name)
      } else {
        groups[concierge.name] = {
          id: concierge.name,
          sessions: [concierge.name, s.name],
          anchorSession: concierge.name,
        }
      }
    }
  }

  return groups
}

const LAST_VIEWED_KEY = 'session-last-viewed'
const STOPPED_WORKING_KEY = 'session-stopped-working'

function loadTimestampMap(key: string): Record<string, number> {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

function persistTimestampMap(key: string, data: Record<string, number>) {
  try { localStorage.setItem(key, JSON.stringify(data)) } catch { /* ignore */ }
}

const DISPLAY_NAMES_KEY = 'session-display-names'

function loadDisplayNames(): Record<string, string> {
  try {
    const raw = localStorage.getItem(DISPLAY_NAMES_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

function persistDisplayNames(names: Record<string, string>) {
  try { localStorage.setItem(DISPLAY_NAMES_KEY, JSON.stringify(names)) } catch { /* ignore */ }
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  sessions: [],
  vaultRoot: null,
  sessionStatuses: {},
  knownNames: null,
  newNames: new Set(),
  wrappingUp: new Set(),
  pastAgentsRevision: 0,
  draftInput: {},
  groups: loadPersistedGroups(),
  displayNames: loadDisplayNames(),
  lastViewed: loadTimestampMap(LAST_VIEWED_KEY),
  stoppedWorkingAt: loadTimestampMap(STOPPED_WORKING_KEY),
  activeSession: (() => {
    try { return localStorage.getItem('agent-active-session') || null } catch { return null }
  })(),
  linkedTaskId: null,
  linkedProjectId: null,

  refreshSessions: async () => {
    if (refreshSessionsInFlight) return refreshSessionsInFlight

    refreshSessionsInFlight = (async () => {
      try {
        const data = await api.fetchSessions()
        const allNames = new Set(data.sessions.map(s => s.name))
        const linkedShadowNames = new Set(
          data.sessions
            .map(s => s.shadow_session)
            .filter((name): name is string => !!name && allNames.has(name))
        )
        // Keep linked shadows so they can group under their parent; hide orphan internals.
        data.sessions = data.sessions.filter(s => !isInternalSession(s.name) || linkedShadowNames.has(s.name))
        // Filter out orphaned sub-agents (verifiers/workers whose parent session is dead)
        const filteredNames = new Set(data.sessions.map(s => s.name))
        data.sessions = data.sessions.filter(s => {
          if (isInternalSession(s.name)) return true         // linked shadows are grouped later
          if (!s.orchestrator_session) return true          // top-level session
          if (s.agent_role === 'task-agent') return true     // task-agents are always shown
          return filteredNames.has(s.orchestrator_session)   // parent must be alive
        })
        const currentNames = new Set(data.sessions.map(s => s.name))
        const prev = get().knownNames
        const newNames = new Set<string>()
        if (prev !== null) {
          for (const name of currentNames) {
            if (!prev.has(name)) newNames.add(name)
          }
        }
        // Detect sessions that disappeared (tmux died) — trigger PM refresh
        // so cards move from "active" to "past" and Resume becomes available.
        let sessionsDisappeared = false
        if (prev !== null) {
          for (const name of prev) {
            if (!currentNames.has(name)) { sessionsDisappeared = true; break }
          }
        }

        const wrappingUp = new Set([...get().wrappingUp].filter(n => currentNames.has(n)))
        const groups = autoGroupSessions(data.sessions, get().groups)
        persistGroups(groups)

        // Track when sessions stop working (for unread indicator)
        const prevSessions = get().sessions
        const stoppedWorkingAt = { ...get().stoppedWorkingAt }
        let stoppedChanged = false
        for (const s of data.sessions) {
          const wasWorking = prevSessions.find(p => p.name === s.name)?.status === 'working'
          const isWorking = s.status === 'working'
          if (wasWorking && !isWorking) {
            stoppedWorkingAt[s.name] = Date.now()
            stoppedChanged = true
          }
          // Clear stoppedWorkingAt if session starts working again (re-activated)
          if (isWorking && stoppedWorkingAt[s.name]) {
            delete stoppedWorkingAt[s.name]
            stoppedChanged = true
          }
        }
        // Prune entries for dead sessions
        const lastViewed = { ...get().lastViewed }
        let viewedChanged = false
        for (const name of Object.keys(stoppedWorkingAt)) {
          if (!currentNames.has(name)) { delete stoppedWorkingAt[name]; stoppedChanged = true }
        }
        for (const name of Object.keys(lastViewed)) {
          if (!currentNames.has(name)) { delete lastViewed[name]; viewedChanged = true }
        }
        if (stoppedChanged) persistTimestampMap(STOPPED_WORKING_KEY, stoppedWorkingAt)
        if (viewedChanged) persistTimestampMap(LAST_VIEWED_KEY, lastViewed)

        const sessionStatuses = Object.fromEntries(
          data.sessions.map(s => [s.name, s.status as SessionStatus]),
        ) as Record<string, SessionStatus>

        set({ sessions: data.sessions, sessionStatuses, knownNames: currentNames, newNames, wrappingUp, groups, vaultRoot: data.vault_root ?? get().vaultRoot,
          ...(sessionsDisappeared ? { pastAgentsRevision: get().pastAgentsRevision + 1 } : {}),
          ...(stoppedChanged ? { stoppedWorkingAt } : {}),
          ...(viewedChanged ? { lastViewed } : {}),
        })
        if (newNames.size > 0) {
          setTimeout(() => set({ newNames: new Set() }), 10000)
        }

        // Clean up stale workspace entries for dead sessions (dynamic import avoids circular dep)
        import('@/stores/workspace-store.ts').then(({ pruneWorkspaces }) => {
          pruneWorkspaces([...currentNames])
        }).catch(() => {})

        // Refresh PM children data when sessions disappear so card displays update
        if (sessionsDisappeared) {
          const { usePMStore } = await import('./pm-store.ts')
          usePMStore.getState().silentRefreshCurrentNode()
        }

        // Reactively update linkedTaskId/linkedProjectId for the active session.
        // On page reload, activeSession is restored from localStorage but linkedTaskId
        // is null until sessions are fetched. Also handles the case where task_id
        // becomes available after init_task_mode is called (a few seconds after spawn).
        const { activeSession, linkedTaskId } = get()
        if (activeSession) {
          const session = data.sessions.find(s => s.name === activeSession)
          if (session) {
            const newTaskId = session.task_id
              || extractTaskIdFromWorkingDir(session.working_dir, data.vault_root ?? get().vaultRoot)
            const newProjectId = extractProjectFromWorkingDir(session.working_dir, data.vault_root ?? get().vaultRoot)
            if (newTaskId !== linkedTaskId || newProjectId !== get().linkedProjectId) {
              set({ linkedTaskId: newTaskId, linkedProjectId: newProjectId })
            }
          } else if (!currentNames.has(activeSession)) {
            // Active session no longer exists — clear linkage
            set({ activeSession: null, linkedTaskId: null, linkedProjectId: null })
          }
        }
      } catch (err) {
        console.error('Failed to fetch sessions:', err)
      } finally {
        refreshSessionsInFlight = null
      }
    })()

    return refreshSessionsInFlight
  },

  setSessionStatus: (name, status) => {
    set({
      sessionStatuses: { ...get().sessionStatuses, [name]: status },
    })
  },

  clearNewName: (name) => {
    set({ newNames: new Set([...get().newNames].filter(n => n !== name)) })
  },

  setSessionTurns: (name, turns) => {
    set({
      sessions: get().sessions.map(s =>
        s.name === name ? { ...s, turns } : s
      ),
    })
  },

  setDraftInput: (session, text) => {
    set({ draftInput: { ...get().draftInput, [session]: text } })
  },

  doKillSession: async (name) => {
    set({ wrappingUp: new Set([...get().wrappingUp, name]) })
    try {
      await api.wrapupSession(name)
    } catch (err) {
      console.error('Wrapup failed:', err)
      const remaining = new Set([...get().wrappingUp])
      remaining.delete(name)
      set({ wrappingUp: remaining })
    }
  },

  doCreateSession: async (prompt, model, runtime) => {
    try {
      const data = await api.createSession(prompt, model, runtime)
      await get().refreshSessions()
      return data.session_name
    } catch (err) {
      console.error('Failed to create session:', err)
      return null
    }
  },

  setActiveSession: (name) => {
    if (name === get().activeSession) return
    const session = name ? get().sessions.find(s => s.name === name) : null
    const taskId = session
      ? (session.task_id || extractTaskIdFromWorkingDir(session.working_dir, get().vaultRoot))
      : null
    const projectId = session ? extractProjectFromWorkingDir(session.working_dir, get().vaultRoot) : null
    // Mark session as viewed (for unread indicator)
    const lastViewed = name ? { ...get().lastViewed, [name]: Date.now() } : get().lastViewed
    if (name) persistTimestampMap(LAST_VIEWED_KEY, lastViewed)
    set({ activeSession: name, linkedTaskId: taskId, linkedProjectId: projectId, lastViewed })
    try { localStorage.setItem('agent-active-session', name ?? '') } catch { /* ignore */ }
    // If the session isn't in the list yet (just spawned), refresh immediately
    // so the sidebar picks it up without waiting for the next 10s poll.
    if (name && !session) {
      void get().refreshSessions()
    }
  },

  getGroupForSession: (name) => {
    if (!name) return null
    return Object.values(get().groups).find(g => g.sessions.includes(name)) ?? null
  },

  createGroup: (anchor, dragged) => {
    const anchorGroup = get().getGroupForSession(anchor)
    const draggedGroup = get().getGroupForSession(dragged)

    // Both already in the same group — nothing to do
    if (anchorGroup && draggedGroup && anchorGroup.id === draggedGroup.id) return

    // Both in different groups — merge into anchor's group
    if (anchorGroup && draggedGroup) {
      const mergedSessions = [...new Set([...anchorGroup.sessions, ...draggedGroup.sessions])]
      const groups = { ...get().groups }
      delete groups[draggedGroup.id]
      groups[anchorGroup.id] = { ...anchorGroup, sessions: mergedSessions }
      persistGroups(groups)
      set({ groups })
      return
    }

    // Anchor is in a group — add dragged to it
    if (anchorGroup) {
      get().addToGroup(anchorGroup.id, dragged)
      return
    }

    // Dragged is in a group — absorb into new group with anchor as anchor
    if (draggedGroup) {
      const sessions = [anchor, ...draggedGroup.sessions.filter(n => n !== anchor)]
      const groups = { ...get().groups }
      delete groups[draggedGroup.id]
      groups[anchor] = { id: anchor, sessions, anchorSession: anchor }
      persistGroups(groups)
      set({ groups })
      return
    }

    // Neither in a group — create new
    const groups = {
      ...get().groups,
      [anchor]: { id: anchor, sessions: [anchor, dragged], anchorSession: anchor },
    }
    persistGroups(groups)
    set({ groups })
  },

  addToGroup: (groupId, sessionName) => {
    const groups = { ...get().groups }
    const group = groups[groupId]
    if (!group || group.sessions.includes(sessionName)) return
    groups[groupId] = { ...group, sessions: [...group.sessions, sessionName] }
    persistGroups(groups)
    set({ groups })
  },

  setDisplayName: (sessionName, displayName) => {
    // Optimistic local update — UI reacts immediately
    const names = { ...get().displayNames }
    if (displayName) {
      names[sessionName] = displayName
    } else {
      delete names[sessionName]
    }
    persistDisplayNames(names)
    set({ displayNames: names })

    // Also update the session row so getDisplayTitle resolves correctly after
    // localStorage is cleared (the server value takes over in step 2).
    const sessions = get().sessions.map((s) =>
      s.name === sessionName ? { ...s, display_name: displayName || null } : s,
    )
    set({ sessions })

    // Persist to backend (best-effort — local override wins if this fails)
    api.setSessionDisplayName(sessionName, displayName).catch((err) => {
      console.warn('setSessionDisplayName failed (local override kept):', err)
    })
  },

  getDisplayTitle: (session) => {
    return (
      get().displayNames[session.name] ||
      session.display_name ||
      session.task_title ||
      session.name
    )
  },

  isWrappingUp: (session) => {
    return get().wrappingUp.has(session.name) || !!session.wrapup_started_at
  },

  wrapupAgeSeconds: (session) => {
    if (!session.wrapup_started_at) return null
    const ms = Date.now() - Date.parse(session.wrapup_started_at)
    if (Number.isNaN(ms)) return null
    return Math.max(0, Math.floor(ms / 1000))
  },

  isSessionUnread: (name) => {
    const { stoppedWorkingAt, lastViewed, activeSession } = get()
    // Active session is never unread (user is looking at it)
    if (name === activeSession) return false
    const stoppedAt = stoppedWorkingAt[name]
    if (!stoppedAt) return false
    const viewedAt = lastViewed[name] || 0
    return stoppedAt > viewedAt
  },
}))
