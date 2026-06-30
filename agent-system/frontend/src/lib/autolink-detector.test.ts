import { describe, it, expect } from 'vitest'
import { findCandidates } from './autolink-detector'


describe('findCandidates — must link in plain prose', () => {
  it('absolute file path with image extension', () => {
    const r = findCandidates(
      'Please check /home/agent/vault/artifacts/uploaded/1778952421_image.png today',
    )
    expect(r).toHaveLength(1)
    expect(r[0].kind).toBe('file')
    expect(r[0].text).toBe('/home/agent/vault/artifacts/uploaded/1778952421_image.png')
    expect(r[0].payload.ext).toBe('png')
  })

  it('vault-relative path with task.md routes to entity', () => {
    const r = findCandidates(
      'See projects/AgentSystem/1_2/1_2_6/1_2_6_1/task.md for context',
    )
    const entity = r.find(m => m.kind === 'entity')
    expect(entity).toBeDefined()
    expect(entity!.payload.filename).toBe('task.md')
    expect(entity!.payload.source).toBe('pm-file')
  })

  it('vault-relative path with worklog.md routes to entity', () => {
    const r = findCandidates('Check projects/AgentSystem/1_2/1_2_6/1_2_6_1/worklog.md')
    const entity = r.find(m => m.kind === 'entity')
    expect(entity).toBeDefined()
    expect(entity!.payload.filename).toBe('worklog.md')
  })

  it('namespaced task ref (3+ segments)', () => {
    const r = findCandidates('Open AgentSystem/1.2.3 in PM')
    expect(r).toHaveLength(1)
    expect(r[0].kind).toBe('entity')
    expect(r[0].payload.taskid).toBe('1.2.3')
    expect(r[0].payload.project).toBe('AgentSystem')
  })

  it('namespaced task ref with 4 segments', () => {
    const r = findCandidates('Check AgentSystem/1.2.6.4 — almost done')
    expect(r).toHaveLength(1)
    expect(r[0].kind).toBe('entity')
    expect(r[0].payload.taskid).toBe('1.2.6.4')
  })

  it('folder-id task ref with trailing slash', () => {
    const r = findCandidates('Folder 1_2_3/ has the artifacts')
    expect(r).toHaveLength(1)
    expect(r[0].kind).toBe('entity')
    expect(r[0].payload.taskid).toBe('1.2.3')
  })

  it('nested folder-id task ref takes deepest', () => {
    const r = findCandidates('Go to 1_2/1_2_6/1_2_6_1/ now')
    expect(r).toHaveLength(1)
    expect(r[0].kind).toBe('entity')
    expect(r[0].payload.taskid).toBe('1.2.6.1')
  })

  it('session name (chainlink)', () => {
    const r = findCandidates('The chainlink_deadbeef session wrote the briefing')
    expect(r).toHaveLength(1)
    expect(r[0].kind).toBe('session')
    expect(r[0].text).toBe('chainlink_deadbeef')
    expect(r[0].payload.role).toBe('chainlink')
    expect(r[0].payload.sessionname).toBe('chainlink_deadbeef')
  })

  it('session name (task) inside parens', () => {
    const r = findCandidates('(see task_054943f2 for details)')
    expect(r).toHaveLength(1)
    expect(r[0].kind).toBe('session')
    expect(r[0].text).toBe('task_054943f2')
  })

  it('known-prefix folder path (projects/)', () => {
    const r = findCandidates('Look under projects/AgentSystem/Scratch/ for notes')
    // Scratch detector wins for this; either way we get an entity or folder hit
    expect(r.length).toBeGreaterThan(0)
  })

  it('known-prefix folder path (_system/)', () => {
    const r = findCandidates('See _system/agents/concierge/ for the spec')
    expect(r).toHaveLength(1)
    expect(r[0].kind).toBe('folder')
    expect(r[0].text).toContain('_system/agents/concierge')
  })

  it('multiple paths in one line', () => {
    const r = findCandidates(
      'Multiple paths: src/A.ts and src/B.ts and projects/X/C.md',
    )
    const files = r.filter(m => m.kind === 'file')
    expect(files.length).toBe(3)
  })
})

describe('findCandidates — must NOT link in plain prose', () => {
  it('bare numeric version number', () => {
    const r = findCandidates('We upgraded to version 1.2.3 today')
    expect(r).toHaveLength(0)
  })

  it('decimal in prose', () => {
    const r = findCandidates('pi is approximately 3.14159')
    expect(r).toHaveLength(0)
  })

  it('bare section number', () => {
    const r = findCandidates('See section 2.1 for details')
    expect(r).toHaveLength(0)
  })

  it('TLD-only hostname', () => {
    const r = findCandidates('visit example.com for details')
    expect(r).toHaveLength(0)
  })

  it('multiple TLDs', () => {
    const r = findCandidates('domains: foo.org, bar.net, baz.io')
    expect(r).toHaveLength(0)
  })

  it('bare filename with no slash and dot extension', () => {
    // Single-segment filename in prose — too noisy; require slash
    const r = findCandidates('save it as report.pdf next')
    expect(r).toHaveLength(0)
  })

  it('URL skipped entirely', () => {
    const r = findCandidates('see https://example.com/file.md for context')
    expect(r).toHaveLength(0)
  })

  it('URL with task-ref-like path does not match', () => {
    const r = findCandidates('open https://example.com/1.2.3 in browser')
    expect(r).toHaveLength(0)
  })

  it('bare 7-char hex (wrong length)', () => {
    const r = findCandidates('try task_2248071')
    expect(r).toHaveLength(0)
  })

  it('uppercase hex session name (must be lowercase)', () => {
    const r = findCandidates('see task_AABBCCDD for context')
    expect(r).toHaveLength(0)
  })

  it('framework version string (Flask/2.0) — must not match as task ref', () => {
    const r = findCandidates('Flask/2.0 released today')
    expect(r.filter(m => m.kind === 'entity')).toHaveLength(0)
  })

  it('framework version with 2-segment version (React/18.3) — must not match', () => {
    const r = findCandidates('upgraded to React/18.3 last week')
    expect(r.filter(m => m.kind === 'entity')).toHaveLength(0)
  })

  it('bare folder name with no slash', () => {
    const r = findCandidates('the artifacts folder is empty')
    expect(r).toHaveLength(0)
  })

  it('quoted markdown filename', () => {
    // Trailing punctuation handled — no malformed chip; bare filename without slash should be skipped
    const r = findCandidates('she said "hello.md" was missing')
    expect(r).toHaveLength(0)
  })

  it('time-like number', () => {
    const r = findCandidates('meeting at 12:00 sharp')
    expect(r).toHaveLength(0)
  })

  it('unknown-prefix folder path', () => {
    const r = findCandidates('go to randomdir/subfolder/ first')
    expect(r).toHaveLength(0)
  })
})

describe('findCandidates — edge cases', () => {
  it('trailing period stripped from file path', () => {
    const r = findCandidates('Open src/a.ts. Then close it.')
    expect(r).toHaveLength(1)
    expect(r[0].text).toBe('src/a.ts')
  })

  it('trailing comma stripped from task ref', () => {
    const r = findCandidates('Check AgentSystem/1.2.3, then continue')
    expect(r).toHaveLength(1)
    expect(r[0].kind).toBe('entity')
    expect(r[0].payload.taskid).toBe('1.2.3')
  })

  it('parens around session name', () => {
    const r = findCandidates('queued (chainlink_aabbccdd) for processing')
    expect(r).toHaveLength(1)
    expect(r[0].text).toBe('chainlink_aabbccdd')
  })

  it('preserves order across multiple types', () => {
    const r = findCandidates(
      'Spawned task_aabbccdd for AgentSystem/1.2.3 — see projects/X/notes.md',
    )
    expect(r).toHaveLength(3)
    expect(r[0].kind).toBe('session')
    expect(r[1].kind).toBe('entity')
    expect(r[2].kind).toBe('file')
  })

  it('non-overlapping matches', () => {
    const r = findCandidates(
      'see AgentSystem/1.2.3 and projects/AgentSystem/1_2/1_2_6/1_2_6_1/task.md',
    )
    expect(r.filter(m => m.kind === 'entity')).toHaveLength(2)
  })
})
