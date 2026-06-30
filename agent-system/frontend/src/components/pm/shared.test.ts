import { beforeEach, describe, expect, it, vi } from 'vitest'

const fetchLLMSettings = vi.fn()

vi.mock('@/lib/api.ts', () => ({
  fetchLLMSettings,
}))

const payload = {
  settings: {
    categories: {
      concierge: {
        provider: 'claude',
        runtime: 'claude-code',
        default_model_by_runtime: {
          'claude-code': 'opus',
          codex: 'gpt-5.5',
        },
      },
      interactive_agent: {
        provider: null,
        runtime: null,
        default_model_by_runtime: {
          'claude-code': 'sonnet',
          codex: 'gpt-5.5',
        },
      },
    },
  },
  providers: {
    claude: true,
    codex: true,
  },
  resolved_interactive_categories: {
    concierge: {
      category: 'concierge',
      provider: 'claude',
      runtime: 'claude-code',
      model: 'opus',
      source: 'category_default',
      provider_available: true,
      available_models: [
        { id: 'default', label: 'Use category default' },
        { id: 'sonnet', label: 'Sonnet' },
        { id: 'opus', label: 'Opus' },
        { id: 'haiku', label: 'Haiku' },
      ],
    },
    interactive_agent: {
      category: 'interactive_agent',
      provider: 'codex',
      runtime: 'codex',
      model: 'gpt-5.5',
      source: 'category_default',
      provider_available: true,
      available_models: [
        { id: 'default', label: 'Use category default' },
        { id: 'gpt-5.5', label: 'GPT' },
        { id: 'gpt-5.4-mini', label: 'GPT Mini' },
      ],
    },
  },
  available_models: {
    'claude-code': [
      { id: 'default', label: 'Use category default' },
      { id: 'sonnet', label: 'Sonnet' },
      { id: 'opus', label: 'Opus' },
      { id: 'haiku', label: 'Haiku' },
    ],
    codex: [
      { id: 'default', label: 'Use category default' },
      { id: 'gpt-5.5', label: 'GPT' },
      { id: 'gpt-5.4-mini', label: 'GPT Mini' },
    ],
  },
  selectable_models: {
    'claude-code': [
      { id: 'default', label: 'Use category default' },
      { id: 'sonnet', label: 'Sonnet' },
      { id: 'opus', label: 'Opus' },
      { id: 'haiku', label: 'Haiku' },
    ],
    codex: [
      { id: 'default', label: 'Use category default' },
      { id: 'gpt-5.5', label: 'GPT' },
      { id: 'gpt-5.4-mini', label: 'GPT Mini' },
    ],
  },
} as any

describe('shared interactive defaults', () => {
  beforeEach(() => {
    vi.resetModules()
    fetchLLMSettings.mockReset()
    fetchLLMSettings.mockResolvedValue(payload)
  })

  it('uses the saved per-surface category default instead of the first model option', async () => {
    const mod = await import('./shared.tsx')
    const result = await mod.fetchInteractiveDefaultsForSurface('concierge')
    expect(result.runtime).toBe('claude-code')
    expect(result.model).toBe('opus')
    expect(result.defaultModels['claude-code']).toBe('opus')
    expect(result.defaultModels.codex).toBe('gpt-5.5')
  })

  it('reuses the cached settings payload across repeated calls', async () => {
    const mod = await import('./shared.tsx')
    await mod.fetchInteractiveDefaultsForSurface('concierge')
    await mod.fetchInteractiveDefaultsForSurface('task_agent')
    await mod.fetchInteractiveDefaults()
    expect(fetchLLMSettings).toHaveBeenCalledTimes(1)
  })

  it('prime cache seeds later callers without another fetch', async () => {
    const mod = await import('./shared.tsx')
    mod.primeLLMSettingsPayloadCache(payload)
    const result = await mod.fetchInteractiveDefaultsForSurface('concierge')
    expect(result.model).toBe('opus')
    expect(fetchLLMSettings).not.toHaveBeenCalled()
  })
})
