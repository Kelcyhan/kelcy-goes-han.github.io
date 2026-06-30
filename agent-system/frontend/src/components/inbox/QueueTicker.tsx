import { useEffect } from 'react'
import { useInboxStore } from '@/stores/inbox-store.ts'

export function QueueTicker() {
  const queueItems = useInboxStore(s => s.queueItems)
  const notifications = useInboxStore(s => s.notifications)
  const approvalCount = useInboxStore(s => s.approvalCount)
  const reviewCount = useInboxStore(s => s.reviewCount)
  const panelOpen = useInboxStore(s => s.panelOpen)
  const togglePanel = useInboxStore(s => s.togglePanel)
  const fetchAll = useInboxStore(s => s.fetchAll)
  const fetchNotifications = useInboxStore(s => s.fetchNotifications)

  const fetchQueue = useInboxStore(s => s.fetchQueue)

  // Poll notifications every 3s, queue every 10s (fallback to SSE)
  useEffect(() => {
    fetchAll()
    const notifInterval = setInterval(fetchNotifications, 3000)
    const queueInterval = setInterval(fetchQueue, 10000)
    return () => { clearInterval(notifInterval); clearInterval(queueInterval) }
  }, [fetchAll, fetchNotifications, fetchQueue])

  const pending = queueItems.filter(t => t.status === 'pending')
  const totalPending = pending.length + notifications.length
  const hasApproval = approvalCount > 0

  // Build ticker text from pending items
  const tickerItems = pending.map(t => t.title)
  if (notifications.length > 0) {
    tickerItems.push(...notifications.map(n => n.message))
  }
  const tickerText = tickerItems.join('  ·  ')

  // If no items, show calm "all clear"
  if (totalPending === 0 && !panelOpen) {
    return (
      <div
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-card border border-border cursor-pointer hover:border-[var(--color-border-strong)] transition-colors type-micro text-muted-foreground select-none"
        onClick={togglePanel}
        title="Open notification panel"
      >
        <span>✓</span>
        <span>All clear</span>
      </div>
    )
  }

  // Single item — no scroll needed
  if (tickerItems.length <= 1 && !panelOpen) {
    return (
      <div
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-card border cursor-pointer hover:border-[var(--color-border-strong)] transition-colors select-none ${hasApproval ? 'border-[rgba(224,90,75,0.4)]' : 'border-border'}`}
        onClick={togglePanel}
        title="Open notification panel"
      >
        {hasApproval && (
          <span className="flex items-center justify-center w-[14px] h-[14px] rounded-full bg-[rgb(224,90,75)] text-white type-caption font-bold shrink-0">{approvalCount}</span>
        )}
        <span className="type-micro text-foreground truncate max-w-[180px]">
          {tickerItems[0] || `${totalPending} to review`}
        </span>
      </div>
    )
  }

  // Multiple items — scrolling ticker
  return (
    <div
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-card border cursor-pointer hover:border-[var(--color-border-strong)] transition-colors select-none overflow-hidden ${hasApproval ? 'border-[rgba(224,90,75,0.4)] queue-ticker-pulse' : 'border-border'}`}
      onClick={togglePanel}
      title="Open notification panel"
      style={{ maxWidth: 220 }}
    >
      {/* Fixed badge */}
      <div className="flex items-center gap-1 shrink-0">
        {hasApproval && (
          <span className="flex items-center justify-center w-[14px] h-[14px] rounded-full bg-[rgb(224,90,75)] text-white type-caption font-bold">{approvalCount}</span>
        )}
        {reviewCount > 0 && (
          <span className="type-caption text-muted-foreground">{reviewCount + approvalCount}</span>
        )}
      </div>

      {/* Scrolling text area */}
      <div className="flex-1 overflow-hidden relative" style={{ minWidth: 0 }}>
        <div
          className="ticker-scroll whitespace-nowrap type-micro text-foreground"
          style={{ animationDuration: `${Math.max(10, tickerText.length * 0.15)}s` }}
        >
          <span>{tickerText}</span>
          <span className="pl-12">{tickerText}</span>
        </div>
      </div>
    </div>
  )
}
