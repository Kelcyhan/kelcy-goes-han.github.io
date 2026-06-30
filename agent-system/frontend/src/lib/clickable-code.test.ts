import { describe, it, expect } from 'vitest'
import { isSessionName, isClickableCode, isVaultPath, isTaskRef } from './clickable-code'

describe('isSessionName', () => {
  // Valid session names — all prefixes
  it('matches task_ prefix', () => {
    expect(isSessionName('task_224807f2')).toBe(true)
  })
  it('matches verifier_ prefix', () => {
    expect(isSessionName('verifier_abcd1234')).toBe(true)
  })
  it('matches concierge_ prefix', () => {
    expect(isSessionName('concierge_0200161a')).toBe(true)
  })
  it('matches chainlink_ prefix', () => {
    expect(isSessionName('chainlink_deadbeef')).toBe(true)
  })
  it('matches shadow_ prefix', () => {
    expect(isSessionName('shadow_00ff00ff')).toBe(true)
  })

  // All-zero and all-f hex
  it('matches all-zero hex', () => {
    expect(isSessionName('task_00000000')).toBe(true)
  })
  it('matches all-f hex', () => {
    expect(isSessionName('task_ffffffff')).toBe(true)
  })

  // Invalid — wrong prefix
  it('rejects unknown prefix', () => {
    expect(isSessionName('worker_224807f2')).toBe(false)
  })
  it('rejects no prefix', () => {
    expect(isSessionName('224807f2')).toBe(false)
  })

  // Invalid — wrong hex length
  it('rejects 7-char hex (too short)', () => {
    expect(isSessionName('task_224807f')).toBe(false)
  })
  it('rejects 9-char hex (too long)', () => {
    expect(isSessionName('task_224807f2a')).toBe(false)
  })

  // Invalid — non-hex characters
  it('rejects non-hex characters', () => {
    expect(isSessionName('task_2248g7f2')).toBe(false)
  })
  it('rejects uppercase hex', () => {
    expect(isSessionName('task_224807F2')).toBe(false)
  })

  // Invalid — extra content
  it('rejects leading whitespace', () => {
    expect(isSessionName(' task_224807f2')).toBe(false)
  })
  it('rejects trailing whitespace', () => {
    expect(isSessionName('task_224807f2 ')).toBe(false)
  })
  it('rejects embedded in sentence', () => {
    expect(isSessionName('spawned task_224807f2 for')).toBe(false)
  })

  // Edge cases
  it('rejects empty string', () => {
    expect(isSessionName('')).toBe(false)
  })
  it('rejects just the prefix', () => {
    expect(isSessionName('task_')).toBe(false)
  })
})

describe('isClickableCode', () => {
  // Session names are clickable
  it('session name is clickable', () => {
    expect(isClickableCode('task_224807f2')).toBe(true)
  })
  it('verifier session is clickable', () => {
    expect(isClickableCode('verifier_abcd1234')).toBe(true)
  })

  // Vault paths are still clickable (regression)
  it('vault path is clickable', () => {
    expect(isClickableCode('worklog.md')).toBe(true)
  })
  it('nested vault path is clickable', () => {
    expect(isClickableCode('src/lib/api.ts')).toBe(true)
  })

  // Task refs are still clickable (regression)
  it('dot task ref is clickable', () => {
    expect(isClickableCode('1.2.3')).toBe(true)
  })
  it('namespaced task ref is clickable', () => {
    expect(isClickableCode('AgentSystem/1.2.3')).toBe(true)
  })
  it('folder task ref is clickable', () => {
    expect(isClickableCode('1_2_3/')).toBe(true)
  })

  // Non-clickable things
  it('plain text is not clickable', () => {
    expect(isClickableCode('hello world')).toBe(false)
  })
  it('unknown prefix session-like name is not clickable', () => {
    expect(isClickableCode('worker_224807f2')).toBe(false)
  })
  it('random variable name is not clickable', () => {
    expect(isClickableCode('my_variable')).toBe(false)
  })
})

describe('isVaultPath — regression', () => {
  it('matches .md files', () => {
    expect(isVaultPath('task.md')).toBe(true)
  })
  it('matches nested paths', () => {
    expect(isVaultPath('projects/AgentSystem/task.md')).toBe(true)
  })
  it('rejects URLs', () => {
    expect(isVaultPath('https://example.com/file.md')).toBe(false)
  })
  it('rejects paths with spaces', () => {
    expect(isVaultPath('my file.md')).toBe(false)
  })
})

describe('isTaskRef — regression', () => {
  it('matches dot notation', () => {
    expect(isTaskRef('1.2.3')).toBe('1.2.3')
  })
  it('matches namespaced', () => {
    expect(isTaskRef('AgentSystem/1.2.3')).toBe('1.2.3')
  })
  it('matches folder notation', () => {
    expect(isTaskRef('1_2_3/')).toBe('1.2.3')
  })
  it('returns null for non-task', () => {
    expect(isTaskRef('hello')).toBeNull()
  })
  it('returns null for session name', () => {
    expect(isTaskRef('task_224807f2')).toBeNull()
  })
})
