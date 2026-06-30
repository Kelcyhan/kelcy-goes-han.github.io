// Drop-in replacement for @clerk/react used in mock mode.
//
// Wired via vite.config.ts when VITE_USE_MOCKS=1. The real @clerk/react
// package is still in node_modules but never imported.
//
// All components render a sensible default for "signed-in mock user".
// All hooks return shapes that callers expect without throwing.

import * as React from 'react'

const MOCK_USER = {
  id: 'mock_user',
  firstName: 'Designer',
  lastName: 'Demo',
  fullName: 'Designer Demo',
  username: 'designer',
  primaryEmailAddress: { emailAddress: 'design@acme.example' },
  imageUrl: 'https://api.dicebear.com/8.x/personas/svg?seed=designer',
}

// ── Provider ─────────────────────────────────────────────────────────────────
export function ClerkProvider({ children }: { children?: React.ReactNode }) {
  return <>{children}</>
}

// ── <Show when="signed-in" | "signed-out"> ───────────────────────────────────
export function Show({ when, children }: { when: 'signed-in' | 'signed-out'; children?: React.ReactNode }) {
  // In mock mode the user is always "signed-in"
  if (when === 'signed-in') return <>{children}</>
  return null
}

// ── Auth control components ──────────────────────────────────────────────────
export function SignInButton({ children }: { children?: React.ReactNode; mode?: string }) {
  return <>{children}</>
}
export function SignUpButton({ children }: { children?: React.ReactNode; mode?: string }) {
  return <>{children}</>
}
export function SignedIn({ children }: { children?: React.ReactNode }) {
  return <>{children}</>
}
export function SignedOut(_props: { children?: React.ReactNode }) {
  return null
}
export function UserButton(_props: any) {
  return (
    <div
      role="button"
      title={MOCK_USER.fullName}
      style={{
        width: 28,
        height: 28,
        borderRadius: '50%',
        background: `url(${MOCK_USER.imageUrl}) center/cover no-repeat, #e2e8f0`,
        cursor: 'pointer',
      }}
    />
  )
}
export function SignIn(_props: any) {
  return <div style={{ padding: 24 }}>Mock SignIn (mock mode — already signed in)</div>
}
export function SignUp(_props: any) {
  return <div style={{ padding: 24 }}>Mock SignUp (mock mode — already signed in)</div>
}

// ── Hooks ─────────────────────────────────────────────────────────────────────
export function useUser() {
  return {
    isLoaded: true,
    isSignedIn: true,
    user: MOCK_USER,
  }
}

export function useAuth() {
  return {
    isLoaded: true,
    isSignedIn: true,
    userId: MOCK_USER.id,
    sessionId: 'mock_session',
    getToken: async (_opts?: any) => 'mock_token',
    signOut: async () => {},
  }
}

export function useClerk() {
  return {
    user: MOCK_USER,
    signOut: async () => {},
    openSignIn: () => {},
    openUserProfile: () => {},
  }
}

export function useSession() {
  return {
    isLoaded: true,
    session: { id: 'mock_session', user: MOCK_USER },
  }
}

// Re-export anything else that might be imported as a no-op
export const ClerkLoaded = ({ children }: { children?: React.ReactNode }) => <>{children}</>
export const ClerkLoading = (_props: any) => null
