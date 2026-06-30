import { useSessionStore } from '@/stores/session-store.ts'
import { useChatStore } from '@/stores/chat-store.ts'
import { formatModelName, formatTokens } from '@/lib/markdown.ts'
import { StatusDot } from '@/components/primitives'

interface StatusBarProps {
  sessionName: string
}

export function StatusBar({ sessionName }: StatusBarProps) {
  const sessionStatus = useSessionStore(s => s.sessionStatuses[sessionName] ?? 'unknown')
  const chatModel = useChatStore(s => s.sessions[sessionName]?.model ?? null)
  // Fallback: read model from session metadata (available before WebSocket streams messages)
  const metaModel = useSessionStore(s => {
    const sess = s.sessions.find(x => x.name === sessionName)
    return sess?.model ?? null
  })
  const model = chatModel || metaModel
  const contextTokens = useChatStore(s => s.sessions[sessionName]?.contextTokens ?? 0)
  const totalInputTokens = useChatStore(s => s.sessions[sessionName]?.totalInputTokens ?? 0)
  const totalOutputTokens = useChatStore(s => s.sessions[sessionName]?.totalOutputTokens ?? 0)

  const dotStatus = sessionStatus === 'working'
    ? 'working' as const
    : sessionStatus === 'idle'
      ? 'idle' as const
      : sessionStatus === 'waiting_input' || sessionStatus === 'login_required'
        ? 'waiting' as const
        : 'unknown' as const

  const statusLabel = sessionStatus === 'waiting_input' ? 'needs input'
    : sessionStatus === 'login_required' ? 'needs login'
    : (sessionStatus || '-')

  let tokenDisplay = ''
  if (contextTokens) {
    tokenDisplay = `${formatTokens(contextTokens)} context`
  } else if (totalInputTokens || totalOutputTokens) {
    tokenDisplay = `${formatTokens(totalInputTokens)} in / ${formatTokens(totalOutputTokens)} out`
  }

  return (
    <div className="flex px-5 py-1 border-t border-[var(--color-border-subtle)] bg-[var(--bg-surface)] type-micro text-muted-foreground gap-4 items-center shrink-0">
      <div className="flex items-center gap-1">
        <StatusDot status={dotStatus} size="sm" />
        <span>{statusLabel}</span>
      </div>
      {model && (
        <span className="opacity-70">{formatModelName(model)}</span>
      )}
      {tokenDisplay && (
        <span>{tokenDisplay}</span>
      )}
    </div>
  )
}
