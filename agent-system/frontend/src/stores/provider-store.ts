import { create } from 'zustand'
import * as api from '@/lib/api.ts'
import type { ProvidersMap, ProviderStatus } from '@/lib/api.ts'

interface ProviderStore {
  providers: ProvidersMap
  loaded: boolean
  fetchError: boolean

  refreshProviders: () => Promise<void>
  setProvider: (name: string, status: ProviderStatus) => void
  connect: () => () => void
}

const POLL_INTERVAL_MS = 30_000

let connectCount = 0
let pollTimer: ReturnType<typeof setInterval> | null = null
let visibilityHandler: (() => void) | null = null
let focusHandler: (() => void) | null = null

export const useProviderStore = create<ProviderStore>()((set, get) => ({
  providers: {},
  loaded: false,
  fetchError: false,

  refreshProviders: async () => {
    try {
      const data = await api.fetchProviders()
      set({ providers: data, loaded: true, fetchError: false })
    } catch {
      set({ fetchError: true })
    }
  },

  setProvider: (name, status) => {
    set(state => ({ providers: { ...state.providers, [name]: status } }))
  },

  connect: () => {
    connectCount += 1
    if (connectCount === 1) {
      void get().refreshProviders()
      pollTimer = setInterval(() => { void get().refreshProviders() }, POLL_INTERVAL_MS)
      visibilityHandler = () => { if (!document.hidden) void get().refreshProviders() }
      focusHandler = () => { void get().refreshProviders() }
      document.addEventListener('visibilitychange', visibilityHandler)
      window.addEventListener('focus', focusHandler)
    }
    return () => {
      connectCount -= 1
      if (connectCount === 0) {
        if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
        if (visibilityHandler) { document.removeEventListener('visibilitychange', visibilityHandler); visibilityHandler = null }
        if (focusHandler) { window.removeEventListener('focus', focusHandler); focusHandler = null }
      }
    }
  },
}))

export function anyProviderLoggedIn(providers: ProvidersMap): boolean {
  return Object.values(providers).some(p => p?.loggedIn === true)
}

export function anyProviderError(providers: ProvidersMap): boolean {
  return Object.values(providers).some(p => Boolean(p?.error))
}

export function allProvidersLoggedOut(providers: ProvidersMap): boolean {
  const entries = Object.values(providers)
  if (entries.length === 0) return false
  return entries.every(p => p?.loggedIn === false && !p?.error)
}
