import { useEffect } from 'react'
import { LogIn, ShieldAlert } from 'lucide-react'
import {
  useProviderStore,
  allProvidersLoggedOut,
} from '@/stores/provider-store.ts'
import { ActionButton } from '@/components/primitives'

interface LoggedOutBannerProps {
  onOpenSettings: () => void
}

export function LoggedOutBanner({ onOpenSettings }: LoggedOutBannerProps) {
  const providers = useProviderStore(s => s.providers)
  const loaded = useProviderStore(s => s.loaded)
  const fetchError = useProviderStore(s => s.fetchError)
  const connect = useProviderStore(s => s.connect)

  useEffect(() => {
    const disconnect = connect()
    return disconnect
  }, [connect])

  const shouldShow = loaded && !fetchError && allProvidersLoggedOut(providers)
  if (!shouldShow) return null

  return (
    <div className="logged-out-banner" role="status">
      <ShieldAlert size={14} className="logged-out-banner-icon" />
      <span className="logged-out-banner-text">
        Sign in to a provider to start using agents.
      </span>
      <ActionButton
        variant="toolbarPrimary"
        size="toolbar"
        className="gap-1.5"
        onClick={onOpenSettings}
        title="Open AI settings to sign in"
      >
        <LogIn size={12} />
        Sign in
      </ActionButton>
    </div>
  )
}
