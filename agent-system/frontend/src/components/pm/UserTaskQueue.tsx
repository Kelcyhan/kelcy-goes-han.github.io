import { useState } from 'react'
import { CheckCircle2, AlertTriangle, Clock, FileText, Shield, MessageSquare, Eye, ExternalLink, X } from 'lucide-react'
import { usePMStore } from '@/stores/pm-store.ts'
import { useTabStore } from '@/stores/tab-store.ts'
import { useSessionStore } from '@/stores/session-store.ts'
import { ActionButton, FileChip, PMBadge } from '@/components/primitives'
import * as api from '@/lib/api.ts'
import type { UserTask } from '@/stores/pm-store.ts'

function taskTypeIcon(type: string) {
  switch (type) {
    case 'confirm_plan': return <CheckCircle2 size={14} className="text-accent" />
    case 'decision': return <AlertTriangle size={14} className="text-orange" />
    case 'read_document': return <FileText size={14} className="text-muted-foreground" />
    case 'external_action': return <MessageSquare size={14} className="text-accent" />
    case 'credential_action': return <Shield size={14} className="text-red" />
    case 'review_output': return <Eye size={14} className="text-accent" />
    default: return <Clock size={14} className="text-muted-foreground" />
  }
}

function taskTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    confirm_plan: 'Confirm Plan',
    read_document: 'Read Document',
    decision: 'Decision',
    external_action: 'External Action',
    credential_action: 'Credential Action',
    review_output: 'Review Output',
  }
  return labels[type] || type.replace(/_/g, ' ')
}

function timeAgo(dateStr?: string): string {
  if (!dateStr) return ''
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`
  const days = Math.floor(hours / 24)
  return `${days} day${days !== 1 ? 's' : ''} ago`
}

function UserTaskCard({ task }: { task: UserTask }) {
  const resolveUserTask = usePMStore(s => s.resolveUserTask)
  const fetchUserTasks = usePMStore(s => s.fetchUserTasks)
  const openDocTab = useTabStore(s => s.openDocTab)
  const openAgentTab = useTabStore(s => s.openAgentTab)
  const [sending, setSending] = useState(false)
  const [sessionDead, setSessionDead] = useState(false)

  const isPending = task.status === 'pending'
  const isConfirmation = task.type === 'confirm_plan' || task.type === 'decision'

  const handleApprove = async () => {
    setSending(true)
    try {
      if (task.session_name) {
        await api.sendMessage(task.session_name, `[Queue item: "${task.title}" (${task.id})] Approved. Proceed.`).catch(() => {
          setSessionDead(true)
        })
      }
      await resolveUserTask(task.id)
    } catch {
      await fetchUserTasks()
    } finally {
      setSending(false)
    }
  }

  const handleDone = async () => {
    setSending(true)
    try {
      if (task.session_name) {
        await api.sendMessage(task.session_name, `[Queue item: "${task.title}" (${task.id})] Resolved by user.`).catch(() => {})
      }
      await resolveUserTask(task.id)
    } catch {
      await fetchUserTasks()
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
    try {
      await resolveUserTask(task.id, 'Dismissed', 'dismissed')
    } catch {
      await fetchUserTasks()
    }
  }

  const handleViewFile = (filePath: string) => {
    openDocTab(filePath, false, isConfirmation ? 'plan' as const : undefined)
  }

  return (
    <div className={`group bg-card border border-border rounded-md p-3 flex flex-col gap-2 transition-colors duration-150 hover:border-[var(--color-border-strong)] ${task.urgency === 'blocking' ? 'border-l-[3px] border-l-[rgb(224,90,75)] bg-[rgba(224,90,75,0.04)]' : ''} ${!isPending ? 'opacity-60' : ''}`}>
      <div className="flex flex-col relative gap-1">
        {isPending && (
          <button className="absolute top-0 right-0 bg-transparent border-none p-0.5 text-[var(--color-text-subtle)] cursor-pointer leading-none opacity-0 group-hover:opacity-100 hover:text-red transition-opacity" onClick={handleDismiss} title="Dismiss">
            <X size={14} />
          </button>
        )}
        <div className="flex items-center gap-1.5 text-xs">
          {taskTypeIcon(task.type)}
          <span className="font-mono type-micro text-muted-foreground">{taskTypeLabel(task.type)}</span>
          <span className="ml-auto type-micro text-[var(--color-text-subtle)]">{timeAgo(task.created)}</span>
        </div>
        <p className="type-body-sm font-medium text-foreground m-0">{task.title}</p>
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

      {task.context && <p className="text-xs text-muted-foreground m-0">{task.context}</p>}

      {/* Actions for pending items */}
      {isPending && (
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-2">
            {task.files && task.files.length > 0 && (
              <ActionButton
                variant="secondary"
                size="sm"
                onClick={() => task.files && handleViewFile(task.files[0])}
              >
                <ExternalLink size={12} /> View {isConfirmation ? 'plan' : 'files'}
              </ActionButton>
            )}
          </div>
          <div className="flex gap-2 flex-wrap">
            {isConfirmation ? (
              <ActionButton
                variant="approve"
                size="sm"
                onClick={handleApprove}
                disabled={sending}
              >
                <CheckCircle2 size={12} /> {sending ? '...' : 'Approve'}
              </ActionButton>
            ) : (
              <ActionButton
                variant="done"
                size="sm"
                onClick={handleDone}
                disabled={sending}
              >
                <CheckCircle2 size={12} /> {sending ? '...' : 'Done'}
              </ActionButton>
            )}
            {task.session_name && !sessionDead && (
              <ActionButton
                variant="secondary"
                size="sm"
                onClick={handleReply}
              >
                <MessageSquare size={12} /> Reply
              </ActionButton>
            )}
          </div>
          {sessionDead && (
            <span className="type-micro text-[var(--color-text-subtle)] italic">Agent session ended</span>
          )}
        </div>
      )}

      {/* Resolved badge */}
      {!isPending && (
        <div className="flex items-center gap-2">
          <PMBadge variant="gray">{task.status}</PMBadge>
          {task.resolution && <span className="text-muted-foreground type-micro">{task.resolution}</span>}
        </div>
      )}
    </div>
  )
}

export function UserTaskQueue() {
  const userTasks = usePMStore(s => s.userTasks)
  const pendingCount = usePMStore(s => s.pendingCount)
  const blockingCount = usePMStore(s => s.blockingCount)

  const blocking = userTasks.filter(t => t.status === 'pending' && t.urgency === 'blocking')
  const normal = userTasks.filter(t => t.status === 'pending' && t.urgency !== 'blocking')
  const resolved = userTasks.filter(t => t.status !== 'pending')

  if (userTasks.length === 0) return null

  return (
    <div className="flex flex-col gap-2 border-t border-border pt-3 mt-1">
      <h2 className="type-body-sm font-semibold text-foreground flex items-center gap-2 m-0">
        Queue
        {pendingCount > 0 && (
          <PMBadge variant="count">{pendingCount} pending</PMBadge>
        )}
        {blockingCount > 0 && (
          <PMBadge variant="red">{blockingCount} blocking</PMBadge>
        )}
      </h2>

      {/* Blocking items first */}
      {blocking.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="type-caption font-bold uppercase tracking-wider text-red py-1 px-0">BLOCKING</div>
          {blocking.map(task => (
            <UserTaskCard key={task.id} task={task} />
          ))}
        </div>
      )}

      {/* Normal items */}
      {normal.length > 0 && (
        <div className="flex flex-col gap-2">
          {blocking.length > 0 && (
            <div className="type-caption font-bold uppercase tracking-wider text-muted-foreground py-1 px-0">NORMAL</div>
          )}
          {normal.map(task => (
            <UserTaskCard key={task.id} task={task} />
          ))}
        </div>
      )}

      {/* Resolved — collapsed */}
      {resolved.length > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs py-1 text-muted-foreground">{resolved.length} resolved</summary>
          <div className="flex flex-col gap-2">
            {resolved.map(task => (
              <UserTaskCard key={task.id} task={task} />
            ))}
          </div>
        </details>
      )}
    </div>
  )
}
