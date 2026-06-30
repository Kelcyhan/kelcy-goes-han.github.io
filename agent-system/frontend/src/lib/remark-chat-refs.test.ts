import { describe, it, expect } from 'vitest'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { toHtml } from 'hast-util-to-html'
import type { Root as HastRoot } from 'hast'
import { remarkChatRefs } from './remark-chat-refs'

async function render(md: string): Promise<string> {
  const processor = unified()
    .use(remarkParse)
    .use(remarkChatRefs)
    .use(remarkRehype, { allowDangerousHtml: false })
  const tree = processor.parse(md)
  const transformed = await processor.run(tree)
  return toHtml(transformed as HastRoot)
}

describe('remarkChatRefs — pipeline integration', () => {
  it('emits entity-chip for namespaced task ref', async () => {
    const html = await render('Check AgentSystem/1.2.3 please')
    expect(html).toContain('<entity-chip')
    expect(html).toContain('project="AgentSystem"')
    expect(html).toMatch(/taskid="1.2.3"/)
  })

  it('emits entity-chip for task.md path with PM routing', async () => {
    const html = await render('See projects/AgentSystem/1_2/1_2_6/1_2_6_1/task.md for context')
    expect(html).toContain('<entity-chip')
    expect(html).toContain('filename="task.md"')
    expect(html).toContain('source="pm-file"')
  })

  it('emits entity-chip for worklog.md (will resolve to preferredTab=log in component)', async () => {
    const html = await render('open projects/X/1_2_3/worklog.md')
    expect(html).toContain('<entity-chip')
    expect(html).toContain('filename="worklog.md"')
  })

  it('emits session-chip for session name', async () => {
    const html = await render('chainlink_deadbeef wrote it')
    expect(html).toContain('<session-chip')
    expect(html).toContain('sessionname="chainlink_deadbeef"')
  })

  it('emits file-chip-inline for absolute image path', async () => {
    const html = await render('open /home/agent/vault/artifacts/uploaded/1778952421_image.png')
    expect(html).toContain('<file-chip-inline')
    expect(html).toContain('ext="png"')
  })

  it('emits folder-chip-inline for known-prefix folder', async () => {
    const html = await render('go to _system/agents/concierge/')
    expect(html).toContain('<folder-chip-inline')
  })

  it('backticked refs now CHIP via loose detectors', async () => {
    const html = await render('here is `task_aabbccdd` and AgentSystem/1.2.3')
    // Session inside backticks: should chip (was raw <code> before)
    expect(html).toContain('<session-chip')
    expect(html).toContain('sessionname="task_aabbccdd"')
    // Task ref in plain prose: also chip
    expect(html).toContain('<entity-chip')
  })

  it('backticked bare numeric task ref chips (looser than plain-prose rule)', async () => {
    const html = await render('see `1.2.3` for the bug')
    // Bare 1.2.3 in plain prose is filtered by stricter rule (no namespace), but
    // inside backticks the user explicitly marked it as a code span → loose
    // detector accepts it.
    expect(html).toContain('<entity-chip')
    expect(html).toContain('taskid="1.2.3"')
  })

  it('backticked bare filename chips even without slash', async () => {
    const html = await render('open `worklog.md` for context')
    // Plain-prose rule requires a slash; backticked bare filename should chip
    // as the user marked it explicitly. task.md/worklog.md route via EntityChip.
    expect(html).toContain('<entity-chip')
    expect(html).toContain('filename="worklog.md"')
  })

  it('skips inside markdown link', async () => {
    const html = await render('see [the page](https://example.com/AgentSystem/1.2.3) here')
    expect(html).not.toContain('<entity-chip')
    expect(html).toContain('<a href="https://example.com/AgentSystem/1.2.3">')
  })

  it('does not match bare numeric version', async () => {
    const html = await render('upgraded to version 1.2.3')
    expect(html).not.toContain('<entity-chip')
    expect(html).not.toContain('<session-chip')
  })

  it('multiple refs in one paragraph', async () => {
    const html = await render('Spawned task_aabbccdd for AgentSystem/1.2.3 — see projects/X/notes.md')
    const sessionCount = (html.match(/<session-chip/g) || []).length
    const entityCount = (html.match(/<entity-chip/g) || []).length
    const fileCount = (html.match(/<file-chip-inline/g) || []).length
    expect(sessionCount).toBe(1)
    expect(entityCount).toBe(1)
    expect(fileCount).toBe(1)
  })
})
