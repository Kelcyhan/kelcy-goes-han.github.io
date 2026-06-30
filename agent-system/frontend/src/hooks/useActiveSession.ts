import { useSessionStore } from '@/stores/session-store.ts'
import type { SessionStatus } from '@/lib/types.ts'

/**
 * Returns the explicitly selected active session and its status.
 * Active session is set by user clicking a session in the sidebar or PM.
 * This is the SINGLE source of truth for "which session is the workspace context".
 */
export function useActiveSession(): { activeSession: string | null; sessionStatus: SessionStatus } {
  const activeSession = useSessionStore(s => s.activeSession)
  const sessionStatus = useSessionStore(s =>
    activeSession ? (s.sessionStatuses[activeSession] ?? 'unknown') : 'unknown'
  )
  return { activeSession, sessionStatus }
}
