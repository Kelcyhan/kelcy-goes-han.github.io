import type { LLMModelOption, LLMSettings, LLMSettingsPayload } from './api.ts'
import type { Session } from './types.ts'
export type Runtime = 'claude-code' | 'codex'

export type ProviderName = 'claude' | 'codex'

const PROVIDER_TO_RUNTIME: Record<ProviderName, Runtime> = {
  claude: 'claude-code',
  codex: 'codex',
}

const RUNTIME_TO_PROVIDER: Record<Runtime, ProviderName> = {
  'claude-code': 'claude',
  codex: 'codex',
}

function isProviderName(value: string): value is ProviderName {
  return value === 'claude' || value === 'codex'
}

export function blockedProvidersFromSessions(
  sessions: Session[],
  sessionStatuses: Record<string, string | undefined>,
): Set<ProviderName> {
  return new Set(
    sessions
      .filter(session => (sessionStatuses[session.name] ?? session.status) === 'login_required')
      .map(session => (session.login_provider === 'codex' || session.runtime === 'codex') ? 'codex' : 'claude'),
  )
}

export function effectiveProviderAvailability(
  payload: LLMSettingsPayload,
  blockedProviders: Set<ProviderName>,
): Record<ProviderName, boolean> {
  void blockedProviders
  return {
    claude: !!payload.providers?.claude,
    codex: !!payload.providers?.codex,
  }
}

function stripDefaultOption(options: LLMModelOption[] | undefined): LLMModelOption[] {
  return (options || []).filter(option => option.id !== 'default')
}

function fallbackModel(options: LLMModelOption[]): string {
  return options[0]?.id || 'default'
}

function storedModelForRuntime(
  settings: LLMSettings | undefined,
  key: string,
  runtime: Runtime,
): string | undefined {
  return settings?.categories?.[key]?.default_model_by_runtime?.[runtime]
    || settings?.categories?.interactive_agent?.default_model_by_runtime?.[runtime]
}

function storedProviderForCategory(
  settings: LLMSettings | undefined,
  key: string,
): ProviderName | undefined {
  const category = settings?.categories?.[key]
  const provider = category?.provider
  if (isProviderName(String(provider || ''))) return provider as ProviderName
  const runtime = category?.runtime
  if (runtime === 'codex' || runtime === 'claude-code') return RUNTIME_TO_PROVIDER[runtime]
  return undefined
}

export function getResolvedInteractiveCategory(
  payload: LLMSettingsPayload,
  key: string,
  blockedProviders: Set<ProviderName>,
  settingsOverride?: LLMSettings,
): {
  provider: ProviderName
  runtime: Runtime
  model: string
  source: string
  providerAvailable: boolean
  availableModels: LLMModelOption[]
} {
  const settings = settingsOverride || payload.settings
  const providerAvailability = effectiveProviderAvailability(payload, blockedProviders)
  const base = payload.resolved_interactive_categories?.[key]
    || payload.resolved_interactive_categories?.interactive_agent
  const requestedProvider = storedProviderForCategory(settings, key)
    || (isProviderName(base?.provider || '') ? (base!.provider as ProviderName) : 'claude')
  const availableProviders = (Object.entries(providerAvailability) as [ProviderName, boolean][])
    .filter(([, available]) => available)
    .map(([provider]) => provider)
  const provider = providerAvailability[requestedProvider]
    ? requestedProvider
    : (availableProviders[0] || requestedProvider)
  const runtime = PROVIDER_TO_RUNTIME[provider]
  const availableModels = stripDefaultOption(
    payload.available_models?.[runtime]
      || payload.selectable_models?.[runtime]
      || base?.available_models,
  )
  const preferredModel = storedModelForRuntime(settings, key, runtime)
    || (base?.runtime === runtime ? base?.model : undefined)
  const model = availableModels.some(option => option.id === preferredModel) ? String(preferredModel) : fallbackModel(availableModels)
  return {
    provider,
    runtime,
    model,
    source: base?.source || 'category_default',
    providerAvailable: providerAvailability[provider],
    availableModels,
  }
}

export function effectiveWarnings(
  payload: LLMSettingsPayload,
  blockedProviders: Set<ProviderName>,
): string[] {
  void blockedProviders
  return payload.warnings || []
}
