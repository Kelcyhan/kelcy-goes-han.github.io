import { useEffect, useRef, useCallback, useState } from 'react'
import { browserScreencastWsUrl } from '@/lib/api.ts'
import { useSessionStore } from '@/stores/session-store.ts'
import * as api from '@/lib/api.ts'
import { Button } from '@/components/ui/button.tsx'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog.tsx'
import { Lock, Globe, RotateCcw, Settings } from 'lucide-react'

const VIEWPORT_W = 1280
const VIEWPORT_H = 720

export function BrowserView() {
  const activeSession = useSessionStore(s => s.activeSession)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mountedRef = useRef(true)
  const statusRef = useRef<HTMLDivElement>(null)
  const canvasSizeRef = useRef({ w: 0, h: 0 })
  const urlInputRef = useRef<HTMLInputElement>(null)
  const [url, setUrl] = useState('')
  const [editingUrl, setEditingUrl] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsPath, setSettingsPath] = useState('State/user/browser-agent-note.md')
  const [maxChars, setMaxChars] = useState(1500)
  const [note, setNote] = useState('')
  const [settingsStatus, setSettingsStatus] = useState('')
  const [saving, setSaving] = useState(false)
  // Init flow: when the session has no BrowserContext yet, show a prompt
  // with an "Initialize browser" button. After click, poll /api/browser/state
  // until the agent has allocated the context (then we reconnect the WS).
  const [needsInit, setNeedsInit] = useState(false)
  const [initInFlight, setInitInFlight] = useState(false)
  const [initError, setInitError] = useState<string | null>(null)
  const initPollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const setStatus = (msg: string) => {
    if (statusRef.current) statusRef.current.textContent = msg
  }

  const send = useCallback((data: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data))
    }
  }, [])

  // Track terminal status to suppress the auto-reconnect loop when the server
  // told us the agent is unmapped or no session was provided. Reconnecting
  // would just hammer the same answer.
  const terminalRef = useRef(false)

  const connect = useCallback((sessionName: string | null) => {
    if (!mountedRef.current) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctxRef.current = ctx

    if (!sessionName) {
      setStatus('No agent selected — pick one in the session rail')
      return
    }

    terminalRef.current = false
    setStatus('Connecting…')

    const ws = new WebSocket(browserScreencastWsUrl(sessionName))
    wsRef.current = ws

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data as string)

      if (msg.type === 'status') {
        if (msg.status === 'connected') {
          setStatus('')
          setNeedsInit(false)
          setInitError(null)
        } else if (msg.status === 'no_browser') {
          setStatus('Browser not running — start an agent that uses browser tools')
        } else if (msg.status === 'no_page') {
          setStatus('No active page — waiting…')
        } else if (msg.status === 'session_required') {
          terminalRef.current = true
          setStatus(msg.message || 'Agent session required to route the live view')
        } else if (msg.status === 'unmapped') {
          terminalRef.current = true
          setStatus('')
          setNeedsInit(true)
        }
        return
      }

      if (msg.type === 'nav') {
        setUrl(msg.url as string)
        return
      }

      if (msg.type === 'frame') {
        const c = canvasRef.current
        const ctx2 = ctxRef.current
        if (!c || !ctx2) return

        // Only resize canvas when dimensions actually change (avoids clearing every frame)
        const dpr = devicePixelRatio
        const newW = Math.floor(c.offsetWidth * dpr)
        const newH = Math.floor(c.offsetHeight * dpr)
        if (canvasSizeRef.current.w !== newW || canvasSizeRef.current.h !== newH) {
          c.width = newW
          c.height = newH
          canvasSizeRef.current = { w: newW, h: newH }
        }

        // createImageBitmap decodes off the main thread — faster than new Image()
        const b64 = msg.data as string
        const binary = atob(b64)
        const bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
        createImageBitmap(new Blob([bytes], { type: 'image/jpeg' })).then(bmp => {
          ctx2.drawImage(bmp, 0, 0, c.width, c.height)
          bmp.close()
        })
      }
    }

    ws.onclose = () => {
      if (!mountedRef.current) return
      // Don't reconnect into the same terminal error.
      if (terminalRef.current) return
      setStatus('Reconnecting…')
      reconnectRef.current = setTimeout(() => connect(sessionName), 2000)
    }

    ws.onerror = () => { ws.close() }
  }, [])

  // Reconnect whenever the focused agent changes.
  useEffect(() => {
    mountedRef.current = true
    if (reconnectRef.current) {
      clearTimeout(reconnectRef.current)
      reconnectRef.current = null
    }
    if (initPollRef.current) {
      clearInterval(initPollRef.current)
      initPollRef.current = null
    }
    if (wsRef.current) {
      try { wsRef.current.close() } catch { /* noop */ }
      wsRef.current = null
    }
    setNeedsInit(false)
    setInitInFlight(false)
    setInitError(null)
    connect(activeSession ?? null)
    return () => {
      mountedRef.current = false
      if (reconnectRef.current) clearTimeout(reconnectRef.current)
      if (initPollRef.current) clearInterval(initPollRef.current)
      wsRef.current?.close()
    }
  }, [connect, activeSession])

  const handleInit = useCallback(async () => {
    if (!activeSession || initInFlight) return
    setInitInFlight(true)
    setInitError(null)
    try {
      const res = await api.initBrowser(activeSession)
      if (res.state === 'ready') {
        // Context already exists — reconnect WS to attach.
        setNeedsInit(false)
        terminalRef.current = false
        connect(activeSession)
        setInitInFlight(false)
        return
      }
      // Poll state until ready, with a 30s ceiling matching expect_next TTL.
      const deadline = Date.now() + 30000
      if (initPollRef.current) clearInterval(initPollRef.current)
      initPollRef.current = setInterval(async () => {
        if (!mountedRef.current || !activeSession) return
        if (Date.now() > deadline) {
          if (initPollRef.current) clearInterval(initPollRef.current)
          initPollRef.current = null
          setInitInFlight(false)
          setInitError('Agent did not allocate browser within 30s. They may be busy — try again.')
          return
        }
        try {
          const state = await api.getBrowserState(activeSession)
          if (state.state === 'ready') {
            if (initPollRef.current) clearInterval(initPollRef.current)
            initPollRef.current = null
            setNeedsInit(false)
            setInitInFlight(false)
            terminalRef.current = false
            // Reconnect the screencast WS to attach to the new context.
            if (wsRef.current) {
              try { wsRef.current.close() } catch { /* noop */ }
              wsRef.current = null
            }
            connect(activeSession)
          }
        } catch (err: any) {
          // Transient error — keep polling, surface to UI on final timeout.
          console.warn('getBrowserState failed:', err?.message || err)
        }
      }, 1000)
    } catch (err: any) {
      setInitError(err?.message || 'Failed to initialize browser.')
      setInitInFlight(false)
    }
  }, [activeSession, initInFlight, connect])

  // Tell the server when this tab becomes hidden/visible so it can throttle
  // the screencast frame rate down to ~1 fps when nobody is watching.
  useEffect(() => {
    const onVis = () => send({ type: 'visibility', hidden: document.hidden })
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [send])

  // Scale canvas coordinates → Chrome viewport coordinates
  const toViewport = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    return {
      x: ((e.clientX - rect.left) / rect.width) * VIEWPORT_W,
      y: ((e.clientY - rect.top) / rect.height) * VIEWPORT_H,
    }
  }

  const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = toViewport(e)
    send({ type: 'mouse', params: { type: 'mouseMoved', x, y, button: 'none', clickCount: 0, modifiers: 0 } })
  }

  const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.currentTarget.focus()
    const { x, y } = toViewport(e)
    const button = e.button === 2 ? 'right' : e.button === 1 ? 'middle' : 'left'
    send({ type: 'mouse', params: { type: 'mousePressed', x, y, button, clickCount: 1, modifiers: 0 } })
  }

  const onMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = toViewport(e)
    const button = e.button === 2 ? 'right' : e.button === 1 ? 'middle' : 'left'
    send({ type: 'mouse', params: { type: 'mouseReleased', x, y, button, clickCount: 1, modifiers: 0 } })
  }

  const onWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    const { x, y } = toViewport(e)
    send({ type: 'wheel', params: { x, y, deltaX: e.deltaX, deltaY: e.deltaY, modifiers: 0 } })
  }

  const onContextMenu = (e: React.MouseEvent) => e.preventDefault()

  const modifiers = (e: React.KeyboardEvent) =>
    (e.altKey ? 1 : 0) | (e.ctrlKey ? 2 : 0) | (e.metaKey ? 4 : 0) | (e.shiftKey ? 8 : 0)

  const onKeyDown = (e: React.KeyboardEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    const mods = modifiers(e)
    send({ type: 'key', params: { type: 'keyDown', key: e.key, code: e.code, modifiers: mods } })
    if (e.key.length === 1) {
      send({ type: 'key', params: { type: 'char', key: e.key, code: e.code, text: e.key, modifiers: mods } })
    }
  }

  const onKeyUp = (e: React.KeyboardEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    send({ type: 'key', params: { type: 'keyUp', key: e.key, code: e.code, modifiers: modifiers(e) } })
  }

  const navigateTo = (target: string) => {
    let nav = target.trim()
    if (!nav) return
    if (!nav.startsWith('http://') && !nav.startsWith('https://')) nav = 'https://' + nav
    send({ type: 'navigate', url: nav })
    setUrl(nav)
    setIsFocused(false)
    canvasRef.current?.focus()
  }

  const isHttps = url.startsWith('https://')

  const loadSettings = useCallback(async () => {
    setSettingsStatus('')
    try {
      const settings = await api.fetchBrowserSettings()
      setNote(settings.note)
      setSettingsPath(settings.path)
      setMaxChars(settings.max_chars)
    } catch (err: any) {
      setSettingsStatus(err?.message || 'Failed to load browser settings.')
    }
  }, [])

  const openSettings = () => {
    setSettingsOpen(true)
    void loadSettings()
  }

  const saveSettings = async () => {
    setSaving(true)
    setSettingsStatus('')
    try {
      const settings = await api.saveBrowserSettings(note)
      setNote(settings.note)
      setSettingsPath(settings.path)
      setMaxChars(settings.max_chars)
      setSettingsStatus('Saved.')
      return settings
    } catch (err: any) {
      setSettingsStatus(err?.message || 'Failed to save browser settings.')
      return null
    } finally {
      setSaving(false)
    }
  }

  const sendToCurrentAgent = async () => {
    if (!activeSession) {
      setSettingsStatus('No active agent session.')
      return
    }
    setSaving(true)
    setSettingsStatus('')
    try {
      const settings = await api.saveBrowserSettings(note)
      setNote(settings.note)
      setSettingsPath(settings.path)
      setMaxChars(settings.max_chars)
      const trimmed = settings.note.trim()
      if (!trimmed) {
        setSettingsStatus('Saved empty note; nothing sent.')
        return
      }
      await api.sendMessage(
        activeSession,
        `[System] Updated browser note from user:\nIf you use Playwright/browser tools, keep this note in mind. Do not copy secrets from this note into task files, worklogs, screenshots, or final responses.\n${trimmed}`,
        { method: 'inbox' },
      )
      setSettingsStatus(`Saved and queued for ${activeSession}.`)
    } catch (err: any) {
      setSettingsStatus(err?.message || 'Failed to send browser note.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ position: 'absolute', inset: 0, background: '#111', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Address bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px',
        background: '#1a1a1a', borderBottom: '1px solid #2a2a2a', flexShrink: 0,
      }}>
        <button
          title="Reload"
          onClick={() => send({ type: 'navigate', url })}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#666', padding: '2px 4px', borderRadius: 3, lineHeight: 1 }}
          onMouseOver={e => (e.currentTarget.style.color = '#aaa')}
          onMouseOut={e => (e.currentTarget.style.color = '#666')}
        >
          <RotateCcw size={13} />
        </button>
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', gap: 5,
          background: '#111', border: '1px solid', borderColor: isFocused ? '#444' : '#2a2a2a',
          borderRadius: 6, padding: '3px 8px', cursor: 'text',
        }} onClick={() => { setEditingUrl(url); setIsFocused(true); setTimeout(() => urlInputRef.current?.select(), 0) }}>
          {isHttps
            ? <Lock size={11} color="#4ade80" style={{ flexShrink: 0 }} />
            : <Globe size={11} color="#666" style={{ flexShrink: 0 }} />
          }
          {isFocused ? (
            <input
              ref={urlInputRef}
              autoFocus
              value={editingUrl}
              onChange={e => setEditingUrl(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') navigateTo(editingUrl)
                if (e.key === 'Escape') { setIsFocused(false); canvasRef.current?.focus() }
              }}
              onBlur={() => setIsFocused(false)}
              style={{
                background: 'none', border: 'none', outline: 'none', flex: 1,
                color: '#ddd', fontSize: 'var(--type-label-size)', lineHeight: 'var(--type-label-line)', fontFamily: 'var(--font-sans)',
              }}
            />
          ) : (
            <span style={{
              flex: 1, fontSize: 'var(--type-label-size)', lineHeight: 'var(--type-label-line)', fontFamily: 'var(--font-sans)',
              color: url ? '#aaa' : '#555', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              userSelect: 'none',
            }}>
              {url || 'No page'}
            </span>
          )}
        </div>
        <button
          title="Browser settings"
          onClick={openSettings}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#666', padding: '2px 4px', borderRadius: 3, lineHeight: 1 }}
          onMouseOver={e => (e.currentTarget.style.color = '#aaa')}
          onMouseOut={e => (e.currentTarget.style.color = '#666')}
        >
          <Settings size={13} />
        </button>
      </div>

      {/* Canvas */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <canvas
          ref={canvasRef}
          tabIndex={0}
          style={{ width: '100%', height: '100%', display: 'block', cursor: 'default', outline: 'none' }}
          onMouseMove={onMouseMove}
          onMouseDown={onMouseDown}
          onMouseUp={onMouseUp}
          onWheel={onWheel}
          onContextMenu={onContextMenu}
          onKeyDown={onKeyDown}
          onKeyUp={onKeyUp}
        />
        <div
          ref={statusRef}
          style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            color: '#888', fontFamily: 'var(--font-sans)', fontSize: 'var(--type-body-sm-size)', lineHeight: 'var(--type-body-sm-line)',
            pointerEvents: 'none', textAlign: 'center',
          }}
        />
        {needsInit && (
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
            color: '#bbb', fontFamily: 'var(--font-sans)', fontSize: 'var(--type-body-sm-size)', lineHeight: 'var(--type-body-sm-line)',
            textAlign: 'center', maxWidth: 360,
          }}>
            <div style={{ color: '#888' }}>
              {activeSession
                ? `Browser not initialized for ${activeSession}.`
                : 'No agent selected.'}
            </div>
            <div style={{ color: '#666', fontSize: 'var(--type-label-size)', lineHeight: 'var(--type-label-line)' }}>
              Click to ask the agent to allocate its playwright browser context.
              Once it does, you can navigate, log in, etc. — the agent will
              share state when it next uses browser tools.
            </div>
            <button
              onClick={handleInit}
              disabled={initInFlight || !activeSession}
              style={{
                background: '#2563eb', color: '#fff', border: 'none',
                padding: '8px 16px', borderRadius: 6, fontSize: 'var(--type-body-sm-size)', lineHeight: 'var(--type-body-sm-line)',
                cursor: (initInFlight || !activeSession) ? 'default' : 'pointer',
                opacity: (initInFlight || !activeSession) ? 0.6 : 1,
                fontFamily: 'var(--font-sans)',
              }}
            >
              {initInFlight ? 'Asking agent to initialize…' : 'Initialize browser'}
            </button>
            {initError && (
              <div style={{ color: '#f87171', fontSize: 'var(--type-label-size)', lineHeight: 'var(--type-label-line)', maxWidth: 320 }}>
                {initError}
              </div>
            )}
          </div>
        )}
      </div>
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Browser Settings</DialogTitle>
            <DialogDescription>
              Note shown to new agents when they may use browser tools. Do not store passwords or tokens here unless you explicitly want agents to see them.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <textarea
              value={note}
              onChange={e => setNote(e.target.value.slice(0, maxChars))}
              rows={8}
              className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="Example: Use staging. Ask before account-sensitive actions."
            />
            <div className="type-micro text-muted-foreground flex justify-between gap-3">
              <span>{settingsPath}</span>
              <span>{note.length}/{maxChars}</span>
            </div>
            {settingsStatus && <div className="type-micro text-muted-foreground">{settingsStatus}</div>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSettingsOpen(false)}>Close</Button>
            <Button variant="secondary" onClick={sendToCurrentAgent} disabled={saving || !activeSession}>
              Send to current agent
            </Button>
            <Button onClick={saveSettings} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
