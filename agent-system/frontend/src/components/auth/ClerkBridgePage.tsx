import { Show, SignIn, SignUp, UserButton, useAuth, useUser } from '@clerk/react'
import { FolderKanban, Layers3, PlayCircle } from 'lucide-react'
import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge.tsx'
import { ActionButton } from '@/components/primitives'
import * as api from '@/lib/api.ts'
import './ClerkBridgePage.css'

type BridgeStatus = 'idle' | 'bridging' | 'error'
type PublicView = 'sign-in' | 'request-access'

interface AccessRequestFormState {
  name: string
  email: string
  organization: string
  use_case: string
}

const EMPTY_FORM: AccessRequestFormState = {
  name: '',
  email: '',
  organization: '',
  use_case: '',
}

function InviteSetupPanel() {
  const searchParams = useMemo(() => new URLSearchParams(window.location.search), [])
  const hasTicket = searchParams.has('__clerk_ticket')

  if (!hasTicket) {
    return (
      <div className="bridge-status-card bridge-status-card-error">
        <div className="bridge-status-header">
          <div>
            <span className="bridge-status-label">Invite status</span>
            <strong>Invite link required</strong>
          </div>
          <Badge variant="blocked">Needs attention</Badge>
        </div>
        <p className="bridge-status-message">
          Use the invite link that was sent after approval. If your link expired, request a fresh invitation.
        </p>
        <div className="bridge-error-actions">
          <a className="bridge-link-button" href="/auth/clerk">Back to sign-in</a>
        </div>
      </div>
    )
  }

  return (
    <div className="bridge-auth-card bridge-auth-card-setup">
      <div className="bridge-setup-copy">
        <span className="bridge-status-label">Approved email</span>
        <strong>Finish setting up your Locusly account</strong>
        <p className="bridge-access-note">
          Use your approved email and complete the remaining setup, usually a password, before entering the workspace.
        </p>
      </div>
      <div className="clerk-auth-screen">
        <SignUp
          path="/auth/clerk/invite"
          routing="path"
          signInUrl="/auth/clerk"
          fallbackRedirectUrl="/auth/clerk"
          forceRedirectUrl="/auth/clerk"
        />
      </div>
    </div>
  )
}

export function ClerkBridgePage() {
  const pathname = window.location.pathname
  const isInviteRoute = pathname.startsWith('/auth/clerk/invite')
  const { isLoaded, isSignedIn, getToken } = useAuth()
  const { user } = useUser()
  const [bridgeStatus, setBridgeStatus] = useState<BridgeStatus>('idle')
  const [bridgeError, setBridgeError] = useState<string | null>(null)
  const [bridgeAttempt, setBridgeAttempt] = useState(0)
  const [legacyCleared, setLegacyCleared] = useState(false)
  const [publicView, setPublicView] = useState<PublicView>('sign-in')
  const [requestForm, setRequestForm] = useState<AccessRequestFormState>(EMPTY_FORM)
  const [requestError, setRequestError] = useState<string | null>(null)
  const [requestStatus, setRequestStatus] = useState<'idle' | 'submitting' | 'submitted'>('idle')

  useEffect(() => {
    document.body.classList.add('auth-route')
    return () => {
      document.body.classList.remove('auth-route')
    }
  }, [])

  useEffect(() => {
    if (!isLoaded || isSignedIn || legacyCleared) return
    let cancelled = false

    void api.clearClerkBridgeSession()
      .catch(() => {
        // Best-effort cookie cleanup for the public entry page.
      })
      .finally(() => {
        if (!cancelled) setLegacyCleared(true)
      })

    return () => {
      cancelled = true
    }
  }, [isLoaded, isSignedIn, legacyCleared])

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return
    let cancelled = false

    const bridge = async () => {
      setBridgeStatus('bridging')
      setBridgeError(null)

      try {
        const token = await getToken()
        if (!token) throw new Error('Clerk did not return a session token.')
        const result = await api.bridgeClerkSession(token)
        if (!cancelled) {
          window.location.replace(result.redirect_to || '/')
        }
      } catch (error) {
        if (!cancelled) {
          setBridgeStatus('error')
          setBridgeError(error instanceof Error ? error.message : 'Bridge failed')
        }
      }
    }

    void bridge()

    return () => {
      cancelled = true
    }
  }, [bridgeAttempt, getToken, isLoaded, isSignedIn])

  const title = user?.firstName || user?.username || user?.primaryEmailAddress?.emailAddress || 'Signed in'
  const isBridgeError = bridgeStatus === 'error'
  const isBridging = bridgeStatus === 'bridging'

  const handleRequestSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (requestStatus === 'submitting') return

    setRequestError(null)
    setRequestStatus('submitting')

    try {
      await api.submitAccessRequest(requestForm)
      setRequestStatus('submitted')
      setRequestForm(EMPTY_FORM)
    } catch (error) {
      setRequestStatus('idle')
      setRequestError(error instanceof Error ? error.message : 'Request failed')
    }
  }

  const headline = isInviteRoute
    ? 'Finish setting up your research-preview account'
    : isBridging || isBridgeError
      ? 'Continue into your workspace'
      : 'A workspace for projects and live agent work'
  const lead = isInviteRoute
    ? 'Approved users finish setup here, then enter Locusly with the same invited account.'
    : isBridgeError
      ? 'We could not complete sign-in. Try again or use the fallback sign-in option.'
      : isBridging
        ? 'Your account is ready. We are opening the workspace and reconnecting you to active work.'
        : 'Organize tasks, run multiple agent sessions, and delegate work while staying in control.'

  return (
    <main className="bridge-shell">
      <section className="bridge-frame">
        <header className="bridge-topbar">
          <div className="bridge-topbar-brand">
            <span className="bridge-topbar-dot" />
            <span className="bridge-topbar-name">Locusly</span>
          </div>
          <div className="bridge-topbar-actions">
            <Badge variant="secondary" className="bridge-topbar-badge">Research preview</Badge>
            <a className="bridge-topbar-link" href="/auth/login">Legacy sign-in</a>
          </div>
        </header>

        <div className="bridge-layout">
          <section className="bridge-panel bridge-panel-primary">
            <div className="bridge-panel-inner">
              <div className="bridge-copy-block">
                <Badge variant={isBridgeError ? 'blocked' : isBridging ? 'working' : 'secondary'} className="bridge-copy-badge">
                  {isInviteRoute ? 'Approved access' : isBridgeError ? 'Sign-in issue' : isBridging ? 'Signing in' : 'Research preview'}
                </Badge>

                <h1>{headline}</h1>

                <p className="bridge-lead">{lead}</p>
              </div>

              <Show when="signed-out">
                {isInviteRoute ? (
                  <InviteSetupPanel />
                ) : (
                  <>
                    <div className="bridge-switcher" role="tablist" aria-label="Entry options">
                      <button
                        type="button"
                        className={`bridge-switcher-tab${publicView === 'sign-in' ? ' is-active' : ''}`}
                        onClick={() => setPublicView('sign-in')}
                        aria-pressed={publicView === 'sign-in'}
                      >
                        Sign in
                      </button>
                      <button
                        type="button"
                        className={`bridge-switcher-tab${publicView === 'request-access' ? ' is-active' : ''}`}
                        onClick={() => setPublicView('request-access')}
                        aria-pressed={publicView === 'request-access'}
                      >
                        Request research access
                      </button>
                    </div>

                    {publicView === 'sign-in' ? (
                      <>
                        <div className="bridge-auth-card">
                          <div className="bridge-card-heading">
                            <strong>Sign in with your approved account</strong>
                            <p className="bridge-access-note">
                              Approved users can sign in now. New users should request research access first.
                            </p>
                          </div>
                          <div className="clerk-auth-screen">
                            <SignIn />
                          </div>
                        </div>

                        <div className="bridge-actions">
                          <ActionButton variant="toolbar" type="button" onClick={() => setPublicView('request-access')}>
                            Request research access
                          </ActionButton>
                          <p className="bridge-access-note">
                            Access is currently limited while Locusly is in research preview.
                          </p>
                        </div>
                      </>
                    ) : requestStatus === 'submitted' ? (
                      <div className="bridge-status-card">
                        <div className="bridge-status-header">
                          <div>
                            <span className="bridge-status-label">Request received</span>
                            <strong>Thanks, we’ve got your request</strong>
                          </div>
                          <Badge variant="working">Queued</Badge>
                        </div>
                        <p className="bridge-status-message">
                          We review research-preview access manually. If approved, you’ll receive an invite to finish setup with your approved email.
                        </p>
                        <div className="bridge-error-actions">
                          <ActionButton variant="toolbarPrimary" type="button" onClick={() => setPublicView('sign-in')}>
                            Back to sign-in
                          </ActionButton>
                        </div>
                      </div>
                    ) : (
                      <form className="bridge-request-card" onSubmit={handleRequestSubmit}>
                        <div className="bridge-card-heading">
                          <strong>Request research access</strong>
                          <p className="bridge-access-note">
                            Tell us who you are and how you’d use Locusly. Accounts are approved manually during the preview.
                          </p>
                        </div>

                        <div className="bridge-form-grid">
                          <label className="bridge-field">
                            <span>Name</span>
                            <input
                              type="text"
                              value={requestForm.name}
                              onChange={event => setRequestForm(current => ({ ...current, name: event.target.value }))}
                              autoComplete="name"
                              required
                            />
                          </label>

                          <label className="bridge-field">
                            <span>Email</span>
                            <input
                              type="email"
                              value={requestForm.email}
                              onChange={event => setRequestForm(current => ({ ...current, email: event.target.value }))}
                              autoComplete="email"
                              required
                            />
                          </label>

                          <label className="bridge-field">
                            <span>Organization</span>
                            <input
                              type="text"
                              value={requestForm.organization}
                              onChange={event => setRequestForm(current => ({ ...current, organization: event.target.value }))}
                              autoComplete="organization"
                            />
                          </label>

                          <label className="bridge-field bridge-field-full">
                            <span>Use case</span>
                            <textarea
                              value={requestForm.use_case}
                              onChange={event => setRequestForm(current => ({ ...current, use_case: event.target.value }))}
                              rows={5}
                              required
                            />
                          </label>
                        </div>

                        {requestError && (
                          <p className="bridge-form-error" role="alert">{requestError}</p>
                        )}

                        <div className="bridge-actions">
                          <ActionButton variant="toolbarPrimary" type="submit" disabled={requestStatus === 'submitting'}>
                            {requestStatus === 'submitting' ? 'Submitting request...' : 'Submit request'}
                          </ActionButton>
                          <ActionButton variant="toolbar" type="button" onClick={() => setPublicView('sign-in')}>
                            Back to sign-in
                          </ActionButton>
                        </div>
                      </form>
                    )}
                  </>
                )}
              </Show>

              <Show when="signed-in">
                <div className={`bridge-status-card${isBridgeError ? ' bridge-status-card-error' : ''}`}>
                  <div className="bridge-status-header">
                    <div>
                      <span className="bridge-status-label">
                        {isBridgeError ? 'Sign-in status' : 'Workspace status'}
                      </span>
                      <strong>
                        {isBridgeError ? 'We couldn’t complete sign-in' : isBridging ? 'Opening your workspace...' : 'Signed in'}
                      </strong>
                    </div>
                    <Badge variant={isBridgeError ? 'blocked' : 'working'}>
                      {isBridgeError ? 'Needs attention' : 'In progress'}
                    </Badge>
                  </div>

                  <p className="bridge-status-message">
                    {isBridgeError
                      ? (bridgeError || 'The workspace handoff did not complete.')
                      : `Signed in as ${title}. We’ll bring you into Locusly in a moment.`}
                  </p>

                  <div className="bridge-account">
                    <div>
                      <span className="bridge-account-label">Account</span>
                      <span className="bridge-account-value">{title}</span>
                    </div>
                    <UserButton />
                  </div>

                  {isBridgeError && (
                    <div className="bridge-error-actions">
                      <ActionButton variant="toolbarPrimary" type="button" onClick={() => setBridgeAttempt(n => n + 1)}>
                        Retry sign-in
                      </ActionButton>
                      <a className="bridge-link" href="/auth/login">Use legacy sign-in</a>
                    </div>
                  )}
                </div>
              </Show>

            </div>
          </section>

          <aside className="bridge-panel bridge-panel-secondary">
            <div className="bridge-side-intro">
              <h2>In Locusly</h2>
              <p>The dashboard stays compact and operational so you can move between planning, live work, and outputs without losing context.</p>
            </div>

            <div className="bridge-feature-list">
              <div className="bridge-feature-item">
                <FolderKanban size={16} />
                <div>
                  <strong>Projects and tasks</strong>
                  <span>Track ongoing work, plans, and outputs in one place.</span>
                </div>
              </div>

              <div className="bridge-feature-item">
                <Layers3 size={16} />
                <div>
                  <strong>Multiple live agents</strong>
                  <span>Run several agent sessions at the same time and keep their work visible.</span>
                </div>
              </div>

              <div className="bridge-feature-item">
                <PlayCircle size={16} />
                <div>
                  <strong>Delegation with control</strong>
                  <span>Let agents work on your behalf and step in when decisions matter.</span>
                </div>
              </div>
            </div>

            <div className="bridge-preview-card" aria-hidden="true">
              <div className="bridge-preview-topbar">
                <span className="bridge-preview-pill">Locusly</span>
                <span className="bridge-preview-meta">Workspace preview</span>
              </div>
              <div className="bridge-preview-body">
                <div className="bridge-preview-rail">
                  <span />
                  <span />
                  <span />
                </div>
                <div className="bridge-preview-main">
                  <div className="bridge-preview-row bridge-preview-row-wide" />
                  <div className="bridge-preview-grid">
                    <div className="bridge-preview-cardlet bridge-preview-cardlet-active" />
                    <div className="bridge-preview-cardlet" />
                  </div>
                  <div className="bridge-preview-row" />
                  <div className="bridge-preview-row bridge-preview-row-muted" />
                </div>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </main>
  )
}
