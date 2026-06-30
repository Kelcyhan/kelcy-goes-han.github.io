import { create } from 'zustand'

/** Serializable state blob for a widget. Widgets define their own shape. */
export type WidgetSnapshot = Record<string, unknown>

interface WidgetSnapshotStore {
  /** Current snapshot state per widget ID. */
  snapshots: Record<string, WidgetSnapshot>

  /** Increments on restoreAllSnapshots — tells mounted widgets to re-apply. */
  generation: number

  /** Widget calls this to push its current state. */
  setSnapshot: (widgetId: string, snapshot: WidgetSnapshot) => void

  /** Get snapshot for a specific widget. */
  getSnapshot: (widgetId: string) => WidgetSnapshot | undefined

  /** Capture all snapshots (called by workspace-store on save). */
  getAllSnapshots: () => Record<string, WidgetSnapshot>

  /** Replace all snapshots (called by workspace-store on restore). */
  restoreAllSnapshots: (snapshots: Record<string, WidgetSnapshot>) => void
}

export const useWidgetSnapshotStore = create<WidgetSnapshotStore>((set, get) => ({
  snapshots: {},
  generation: 0,

  setSnapshot: (widgetId, snapshot) => {
    set(s => ({ snapshots: { ...s.snapshots, [widgetId]: snapshot } }))
  },

  getSnapshot: (widgetId) => get().snapshots[widgetId],

  getAllSnapshots: () => ({ ...get().snapshots }),

  restoreAllSnapshots: (snapshots) => {
    set(s => ({ snapshots: { ...snapshots }, generation: s.generation + 1 }))
  },
}))
