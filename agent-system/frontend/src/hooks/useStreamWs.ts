import { useEffect, useRef } from 'react'
import { useChatStore } from '@/stores/chat-store.ts'
import { useSessionStore } from '@/stores/session-store.ts'
import { streamWsUrl } from '@/lib/api.ts'
import type { WsPayload, SessionStatus } from '@/lib/types.ts'

const MAX_RECONNECT = 8
const RECONNECT_BASE_MS = 500  // start at 500ms, double each attempt (capped at 4s)

export function useStreamWebSocket(sessionName: string | null) {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectRef = useRef(0)
  const cursorRef = useRef<string | null>(null)

  // Read per-session cursor
  const cursor = useChatStore(s => sessionName ? (s.sessions[sessionName]?.cursor ?? null) : null)
  cursorRef.current = cursor

  const setSessionStatus = useSessionStore(s => s.setSessionStatus)
  const setSessionTurns = useSessionStore(s => s.setSessionTurns)
  const refreshSessions = useSessionStore(s => s.refreshSessions)

  useEffect(() => {
    if (!sessionName) return

    // Ensure session exists in chat store
    useChatStore.getState().ensureSession(sessionName)

    const connect = () => {
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }

      const url = streamWsUrl(sessionName, cursorRef.current)
      const ws = new WebSocket(url)
      wsRef.current = ws

      ws.onopen = () => {
        reconnectRef.current = 0
      }

      ws.onmessage = (event) => {
        try {
          const data: WsPayload = JSON.parse(event.data)
          const store = useChatStore.getState()

          if (data.type === 'messages' && data.messages) {
            store.addMessages(sessionName, data.messages, data.last_uuid)
            if (data.model) store.setModel(sessionName, data.model)
          }

          if (data.type === 'status') {
            const status = data.status === 'running' ? 'working' : data.status as SessionStatus
            setSessionStatus(sessionName, status)
            if (data.turns != null) {
              setSessionTurns(sessionName, data.turns)
            }
            if (data.model) store.setModel(sessionName, data.model)
            if (data.total_usage) {
              store.updateTokens(sessionName, data.total_usage.input_tokens, data.total_usage.output_tokens)
            }
          }

          if (data.type === 'conversation_reset') {
            store.clearSession(sessionName)
            cursorRef.current = null
            store.setHeaderInfo(sessionName, 'Context compressed — reloading...')
            store.loadHistory(sessionName)
            refreshSessions()
          }

          if (data.type === 'session_ended') {
            store.setHeaderInfo(sessionName, 'Session ended')
            setSessionStatus(sessionName, 'ended')
          }
        } catch { /* ignore parse errors */ }
      }

      ws.onclose = (event) => {
        if (wsRef.current !== ws) return
        const store = useChatStore.getState()
        if (event.code === 1008) {
          store.setHeaderInfo(sessionName, event.reason || 'Session not available')
          return
        }
        reconnectRef.current++
        if (reconnectRef.current <= MAX_RECONNECT) {
          const delay = Math.min(RECONNECT_BASE_MS * Math.pow(2, reconnectRef.current - 1), 4000)
          store.setHeaderInfo(sessionName, `Reconnecting... (${reconnectRef.current}/${MAX_RECONNECT})`)
          setTimeout(connect, delay)
        } else {
          store.setHeaderInfo(sessionName, 'Connection lost')
        }
      }
    }

    connect()

    return () => {
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionName])
}
