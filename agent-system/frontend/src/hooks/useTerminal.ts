import { useRef, useEffect, useCallback } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { WebglAddon } from '@xterm/addon-webgl'
import { terminalWsUrl } from '@/lib/api.ts'

const TERM_THEME_DARK = {
  background: '#1F1F34',        /* matches --bg-panel dark */
  foreground: '#E8E6E3',
  cursor: '#D6D876',
  cursorAccent: '#1F1F34',
  selectionBackground: 'rgba(214, 216, 118, 0.3)',
  black: '#1A1A1F',
  red: '#FF6B6B',
  green: '#87D687',
  yellow: '#D6D876',
  blue: '#6BB3FF',
  magenta: '#C792EA',
  cyan: '#89DDFF',
  white: '#E8E6E3',
  brightBlack: '#4A4A50',
  brightRed: '#FF8A8A',
  brightGreen: '#A5E6A5',
  brightYellow: '#E8EA8C',
  brightBlue: '#8AC8FF',
  brightMagenta: '#D9ABF5',
  brightCyan: '#A6EAFF',
  brightWhite: '#FFFFFF',
}

const TERM_THEME_LIGHT = {
  background: '#FFFFFF',        /* matches --bg-panel light */
  foreground: '#1A1A2A',
  cursor: '#5BA3D9',
  cursorAccent: '#FFFFFF',
  selectionBackground: 'rgba(91, 163, 217, 0.25)',
  black: '#2C2C3C',
  red: '#C0392B',
  green: '#27AE60',
  yellow: '#D4922A',
  blue: '#2980B9',
  magenta: '#8E44AD',
  cyan: '#16A085',
  white: '#5A5A6E',
  brightBlack: '#6A6A7E',
  brightRed: '#E05A4B',
  brightGreen: '#3BB87A',
  brightYellow: '#D4A72C',
  brightBlue: '#5BA3D9',
  brightMagenta: '#A855C8',
  brightCyan: '#1ABC9C',
  brightWhite: '#111118',
}

const TERM_THEME = window.matchMedia('(prefers-color-scheme: light)').matches
  ? TERM_THEME_LIGHT
  : TERM_THEME_DARK

export function useTerminal(_sessionName: string | null) {
  const termRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const roRef = useRef<ResizeObserver | null>(null)
  const writeBuf = useRef<Uint8Array[]>([])
  const rafId = useRef<number | null>(null)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reconnectCount = useRef(0)
  const MAX_RECONNECT = 5

  const scheduleFlush = useCallback(() => {
    if (rafId.current !== null) return
    rafId.current = requestAnimationFrame(() => {
      rafId.current = null
      const term = termRef.current
      if (!term || writeBuf.current.length === 0) return
      const merged = new Uint8Array(writeBuf.current.reduce((a, b) => a + b.length, 0))
      let off = 0
      for (const chunk of writeBuf.current) {
        merged.set(chunk, off)
        off += chunk.length
      }
      writeBuf.current = []
      term.write(merged)
    })
  }, [])

  const destroy = useCallback(() => {
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current)
      reconnectTimer.current = null
    }
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    if (rafId.current !== null) {
      cancelAnimationFrame(rafId.current)
      rafId.current = null
    }
    writeBuf.current = []
    if (roRef.current) {
      roRef.current.disconnect()
      roRef.current = null
    }
    if (termRef.current) {
      termRef.current.dispose()
      termRef.current = null
      fitRef.current = null
    }
  }, [])

  const init = useCallback((container: HTMLDivElement, onReady?: () => void) => {
    destroy()

    const terminalFontSize = parseFloat(
      getComputedStyle(document.documentElement)
        .getPropertyValue('--type-body-sm-size')
        .trim()
    ) || 13

    const term = new Terminal({
      theme: TERM_THEME,
      fontFamily: "var(--font-mono)",
      fontSize: terminalFontSize,
      fontWeight: 400,
      lineHeight: 1.2,
      letterSpacing: 0,
      cursorBlink: true,
      cursorStyle: 'bar',
      scrollback: 10000,
      allowProposedApi: true,
    })

    const fit = new FitAddon()
    const webLinks = new WebLinksAddon()
    term.loadAddon(fit)
    term.loadAddon(webLinks)

    term.open(container)

    // Allow devtools shortcuts through
    term.attachCustomKeyEventHandler((e) => {
      if (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J')) return false
      return true
    })

    // Try WebGL renderer
    try {
      const webgl = new WebglAddon()
      webgl.onContextLoss(() => webgl.dispose())
      term.loadAddon(webgl)
    } catch { /* WebGL not available */ }

    termRef.current = term
    fitRef.current = fit

    // Initial fit with retry — connect WebSocket only after real size is known
    const performFit = () => {
      requestAnimationFrame(() => {
        if (!fit || !term) return
        const rect = container.getBoundingClientRect()
        if (rect.width > 0 && rect.height > 0) {
          fit.fit()
          onReady?.()
        } else {
          setTimeout(performFit, 50)
        }
      })
    }
    performFit()

    // ResizeObserver
    let resizeTimer: ReturnType<typeof setTimeout> | null = null
    const ro = new ResizeObserver(() => {
      if (!fit || !term) return
      if (resizeTimer) clearTimeout(resizeTimer)
      resizeTimer = setTimeout(() => {
        const rect = container.getBoundingClientRect()
        if (rect.width > 0 && rect.height > 0) {
          try {
            fit.fit()
            term.refresh(0, term.rows - 1)
          } catch { /* ignore */ }
        }
      }, 200)
    })
    ro.observe(container)
    roRef.current = ro

    // Send input to WebSocket
    term.onData((data) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'input', data }))
      }
    })

    // Send resize to WebSocket
    term.onResize(({ cols, rows }) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'resize', cols, rows }))
      }
    })

    return term
  }, [destroy])

  const connectWs = useCallback((name: string) => {
    const term = termRef.current
    if (!term) return
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current)
      reconnectTimer.current = null
    }

    const url = terminalWsUrl(name, term.cols, term.rows)
    const ws = new WebSocket(url)
    ws.binaryType = 'arraybuffer'
    wsRef.current = ws

    ws.onopen = () => {
      reconnectCount.current = 0
      term.focus()
    }

    ws.onmessage = (event) => {
      if (!term) return
      if (event.data instanceof ArrayBuffer) {
        writeBuf.current.push(new Uint8Array(event.data))
        scheduleFlush()
      } else {
        try {
          const msg = JSON.parse(event.data)
          if (msg.type === 'session_ended') {
            term.write('\r\n\x1b[38;2;248;81;73m--- Session ended ---\x1b[0m\r\n')
          }
        } catch { /* ignore */ }
      }
    }

    ws.onclose = () => {
      reconnectCount.current++
      if (reconnectCount.current <= MAX_RECONNECT) {
        reconnectTimer.current = setTimeout(() => {
          if (termRef.current) connectWs(name)
        }, 3000)
      }
    }
  }, [scheduleFlush])

  // Cleanup on unmount
  useEffect(() => {
    return () => destroy()
  }, [destroy])

  return { termRef, fitRef, init, connectWs, destroy }
}
