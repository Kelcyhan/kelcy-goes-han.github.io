import { create } from 'zustand'
import type { Notification } from '@/lib/types.ts'
import type { UserTask } from '@/stores/pm-store.ts'
import * as api from '@/lib/api.ts'

type InboxFilter = 'all' | 'approval' | 'review' | 'done'

interface InboxStore {
  // Data
  queueItems: UserTask[]
  notifications: Notification[]
  approvalCount: number           // confirm_plan + decision (agent paused)
  reviewCount: number             // read_document, review_output, external_action

  // Panel state
  panelOpen: boolean
  filter: InboxFilter

  // Actions
  fetchAll: () => Promise<void>
  fetchQueue: () => Promise<void>
  fetchNotifications: () => Promise<void>
  resolveItem: (id: string, resolution?: string, status?: 'resolved' | 'dismissed') => Promise<void>
  acknowledgeNotification: (id: string) => Promise<void>
  togglePanel: () => void
  openPanel: () => void
  closePanel: () => void
  setFilter: (f: InboxFilter) => void
}

export const useInboxStore = create<InboxStore>()((set, get) => ({
  queueItems: [],
  notifications: [],
  approvalCount: 0,
  reviewCount: 0,

  panelOpen: false,
  filter: 'all',

  fetchAll: async () => {
    await Promise.all([get().fetchQueue(), get().fetchNotifications()])
  },

  fetchQueue: async () => {
    try {
      const data = await api.fetchUserTasks()
      const approvalTypes = new Set(['confirm_plan', 'decision'])
      const pending = data.tasks.filter((t: UserTask) => t.status === 'pending')
      set({
        queueItems: data.tasks,
        approvalCount: pending.filter((t: UserTask) => approvalTypes.has(t.type)).length,
        reviewCount: pending.filter((t: UserTask) => !approvalTypes.has(t.type)).length,
      })
    } catch { /* ignore */ }
  },

  fetchNotifications: async () => {
    try {
      const data = await api.fetchNotifications()
      set({ notifications: data.notifications })
    } catch { /* ignore */ }
  },

  resolveItem: async (id, resolution, status) => {
    try {
      // Silent resolve — no message to agent session.
      // Only handleApprove in QueueCard explicitly messages the agent.
      await api.resolveUserTask(id, resolution, status)
      await get().fetchQueue()
    } catch {
      await get().fetchQueue()
    }
  },

  acknowledgeNotification: async (id) => {
    try {
      await api.acknowledgeNotification(id)
    } catch { /* ignore */ }
    set(state => ({
      notifications: state.notifications.filter(n => n.id !== id),
    }))
  },

  togglePanel: () => set(s => ({ panelOpen: !s.panelOpen })),
  openPanel: () => set({ panelOpen: true }),
  closePanel: () => set({ panelOpen: false }),
  setFilter: (filter) => set({ filter }),
}))
