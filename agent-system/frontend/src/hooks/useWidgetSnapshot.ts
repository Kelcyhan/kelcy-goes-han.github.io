import { useCallback } from 'react'
import { useWidgetSnapshotStore } from '@/stores/widget-snapshot-store'

/**
 * Drop-in replacement for useState that stores widget state in the
 * widget-snapshot-store. When switchSession calls restoreAllSnapshots,
 * the store value changes and the component re-renders automatically.
 *
 * No timing issues — the state IS the store.
 *
 * Usage (replaces useState):
 *   const [activeTab, setActiveTab] = useWidgetState('paper-discovery', 'activeTab', 'Library')
 *   const [viewingPaperId, setViewingPaperId] = useWidgetState('paper-discovery', 'viewingPaperId', null)
 */
export function useWidgetState<T>(
  widgetId: string,
  key: string,
  defaultValue: T,
): [T, (value: T | ((prev: T) => T)) => void] {
  // Read from store — falls back to default if not set
  const value = useWidgetSnapshotStore(
    s => (s.snapshots[widgetId]?.[key] as T) ?? defaultValue
  )

  const setSnapshot = useWidgetSnapshotStore(s => s.setSnapshot)

  const setValue = useCallback((newValue: T | ((prev: T) => T)) => {
    const store = useWidgetSnapshotStore.getState()
    const current = (store.snapshots[widgetId]?.[key] as T) ?? defaultValue
    const resolved = typeof newValue === 'function'
      ? (newValue as (prev: T) => T)(current)
      : newValue
    const existing = store.snapshots[widgetId] || {}
    store.setSnapshot(widgetId, { ...existing, [key]: resolved })
  }, [widgetId, key, defaultValue, setSnapshot])

  return [value, setValue]
}
