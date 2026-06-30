export function formatToolPreview(toolName: string, input: Record<string, unknown> | undefined): string {
  if (!input) return ''
  if (toolName === 'Read' || toolName === 'Write') return String(input.file_path || '')
  if (toolName === 'Edit') return String(input.file_path || '')
  if (toolName === 'Bash') return String(input.command || '')
  if (toolName === 'Glob') return String(input.pattern || '')
  if (toolName === 'Grep') return String(input.pattern || '')
  if (toolName === 'WebFetch') return String(input.url || '')
  if (toolName === 'WebSearch') return String(input.query || '')
  if (toolName === 'Task') return String(input.description || '')
  if (toolName === 'Agent') return String(input.description || input.prompt || '').substring(0, 80)
  if (toolName === 'Skill') return String(input.skill || '')
  for (const val of Object.values(input)) {
    if (typeof val === 'string' && val.length > 0) return val.substring(0, 80)
  }
  return ''
}

export function formatModelName(model: string): string {
  const normalized = model.trim()
  const mapped: Record<string, string> = {
    sonnet: 'Sonnet',
    opus: 'Opus',
    haiku: 'Haiku',
    'claude-sonnet-4-6': 'Sonnet',
    'claude-opus-4-6': 'Opus',
    'claude-haiku-4-5-20251001': 'Haiku',
    'gpt-5.5': 'GPT',
    'gpt-5.4-mini': 'GPT Mini',
  }
  return mapped[normalized] || normalized.replace('claude-', '').replace(/-\d{8}$/, '')
}

export function formatTokens(tokens: number): string {
  return (tokens / 1000).toFixed(tokens >= 10000 ? 0 : 1) + 'k'
}
