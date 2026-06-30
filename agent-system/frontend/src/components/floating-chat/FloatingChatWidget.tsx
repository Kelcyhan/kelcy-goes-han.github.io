import { useState, useRef, useCallback, useEffect, type ComponentType, type CSSProperties } from 'react'
import { X, Minus } from 'lucide-react'
import { ChatContainer } from '@/components/chat/ChatContainer.tsx'
import { InputBar } from '@/components/chat/InputBar.tsx'
import type { InputBarHandle } from '@/components/chat/InputBar.tsx'
import { StatusBar } from '@/components/chat/StatusBar.tsx'
import { useSessionStore } from '@/stores/session-store.ts'
import { useChatStore } from '@/stores/chat-store.ts'
import * as api from '@/lib/api.ts'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog.tsx'
import { Button } from '@/components/ui/button.tsx'
import { registerFloatingChat, minimizeOtherFloatingChats } from './floating-chat-bus.ts'
import { useNewSessionGate } from '@/components/auth/useNewSessionGate.ts'
import { ActionButton, IconButton } from '@/components/primitives'

const FAB_H = 31
const DEFAULT_PANEL_H = 500
const DEFAULT_PANEL_W = 360
const MIN_PANEL_W = 280
const MIN_PANEL_H = 320
const SIDE_MARGIN = 24
const TOP_MARGIN = 12
const GAP = 10

// Claude auth dock: bottom: 12px, left: 12px, ~40px tall (compact)
const AUTH_DOCK_BOTTOM = 12
const AUTH_DOCK_H = 40

export type FloatingChatChip = {
  icon: string
  label: string
  msg: string
  tip: string
}

export type FloatingChatCloseDialog = {
  /** Title in the close-confirmation modal, e.g. 'Close "Helper"?' */
  title: string
  /** Body copy under the title — explain what closing does. */
  description: string
}

export type FloatingChatVariantConfig = {
  /** Stable key — used as the mutual-exclusion bus key and as the FAB data attribute. */
  variant: string
  storageKeys: {
    /** localStorage key for the session_name. Set to null to disable session persistence (always fresh on first open). */
    session: string | null
    /** localStorage key for the FAB position. Always persisted. */
    position: string
    /** localStorage key for the panel size {w,h}. Always persisted. */
    size: string
  }
  /** CSS color value — e.g. 'var(--color-accent)' or 'var(--color-green-deep)'. */
  fabColor: string
  /** Brighter color for hover (e.g. 'var(--color-accent-bright)' or color-mix expression). */
  fabColorHover: string
  Icon: ComponentType<{ size?: number }>
  iconSize?: number
  title: string
  subtitle: string
  chips: ReadonlyArray<FloatingChatChip>
  sessionCreator: () => Promise<{ session_name: string }>
  /** Vertical stacking index in the bottom-left FAB column. 0 = bottommost (above auth dock). */
  stackIndex: number
  ariaLabel: string
  fabTitle: string
  closeTitle?: string
  /** Wording for the X-button confirmation modal. */
  closeDialog: FloatingChatCloseDialog
}

function getInitialPos(posKey: string, stackIndex: number): { x: number; y: number } {
  try {
    const stored = localStorage.getItem(posKey)
    if (stored) {
      const p = JSON.parse(stored)
      if (typeof p.x === 'number' && typeof p.y === 'number') {
        // Re-clamp on load so a position saved on a larger screen doesn't leave
        // the FAB off-screen when the page is opened in a smaller window.
        return clampPos(p.x, p.y)
      }
    }
  } catch { /* ignore */ }
  // Default: FAB sits in the bottom-left stack above the Claude auth dock.
  // stackIndex 0 = directly above auth dock; each higher index adds (FAB_H + GAP).
  const baseY = window.innerHeight - AUTH_DOCK_BOTTOM - AUTH_DOCK_H - GAP - FAB_H
  return {
    x: 12,
    y: baseY - stackIndex * (FAB_H + GAP),
  }
}

function getInitialSize(sizeKey: string, fabY: number): { w: number; h: number } {
  try {
    const stored = localStorage.getItem(sizeKey)
    if (stored) {
      const s = JSON.parse(stored)
      if (typeof s.w === 'number' && typeof s.h === 'number') {
        return clampSize(s.w, s.h, fabY)
      }
    }
  } catch { /* ignore */ }
  return clampSize(DEFAULT_PANEL_W, DEFAULT_PANEL_H, fabY)
}

/** Max height keeps panelTop on-screen given the FAB's current y. */
function clampSize(w: number, h: number, fabY: number): { w: number; h: number } {
  const maxW = Math.max(MIN_PANEL_W, window.innerWidth - SIDE_MARGIN)
  // Panel renders above the FAB at top = fabY - h - GAP. Keep top ≥ TOP_MARGIN.
  const maxH = Math.max(MIN_PANEL_H, fabY - GAP - TOP_MARGIN)
  return {
    w: Math.max(MIN_PANEL_W, Math.min(maxW, w)),
    h: Math.max(MIN_PANEL_H, Math.min(maxH, h)),
  }
}

/** Keeps just the FAB on-screen. The panel may extend off the top when the
 *  user has resized it taller than the viewport allows above the FAB; that's
 *  acceptable — the FAB anchor must always remain grabbable. */
function clampPos(x: number, y: number): { x: number; y: number } {
  return {
    x: Math.max(0, Math.min(window.innerWidth - FAB_H, x)),
    y: Math.max(0, Math.min(window.innerHeight - FAB_H, y)),
  }
}

export function FloatingChatWidget({ config }: { config: FloatingChatVariantConfig }) {
  const {
    variant,
    storageKeys,
    fabColor,
    fabColorHover,
    Icon,
    iconSize = 18,
    title,
    subtitle,
    chips,
    sessionCreator,
    stackIndex,
    ariaLabel,
    fabTitle,
    closeTitle,
    closeDialog,
  } = config

  const [open, setOpen] = useState(false)
  const [sessionName, setSessionName] = useState<string | null>(null)
  const [spawning, setSpawning] = useState(false)
  const [confirmingClose, setConfirmingClose] = useState(false)
  const inputBarRef = useRef<InputBarHandle | null>(null)

  const sessionGate = useNewSessionGate()
  // Only gate spawn-from-cold: an existing chat session should still be openable
  // so the user can read prior messages even after logout.
  const gateNewSpawn = sessionGate.disabled && !sessionName

  const [pos, setPos] = useState(() => getInitialPos(storageKeys.position, stackIndex))
  const posRef = useRef(pos)
  posRef.current = pos

  const [size, setSize] = useState(() => getInitialSize(storageKeys.size, posRef.current.y))
  const sizeRef = useRef(size)
  sizeRef.current = size

  // Deduplicates concurrent ensureSession calls — without this, two rapid FAB
  // taps both see sessionName === null and call sessionCreator(), spawning
  // two backend sessions where only one is tracked in localStorage.
  const pendingRef = useRef<Promise<string> | null>(null)

  // Unread badge: show 1 only when agent has finished and there's a new message
  const msgCount = useChatStore(s =>
    sessionName ? (s.sessions[sessionName]?.messages?.length ?? 0) : 0
  )
  const sessionStatus = useSessionStore(s => s.sessionStatuses[sessionName ?? ''] ?? 'unknown')
  const [seenCount, setSeenCount] = useState(0)
  const hasUnread = msgCount > seenCount && sessionStatus !== 'working'

  const ensureSession = useCallback(async () => {
    if (sessionName) return sessionName
    if (pendingRef.current) return pendingRef.current
    setSpawning(true)
    pendingRef.current = (async () => {
      try {
        // Variants that persist session names try to rehydrate first.
        // Variants with storageKeys.session === null always spawn fresh.
        if (storageKeys.session) {
          const stored = localStorage.getItem(storageKeys.session)
          if (stored) {
            try {
              await api.fetchMessages(stored)
              setSessionName(stored)
              return stored
            } catch {
              localStorage.removeItem(storageKeys.session)
            }
          }
        }
        const { session_name } = await sessionCreator()
        if (storageKeys.session) {
          localStorage.setItem(storageKeys.session, session_name)
        }
        setSessionName(session_name)
        return session_name
      } finally {
        pendingRef.current = null
        setSpawning(false)
      }
    })()
    return pendingRef.current
  }, [sessionName, sessionCreator, storageKeys.session])

  const fillChip = useCallback((text: string) => {
    inputBarRef.current?.restoreText(text)
  }, [])

  const handleMinimize = useCallback(() => {
    setSeenCount(msgCount)
    setOpen(false)
  }, [msgCount])

  const handleOpen = useCallback(async () => {
    minimizeOtherFloatingChats(variant)
    setOpen(true)
    await ensureSession()
    setSeenCount(msgCount)
  }, [ensureSession, msgCount, variant])

  const requestClose = useCallback(() => {
    setConfirmingClose(true)
  }, [])

  const cancelClose = useCallback(() => {
    setConfirmingClose(false)
  }, [])

  const confirmClose = useCallback(() => {
    setConfirmingClose(false)
    setOpen(false)
    setSeenCount(msgCount)
    if (sessionName) {
      api.killSession(sessionName).catch(() => {})
      if (storageKeys.session) localStorage.removeItem(storageKeys.session)
      setSessionName(null)
    }
  }, [sessionName, msgCount, storageKeys.session])

  // Register with the mutual-exclusion bus so peers can minimize this panel.
  useEffect(() => {
    return registerFloatingChat(variant, () => setOpen(false))
  }, [variant])

  // Mark as seen when panel opens
  useEffect(() => {
    if (open) setSeenCount(msgCount)
  }, [open, msgCount])

  // Keep the FAB and panel inside the viewport when the window is resized.
  // Without this, dragging the FAB to a corner on a large screen and then
  // shrinking the window (or changing screen resolution) leaves it stranded
  // off-screen.
  useEffect(() => {
    const onResize = () => {
      const repos = clampPos(posRef.current.x, posRef.current.y)
      if (repos.x !== posRef.current.x || repos.y !== posRef.current.y) {
        posRef.current = repos
        setPos(repos)
        try { localStorage.setItem(storageKeys.position, JSON.stringify(repos)) } catch { /* ignore */ }
      }
      const resz = clampSize(sizeRef.current.w, sizeRef.current.h, posRef.current.y)
      if (resz.w !== sizeRef.current.w || resz.h !== sizeRef.current.h) {
        sizeRef.current = resz
        setSize(resz)
        try { localStorage.setItem(storageKeys.size, JSON.stringify(resz)) } catch { /* ignore */ }
      }
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [storageKeys.position, storageKeys.size])

  // ── Drag handling (FAB position) ───────────────────────────────────────
  const startDrag = useCallback((clientX: number, clientY: number) => {
    const orig = { ...posRef.current }
    const onMove = (ev: PointerEvent) => {
      const newPos = clampPos(
        orig.x + ev.clientX - clientX,
        orig.y + ev.clientY - clientY,
      )
      setPos(newPos)
      posRef.current = newPos
    }
    const onUp = () => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
      try { localStorage.setItem(storageKeys.position, JSON.stringify(posRef.current)) } catch { /* ignore */ }
    }
    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
  }, [storageKeys.position])

  const onHeaderDragStart = useCallback((e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return
    e.preventDefault()
    startDrag(e.clientX, e.clientY)
  }, [startDrag])

  const onFabDragStart = useCallback((e: React.PointerEvent) => {
    // Only drag if pointer moves — distinguish from click via a small threshold
    const startX = e.clientX
    const startY = e.clientY
    let moved = false
    const orig = { ...posRef.current }
    const onMove = (ev: PointerEvent) => {
      if (!moved && Math.hypot(ev.clientX - startX, ev.clientY - startY) < 4) return
      moved = true
      const newPos = clampPos(
        orig.x + ev.clientX - startX,
        orig.y + ev.clientY - startY,
      )
      setPos(newPos)
      posRef.current = newPos
    }
    const onUp = () => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
      if (moved) {
        try { localStorage.setItem(storageKeys.position, JSON.stringify(posRef.current)) } catch { /* ignore */ }
      }
    }
    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
  }, [storageKeys.position])

  // ── Resize handling (panel size, FAB-anchored) ─────────────────────────
  // 'top'    → drag up grows height; FAB stays put, panel top moves up.
  // 'right'  → drag right grows width; left edge stays at pos.x.
  // 'corner' → top-right; both at once.
  const startResize = useCallback(
    (e: React.PointerEvent, edge: 'top' | 'right' | 'corner') => {
      e.preventDefault()
      e.stopPropagation()
      const startX = e.clientX
      const startY = e.clientY
      const orig = { ...sizeRef.current }
      const onMove = (ev: PointerEvent) => {
        const dx = ev.clientX - startX
        const dy = ev.clientY - startY
        let nextW = orig.w
        let nextH = orig.h
        if (edge === 'right' || edge === 'corner') nextW = orig.w + dx
        if (edge === 'top' || edge === 'corner') nextH = orig.h - dy
        const next = clampSize(nextW, nextH, posRef.current.y)
        setSize(next)
        sizeRef.current = next
      }
      const onUp = () => {
        document.removeEventListener('pointermove', onMove)
        document.removeEventListener('pointerup', onUp)
        try { localStorage.setItem(storageKeys.size, JSON.stringify(sizeRef.current)) } catch { /* ignore */ }
        // Re-clamp the FAB position in case the window changed during resize
        const repos = clampPos(posRef.current.x, posRef.current.y)
        if (repos.x !== posRef.current.x || repos.y !== posRef.current.y) {
          setPos(repos)
          posRef.current = repos
          try { localStorage.setItem(storageKeys.position, JSON.stringify(repos)) } catch { /* ignore */ }
        }
      }
      document.addEventListener('pointermove', onMove)
      document.addEventListener('pointerup', onUp)
    },
    [storageKeys.size, storageKeys.position],
  )

  // Panel renders above the FAB; compute its top from current height
  const fabTop = pos.y
  const panelTop = pos.y - size.h - GAP

  // Drives the FAB background in CSS — see .helper-fab in overrides.css
  const fabStyle = {
    position: 'fixed',
    left: pos.x,
    top: fabTop,
    zIndex: 45,
    '--fab-color': fabColor,
    '--fab-color-hover': fabColorHover,
  } as CSSProperties

  return (
    <>
      {/* Keep panel mounted once session exists so WS stays alive and chat is cached */}
      {sessionName && (
        <div
          className="helper-panel"
          data-floating-chat-variant={variant}
          style={{
            position: 'fixed',
            left: pos.x,
            top: panelTop,
            width: size.w,
            height: size.h,
            zIndex: 45,
            display: open ? 'flex' : 'none',
          }}
        >
          {/* Resize handles — top edge, right edge, top-right corner.
              Bottom and left are anchored to the FAB so resize is naturally one-sided. */}
          <div
            className="floating-chat-resize-handle floating-chat-resize-top"
            onPointerDown={e => startResize(e, 'top')}
            aria-hidden="true"
          />
          <div
            className="floating-chat-resize-handle floating-chat-resize-right"
            onPointerDown={e => startResize(e, 'right')}
            aria-hidden="true"
          />
          <div
            className="floating-chat-resize-handle floating-chat-resize-corner"
            onPointerDown={e => startResize(e, 'corner')}
            aria-hidden="true"
          />

          <div className="helper-header" style={{ cursor: 'grab' }} onPointerDown={onHeaderDragStart}>
            <div className="helper-header-left">
              <span className="helper-title">
                <Icon size={13} />
                {title}
              </span>
              <span className="helper-subtitle">{subtitle}</span>
            </div>
            <div className="helper-header-actions" onPointerDown={e => e.stopPropagation()}>
              <IconButton variant="appShell" size="xs" onClick={handleMinimize} title="Minimize">
                <Minus size={13} />
              </IconButton>
              <IconButton
                variant="appShell"
                size="xs"
                onClick={requestClose}
                title={closeTitle ?? 'Close — ends session, opens fresh next time'}
              >
                <X size={13} />
              </IconButton>
            </div>
          </div>

          <div className="helper-body">
            {spawning ? (
              <div className="helper-loading">Starting {title.toLowerCase()}…</div>
            ) : (
              <ChatContainer sessionName={sessionName} inputBarRef={inputBarRef} />
            )}
          </div>

          {/* Unmount input controls when minimized so this InputBar
              stops subscribing to the global voice stream — otherwise
              speech-to-text from other chats lands here too. */}
          {!spawning && open && (
            <>
              <div className="helper-chips">
                {chips.map(chip => (
                  <ActionButton key={chip.label} variant="chip" size="chip" title={chip.tip} onClick={() => fillChip(chip.msg)}>
                    {chip.icon} {chip.label}
                  </ActionButton>
                ))}
              </div>
              <StatusBar sessionName={sessionName} />
              <InputBar ref={inputBarRef} sessionName={sessionName} />
            </>
          )}
        </div>
      )}

      <button
        className={`helper-fab${gateNewSpawn ? ' is-disabled' : ''}`}
        data-floating-chat-variant={variant}
        style={fabStyle}
        onClick={gateNewSpawn ? undefined : (open ? handleMinimize : handleOpen)}
        onPointerDown={gateNewSpawn ? undefined : onFabDragStart}
        title={gateNewSpawn ? sessionGate.tooltip : fabTitle}
        aria-label={gateNewSpawn ? sessionGate.tooltip : ariaLabel}
        aria-disabled={gateNewSpawn}
      >
        <Icon size={iconSize} />
        {!open && hasUnread && (
          <span className="helper-badge">1</span>
        )}
      </button>

      {/* Close-confirmation modal — same shadcn Dialog primitives as the
          sidebar's CloseConfirmDialog (SessionRail.tsx:161) for visual parity. */}
      <Dialog open={confirmingClose} onOpenChange={(o) => { if (!o) cancelClose() }}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>{closeDialog.title}</DialogTitle>
            <DialogDescription>{closeDialog.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={cancelClose}>Cancel</Button>
            <Button variant="destructive" onClick={confirmClose}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
