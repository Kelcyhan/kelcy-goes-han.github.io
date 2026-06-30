// Mock mode installer.
//
// When VITE_USE_MOCKS=1, this module:
//   1. Patches window.fetch to serve fixtures for known /api/ endpoints
//   2. Stubs WebSocket so live-stream hooks don't throw (just silent — no live updates)
//
// Anything unmatched falls through to a no-op response. The dashboard can render
// every screen + the session rail from static fixtures.

import { tryHandle } from './handlers.ts'

export const MOCK_MODE = import.meta.env.VITE_USE_MOCKS === '1'

function patchFetch() {
  const original = window.fetch.bind(window)
  window.fetch = async (input, init) => {
    const rawUrl = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    // Only intercept same-origin /api/ paths
    let url: URL
    try {
      url = new URL(rawUrl, window.location.origin)
    } catch {
      return original(input as any, init)
    }
    if (url.origin !== window.location.origin || !url.pathname.startsWith('/api/')) {
      return original(input as any, init)
    }
    const mocked = tryHandle(url, init)
    if (mocked) {
      // Tiny latency to keep loading states realistic
      await new Promise(r => setTimeout(r, 40))
      return mocked
    }
    return original(input as any, init)
  }
}

function patchWebSocket() {
  // Quiet stub — connects, never emits, accepts close.
  const Original = window.WebSocket
  class QuietWebSocket extends EventTarget {
    static readonly CONNECTING = 0
    static readonly OPEN = 1
    static readonly CLOSING = 2
    static readonly CLOSED = 3
    readyState = 1
    url = ''
    onopen: ((e: Event) => void) | null = null
    onmessage: ((e: MessageEvent) => void) | null = null
    onclose: ((e: CloseEvent) => void) | null = null
    onerror: ((e: Event) => void) | null = null

    constructor(url: string | URL, _protocols?: string | string[]) {
      super()
      this.url = url.toString()
      // Fire open on next tick
      queueMicrotask(() => {
        this.onopen?.(new Event('open'))
        this.dispatchEvent(new Event('open'))
      })
    }
    send(_data: any) { /* no-op */ }
    close() {
      this.readyState = 3
      const ev = new CloseEvent('close', { wasClean: true, code: 1000, reason: 'mock' })
      this.onclose?.(ev)
      this.dispatchEvent(ev)
    }
  }
  // Only swap if mocks active — keeps the original available via globalThis.OriginalWebSocket
  ;(window as any).OriginalWebSocket = Original
  ;(window as any).WebSocket = QuietWebSocket
}

export function installMocks() {
  if (!MOCK_MODE) return
  patchFetch()
  patchWebSocket()
  // Friendly badge in console
  // eslint-disable-next-line no-console
  console.info('[mock-mode] enabled — /api/* served from src/mocks/fixtures.ts')
}
