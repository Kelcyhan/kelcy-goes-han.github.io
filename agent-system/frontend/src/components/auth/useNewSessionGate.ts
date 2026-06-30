import { useEffect } from 'react'
import {
  useProviderStore,
  anyProviderLoggedIn,
} from '@/stores/provider-store.ts'

/**
 * Returns whether the user is blocked from creating new agent sessions due to
 * being logged out of every configured AI provider. Subscribes the consumer
 * to the shared provider store so polling is automatic.
 *
 * The gate is intentionally creation-only: it gates `spawnTaskAgent` /
 * `createHelperSession` / `createConciergeSession` call sites, but NOT
 * recovery actions like Resume on a dead session.
 *
 * The gate stays open (disabled=false) while provider status is still
 * loading or returned errors, so transient backend issues do not trap the
 * user with disabled buttons.
 */
export function useNewSessionGate(): { disabled: boolean; tooltip?: string } {
  const providers = useProviderStore(s => s.providers)
  const loaded = useProviderStore(s => s.loaded)
  const fetchError = useProviderStore(s => s.fetchError)
  const connect = useProviderStore(s => s.connect)

  useEffect(() => {
    const disconnect = connect()
    return disconnect
  }, [connect])

  if (!loaded || fetchError) return { disabled: false }
  if (anyProviderLoggedIn(providers)) return { disabled: false }
  return {
    disabled: true,
    tooltip: 'Sign in to a provider first',
  }
}
