/**
 * ui-events-store
 *
 * Subscribes to /api/ui/events (SSE) and dispatches agent-originated UI
 * commands to the right zustand store:
 *
 *   open_file    → useTabStore.openDocTab
 *   open_session → useSessionStore.setActiveSession
 *   open_pm_task → usePMStore.goToTaskTarget
 *
 * Mounted once from App.tsx. One connection per tab; the server fans out
 * to every connected tab, so any tab the user has open can receive the
 * command.
 */

import * as api from '@/lib/api.ts'
import { useTabStore } from '@/stores/tab-store.ts'
import { useSessionStore } from '@/stores/session-store.ts'
import { usePMStore } from '@/stores/pm-store.ts'

type UICommand =
  | { type: 'ui_command'; verb: 'show_file'; payload: { path: string; focus?: boolean; panel_hint?: string | null } }
  | { type: 'ui_command'; verb: 'open_session'; payload: { name: string } }
  | { type: 'ui_command'; verb: 'open_pm_task'; payload: { project: string; task_id: string; tab?: 'plan' | 'log' | null } }
  | { type: 'ui_ready' }

let _es: EventSource | null = null
let _retryTimer: number | null = null
let _retryDelay = 1000

function _handleEvent(data: UICommand) {
  if (data.type === 'ui_ready') return
  if (data.type !== 'ui_command') return

  try {
    switch (data.verb) {
      case 'show_file': {
        const { path } = data.payload
        if (path) void useTabStore.getState().openDocTab(path, false)
        break
      }
      case 'open_session': {
        const { name } = data.payload
        if (name) useSessionStore.getState().setActiveSession(name)
        break
      }
      case 'open_pm_task': {
        const { project, task_id, tab } = data.payload
        if (project && task_id) {
          const preferredTab = tab === 'plan' || tab === 'log' ? tab : undefined
          void usePMStore.getState().goToTaskTarget(project, task_id, preferredTab)
        }
        break
      }
      default: {
        // eslint-disable-next-line no-console
        console.warn('[ui-events] unknown verb', data)
      }
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[ui-events] handler failed', e, data)
  }
}

export function connectUIEvents() {
  if (_es) return
  const token = api.getAuthToken()
  const params = new URLSearchParams()
  if (token) params.set('token', token)
  const url = `/api/ui/events${params.toString() ? `?${params.toString()}` : ''}`

  const es = new EventSource(url)
  _es = es

  es.onopen = () => { _retryDelay = 1000 }

  es.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data) as UICommand
      _handleEvent(data)
    } catch {
      /* ignore parse errors */
    }
  }

  es.onerror = () => {
    try { es.close() } catch { /* ignore */ }
    _es = null
    if (_retryTimer) window.clearTimeout(_retryTimer)
    const delay = _retryDelay
    _retryDelay = Math.min(_retryDelay * 2, 30000)
    _retryTimer = window.setTimeout(() => {
      _retryTimer = null
      connectUIEvents()
    }, delay)
  }
}

export function disconnectUIEvents() {
  if (_retryTimer) {
    window.clearTimeout(_retryTimer)
    _retryTimer = null
  }
  if (_es) {
    try { _es.close() } catch { /* ignore */ }
    _es = null
  }
}
