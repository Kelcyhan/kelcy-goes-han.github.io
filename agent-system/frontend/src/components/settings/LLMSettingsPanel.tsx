import { useCallback, useEffect, useState } from 'react'
import * as api from '@/lib/api.ts'
import { useSessionStore } from '@/stores/session-store.ts'
import { ActionButton } from '@/components/primitives'

type Props = {
  compact?: boolean
  onOpenAdvanced?: () => void
}

export function LLMSettingsPanel({ compact = false, onOpenAdvanced }: Props) {
  const [payload, setPayload] = useState<api.LLMSettingsPayload | null>(null)
  const [status, setStatus] = useState('')
  const sessions = useSessionStore(s => s.sessions)
  const sessionStatuses = useSessionStore(s => s.sessionStatuses)

  const refresh = useCallback(async () => {
    try {
      setPayload(await api.fetchLLMSettings())
      setStatus('')
    } catch (err: any) {
      setStatus(err?.message || 'Failed to load AI settings.')
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  if (!payload) {
    return <div className="type-micro text-muted-foreground">Loading AI settings…</div>
  }

  const defaultProvider = payload.settings.providers?.default_provider
  const blockedProviders = new Set<string>(
    sessions
      .filter(session => (sessionStatuses[session.name] ?? session.status) === 'login_required')
      .map(session => (session.login_provider === 'codex' || session.runtime === 'codex') ? 'codex' : 'claude'),
  )
  const loggedIn = Object.entries(payload.providers)
    .filter(([provider, ok]) => ok && !blockedProviders.has(provider))
    .map(([provider]) => provider)
  const sizeClass = compact ? 'type-micro' : 'type-label'

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <div className={`font-medium ${sizeClass}`}>AI Settings</div>
        <div className="type-micro text-muted-foreground">
          Default AI plus advanced role, widget, and tool defaults live on the full page.
        </div>
      </div>

      <div className="rounded-md border border-border bg-[rgba(255,255,255,0.03)] p-2.5">
        <div className="type-caption uppercase tracking-[0.18em] text-muted-foreground">Default AI</div>
        <div className="mt-1 type-label font-medium text-foreground">
          {defaultProvider ? (defaultProvider === 'codex' ? 'Codex' : 'Claude') : 'Not explicitly set'}
        </div>
        <div className="mt-1 type-micro text-muted-foreground">
          Connected: {loggedIn.length ? loggedIn.join(', ') : 'none'}
        </div>
      </div>

      {payload.warnings.length > 0 && (
        <div className="rounded-md border border-orange/30 bg-orange/10 p-2 type-micro text-orange">
          {payload.warnings[0]}
        </div>
      )}

      {status && <div className="type-micro text-muted-foreground">{status}</div>}

      <ActionButton
        type="button"
        onClick={onOpenAdvanced}
        variant="toolbar"
        size="default"
      >
        Open full AI settings
      </ActionButton>
    </div>
  )
}
