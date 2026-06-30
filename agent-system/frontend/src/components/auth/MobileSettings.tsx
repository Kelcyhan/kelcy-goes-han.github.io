import { useCallback, useEffect, useRef, useState } from 'react'
import { ExternalLink, Link2, LogIn, LogOut, Copy, Check, Loader2, Settings, RefreshCw, Monitor } from 'lucide-react'
import { useSessionStore } from '@/stores/session-store.ts'
import { useProviderStore } from '@/stores/provider-store.ts'
import * as api from '@/lib/api.ts'
import { AISettingsPage } from '@/components/settings/AISettingsPage.tsx'
import { LLMSettingsPanel } from '@/components/settings/LLMSettingsPanel.tsx'
import { ActionButton } from '@/components/primitives'

// ---------------------------------------------------------------------------
// Types (same as ClaudeAuthDock)
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

function isClaudeCodeEntry(state: ClaudeFlowState): state is
  | { phase: 'waiting_code'; url: string; session: string }
  | { phase: 'submitting'; url: string; session: string }
  | { phase: 'error'; message: string; url?: string; session?: string } {
  return state.phase === 'waiting_code' || state.phase === 'submitting' || state.phase === 'error'
}

// ---------------------------------------------------------------------------
// MobileSettings — full-screen settings view for mobile
// ---------------------------------------------------------------------------

export function MobileSettings() {
  const refreshSessions = useSessionStore(s => s.refreshSessions)
  const activeSession = useSessionStore(s => s.activeSession)

  const providers = useProviderStore(s => s.providers)
  const refreshProviders = useProviderStore(s => s.refreshProviders)
  const setProviderInStore = useProviderStore(s => s.setProvider)
  const connectProviderStore = useProviderStore(s => s.connect)

  const [claudeState, setClaudeState] = useState<ClaudeFlowState>({ phase: 'idle' })
  const [codexState, setCodexState] = useState<CodexFlowState>({ phase: 'idle' })
  const [loginCode, setLoginCode] = useState('')
  const [copyFeedback, setCopyFeedback] = useState<Record<string, 'idle' | 'copied' | 'error'>>({})
  const [browserNote, setBrowserNote] = useState('')
  const [browserNotePath, setBrowserNotePath] = useState('State/user/browser-agent-note.md')
  const [browserNoteMaxChars, setBrowserNoteMaxChars] = useState(1500)
  const [browserNoteStatus, setBrowserNoteStatus] = useState('')
  const [browserNoteSaving, setBrowserNoteSaving] = useState(false)
  const [showAdvancedAISettings, setShowAdvancedAISettings] = useState(false)

  const codexPollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const claudeStatus = providers.claude
  const codexStatus = providers.codex
  const claudeLoginInFlight = useRef<Promise<void> | null>(null)

  // Provider polling is now in useProviderStore — just connect on mount.
  useEffect(() => {
    const disconnect = connectProviderStore()
    return disconnect
  }, [connectProviderStore])

  useEffect(() => {
    api.fetchBrowserSettings().then(settings => {
      setBrowserNote(settings.note ?? '')
      setBrowserNotePath(settings.path ?? 'State/user/browser-agent-note.md')
      setBrowserNoteMaxChars(settings.max_chars ?? 1500)
    }).catch(() => {
      setBrowserNoteStatus('Failed to load browser settings.')
    })
  }, [])

  // --- Codex poll while waiting ---
  useEffect(() => {
    if (codexState.phase !== 'waiting_completion') {
      if (codexPollRef.current) { clearInterval(codexPollRef.current); codexPollRef.current = null }
      return
    }
    codexPollRef.current = setInterval(async () => {
      try {
        const st = await api.providerStatus('codex')
        if (st.loggedIn) {
          setCodexState({ phase: 'idle' })
          setProviderInStore('codex', st)
        }
      } catch { /* keep polling */ }
    }, 3000)
    return () => { if (codexPollRef.current) { clearInterval(codexPollRef.current); codexPollRef.current = null } }
  }, [codexState.phase, setProviderInStore])

  const claudeUrl = isClaudeCodeEntry(claudeState) ? claudeState.url : null
  const claudeSession = isClaudeCodeEntry(claudeState) ? claudeState.session : null

  // --- Copy helper ---
  const handleCopy = useCallback(async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopyFeedback(prev => ({ ...prev, [key]: 'copied' }))
      setTimeout(() => setCopyFeedback(prev => ({ ...prev, [key]: 'idle' })), 1500)
    } catch {
      setCopyFeedback(prev => ({ ...prev, [key]: 'error' }))
      setTimeout(() => setCopyFeedback(prev => ({ ...prev, [key]: 'idle' })), 2000)
    }
  }, [])

  // --- Claude login ---
  const handleClaudeLogin = useCallback(async () => {
    if (claudeLoginInFlight.current) return claudeLoginInFlight.current
    claudeLoginInFlight.current = (async () => {
      setClaudeState({ phase: 'fetching' })
      setLoginCode('')
      try {
        const res = await api.loginClaudeAuth()
        window.open(res.url, '_blank')
        setClaudeState({ phase: 'waiting_code', url: res.url, session: res.session })
      } catch (err: any) {
        setClaudeState({ phase: 'error', message: err?.message || 'Failed to start Claude login.' })
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
      setClaudeState({ phase: 'submitted', session: claudeSession })
      setLoginCode('')
      void refreshSessions()
      void refreshProviders()
      setTimeout(() => { void refreshProviders() }, 3000)
    } catch (err: any) {
      setClaudeState({ phase: 'error', message: err?.message || 'Failed to submit code.', url, session: claudeSession })
    }
  }, [claudeSession, claudeUrl, loginCode, refreshProviders, refreshSessions])

  const handleClaudeLogout = useCallback(async () => {
    setClaudeState({ phase: 'logging_out' })
    try {
      await api.logoutClaudeAuth()
      setProviderInStore('claude', { loggedIn: false })
      setClaudeState({ phase: 'idle' })
      void refreshSessions()
    } catch (err: any) {
      setClaudeState({ phase: 'error', message: err?.message || 'Logout failed.' })
      void refreshProviders()
    }
  }, [refreshProviders, refreshSessions, setProviderInStore])

  // --- Codex login ---
  const handleCodexLogin = useCallback(async () => {
    setCodexState({ phase: 'fetching' })
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
    try {
      await api.providerLogout('codex')
      setProviderInStore('codex', { loggedIn: false })
      setCodexState({ phase: 'idle' })
    } catch (err: any) {
      setCodexState({ phase: 'error', message: err?.message || 'Logout failed.' })
      void refreshProviders()
    }
  }, [refreshProviders, setProviderInStore])

  const handleBrowserNoteSave = useCallback(async () => {
    setBrowserNoteSaving(true)
    setBrowserNoteStatus('')
    try {
      const settings = await api.saveBrowserSettings(browserNote)
      setBrowserNote(settings.note)
      setBrowserNotePath(settings.path)
      setBrowserNoteMaxChars(settings.max_chars)
      setBrowserNoteStatus('Saved.')
    } catch (err: any) {
      setBrowserNoteStatus(err?.message || 'Failed to save browser note.')
    } finally {
      setBrowserNoteSaving(false)
    }
  }, [browserNote])

  const handleBrowserNoteSend = useCallback(async () => {
    if (!activeSession) {
      setBrowserNoteStatus('No active agent session.')
      return
    }
    setBrowserNoteSaving(true)
    setBrowserNoteStatus('')
    try {
      const settings = await api.saveBrowserSettings(browserNote)
      setBrowserNote(settings.note)
      setBrowserNotePath(settings.path)
      setBrowserNoteMaxChars(settings.max_chars)
      const trimmed = settings.note.trim()
      if (!trimmed) {
        setBrowserNoteStatus('Saved empty note; nothing sent.')
        return
      }
      await api.sendMessage(
        activeSession,
        `[System] Updated browser note from user:\nIf you use Playwright/browser tools, keep this note in mind. Do not copy secrets from this note into task files, worklogs, screenshots, or final responses.\n${trimmed}`,
        { method: 'inbox' },
      )
      setBrowserNoteStatus(`Saved and queued for ${activeSession}.`)
    } catch (err: any) {
      setBrowserNoteStatus(err?.message || 'Failed to send browser note.')
    } finally {
      setBrowserNoteSaving(false)
    }
  }, [activeSession, browserNote])

  if (showAdvancedAISettings) {
    return (
      <div className="mobile-settings">
        <AISettingsPage title="AI Settings" onBack={() => setShowAdvancedAISettings(false)} />
      </div>
    )
  }

  return (
    <div className="mobile-settings">
      <div className="mobile-settings-header">
        <Settings size={16} />
        <span>Settings</span>
      </div>

      <div className="mobile-settings-section">
        <div className="mobile-settings-section-title">Providers</div>
        <div className="mobile-settings-section-desc">Manage login for AI providers</div>

        {/* Claude */}
        <MobileProviderCard
          name="Claude"
          loggedIn={claudeStatus?.loggedIn ?? false}
          detail={claudeStatus?.loggedIn ? (claudeStatus.subscriptionType || 'Connected') : 'Not logged in'}
          loading={claudeState.phase === 'fetching' || claudeState.phase === 'logging_out'}
        >
          {claudeState.phase === 'fetching' && (
            <div className="mobile-settings-msg">Opening Claude login...</div>
          )}
          {claudeState.phase === 'logging_out' && (
            <div className="mobile-settings-msg">Logging out...</div>
          )}
          {(claudeState.phase === 'waiting_code' || claudeState.phase === 'submitting' || (claudeState.phase === 'error' && claudeUrl)) && (
            <div className="mobile-settings-flow">
              <div className="mobile-settings-btns">
                <ActionButton variant="toolbar" size="appShell" onClick={() => claudeUrl && window.open(claudeUrl, '_blank')}>
                  <ExternalLink size={12} /> Open Login
                </ActionButton>
                <ActionButton variant="toolbar" size="appShell" onClick={() => claudeUrl && handleCopy(claudeUrl, 'm-claude-url')}>
                  <Link2 size={12} />
                  {copyFeedback['m-claude-url'] === 'copied' ? 'Copied' : 'Copy Link'}
                </ActionButton>
              </div>
              <div className="mobile-settings-msg">
                Paste the exact code shown on Claude's Authentication Code page.
              </div>
              <div className="mobile-settings-code-row">
                <input
                  className="mobile-settings-input"
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
                  {claudeState.phase === 'submitting' ? '...' : 'Submit'}
                </ActionButton>
              </div>
            </div>
          )}
          {claudeState.phase === 'submitted' && (
            <div className="mobile-settings-msg">Code sent. The blocked session will restart if needed.</div>
          )}
          {claudeState.phase === 'error' && !claudeUrl && (
            <div className="mobile-settings-error">{claudeState.message}</div>
          )}
          {(claudeState.phase === 'idle' || (claudeState.phase === 'error' && !claudeUrl)) && (
            <div className="mobile-settings-btns">
              <ActionButton variant="toolbarPrimary" size="appShell" onClick={handleClaudeLogin}>
                <LogIn size={12} /> Login
              </ActionButton>
              <ActionButton variant="toolbar" size="appShell" onClick={handleClaudeLogout}>
                <LogOut size={12} /> Logout
              </ActionButton>
            </div>
          )}
        </MobileProviderCard>

        {/* Codex */}
        <MobileProviderCard
          name="Codex"
          loggedIn={codexStatus?.loggedIn ?? false}
          detail={codexStatus?.loggedIn ? 'Connected' : 'Not logged in'}
          loading={codexState.phase === 'fetching' || codexState.phase === 'logging_out'}
        >
          {codexState.phase === 'fetching' && (
            <div className="mobile-settings-msg">Starting Codex login...</div>
          )}
          {codexState.phase === 'logging_out' && (
            <div className="mobile-settings-msg">Logging out...</div>
          )}
          {codexState.phase === 'waiting_completion' && (
            <div className="mobile-settings-flow">
              <div className="mobile-settings-msg">Open the link and enter the device code.</div>
              <div className="mobile-settings-btns">
                <ActionButton variant="toolbar" size="appShell" onClick={() => window.open(codexState.url, '_blank')}>
                  <ExternalLink size={12} /> Open Login
                </ActionButton>
                <ActionButton variant="toolbar" size="appShell" onClick={() => handleCopy(codexState.code, 'm-codex-code')}>
                  {copyFeedback['m-codex-code'] === 'copied' ? <Check size={12} /> : <Copy size={12} />}
                  {copyFeedback['m-codex-code'] === 'copied' ? 'Copied' : 'Copy Code'}
                </ActionButton>
              </div>
              <div className="mobile-settings-device-code">{codexState.code}</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span className="mobile-settings-msg" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Loader2 size={12} className="animate-spin" /> Waiting for login...
                </span>
                <ActionButton variant="toolbar" size="panel" onClick={handleCodexLogin}>
                  <RefreshCw size={11} /> New Code
                </ActionButton>
              </div>
            </div>
          )}
          {codexState.phase === 'error' && (
            <div className="mobile-settings-error">{codexState.message}</div>
          )}
          {(codexState.phase === 'idle' || codexState.phase === 'error') && (
            <div className="mobile-settings-btns">
              <ActionButton variant="toolbarPrimary" size="appShell" onClick={handleCodexLogin}>
                <LogIn size={12} /> Login
              </ActionButton>
              <ActionButton variant="toolbar" size="appShell" onClick={handleCodexLogout}>
                <LogOut size={12} /> Logout
              </ActionButton>
            </div>
          )}
        </MobileProviderCard>
      </div>

      <div className="mobile-settings-section">
        <div className="mobile-settings-section-title">AI Settings</div>
        <div className="mobile-settings-section-desc">Default AI plus advanced agent, widget, research, and tool defaults</div>
        <div className="mobile-provider-card">
          <div className="mobile-provider-body">
            <LLMSettingsPanel onOpenAdvanced={() => setShowAdvancedAISettings(true)} />
          </div>
        </div>
      </div>

      <div className="mobile-settings-section">
        <div className="mobile-settings-section-title">Browser</div>
        <div className="mobile-settings-section-desc">Short note for agents using browser tools</div>
        <div className="mobile-provider-card">
          <div className="mobile-provider-header">
            <Monitor size={13} />
            <span className="mobile-provider-name">Agent browser note</span>
            <span className="mobile-provider-detail">{browserNote.length}/{browserNoteMaxChars}</span>
          </div>
          <div className="mobile-provider-body">
            <textarea
              className="mobile-settings-input mobile-settings-textarea"
              value={browserNote}
              onChange={e => setBrowserNote(e.target.value.slice(0, browserNoteMaxChars))}
              rows={6}
              placeholder="Example: Use staging. Ask before account-sensitive actions."
            />
            <div className="mobile-settings-hint">
              {browserNotePath}. Do not store passwords or tokens here unless you explicitly want agents to see them.
            </div>
            {browserNoteStatus && <div className="mobile-settings-msg">{browserNoteStatus}</div>}
            <div className="mobile-settings-btns">
              <ActionButton variant="toolbarPrimary" size="appShell" onClick={handleBrowserNoteSave} disabled={browserNoteSaving}>
                {browserNoteSaving ? 'Saving...' : 'Save'}
              </ActionButton>
              <ActionButton variant="toolbar" size="appShell" onClick={handleBrowserNoteSend} disabled={browserNoteSaving || !activeSession}>
                Send to current agent
              </ActionButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// MobileProviderCard
// ---------------------------------------------------------------------------

function MobileProviderCard({
  name,
  loggedIn,
  detail,
  loading,
  children,
}: {
  name: string
  loggedIn: boolean
  detail: string
  loading?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="mobile-provider-card">
      <div className="mobile-provider-header">
        <span className={`provider-status-dot ${loggedIn ? 'connected' : 'disconnected'}`} />
        <span className="mobile-provider-name">{name}</span>
        <span className="mobile-provider-detail">
          {loading ? 'Working...' : detail}
        </span>
      </div>
      <div className="mobile-provider-body">
        {children}
      </div>
    </div>
  )
}
