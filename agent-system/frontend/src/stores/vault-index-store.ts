import { create } from 'zustand'
import type { VaultPage } from '@/lib/dataview.ts'
import { fetchLocalVaultTasks, hasLocalVault } from '@/lib/local-vault.ts'

interface VaultIndexState {
  pages: VaultPage[]
  loaded: boolean
  loading: boolean
  error: string | null
  lastFetched: number | null

  /** Fetch (or refresh) task pages from /api/vault/tasks. */
  fetchPages: () => Promise<void>
}

export const useVaultIndexStore = create<VaultIndexState>((set, get) => ({
  pages: [],
  loaded: false,
  loading: false,
  error: null,
  lastFetched: null,

  async fetchPages() {
    // Skip if already loading or fetched in last 60s
    const { loading, lastFetched } = get()
    if (loading) return
    if (lastFetched && Date.now() - lastFetched < 60_000) return

    set({ loading: true, error: null })
    try {
      const res = await fetch('/api/vault/tasks')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as { tasks: VaultPage[] }
      set({
        pages: data.tasks,
        loaded: true,
        loading: false,
        lastFetched: Date.now(),
      })
    } catch (err) {
      if (hasLocalVault()) {
        const data = fetchLocalVaultTasks()
        set({
          pages: data.tasks,
          loaded: true,
          loading: false,
          error: null,
          lastFetched: Date.now(),
        })
        return
      }
      set({
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to load task index',
      })
    }
  },
}))
