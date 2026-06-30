import { useEffect, useCallback } from 'react'
import { X } from 'lucide-react'
import { useInboxStore } from '@/stores/inbox-store.ts'
import { QueueCard, QueueCardCompact } from './QueueCard.tsx'
import type { UserTask } from '@/stores/pm-store.ts'
import type { Notification } from '@/lib/types.ts'

type FilterKey = 'all' | 'approval' | 'review' | 'done'

const APPROVAL_TYPES = new Set(['confirm_plan', 'decision'])

const FILTER_LABELS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'approval', label: 'Approval' },
  { key: 'review', label: 'Review' },
  { key: 'done', label: 'Done' },
]

function filterCount(key: FilterKey, items: UserTask[], notifications: Notification[]): number {
  switch (key) {
    case 'all': return items.filter(t => t.status === 'pending').length + notifications.length
    case 'approval': return items.filter(t => t.status === 'pending' && APPROVAL_TYPES.has(t.type)).length
    case 'review': return items.filter(t => t.status === 'pending' && !APPROVAL_TYPES.has(t.type)).length + notifications.length
    case 'done': return items.filter(t => t.status !== 'pending').length
  }
}

function NotificationRow({ notif, onAck }: { notif: Notification; onAck: (id: string) => void }) {
  return (
    <div className="group flex items-start gap-2 py-1.5 px-1 hover:bg-card/50 rounded-sm transition-colors">
      <span className="type-label mt-px shrink-0">✓</span>
      <div className="flex-1 min-w-0">
        <div className="type-label text-foreground leading-snug truncate">{notif.message}</div>
        <div className="type-caption text-[var(--color-text-subtle)]">{notif.display_name || 'Session update'}</div>
      </div>
      <span className="type-caption text-[var(--color-text-subtle)] shrink-0">
        {new Date(notif.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </span>
      <button
        className="shrink-0 bg-transparent border-none p-0 text-muted-foreground cursor-pointer leading-none opacity-0 group-hover:opacity-100 transition-opacity hover:text-foreground"
        onClick={() => onAck(notif.id)}
        title="Dismiss"
      >
        <X size={10} />
      </button>
    </div>
  )
}

function groupByDay(items: UserTask[]): { label: string; items: UserTask[] }[] {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const yesterday = today - 86400000

  const groups: { label: string; items: UserTask[] }[] = [
    { label: 'Today', items: [] },
    { label: 'Yesterday', items: [] },
    { label: 'Older', items: [] },
  ]

  for (const item of items) {
    const ts = new Date(item.resolved || item.created || '').getTime()
    if (ts >= today) groups[0].items.push(item)
    else if (ts >= yesterday) groups[1].items.push(item)
    else groups[2].items.push(item)
  }

  return groups.filter(g => g.items.length > 0)
}

export function QueuePanel() {
  const panelOpen = useInboxStore(s => s.panelOpen)
  const closePanel = useInboxStore(s => s.closePanel)
  const filter = useInboxStore(s => s.filter)
  const setFilter = useInboxStore(s => s.setFilter)
  const queueItems = useInboxStore(s => s.queueItems)
  const notifications = useInboxStore(s => s.notifications)
  const approvalCount = useInboxStore(s => s.approvalCount)
  const reviewCount = useInboxStore(s => s.reviewCount)
  const acknowledgeNotification = useInboxStore(s => s.acknowledgeNotification)

  // Escape to close
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && panelOpen) closePanel()
  }, [panelOpen, closePanel])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  if (!panelOpen) return null

  const approvals = queueItems.filter(t => t.status === 'pending' && APPROVAL_TYPES.has(t.type))
  const reviews = queueItems.filter(t => t.status === 'pending' && !APPROVAL_TYPES.has(t.type))
  const resolved = queueItems.filter(t => t.status !== 'pending')
  const resolvedGroups = groupByDay(resolved)

  // Apply filter
  const showApproval = filter === 'all' || filter === 'approval'
  const showReview = filter === 'all' || filter === 'review'
  const showUpdates = filter === 'all' || filter === 'review'
  const showDone = filter === 'all' || filter === 'done'

  const totalActive = approvalCount + reviewCount + notifications.length

  return (
    <div className="queue-panel open">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border shrink-0">
        <span className="type-body-sm font-semibold text-foreground flex-1">Notifications</span>
        <div className="flex items-center gap-1.5 type-micro text-muted-foreground">
          {approvalCount > 0 && (
            <span className="flex items-center gap-1">
              <span className="w-[6px] h-[6px] rounded-full bg-[rgb(224,90,75)] inline-block" />
              {approvalCount} approval
            </span>
          )}
          {reviewCount > 0 && <span>· {reviewCount} to review</span>}
        </div>
        <button
          className="bg-transparent border-none p-0.5 text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
          onClick={closePanel}
          title="Close"
        >
          <X size={14} />
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex gap-1 px-3 py-2 border-b border-[var(--color-border-subtle)] shrink-0">
        {FILTER_LABELS.map(({ key, label }) => {
          const count = filterCount(key, queueItems, notifications)
          const isActive = filter === key
          const isWaitingFilter = key === 'approval' && approvalCount > 0
          return (
            <button
              key={key}
              className={`px-2 py-0.5 rounded-md type-micro font-medium border-none cursor-pointer transition-colors ${
                isActive
                  ? 'bg-accent text-white'
                  : isWaitingFilter
                    ? 'bg-[rgba(224,90,75,0.1)] text-red hover:bg-[rgba(224,90,75,0.2)]'
                    : 'bg-transparent text-muted-foreground hover:bg-card'
              }`}
              onClick={() => setFilter(key)}
            >
              {label} {count > 0 ? count : ''}
            </button>
          )
        })}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-3 py-2 flex flex-col gap-3">
        {totalActive === 0 && filter !== 'done' && (
          <div className="flex flex-col items-center justify-center py-8 gap-2 text-muted-foreground">
            <span className="text-lg">✓</span>
            <span className="text-sm">All clear</span>
            <span className="text-xs">Your agents are working. Nothing needs your attention.</span>
          </div>
        )}

        {/* NEEDS APPROVAL section */}
        {showApproval && approvals.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="type-caption font-bold uppercase tracking-wider text-red flex items-center gap-1.5">
              Needs Approval
              <span className="text-[var(--color-text-subtle)] font-normal normal-case tracking-normal">— waiting</span>
            </div>
            {approvals.map(task => (
              <QueueCard key={task.id} task={task} />
            ))}
          </div>
        )}

        {/* FOR REVIEW section */}
        {showReview && reviews.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="type-caption font-bold uppercase tracking-wider text-muted-foreground">
              For Review
            </div>
            {reviews.map(task => (
              <QueueCard key={task.id} task={task} />
            ))}
          </div>
        )}

        {/* UPDATES section (notifications) */}
        {showUpdates && notifications.length > 0 && (
          <div className="flex flex-col gap-0.5">
            <div className="type-caption font-bold uppercase tracking-wider text-muted-foreground mb-1">
              Updates
            </div>
            {notifications.map(n => (
              <NotificationRow key={n.id} notif={n} onAck={acknowledgeNotification} />
            ))}
          </div>
        )}

        {/* DONE section */}
        {showDone && resolvedGroups.length > 0 && (
          <div className="flex flex-col gap-1">
            {resolvedGroups.map(group => (
              <details key={group.label}>
                <summary className="cursor-pointer type-caption font-bold uppercase tracking-wider text-muted-foreground py-1 flex items-center gap-1">
                  {group.label}
                  <span className="font-normal normal-case">({group.items.length})</span>
                </summary>
                <div className="flex flex-col gap-0.5 pt-1">
                  {group.items.map(task => (
                    <QueueCardCompact key={task.id} task={task} />
                  ))}
                </div>
              </details>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
