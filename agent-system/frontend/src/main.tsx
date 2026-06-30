import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ClerkProvider } from '@clerk/react'
import 'dockview/dist/styles/dockview.css'
import './styles/tokens.css'
import './styles/base.css'
import './styles/animations.css'
import './styles/overrides.css'
import App from './App.tsx'
import { installMocks, MOCK_MODE } from './mocks/install.ts'

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

installMocks()

if (!MOCK_MODE && !PUBLISHABLE_KEY) {
  throw new Error(
    'Add your Clerk Publishable Key to .env.local, or set VITE_USE_MOCKS=1 for offline mock mode',
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ClerkProvider
      publishableKey={PUBLISHABLE_KEY ?? 'pk_mock_offline'}
      afterSignOutUrl="/auth/clerk"
      signInUrl="/auth/clerk"
      signUpUrl="/auth/clerk/invite"
    >
      <App />
    </ClerkProvider>
  </StrictMode>,
)
