import { useState } from 'react'
import { CheckCircle2, AlertTriangle, Clock, FileText, Shield, MessageSquare, Eye, X } from 'lucide-react'
import { useInboxStore } from '@/stores/inbox-store.ts'
import { useTabStore } from '@/stores/tab-store.ts'
import { useSessionStore } from '@/stores/session-store.ts'
import { ActionButton, FileChip } from '@/components/primitives'
import * as api from '@/lib/api.ts'
import type { UserTask } from '@/stores/pm-store.ts'

function typeIcon(type: string) {
  switch (type) {
    case 'confirm_plan': return <CheckCircle2 size={14} className="text-accent" />
    case 'decision': return <AlertTriangle size={14} className="text-orange" />
    case 'read_document': return <FileText size={14} className="text-muted-foreground" />
    case 'external_action': return <MessageSquare size={14} className="text-accent" />
    case 'credential_action': return <Shield size={14} className="text-red" />
    case 'review_output':
    case 'review_artifact':
      return <Eye size={14} className="text-accent" />
    default: return <Clock size={14} className="text-muted-foreground" />
  }
}

function typeLabel(type: string): string {
  const labels: Record<string, string> = {
    confirm_plan: 'Confirm Plan',
    read_document: 'Read Document',
    decision: 'Decision',
    external_action: 'External Action',
    credential_action: 'Credential Action',
    review_output: 'Review Output',
    review_artifact: 'Review Artifact',
  }
  return labels[type] || type.replace(/_/g, ' ')
}

function requestSummary(task: UserTask): string {
  switch (task.type) {
    case 'confirm_plan':
      return 'Approve the proposed plan so the agent can continue.'
    case 'decision':
      return 'Choose a direction so the agent can continue.'
    case 'read_document':
      return 'Read the referenced document and mark it reviewed.'
    case 'review_output':
    case 'review_artifact':
      return 'Review the output before the work moves on.'
    case 'credential_action':
      return 'Complete the credential step outside the agent session.'
    case 'external_action':
      return 'Complete the external step and return to the agent if needed.'
    default:
      return task.urgency === 'blocking'
        ? 'This needs your input before the agent can continue.'
        : 'This is waiting for your review.'
  }
}

function compactLocation(task: UserTask): string | null {
  if (task.files?.[0]) {
    const parts = task.files[0].split('/').filter(Boolean)
    const projectsIndex = parts.indexOf('projects')
    if (projectsIndex >= 0 && parts[projectsIndex + 1]) return parts[projectsIndex + 1]
  }
  return null
}

function timeAgo(dateStr?: string): string {
  if (!dateStr) return ''
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  return `${days}d`
}

function isStale(dateStr?: string): boolean {
  if (!dateStr) return false
  return Date.now() - new Date(dateStr).getTime() > 24 * 60 * 60 * 1000
}

export function QueueCard({ task }: { task: UserTask }) {
  const resolveItem = useInboxStore(s => s.resolveItem)
  const openDocTab = useTabStore(s => s.openDocTab)
  const openAgentTab = useTabStore(s => s.openAgentTab)
  const [sending, setSending] = useState(false)
  const [sessionDead, setSessionDead] = useState(false)

  const isPending = task.status === 'pending'
  const isConfirmation = task.type === 'confirm_plan' || task.type === 'decision'
  const isWaiting = task.urgency === 'blocking'
  const stale = isPending && isStale(task.created)
  const location = compactLocation(task)

  const handleApprove = async () => {
    setSending(true)
    try {
      if (task.session_name) {
        await api.sendMessage(task.session_name, `[Queue item: "${task.title}" (${task.id})] Approved. Proceed.`).catch(() => {
          setSessionDead(true)
        })
      }
      await resolveItem(task.id)
    } finally {
      setSending(false)
    }
  }

  const handleDone = async () => {
    setSending(true)
    try {
      await resolveItem(task.id)
    } finally {
      setSending(false)
    }
  }

  const handleReply = () => {
    if (task.session_name) {
      useSessionStore.getState().setActiveSession(task.session_name)
      openAgentTab(task.session_name)
    }
  }

  const handleDismiss = async () => {
    await resolveItem(task.id)
  }

  const handleViewFile = (filePath: string) => {
    // Prefer the HTML twin when one exists for this task's primary file.
    // Twin lookup happens server-side (pm.py:get_user_tasks); we just
    // honour the html_url it stamped on the queue item.
    if (task.html_url) {
      window.open(task.html_url, '_blank', 'noopener,noreferrer')
      return
    }
    openDocTab(filePath, false, isConfirmation ? 'plan' as const : undefined)
  }

  return (
    <div className={`group bg-card border border-border rounded-md p-3 flex flex-col gap-2 transition-colors duration-150 hover:border-[var(--color-border-strong)] ${isWaiting && isPending ? 'border-l-[3px] border-l-[rgb(224,90,75)] bg-[rgba(224,90,75,0.04)]' : ''} ${!isPending ? 'opacity-60' : ''}`}>
      {/* Stale banner */}
      {stale && (
        <div className="type-caption font-bold uppercase tracking-wider text-orange px-1.5 py-0.5 bg-[rgba(255,165,0,0.08)] rounded-sm -mx-1 -mt-1">
          Waiting {timeAgo(task.created)}
        </div>
      )}

      <div className="flex flex-col relative gap-2">
        {isPending && (
          <button className="absolute top-0 right-0 bg-transparent border-none p-0.5 text-[var(--color-text-subtle)] cursor-pointer leading-none opacity-0 group-hover:opacity-100 hover:text-red transition-opacity" onClick={handleDismiss} title="Dismiss">
            <X size={14} />
          </button>
        )}
        <div className="flex items-start gap-2 pr-5">
          <div className="mt-0.5 shrink-0">{typeIcon(task.type)}</div>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-1.5">
              <span className="font-mono type-micro text-muted-foreground">{typeLabel(task.type)}</span>
              {isWaiting && isPending && (
                <>
                  <span className="text-[var(--color-text-subtle)]">&middot;</span>
                  <span className="type-micro font-semibold text-red">Paused</span>
                </>
              )}
              {!isWaiting && isPending && (
                <>
                  <span className="text-[var(--color-text-subtle)]">&middot;</span>
                  <span className="type-micro text-[var(--color-text-subtle)]">Review requested</span>
                </>
              )}
            </div>
            <p className="type-body-sm font-medium text-foreground m-0 leading-tight mt-0.5">{task.title}</p>
          </div>
          {!stale && <span className="type-micro text-[var(--color-text-subtle)] shrink-0">{timeAgo(task.created)}</span>}
        </div>

        <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 type-micro">
          {location && (
            <>
              <span className="text-[var(--color-text-subtle)]">Where</span>
              <span className="font-mono text-muted-foreground truncate" title={location}>{location}</span>
            </>
          )}
          <span className="text-[var(--color-text-subtle)]">Needs</span>
          <span className="text-muted-foreground">{requestSummary(task)}</span>
        </div>

        {task.context && (
          <p className="text-xs text-muted-foreground m-0 leading-snug rounded-sm bg-[var(--bg-ingrained)] px-2 py-1.5">
            {task.context}
          </p>
        )}
      </div>

      {/* File links */}
      {task.files && task.files.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {task.files.map((file, i) => (
            <FileChip
              key={i}
              onClick={() => handleViewFile(file)}
              title={file}
            >
              <FileText size={12} />
              <span>{file.split('/').pop()}</span>
            </FileChip>
          ))}
        </div>
      )}

      {/* Actions for pending items */}
      {isPending && (
        <div className="flex items-center gap-2 flex-wrap">
          {task.files && task.files.length > 0 && (
            <ActionButton variant="secondary" size="sm" onClick={() => task.files && handleViewFile(task.files[0])}>
              View {isConfirmation ? 'plan' : 'file'}{task.html_url ? (task.html_stale ? ' (HTML, stale)' : ' (HTML)') : ''}
            </ActionButton>
          )}
          {isConfirmation ? (
            <ActionButton variant="approve" size="sm" onClick={handleApprove} disabled={sending}>
              <CheckCircle2 size={12} /> {sending ? '...' : 'Approve'}
            </ActionButton>
          ) : (
            <ActionButton variant="done" size="sm" onClick={handleDone} disabled={sending}>
              <CheckCircle2 size={12} /> {sending ? '...' : 'Done'}
            </ActionButton>
          )}
          {task.session_name && !sessionDead && (
            <ActionButton variant="secondary" size="sm" onClick={handleReply}>
              <MessageSquare size={12} /> Open session
            </ActionButton>
          )}
          {sessionDead && (
            <span className="type-micro text-[var(--color-text-subtle)] italic">Agent session ended</span>
          )}
        </div>
      )}

      {/* Resolved badge */}
      {!isPending && (
        <div className="flex items-center gap-2 type-micro text-muted-foreground">
          <span className="bg-[var(--color-accent-dim)] text-accent px-1.5 py-px rounded-full type-caption font-semibold">{task.status}</span>
          {task.resolution && <span>{task.resolution}</span>}
        </div>
      )}
    </div>
  )
}

/** Compact one-line card for resolved items */
export function QueueCardCompact({ task }: { task: UserTask }) {
  return (
    <div className="flex items-center gap-2 py-1 px-1 type-micro text-muted-foreground">
      {typeIcon(task.type)}
      <span className="flex-1 truncate">{task.title}</span>
      <span className="shrink-0">{timeAgo(task.resolved || task.created)}</span>
    </div>
  )
}
