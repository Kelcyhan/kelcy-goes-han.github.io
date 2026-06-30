import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the AgentsWidget components before importing the store
vi.mock('@/components/widgets/AgentsWidget.tsx', () => ({
  AgentsCompact: () => null,
  AgentsDetail: () => null,
}))

import { useHomeStore, resolveIcon, type WidgetConfig, type BuildingWidget } from '../home-store.tsx'

/**
 * Reset store state between tests.
 * We grab the current registry (populated from STATIC_REGISTRY at import time)
 * and preserve it, since it contains the built-in widget definitions.
 */
function resetStore() {
  const registry = useHomeStore.getState().registry
  useHomeStore.setState({
    widgets: [],
    registry,
    expandedWidgetId: null,
    editMode: false,
    manageModalOpen: false,
    buildingWidgets: [],
  })
}

// ── resolveIcon ──

describe('resolveIcon', () => {
  it('returns the correct icon for a known name', () => {
    const icon = resolveIcon('Bot')
    expect(icon).toBeDefined()
    // Lucide icons are React forwardRef components — they may be objects or functions
    // depending on the React/lucide version. The key test is that we get a truthy value
    // that differs from the fallback when the name is valid.
    const fallback = resolveIcon('__nonexistent__')
    expect(icon).not.toBe(fallback)
  })

  it('returns different icons for different names', () => {
    const bot = resolveIcon('Bot')
    const inbox = resolveIcon('Inbox')
    expect(bot).not.toBe(inbox)
  })

  it('returns LayoutGrid fallback for unknown icon name', () => {
    const fallback = resolveIcon('NonExistentIconName')
    const layoutGrid = resolveIcon('LayoutGrid')
    expect(fallback).toBe(layoutGrid)
  })

  it('returns LayoutGrid fallback for empty string', () => {
    const fallback = resolveIcon('')
    const layoutGrid = resolveIcon('LayoutGrid')
    expect(fallback).toBe(layoutGrid)
  })
})

// ── mergeWithRegistry (tested indirectly via initWidgets) ──

describe('mergeWithRegistry via initWidgets', () => {
  beforeEach(() => {
    resetStore()
  })

  it('creates configs from registry when no saved widgets exist', () => {
    const registry = useHomeStore.getState().registry

    useHomeStore.getState().initWidgets()

    const widgets = useHomeStore.getState().widgets
    // Should create a config for each registry entry
    expect(widgets.length).toBe(registry.length)
    for (const def of registry) {
      const config = widgets.find(w => w.id === def.id)
      expect(config).toBeDefined()
      expect(config!.enabled).toBe(def.defaultEnabled)
      expect(config!.sort_order).toBe(def.defaultOrder)
    }
  })

  it('preserves saved config for existing widgets', () => {
    // Pre-set a saved config where agents is disabled
    const savedWidgets: WidgetConfig[] = [
      { id: 'agents', enabled: false, sort_order: 99 },
    ]
    useHomeStore.setState({ widgets: savedWidgets })

    useHomeStore.getState().initWidgets()

    const widgets = useHomeStore.getState().widgets
    const agentsConfig = widgets.find(w => w.id === 'agents')
    expect(agentsConfig).toBeDefined()
    // Should preserve the saved values, not the defaults
    expect(agentsConfig!.enabled).toBe(false)
    expect(agentsConfig!.sort_order).toBe(99)
  })

  it('adds new registry entries not present in saved config', () => {
    const registry = useHomeStore.getState().registry
    // Save only agents, not inbox
    const savedWidgets: WidgetConfig[] = [
      { id: 'agents', enabled: false, sort_order: 5 },
    ]
    useHomeStore.setState({ widgets: savedWidgets })

    useHomeStore.getState().initWidgets()

    const widgets = useHomeStore.getState().widgets
    expect(widgets.length).toBe(registry.length)

    // agents should keep saved config
    const agentsConfig = widgets.find(w => w.id === 'agents')
    expect(agentsConfig!.enabled).toBe(false)
    expect(agentsConfig!.sort_order).toBe(5)

    // inbox should get defaults from registry
    const inboxDef = registry.find(d => d.id === 'inbox')
    if (inboxDef) {
      const inboxConfig = widgets.find(w => w.id === 'inbox')
      expect(inboxConfig).toBeDefined()
      expect(inboxConfig!.enabled).toBe(inboxDef.defaultEnabled)
      expect(inboxConfig!.sort_order).toBe(inboxDef.defaultOrder)
    }
  })
})

// ── Store initialization ──

describe('initWidgets', () => {
  beforeEach(() => {
    resetStore()
  })

  it('populates widgets array from empty state', () => {
    const registry = useHomeStore.getState().registry

    useHomeStore.getState().initWidgets()

    const { widgets } = useHomeStore.getState()
    expect(widgets.length).toBeGreaterThan(0)
    expect(widgets.length).toBe(registry.length)
  })

  it('is idempotent — calling twice yields same result', () => {
    useHomeStore.getState().initWidgets()
    const first = [...useHomeStore.getState().widgets]

    useHomeStore.getState().initWidgets()
    const second = useHomeStore.getState().widgets

    expect(second).toEqual(first)
  })
})

// ── buildingWidgets management ──

describe('buildingWidgets management', () => {
  beforeEach(() => {
    resetStore()
  })

  it('addBuildingWidget appends a widget to the list', () => {
    const bw: BuildingWidget = {
      id: 'weather-widget',
      title: 'Weather',
      icon: 'Globe',
      sessionName: 'session-123',
    }

    useHomeStore.getState().addBuildingWidget(bw)

    const { buildingWidgets } = useHomeStore.getState()
    expect(buildingWidgets).toHaveLength(1)
    expect(buildingWidgets[0]).toEqual(bw)
  })

  it('addBuildingWidget appends multiple widgets', () => {
    const bw1: BuildingWidget = {
      id: 'weather-widget',
      title: 'Weather',
      icon: 'Globe',
      sessionName: 'session-1',
    }
    const bw2: BuildingWidget = {
      id: 'fitness-tracker',
      title: 'Fitness',
      icon: 'Dumbbell',
      sessionName: 'session-2',
    }

    useHomeStore.getState().addBuildingWidget(bw1)
    useHomeStore.getState().addBuildingWidget(bw2)

    const { buildingWidgets } = useHomeStore.getState()
    expect(buildingWidgets).toHaveLength(2)
    expect(buildingWidgets[0]).toEqual(bw1)
    expect(buildingWidgets[1]).toEqual(bw2)
  })

  it('removeBuildingWidget removes by id', () => {
    const bw1: BuildingWidget = {
      id: 'weather-widget',
      title: 'Weather',
      icon: 'Globe',
      sessionName: 'session-1',
    }
    const bw2: BuildingWidget = {
      id: 'fitness-tracker',
      title: 'Fitness',
      icon: 'Dumbbell',
      sessionName: 'session-2',
    }

    useHomeStore.getState().addBuildingWidget(bw1)
    useHomeStore.getState().addBuildingWidget(bw2)
    useHomeStore.getState().removeBuildingWidget('weather-widget')

    const { buildingWidgets } = useHomeStore.getState()
    expect(buildingWidgets).toHaveLength(1)
    expect(buildingWidgets[0].id).toBe('fitness-tracker')
  })

  it('removeBuildingWidget is a no-op for unknown id', () => {
    const bw: BuildingWidget = {
      id: 'weather-widget',
      title: 'Weather',
      icon: 'Globe',
      sessionName: 'session-1',
    }

    useHomeStore.getState().addBuildingWidget(bw)
    useHomeStore.getState().removeBuildingWidget('nonexistent')

    const { buildingWidgets } = useHomeStore.getState()
    expect(buildingWidgets).toHaveLength(1)
  })
})

// ── toggleWidget ──

describe('toggleWidget', () => {
  beforeEach(() => {
    resetStore()
    // Initialize widgets from the static registry
    useHomeStore.getState().initWidgets()
  })

  it('toggles enabled from true to false', () => {
    // agents is defaultEnabled: true
    const before = useHomeStore.getState().widgets.find(w => w.id === 'agents')
    expect(before?.enabled).toBe(true)

    useHomeStore.getState().toggleWidget('agents')

    const after = useHomeStore.getState().widgets.find(w => w.id === 'agents')
    expect(after?.enabled).toBe(false)
  })

  it('toggles enabled from false to true', () => {
    // First disable it
    useHomeStore.getState().toggleWidget('agents')
    const disabled = useHomeStore.getState().widgets.find(w => w.id === 'agents')
    expect(disabled?.enabled).toBe(false)

    // Toggle back
    useHomeStore.getState().toggleWidget('agents')
    const enabled = useHomeStore.getState().widgets.find(w => w.id === 'agents')
    expect(enabled?.enabled).toBe(true)
  })

  it('clears expandedWidgetId when disabling the expanded widget', () => {
    useHomeStore.setState({ expandedWidgetId: 'agents' })

    // Toggle agents off — it was enabled and expanded, so expandedWidgetId should clear
    useHomeStore.getState().toggleWidget('agents')

    expect(useHomeStore.getState().expandedWidgetId).toBeNull()
  })

  it('does not clear expandedWidgetId when toggling a different widget', () => {
    useHomeStore.setState({ expandedWidgetId: 'agents' })

    // Toggle inbox, not agents
    useHomeStore.getState().toggleWidget('inbox')

    expect(useHomeStore.getState().expandedWidgetId).toBe('agents')
  })

  it('does not clear expandedWidgetId when enabling (not disabling) the widget', () => {
    // Disable agents first, then expand something else
    useHomeStore.getState().toggleWidget('agents')
    useHomeStore.setState({ expandedWidgetId: 'agents' })

    // Toggle agents back on — it was disabled, so the condition for clearing does not fire
    useHomeStore.getState().toggleWidget('agents')

    expect(useHomeStore.getState().expandedWidgetId).toBe('agents')
  })
})

// ── reorderWidgets ──

describe('reorderWidgets', () => {
  beforeEach(() => {
    resetStore()
    // Set up widgets with known sort_orders
    useHomeStore.setState({
      widgets: [
        { id: 'a', enabled: true, sort_order: 0 },
        { id: 'b', enabled: true, sort_order: 1 },
        { id: 'c', enabled: true, sort_order: 2 },
        { id: 'd', enabled: true, sort_order: 3 },
      ],
    })
  })

  /**
   * The reorder algorithm:
   * 1. Sort by sort_order
   * 2. Splice out the active item
   * 3. Insert it at the overId's *original* index (which may shift after splice)
   * 4. Assign sort_order = average of neighbors at the new position
   *
   * When moving forward (activeIdx < overIdx), the effective insertion is
   * one position after the overId element because the splice of activeId shifts
   * indices down by one.
   */

  it('moves a widget forward (a→c results in [b,c,a,d])', () => {
    // activeIdx=0(a), overIdx=2(c)
    // After splice: [b,c,d]. Insert at 2: [b,c,a,d]
    useHomeStore.getState().reorderWidgets('a', 'c')

    const widgets = [...useHomeStore.getState().widgets].sort((x, y) => x.sort_order - y.sort_order)
    const ids = widgets.map(w => w.id)
    expect(ids).toEqual(['b', 'c', 'a', 'd'])
  })

  it('is a no-op when activeId equals overId', () => {
    const before = [...useHomeStore.getState().widgets]
    useHomeStore.getState().reorderWidgets('a', 'a')
    const after = useHomeStore.getState().widgets
    expect(after).toEqual(before)
  })

  it('is a no-op when activeId does not exist', () => {
    const before = [...useHomeStore.getState().widgets]
    useHomeStore.getState().reorderWidgets('nonexistent', 'a')
    const after = useHomeStore.getState().widgets
    expect(after).toEqual(before)
  })

  it('is a no-op when overId does not exist', () => {
    const before = [...useHomeStore.getState().widgets]
    useHomeStore.getState().reorderWidgets('a', 'nonexistent')
    const after = useHomeStore.getState().widgets
    expect(after).toEqual(before)
  })

  it('moves last widget to first position (d→a results in [d,a,b,c])', () => {
    // activeIdx=3(d), overIdx=0(a)
    // After splice: [a,b,c]. Insert at 0: [d,a,b,c]
    // sort_order: prev=undefined→0, next=a(0). moved=(0+0)/2=0
    // d gets sort_order 0, a already has 0 — tie, but d was inserted before a
    useHomeStore.getState().reorderWidgets('d', 'a')

    const widgets = [...useHomeStore.getState().widgets].sort((x, y) => x.sort_order - y.sort_order)
    const ids = widgets.map(w => w.id)
    // d(0) and a(0) tie — but d was spliced in at index 0
    // The stable sort preserves insertion order within the array
    expect(ids[0]).toBe('d')
    expect(ids.slice(1)).toContain('a')
    expect(ids.slice(1)).toContain('b')
    expect(ids.slice(1)).toContain('c')
  })

  it('moves first widget to last position (a→d results in [b,c,d,a])', () => {
    // activeIdx=0(a), overIdx=3(d)
    // After splice: [b,c,d]. Insert at 3: [b,c,d,a]
    // prev=d(3), next=undefined→3+2=5. moved=(3+5)/2=4
    useHomeStore.getState().reorderWidgets('a', 'd')

    const widgets = [...useHomeStore.getState().widgets].sort((x, y) => x.sort_order - y.sort_order)
    const ids = widgets.map(w => w.id)
    expect(ids).toEqual(['b', 'c', 'd', 'a'])
  })

  it('assigns intermediate sort_order between neighbors', () => {
    // Move 'a' to 'c': after reorder, 'a' is at index 2: [b, c, a, d]
    // prev = c(2), next = d(3) → sort_order = (2+3)/2 = 2.5
    useHomeStore.getState().reorderWidgets('a', 'c')

    const moved = useHomeStore.getState().widgets.find(w => w.id === 'a')
    expect(moved).toBeDefined()
    expect(moved!.sort_order).toBe(2.5)
  })

  it('moves b before a (backward move, b→a results in [b,a,c,d])', () => {
    // activeIdx=1(b), overIdx=0(a)
    // After splice: [a,c,d]. Insert at 0: [b,a,c,d]
    useHomeStore.getState().reorderWidgets('b', 'a')

    const widgets = [...useHomeStore.getState().widgets].sort((x, y) => x.sort_order - y.sort_order)
    const ids = widgets.map(w => w.id)
    // b gets sort_order = (0 + 0)/2 = 0 (prev undefined→0, next=a→0)
    // b(0) and a(0) tie, but b inserted first
    expect(ids[0]).toBe('b')
  })
})
