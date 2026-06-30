import React from 'react'
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { LucideIcon } from 'lucide-react'
import {
  Bot, Inbox, Activity, BookOpen, BarChart3, Heart, Dumbbell,
  Newspaper, Mail, Calendar, Clock, Settings, Star, Zap,
  LayoutGrid, FileText, Globe, Database, Cpu, Search,
  Moon, Sun, Flame, TrendingUp, Coffee, Target,
} from 'lucide-react'
import { AgentsCompact, AgentsDetail } from '@/components/widgets/AgentsWidget.tsx'
import { GoalsCompact, GoalsDetail } from '@/components/widgets/GoalsWidget.tsx'
import { SpawnerHealthCompact, SpawnerHealthDetail } from '@/components/widgets/SpawnerHealthWidget.tsx'

// ── Icon resolver for dynamic widgets ──

const ICON_MAP: Record<string, LucideIcon> = {
  Bot, Inbox, Activity, BookOpen, BarChart3, Heart, Dumbbell,
  Newspaper, Mail, Calendar, Clock, Settings, Star, Zap,
  LayoutGrid, FileText, Globe, Database, Cpu, Search,
  Moon, Sun, Flame, TrendingUp, Coffee,
}

export function resolveIcon(name: string): LucideIcon {
  return ICON_MAP[name] || LayoutGrid
}

// ── Discover widget modules at build time via import.meta.glob ──

const compactModules = import.meta.glob<{ default: React.ComponentType }>(
  '@widgets/*/code/Compact.tsx'
)

const detailModules = import.meta.glob<{ default: React.ComponentType }>(
  '@widgets/*/code/Detail.tsx'
)

/** Extract widget ID from a glob key like "@widgets/fitness-tracker/code/Compact.tsx" */
function extractWidgetId(globKey: string): string {
  // Handle both alias form and resolved form
  const parts = globKey.split('/')
  const codeIdx = parts.indexOf('code')
  return codeIdx > 0 ? parts[codeIdx - 1] : ''
}

// Build a map of widget ID → lazy module loaders
const discoveredWidgets = new Map<string, {
  compact: () => Promise<{ default: React.ComponentType }>
  detail: () => Promise<{ default: React.ComponentType }>
}>()

for (const [key, loader] of Object.entries(compactModules)) {
  const id = extractWidgetId(key)
  if (!id || id.startsWith('_')) continue
  const existing = discoveredWidgets.get(id) || { compact: loader, detail: loader }
  existing.compact = loader
  discoveredWidgets.set(id, existing)
}

for (const [key, loader] of Object.entries(detailModules)) {
  const id = extractWidgetId(key)
  if (!id || id.startsWith('_')) continue
  const existing = discoveredWidgets.get(id) || { compact: loader, detail: loader }
  existing.detail = loader
  discoveredWidgets.set(id, existing)
}

// ── Widget Definition (static registry) ──

export interface WidgetDef {
  id: string
  title: string
  icon: LucideIcon
  /** Small summary shown in the grid card */
  CompactComponent: React.ComponentType
  /** Full content shown when the card is clicked */
  DetailComponent: React.ComponentType
  defaultEnabled: boolean
  defaultOrder: number
  category: string
  /** Protected widgets cannot be deleted via the UI. Source of truth is widget.yaml. */
  protected?: boolean
  /** Hidden widgets stay in the code/registry but don't render on the home grid. */
  hidden?: boolean
  /** Absolute path prefixes used to scope the embedded Agents section.
   * Sessions whose working_dir starts with any of these appear in the
   * widget's Detail panel. Undefined = fall back to widgets/<id>. */
  workingDirPrefixes?: string[]
}

// ── Widget Config (persisted user preferences) ──

export interface WidgetConfig {
  id: string
  enabled: boolean
  sort_order: number
}

export interface BuildingWidget {
  id: string
  title: string
  icon: string
  sessionName: string
}

// ── Safe localStorage wrapper (catches quota errors gracefully) ──

const safeStorage = createJSONStorage(() => ({
  getItem(name: string) { return localStorage.getItem(name) },
  setItem(name: string, value: string) {
    try {
      localStorage.setItem(name, value)
    } catch {
      // Quota exceeded — prune old workspace snapshots and retry
      try {
        const wsKeys: string[] = []
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i)
          if (key?.startsWith('agent-session-ws-')) wsKeys.push(key)
        }
        // Remove oldest half of workspace entries to free space
        if (wsKeys.length > 0) {
          wsKeys.sort()
          const toRemove = wsKeys.slice(0, Math.max(1, Math.floor(wsKeys.length / 2)))
          for (const key of toRemove) localStorage.removeItem(key)
        }
        localStorage.setItem(name, value)
      } catch {
        console.warn('[home-store] localStorage quota exceeded, widget preferences not saved')
      }
    }
  },
  removeItem(name: string) { localStorage.removeItem(name) },
}))

// ── Placeholder Widgets (used until real widgets are built) ──

function PlaceholderCompact() {
  return (
    <div className="flex items-center justify-center text-muted-foreground italic text-xs py-6">
      Coming soon
    </div>
  )
}

function PlaceholderDetail() {
  return (
    <div className="flex items-center justify-center text-muted-foreground italic text-sm py-12">
      Full view coming soon
    </div>
  )
}

// ── Static Widget Registry (built-in widgets) ──

const STATIC_REGISTRY: WidgetDef[] = [
  {
    id: 'agents',
    title: 'Agents',
    icon: Bot,
    CompactComponent: AgentsCompact,
    DetailComponent: AgentsDetail,
    defaultEnabled: true,
    defaultOrder: 0,
    category: 'built-in',
    protected: true,
    hidden: true,
  },
  {
    id: 'goals',
    title: 'Goals',
    icon: Target,
    CompactComponent: GoalsCompact,
    DetailComponent: GoalsDetail,
    defaultEnabled: true,
    defaultOrder: 1,
    category: 'built-in',
  },
  {
    id: 'inbox',
    title: 'Inbox',
    icon: Inbox,
    CompactComponent: PlaceholderCompact,
    DetailComponent: PlaceholderDetail,
    defaultEnabled: true,
    defaultOrder: 2,
    category: 'built-in',
  },
  {
    id: 'spawner-health',
    title: 'Spawner Backend',
    icon: Activity,
    CompactComponent: SpawnerHealthCompact,
    DetailComponent: SpawnerHealthDetail,
    defaultEnabled: true,
    defaultOrder: 3,
    category: 'built-in',
    hidden: true,
  },
]

// ── Exported combined registry (used by HomeScreen for lookups) ──
export let WIDGET_REGISTRY: WidgetDef[] = [...STATIC_REGISTRY]

// ── Store ──

interface HomeStore {
  widgets: WidgetConfig[]
  registry: WidgetDef[]
  expandedWidgetId: string | null
  editMode: boolean
  manageModalOpen: boolean
  buildingWidgets: BuildingWidget[]

  // Actions
  initWidgets: () => void
  loadDynamicWidgets: () => Promise<void>
  toggleWidget: (id: string) => void
  reorderWidgets: (activeId: string, overId: string) => void
  expandWidget: (id: string) => void
  collapseWidget: () => void
  toggleEditMode: () => void
  openManageModal: () => void
  closeManageModal: () => void
  addBuildingWidget: (w: BuildingWidget) => void
  removeBuildingWidget: (id: string) => void
  deleteWidget: (id: string) => Promise<void>
}

/** Merge registry defaults with any saved config. Hidden widgets are omitted — they stay registered (for lookup) but never render. */
function mergeWithRegistry(saved: WidgetConfig[], registry: WidgetDef[]): WidgetConfig[] {
  const savedMap = new Map(saved.map(w => [w.id, w]))
  return registry
    .filter(def => !def.hidden)
    .map(def => {
      const existing = savedMap.get(def.id)
      if (existing) return existing
      return { id: def.id, enabled: def.defaultEnabled, sort_order: def.defaultOrder }
    })
}

export const useHomeStore = create<HomeStore>()(
  persist(
    (set, get) => ({
      widgets: [],
      registry: [...STATIC_REGISTRY],
      expandedWidgetId: null,
      editMode: false,
      manageModalOpen: false,
      buildingWidgets: [],

      initWidgets: () => {
        const current = get().widgets
        const registry = get().registry
        set({ widgets: mergeWithRegistry(current, registry) })
      },

      loadDynamicWidgets: async () => {
        try {
          const token = new URLSearchParams(window.location.search).get('token') || ''
          const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {}
          const res = await fetch('/api/widgets/registry', { headers })
          if (!res.ok) return
          const data = await res.json()

          const dynamicDefs: WidgetDef[] = (data.widgets || [])
            .filter((w: { id: string }) => !STATIC_REGISTRY.some(s => s.id === w.id))
            .filter((w: { id: string }) => discoveredWidgets.has(w.id))
            .map((w: { id: string; title: string; icon: string; default_enabled?: boolean; default_order?: number; category?: string; protected?: boolean; working_dir_prefixes?: string[] | null }) => {
              const modules = discoveredWidgets.get(w.id)!
              return {
                id: w.id,
                title: w.title,
                icon: resolveIcon(w.icon),
                CompactComponent: React.lazy(modules.compact),
                DetailComponent: React.lazy(modules.detail),
                defaultEnabled: w.default_enabled ?? true,
                defaultOrder: w.default_order ?? 100,
                category: w.category || 'agent-created',
                protected: w.protected === true,
                workingDirPrefixes: Array.isArray(w.working_dir_prefixes) && w.working_dir_prefixes.length > 0
                  ? w.working_dir_prefixes
                  : undefined,
              }
            })

          const fullRegistry = [...STATIC_REGISTRY, ...dynamicDefs]
          WIDGET_REGISTRY = fullRegistry

          const current = get().widgets
          set({
            registry: fullRegistry,
            widgets: mergeWithRegistry(current, fullRegistry),
          })
        } catch {
          // API not available — use static registry only
        }
      },

      toggleWidget: (id) => {
        set(s => ({
          widgets: s.widgets.map(w =>
            w.id === id ? { ...w, enabled: !w.enabled } : w
          ),
          expandedWidgetId: s.expandedWidgetId === id && s.widgets.find(w => w.id === id)?.enabled
            ? null
            : s.expandedWidgetId,
        }))
      },

      reorderWidgets: (activeId, overId) => {
        if (activeId === overId) return
        const widgets = [...get().widgets].sort((a, b) => a.sort_order - b.sort_order)
        const activeIdx = widgets.findIndex(w => w.id === activeId)
        const overIdx = widgets.findIndex(w => w.id === overId)
        if (activeIdx < 0 || overIdx < 0) return

        const [moved] = widgets.splice(activeIdx, 1)
        widgets.splice(overIdx, 0, moved)

        const prev = widgets[overIdx - 1]?.sort_order ?? 0
        const next = widgets[overIdx + 1]?.sort_order ?? (prev + 2)
        moved.sort_order = (prev + next) / 2

        set({ widgets })
      },

      expandWidget: (id) => set({ expandedWidgetId: id }),
      collapseWidget: () => set({ expandedWidgetId: null }),
      toggleEditMode: () => set(s => ({ editMode: !s.editMode, expandedWidgetId: null })),
      openManageModal: () => set({ manageModalOpen: true }),
      closeManageModal: () => set({ manageModalOpen: false }),
      addBuildingWidget: (w) => set(s => ({ buildingWidgets: [...s.buildingWidgets, w] })),
      removeBuildingWidget: (id) => set(s => ({ buildingWidgets: s.buildingWidgets.filter(w => w.id !== id) })),
      deleteWidget: async (id) => {
        const token = typeof window !== 'undefined'
          ? new URLSearchParams(window.location.search).get('token')
          : null
        const headers: Record<string, string> = {}
        if (token) headers['Authorization'] = `Bearer ${token}`
        const res = await fetch(`/api/widgets/${id}`, { method: 'DELETE', headers })
        if (!res.ok) {
          const err = await res.json().catch(() => ({ detail: 'Failed to delete widget' }))
          throw new Error(err.detail || 'Failed to delete widget')
        }
        // Remove from local state
        set(s => ({
          widgets: s.widgets.filter(w => w.id !== id),
          registry: s.registry.filter(d => d.id !== id),
          expandedWidgetId: s.expandedWidgetId === id ? null : s.expandedWidgetId,
          buildingWidgets: s.buildingWidgets.filter(w => w.id !== id),
        }))
        WIDGET_REGISTRY = get().registry
      },
    }),
    {
      name: 'home-widgets',
      storage: safeStorage,
      partialize: (state) => ({ widgets: state.widgets }),
    }
  )
)
