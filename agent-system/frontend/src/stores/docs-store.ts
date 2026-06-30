import { create } from 'zustand'
import type { VaultFile, TreeNode } from '@/lib/types.ts'
import * as api from '@/lib/api.ts'

interface DocsStore {
  currentPath: string | null
  currentFile: VaultFile | null
  history: string[]
  fileTree: TreeNode[] | null
  loading: boolean
  error: string | null

  loadFile: (path: string) => Promise<void>
  goBack: () => void
  loadTree: () => Promise<void>
  navigateWikilink: (target: string) => Promise<void>
}

export const useDocsStore = create<DocsStore>((set, get) => ({
  currentPath: null,
  currentFile: null,
  history: [],
  fileTree: null,
  loading: false,
  error: null,

  loadFile: async (path) => {
    const prev = get().currentPath
    if (prev && prev !== path) {
      set({ history: [...get().history, prev] })
    }
    set({ currentPath: path, loading: true, error: null })
    try {
      const data = await api.fetchVaultFile(path)
      set({ currentFile: data, loading: false })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load'
      set({ error: msg, loading: false, currentFile: null })
    }
  },

  goBack: () => {
    const hist = get().history
    if (hist.length === 0) return
    const prev = hist[hist.length - 1]
    set({ history: hist.slice(0, -1), currentPath: null })
    get().loadFile(prev)
  },

  loadTree: async () => {
    try {
      const data = await api.fetchVaultTree()
      set({ fileTree: data.tree })
    } catch (err) {
      console.error('Failed to load file tree:', err)
    }
  },

  navigateWikilink: async (target) => {
    const hashIdx = target.indexOf('#')
    const linkTarget = hashIdx >= 0 ? target.substring(0, hashIdx) : target
    const heading = hashIdx >= 0 ? target.substring(hashIdx + 1) : ''

    if (!linkTarget && heading) {
      // Same-page heading — scroll handled by component
      return
    }

    try {
      const data = await api.resolveWikilink(linkTarget)
      await get().loadFile(data.path)
      if (heading) {
        // Scroll handled after render by the component
      }
    } catch {
      set({ error: `Could not resolve link: ${target}` })
    }
  },
}))
