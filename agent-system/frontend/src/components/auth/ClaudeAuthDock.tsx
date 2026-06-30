import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ExternalLink, Link2, LogIn, LogOut, ShieldAlert, ShieldCheck, Copy, Check, Loader2, RefreshCw } from 'lucide-react'
import { useSessionStore } from '@/stores/session-store.ts'
import { useProviderStore } from '@/stores/provider-store.ts'
import * as api from '@/lib/api.ts'
import { ActionButton } from '@/components/primitives'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ClaudeFlowState =
  | { phase: 'idle' }
  | { phase: 'fetching' }
  | { phase: 'waiting_code'; url: string; session: string }
  | { phase: 'submitting'; url: string; session: string }
  | { phase: 'submitted'; session: string }
  | { phase: 'logging_out' }
  | { phase: 'error'; message: string; url?: string; session?: string }

type CodexFlowState =
  | { phase: 'idle' }
  | { phase: 'fetching' }
  | { phase: 'waiting_completion'; url: string; code: string }
  | { phase: 'logging_out' }
  | { phase: 'error'; message: string }

const LOGIN_ALERT_SUPPRESSIONS_KEY = 'auth-login-alert-suppressions'

type LoginAlert = {
  session: string
  provider: 'claude' | 'codex'
  key: string
}

function isClaudeCodeEntry(state: ClaudeFlowState): state is
  | { phase: 'waiting_code'; url: string; session: string }
  | { phase: 'submitting'; url: string; session: string }
  | { phase: 'error'; message: string; url?: string; session?: string } {
  return state.phase === 'waiting_code' || state.phase === 'submitting' || state.phase === 'error'
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ClaudeAuthDock({
  embedded = false,
  onProvidersChange,
}: {
  embedded?: boolean
  onProvidersChange?: (providers: api.ProvidersMap) => void
} = {}) {
  const sessions = useSessionStore(s => s.sessions)
  const sessionStatuses = useSessionStore(s => s.sessionStatuses)
  const refreshSessions = useSessionStore(s => s.refreshSessions)

  const providers = useProviderStore(s => s.providers)
  const refreshProviders = useProviderStore(s => s.refreshProviders)
  const setProviderInStore = useProviderStore(s => s.setProvider)
  const connectProviderStore = useProviderStore(s => s.connect)

  const [open, setOpen] = useState(false)
  const [claudeState, setClaudeState] = useState<ClaudeFlowState>({ phase: 'idle' })
  const [codexState, setCodexState] = useState<CodexFlowState>({ phase: 'idle' })
  const [loginCode, setLoginCode] = useState('')
  const [copyFeedback, setCopyFeedback] = useState<Record<string, 'idle' | 'copied' | 'error'>>({})
  const [suppressedSession, setSuppressedSession] = useState<string | null>(null)
  const [suppressedLoginAlerts, setSuppressedLoginAlerts] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(LOGIN_ALERT_SUPPRESSIONS_KEY) || '[]'))
    } catch {
      return new Set()
    }
  })

  const codexPollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const claudeLoginInFlight = useRef<Promise<void> | null>(null)

  const claudeStatus = providers.claude
  const codexStatus = providers.codex

  const loginRequiredAlerts = useMemo<LoginAlert[]>(
    () => sessions
      .filter(s => (sessionStatuses[s.name] ?? s.status) === 'login_required')
      .map(s => {
        const provider = s.login_provider === 'codex' || s.runtime === 'codex' ? 'codex' : 'claude'
        const failureId = s.login_failure_id || 'current'
        return {
          session: s.name,
          provider,
          key: `${provider}:${s.name}:${failureId}`,
        }
      }),
    [sessions, sessionStatuses],
  )

  const unresolvedLoginAlerts = useMemo(
    () => loginRequiredAlerts.filter(alert =>
      alert.session !== suppressedSession && !suppressedLoginAlerts.has(alert.key)
    ),
    [loginRequiredAlerts, suppressedLoginAlerts, suppressedSession],
  )

  const claudeLoggedOut = claudeStatus?.loggedIn === false
  const codexLoggedOut = codexStatus?.loggedIn === false
  const claudeSessionBlocked = unresolvedLoginAlerts.some(a => a.provider === 'claude')
  const codexSessionBlocked = unresolvedLoginAlerts.some(a => a.provider === 'codex')
  const needsAttention = unresolvedLoginAlerts.length > 0 || claudeLoggedOut || codexLoggedOut
  const allLoggedIn = claudeStatus?.loggedIn && codexStatus?.loggedIn
  const showExpandedPill = open || needsAttention

  const suppressLoginAlerts = useCallback((alerts: LoginAlert[]) => {
    if (alerts.length === 0) return
    setSuppressedLoginAlerts(prev => {
      const next = new Set(prev)
      for (const alert of alerts) next.add(alert.key)
      try {
        localStorage.setItem(LOGIN_ALERT_SUPPRESSIONS_KEY, JSON.stringify([...next]))
      } catch { /* ignore */ }
      return next
    })
  }, [])

  // Provider status now lives in useProviderStore. Connect once per mount;
  // the store handles polling + visibility/focus refetch internally.
  useEffect(() => {
    const disconnect = connectProviderStore()
    return disconnect
  }, [connectProviderStore])

  // Bridge: fire onProvidersChange when providers change, for callers that
  // still consume the prop callback (embedded variants).
  useEffect(() => {
    onProvidersChange?.(providers)
  }, [providers, onProvidersChange])

  // --- Claude: suppressed-session cleanup ---
  useEffect(() => {
    if (!suppressedSession) return
    if (!loginRequiredAlerts.some(alert => alert.session === suppressedSession)) {
      setSuppressedSession(null)
      setClaudeState({ phase: 'idle' })
      setLoginCode('')
    }
  }, [loginRequiredAlerts, suppressedSession])

  // --- Codex: poll status while waiting for completion ---
  useEffect(() => {
    if (codexState.phase !== 'waiting_completion') {
      if (codexPollRef.current) {
        clearInterval(codexPollRef.current)
        codexPollRef.current = null
      }
      return
    }
    codexPollRef.current = setInterval(async () => {
      try {
        const st = await api.providerStatus('codex')
        if (st.loggedIn) {
          setCodexState({ phase: 'idle' })
          setProviderInStore('codex', st)
          suppressLoginAlerts(loginRequiredAlerts.filter(alert => alert.provider === 'codex'))
        }
      } catch { /* keep polling */ }
    }, 3000)
    return () => {
      if (codexPollRef.current) {
        clearInterval(codexPollRef.current)
        codexPollRef.current = null
      }
    }
  }, [codexState.phase, loginRequiredAlerts, setProviderInStore, suppressLoginAlerts])

  const claudeUrl = isClaudeCodeEntry(claudeState) ? claudeState.url : null
  const claudeSession = isClaudeCodeEntry(claudeState) ? claudeState.session : null

  // --- Copy helper ---
  const handleCopy = useCallback(async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopyFeedback(prev => ({ ...prev, [key]: 'copied' }))
      window.setTimeout(() => setCopyFeedback(prev => ({ ...prev, [key]: 'idle' })), 1500)
    } catch {
      setCopyFeedback(prev => ({ ...prev, [key]: 'error' }))
      window.setTimeout(() => setCopyFeedback(prev => ({ ...prev, [key]: 'idle' })), 2000)
    }
  }, [])

  // --- Claude login ---
  const handleClaudeLogin = useCallback(async () => {
    if (claudeLoginInFlight.current) return claudeLoginInFlight.current
    claudeLoginInFlight.current = (async () => {
      setClaudeState({ phase: 'fetching' })
      setLoginCode('')
      setSuppressedSession(null)
      setOpen(true)
      try {
        const res = await api.loginClaudeAuth()
        window.open(res.url, '_blank')
        setClaudeState({ phase: 'waiting_code', url: res.url, session: res.session })
      } catch (err: any) {
        setClaudeState({ phase: 'error', message: err?.message || 'Failed to get Claude login link.' })
      } finally {
        claudeLoginInFlight.current = null
      }
    })()
    return claudeLoginInFlight.current
  }, [])

  const handleClaudeCodeSubmit = useCallback(async () => {
    if (!claudeSession || !loginCode.trim()) return
    const url = claudeUrl || ''
    setClaudeState({ phase: 'submitting', url, session: claudeSession })
    try {
      await api.submitLoginCode(claudeSession, loginCode.trim())
      setSuppressedSession(claudeSession)
      suppressLoginAlerts(loginRequiredAlerts.filter(alert => alert.provider === 'claude'))
      setClaudeState({ phase: 'submitted', session: claudeSession })
      setLoginCode('')
      void refreshSessions()
      void refreshProviders()
      window.setTimeout(() => { void refreshProviders() }, 1500)
      window.setTimeout(() => { void refreshSessions() }, 1500)
      window.setTimeout(() => { void refreshProviders() }, 4000)
      window.setTimeout(() => { void refreshSessions() }, 4000)
    } catch (err: any) {
      setClaudeState({
        phase: 'error',
        message: err?.message || 'Failed to submit auth code.',
        url,
        session: claudeSession,
      })
    }
  }, [claudeSession, claudeUrl, loginCode, loginRequiredAlerts, refreshProviders, refreshSessions, suppressLoginAlerts])

  const handleClaudeLogout = useCallback(async () => {
    setClaudeState({ phase: 'logging_out' })
    setLoginCode('')
    setOpen(true)
    try {
      await api.logoutClaudeAuth()
      setProviderInStore('claude', { loggedIn: false })
      setSuppressedSession(null)
      setClaudeState({ phase: 'idle' })
      void refreshSessions()
    } catch (err: any) {
      setClaudeState({ phase: 'error', message: err?.message || 'Failed to log out from Claude.' })
      void refreshProviders()
    }
  }, [refreshProviders, refreshSessions, setProviderInStore])

  // --- Codex login ---
  const handleCodexLogin = useCallback(async () => {
    setCodexState({ phase: 'fetching' })
    setOpen(true)
    try {
      const res = await api.providerLogin('codex')
      window.open(res.url, '_blank')
      setCodexState({ phase: 'waiting_completion', url: res.url, code: res.code || '' })
    } catch (err: any) {
      setCodexState({ phase: 'error', message: err?.message || 'Failed to start Codex login.' })
    }
  }, [])

  const handleCodexLogout = useCallback(async () => {
    setCodexState({ phase: 'logging_out' })
    setOpen(true)
    try {
      await api.providerLogout('codex')
      setProviderInStore('codex', { loggedIn: false })
      setCodexState({ phase: 'idle' })
    } catch (err: any) {
      setCodexState({ phase: 'error', message: err?.message || 'Failed to log out from Codex.' })
      void refreshProviders()
    }
  }, [refreshProviders, setProviderInStore])

  // --- Pill label ---
  const attentionCount = (claudeLoggedOut ? 1 : 0) + (codexLoggedOut ? 1 : 0)
  const title = !needsAttention
    ? 'Provider Auth'
    : attentionCount > 1
      ? 'Providers Need Login'
      : claudeLoggedOut
        ? 'Claude Login Required'
        : codexLoggedOut
          ? 'Codex Login Required'
          : claudeSessionBlocked && codexSessionBlocked
            ? 'Sessions Need Login'
            : claudeSessionBlocked
              ? 'Claude Session Login Required'
              : 'Codex Session Login Required'
  const subtitle = needsAttention
    ? 'Action needed'
    : (allLoggedIn ? 'All providers connected' : 'Manage provider logins')

  const rows = (
    <>
      {/* ---- Claude row ---- */}
      <ProviderRow
            name="Claude"
            loggedIn={claudeStatus?.loggedIn ?? false}
            sessionBlocked={claudeSessionBlocked}
            detail={claudeStatus?.loggedIn ? (claudeStatus.subscriptionType || 'Connected') : undefined}
            loading={claudeState.phase === 'fetching' || claudeState.phase === 'logging_out'}
          >
            {claudeState.phase === 'fetching' && (
              <div className="claude-auth-message">Opening Claude login...</div>
            )}
            {claudeState.phase === 'logging_out' && (
              <div className="claude-auth-message">Logging out of Claude...</div>
            )}
            {(claudeState.phase === 'waiting_code' || claudeState.phase === 'submitting' || (claudeState.phase === 'error' && claudeUrl)) && (
              <div className="claude-auth-flow">
                <div className="claude-auth-actions">
                  <ActionButton variant="toolbar" size="appShell" onClick={() => claudeUrl && window.open(claudeUrl, '_blank')}>
                    <ExternalLink size={12} />Open Login
                  </ActionButton>
                  <ActionButton variant="toolbar" size="appShell" onClick={() => claudeUrl && handleCopy(claudeUrl, 'claude-url')}>
                    <Link2 size={12} />
                    {(copyFeedback['claude-url'] === 'copied') ? 'Copied' : 'Copy Link'}
                  </ActionButton>
                </div>
                {claudeUrl && <div className="claude-auth-url-box">{claudeUrl}</div>}
                <div className="claude-auth-message" style={{ marginBottom: 6 }}>
                  Open the link, finish Claude sign-in remotely, then paste the exact code shown on Claude's Authentication Code page.
                </div>
                <div className="claude-auth-code-row">
                  <input
                    className="claude-auth-code-input"
                    placeholder="Paste exact Claude code..."
                    value={loginCode}
                    onChange={e => setLoginCode(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleClaudeCodeSubmit() }}
                    disabled={claudeState.phase === 'submitting'}
                  />
                  <ActionButton
                    variant="toolbarPrimary"
                    size="appShell"
                    onClick={handleClaudeCodeSubmit}
                    disabled={!loginCode.trim() || claudeState.phase === 'submitting'}
                  >
                    {claudeState.phase === 'submitting' ? 'Submitting...' : 'Submit'}
                  </ActionButton>
                </div>
              </div>
            )}
            {claudeState.phase === 'submitted' && (
              <div className="claude-auth-message">
                Code sent to Claude. The affected session will restart if it was blocked on login.
              </div>
            )}
            {claudeState.phase === 'error' && !claudeUrl && (
              <div className="claude-auth-error">{claudeState.message}</div>
            )}
            {claudeState.phase === 'idle' && (
              <div className="claude-auth-actions">
                <ActionButton variant="toolbarPrimary" size="appShell" onClick={handleClaudeLogin}>
                  <LogIn size={12} />Login
                </ActionButton>
                <ActionButton variant="toolbar" size="appShell" onClick={handleClaudeLogout}>
                  <LogOut size={12} />Logout
                </ActionButton>
              </div>
            )}
          </ProviderRow>

          {/* ---- Codex row ---- */}
          <ProviderRow
            name="Codex"
            loggedIn={codexStatus?.loggedIn ?? false}
            sessionBlocked={codexSessionBlocked}
            detail={codexStatus?.loggedIn ? 'Connected' : undefined}
            loading={codexState.phase === 'fetching' || codexState.phase === 'logging_out'}
          >
            {codexState.phase === 'fetching' && (
              <div className="claude-auth-message">Starting Codex login...</div>
            )}
            {codexState.phase === 'logging_out' && (
              <div className="claude-auth-message">Logging out of Codex...</div>
            )}
            {codexState.phase === 'waiting_completion' && (
              <div className="claude-auth-flow">
                <div className="claude-auth-message" style={{ marginBottom: 6 }}>
                  Open the link below and enter the device code to complete login.
                </div>
                <div className="claude-auth-actions">
                  <ActionButton variant="toolbar" size="appShell" onClick={() => window.open(codexState.url, '_blank')}>
                    <ExternalLink size={12} />Open Login
                  </ActionButton>
                  <ActionButton variant="toolbar" size="appShell" onClick={() => handleCopy(codexState.code, 'codex-code')}>
                    {(copyFeedback['codex-code'] === 'copied') ? <Check size={12} /> : <Copy size={12} />}
                    {(copyFeedback['codex-code'] === 'copied') ? 'Copied' : 'Copy Code'}
                  </ActionButton>
                </div>
                <div className="provider-device-code">{codexState.code}</div>
                <div className="claude-auth-message" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Loader2 size={12} className="animate-spin" />
                    Waiting for login...
                  </span>
                  <ActionButton variant="toolbar" size="panel" onClick={handleCodexLogin}>
                    <RefreshCw size={10} />New Code
                  </ActionButton>
                </div>
              </div>
            )}
            {codexState.phase === 'error' && (
              <div className="claude-auth-error">{codexState.message}</div>
            )}
            {(codexState.phase === 'idle' || codexState.phase === 'error') && (
              <div className="claude-auth-actions">
                <ActionButton variant="toolbarPrimary" size="appShell" onClick={handleCodexLogin}>
                  <LogIn size={12} />Login
                </ActionButton>
                <ActionButton variant="toolbar" size="appShell" onClick={handleCodexLogout}>
                  <LogOut size={12} />Logout
                </ActionButton>
              </div>
            )}
          </ProviderRow>
    </>
  )

  if (embedded) {
    return <div className="claude-auth-embedded">{rows}</div>
  }

  return (
    <div className={`claude-auth-dock ${showExpandedPill ? 'expanded' : 'compact'} ${open ? 'open' : ''} ${needsAttention ? 'needs-attention' : ''}`}>
      <button
        className={`claude-auth-pill ${showExpandedPill ? 'expanded' : 'compact'} ${needsAttention ? 'attention animate-auth-blink' : ''}`}
        onClick={() => setOpen(v => !v)}
        title={title}
      >
        <span className="claude-auth-pill-icon">
          {needsAttention ? <ShieldAlert size={14} /> : <ShieldCheck size={14} />}
        </span>
        {showExpandedPill ? (
          <span className="claude-auth-pill-copy">
            <span className="claude-auth-pill-title">{title}</span>
            <span className="claude-auth-pill-subtitle">{subtitle}</span>
          </span>
        ) : (
          <span className="claude-auth-pill-label">Auth</span>
        )}
      </button>

      {open && (
        <div className="claude-auth-panel animate-expand-fade">
          <div className="claude-auth-panel-header">
            <div>
              <div className="claude-auth-panel-title">Provider Auth Hub</div>
              <div className="claude-auth-panel-subtitle">Manage login for all AI providers</div>
            </div>
          </div>
          {rows}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// ProviderRow — collapsible row for each provider
// ---------------------------------------------------------------------------

function ProviderRow({
  name,
  loggedIn,
  sessionBlocked,
  detail,
  loading,
  children,
}: {
  name: string
  loggedIn: boolean
  sessionBlocked?: boolean
  detail?: string
  loading?: boolean
  children: React.ReactNode
}) {
  const [expanded, setExpanded] = useState(!loggedIn || !!sessionBlocked)

  // Auto-expand when logged out or sessions blocked
  useEffect(() => {
    if (!loggedIn || sessionBlocked) setExpanded(true)
  }, [loggedIn, sessionBlocked])

  const dotClass = !loggedIn ? 'disconnected' : sessionBlocked ? 'warning' : 'connected'
  const detailText = loading ? 'Working...'
    : !loggedIn ? 'Not logged in'
    : sessionBlocked ? `${detail || 'Connected'} · sessions need login`
    : (detail || 'Connected')

  return (
    <div className="provider-row">
      <button className="provider-row-header" onClick={() => setExpanded(v => !v)}>
        <span className={`provider-status-dot ${dotClass}`} />
        <span className="provider-row-name">{name}</span>
        <span className="provider-row-detail">
          {detailText}
        </span>
        <span className={`provider-row-chevron ${expanded ? 'open' : ''}`}>&#x25B8;</span>
      </button>
      {expanded && (
        <div className="provider-row-body">
          {children}
        </div>
      )}
    </div>
  )
}
