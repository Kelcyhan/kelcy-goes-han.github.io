import { create } from 'zustand'
import * as api from '@/lib/api.ts'
import type { HomeLayout, HomeGroup } from '@/lib/api.ts'

type SectionKey = 'active' | 'past'

interface HomeLayoutStore {
  layout: HomeLayout | null
  loading: boolean
  loaded: boolean

  loadLayout: () => Promise<void>
  setSectionCollapsed: (section: SectionKey, collapsed: boolean) => void
  toggleGroupCollapsed: (groupId: string) => void
  reorderGroups: (groupIds: string[]) => void
  createGroup: (label: string) => string
  renameGroup: (id: string, label: string) => void
  deleteGroup: (id: string) => void
  moveAgent: (sessionName: string, toGroup: string, toOrder: number) => void
  setPlacements: (placements: HomeLayout['placements']) => void
  unplaceAgent: (sessionName: string) => void
}

let persistTimer: ReturnType<typeof setTimeout> | null = null
const PERSIST_DEBOUNCE_MS = 300

function schedulePersist(layout: HomeLayout) {
  if (persistTimer) clearTimeout(persistTimer)
  persistTimer = setTimeout(() => {
    api.putHomeLayout(layout).catch(err => {
      console.warn('putHomeLayout failed:', err)
    })
    persistTimer = null
  }, PERSIST_DEBOUNCE_MS)
}

function nextGroupId(): string {
  const rand = Math.random().toString(36).slice(2, 8)
  return `grp_${rand}`
}

export const useHomeLayoutStore = create<HomeLayoutStore>((set, get) => ({
  layout: null,
  loading: false,
  loaded: false,

  loadLayout: async () => {
    if (get().loading || get().loaded) return
    set({ loading: true })
    try {
      const layout = await api.fetchHomeLayout()
      set({ layout, loading: false, loaded: true })
    } catch (err) {
      console.warn('fetchHomeLayout failed:', err)
      set({ loading: false })
    }
  },

  setSectionCollapsed: (section, collapsed) => {
    const layout = get().layout
    if (!layout) return
    const next: HomeLayout = {
      ...layout,
      sections: {
        ...layout.sections,
        [section]: { collapsed },
      },
    }
    set({ layout: next })
    schedulePersist(next)
  },

  toggleGroupCollapsed: (groupId) => {
    const layout = get().layout
    if (!layout) return
    const next: HomeLayout = {
      ...layout,
      groups: layout.groups.map(g =>
        g.id === groupId ? { ...g, collapsed: !g.collapsed } : g,
      ),
    }
    set({ layout: next })
    schedulePersist(next)
  },

  reorderGroups: (groupIds) => {
    const layout = get().layout
    if (!layout) return
    const byId = new Map(layout.groups.map(g => [g.id, g]))
    const reordered: HomeGroup[] = []
    groupIds.forEach((id, idx) => {
      const g = byId.get(id)
      if (g) reordered.push({ ...g, order: idx })
    })
    // Append any groups not in the incoming list (defensive).
    layout.groups.forEach(g => {
      if (!groupIds.includes(g.id)) reordered.push({ ...g, order: reordered.length })
    })
    const next: HomeLayout = { ...layout, groups: reordered }
    set({ layout: next })
    schedulePersist(next)
  },

  createGroup: (label) => {
    const layout = get().layout
    if (!layout) return ''
    const id = nextGroupId()
    // New user groups land at the absolute end, right above the
    // "+ New group" button rendered below the list.
    const maxOrder = layout.groups.reduce((m, g) => Math.max(m, g.order), -1)
    const group: HomeGroup = {
      id, label, kind: 'user', collapsed: false, order: maxOrder + 1,
    }
    const next: HomeLayout = { ...layout, groups: [...layout.groups, group] }
    set({ layout: next })
    schedulePersist(next)
    return id
  },

  renameGroup: (id, label) => {
    const layout = get().layout
    if (!layout) return
    const next: HomeLayout = {
      ...layout,
      groups: layout.groups.map(g => (g.id === id ? { ...g, label } : g)),
    }
    set({ layout: next })
    schedulePersist(next)
  },

  deleteGroup: (id) => {
    const layout = get().layout
    if (!layout) return
    const group = layout.groups.find(g => g.id === id)
    if (!group || group.kind !== 'user') return
    // Un-place any agents that were in this group — they fall back to their
    // auto-role bucket on the next render.
    const placements = { ...layout.placements }
    for (const [name, p] of Object.entries(placements)) {
      if (p.group === id) delete placements[name]
    }
    const next: HomeLayout = {
      ...layout,
      groups: layout.groups.filter(g => g.id !== id),
      placements,
    }
    set({ layout: next })
    schedulePersist(next)
  },

  moveAgent: (sessionName, toGroup, toOrder) => {
    const layout = get().layout
    if (!layout) return
    const placements = {
      ...layout.placements,
      [sessionName]: { group: toGroup, order: toOrder },
    }
    const next: HomeLayout = { ...layout, placements }
    set({ layout: next })
    schedulePersist(next)
  },

  setPlacements: (placements) => {
    const layout = get().layout
    if (!layout) return
    const next: HomeLayout = { ...layout, placements }
    set({ layout: next })
    schedulePersist(next)
  },

  unplaceAgent: (sessionName) => {
    const layout = get().layout
    if (!layout) return
    if (!layout.placements[sessionName]) return
    const placements = { ...layout.placements }
    delete placements[sessionName]
    const next: HomeLayout = { ...layout, placements }
    set({ layout: next })
    schedulePersist(next)
  },
}))
