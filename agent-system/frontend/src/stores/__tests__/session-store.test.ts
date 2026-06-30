import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock the API module so setDisplayName's backend call is a no-op
vi.mock('@/lib/api.ts', () => ({
  fetchSessions: vi.fn(),
  createSession: vi.fn(),
  wrapupSession: vi.fn(),
  setSessionDisplayName: vi.fn().mockResolvedValue({ display_name: null }),
}))

// Provide a minimal localStorage for the 'node' test environment
class MemoryStorage {
  private store = new Map<string, string>()
  getItem(key: string) { return this.store.has(key) ? this.store.get(key)! : null }
  setItem(key: string, value: string) { this.store.set(key, String(value)) }
  removeItem(key: string) { this.store.delete(key) }
  clear() { this.store.clear() }
  key(i: number) { return [...this.store.keys()][i] ?? null }
  get length() { return this.store.size }
}
;(globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage()

import { useSessionStore } from '../session-store.ts'
import type { Session } from '@/lib/types.ts'

function baseSession(overrides: Partial<Session> = {}): Session {
  return {
    name: 'task-agent_abc123',
    status: 'idle',
    ...overrides,
  }
}

describe('getDisplayTitle resolution order', () => {
  beforeEach(() => {
    // Reset localStorage-backed displayNames between tests
    localStorage.clear()
    useSessionStore.setState({ displayNames: {}, sessions: [] })
  })

  it('falls through to session.name when no other source is set', () => {
    const session = baseSession({ name: 'task-agent_abc123' })
    expect(useSessionStore.getState().getDisplayTitle(session)).toBe('task-agent_abc123')
  })

  it('uses task_title when set and display_name/override are absent', () => {
    const session = baseSession({ task_title: 'Fix orphan sweep' })
    expect(useSessionStore.getState().getDisplayTitle(session)).toBe('Fix orphan sweep')
  })

  it('prefers display_name over task_title', () => {
    const session = baseSession({
      task_title: 'Fix orphan sweep',
      display_name: 'Orphan Sweep Investigation',
    })
    expect(useSessionStore.getState().getDisplayTitle(session)).toBe('Orphan Sweep Investigation')
  })

  it('prefers localStorage override over display_name', () => {
    const session = baseSession({
      name: 'task-agent_abc123',
      task_title: 'Fix orphan sweep',
      display_name: 'Orphan Sweep Investigation',
    })
    useSessionStore.setState({ displayNames: { 'task-agent_abc123': 'My Custom Name' } })
    expect(useSessionStore.getState().getDisplayTitle(session)).toBe('My Custom Name')
  })

  it('localStorage override wins even when all lower layers are set', () => {
    const session = baseSession({
      name: 'concierge_xyz',
      task_title: 'T',
      display_name: 'D',
    })
    useSessionStore.setState({ displayNames: { concierge_xyz: 'Override' } })
    expect(useSessionStore.getState().getDisplayTitle(session)).toBe('Override')
  })

  it('ignores empty-string display_name and falls back to task_title', () => {
    const session = baseSession({ task_title: 'Task Title', display_name: '' })
    expect(useSessionStore.getState().getDisplayTitle(session)).toBe('Task Title')
  })

  it('ignores null display_name and falls back to task_title', () => {
    const session = baseSession({ task_title: 'Task Title', display_name: null })
    expect(useSessionStore.getState().getDisplayTitle(session)).toBe('Task Title')
  })
})

describe('isWrappingUp + wrapupAgeSeconds', () => {
  beforeEach(() => {
    localStorage.clear()
    useSessionStore.setState({ displayNames: {}, sessions: [], wrappingUp: new Set() })
  })

  it('returns false when neither local set nor server flag is present', () => {
    const s = baseSession({ name: 'task-agent_abc' })
    expect(useSessionStore.getState().isWrappingUp(s)).toBe(false)
    expect(useSessionStore.getState().wrapupAgeSeconds(s)).toBeNull()
  })

  it('returns true when local wrappingUp set contains the session name (optimistic)', () => {
    const s = baseSession({ name: 'task-agent_abc' })
    useSessionStore.setState({ wrappingUp: new Set(['task-agent_abc']) })
    expect(useSessionStore.getState().isWrappingUp(s)).toBe(true)
    // Age still null because the server flag hasn't arrived yet
    expect(useSessionStore.getState().wrapupAgeSeconds(s)).toBeNull()
  })

  it('returns true when server flag wrapup_started_at is set', () => {
    const iso = new Date(Date.now() - 30_000).toISOString()
    const s = baseSession({ name: 'task-agent_abc', wrapup_started_at: iso })
    expect(useSessionStore.getState().isWrappingUp(s)).toBe(true)
    const age = useSessionStore.getState().wrapupAgeSeconds(s)
    expect(age).toBeGreaterThanOrEqual(29)
    expect(age).toBeLessThanOrEqual(31)
  })

  it('age crosses the 180s force-close threshold when old enough', () => {
    const iso = new Date(Date.now() - 200_000).toISOString()
    const s = baseSession({ name: 'task-agent_abc', wrapup_started_at: iso })
    expect(useSessionStore.getState().wrapupAgeSeconds(s)).toBeGreaterThan(180)
  })

  it('handles malformed wrapup_started_at by returning null age', () => {
    const s = baseSession({ name: 'task-agent_abc', wrapup_started_at: 'not-a-date' })
    expect(useSessionStore.getState().wrapupAgeSeconds(s)).toBeNull()
  })

  it('local set survives after server flag disappears (reverse case — covers race)', () => {
    const s = baseSession({ name: 'task-agent_abc' })
    useSessionStore.setState({ wrappingUp: new Set(['task-agent_abc']) })
    expect(useSessionStore.getState().isWrappingUp(s)).toBe(true)
  })
})

describe('setDisplayName', () => {
  beforeEach(() => {
    localStorage.clear()
    useSessionStore.setState({
      displayNames: {},
      sessions: [baseSession({ name: 'task-agent_abc123', display_name: null })],
    })
  })

  it('writes the override into displayNames and persists to localStorage', () => {
    useSessionStore.getState().setDisplayName('task-agent_abc123', 'Custom')
    expect(useSessionStore.getState().displayNames['task-agent_abc123']).toBe('Custom')
    expect(localStorage.getItem('session-display-names')).toContain('Custom')
  })

  it('removes the override when display_name is null', () => {
    useSessionStore.setState({ displayNames: { 'task-agent_abc123': 'Custom' } })
    useSessionStore.getState().setDisplayName('task-agent_abc123', null)
    expect(useSessionStore.getState().displayNames['task-agent_abc123']).toBeUndefined()
  })

  it('also updates the session row so resolution works after override clears', () => {
    useSessionStore.getState().setDisplayName('task-agent_abc123', 'Custom')
    const session = useSessionStore.getState().sessions.find(s => s.name === 'task-agent_abc123')
    expect(session?.display_name).toBe('Custom')
  })
})
