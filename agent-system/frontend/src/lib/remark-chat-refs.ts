import type { Plugin } from 'unified'
import type { Root, Text, PhrasingContent, InlineCode } from 'mdast'
import { visit, SKIP } from 'unist-util-visit'
import { findCandidates, type RefKind } from './autolink-detector'
import { isVaultPath, isTaskRef, isSessionName, isFolderPath } from './clickable-code'

const SKIP_PARENTS = new Set([
  'code',
  'link',
  'linkReference',
  'definition',
  'image',
  'imageReference',
])

const KIND_TO_HNAME: Record<RefKind, string> = {
  entity: 'entity-chip',
  session: 'session-chip',
  file: 'file-chip-inline',
  folder: 'folder-chip-inline',
}

interface CustomInlineNode {
  type: 'chatChip'
  data: {
    hName: string
    hProperties: Record<string, string>
    hChildren: Array<{ type: 'text'; value: string }>
  }
}

function makeChipNode(hName: string, payload: Record<string, string>, displayText: string): CustomInlineNode {
  return {
    type: 'chatChip',
    data: {
      hName,
      hProperties: { ...payload, 'data-chip': hName },
      hChildren: [{ type: 'text', value: displayText }],
    },
  }
}

/**
 * Classify a token using the LOOSE detectors from clickable-code.ts. Used for
 * inlineCode values where the user has explicitly marked the token as a code
 * span, so we trust their intent and accept patterns the stricter plain-prose
 * detector would reject (e.g. bare numeric task IDs, single-word filenames).
 */
function classifyLooseToken(token: string): { hName: string; payload: Record<string, string> } | null {
  if (isSessionName(token)) {
    const m = token.match(/^(task|verifier|concierge|chainlink|shadow)_/)
    const role = m ? m[1] : ''
    return { hName: KIND_TO_HNAME.session, payload: { sessionname: token, role } }
  }
  const taskId = isTaskRef(token)
  if (taskId) {
    // Namespaced: AgentSystem/1.2.3
    const ns = token.match(/^([A-Z][A-Za-z0-9]+)\/(\d+(?:\.\d+)+)$/)
    const project = ns ? ns[1] : ''
    // Scratch slug: AgentSystem/Scratch/slug or scratch/slug
    const scratchNs = token.match(/^([A-Z][A-Za-z0-9]+)\/[Ss]cratch\//)
    const projectFromScratch = scratchNs ? scratchNs[1] : ''
    const payload: Record<string, string> = { taskid: taskId, source: 'task-ref' }
    if (project) payload.project = project
    else if (projectFromScratch) payload.project = projectFromScratch
    return { hName: KIND_TO_HNAME.entity, payload }
  }
  if (isVaultPath(token)) {
    const filename = token.split('/').pop() || token
    // PM-file routing: task.md / worklog.md → EntityChip
    if (filename === 'task.md' || filename === 'worklog.md') {
      return { hName: KIND_TO_HNAME.entity, payload: { path: token, filename, source: 'pm-file' } }
    }
    const ext = token.slice(token.lastIndexOf('.') + 1).toLowerCase()
    return { hName: KIND_TO_HNAME.file, payload: { path: token, ext } }
  }
  if (isFolderPath(token)) {
    return { hName: KIND_TO_HNAME.folder, payload: { path: token } }
  }
  return null
}

export const remarkChatRefs: Plugin<[], Root> = () => (tree) => {
  // Pass 1: backticked code spans. inlineCode is a leaf node — replace whole
  // if its value classifies as a single ref. Skip inside link ancestors.
  visit(tree, 'inlineCode', (node: InlineCode, index, parent) => {
    if (!parent || index == null) return
    if (parent.type === 'link' || parent.type === 'linkReference') return
    const token = node.value.trim()
    if (!token || token.includes(' ')) return
    const classified = classifyLooseToken(token)
    if (!classified) return
    const chip = makeChipNode(classified.hName, classified.payload, token) as unknown as PhrasingContent
    parent.children.splice(index, 1, chip)
    return [SKIP, index + 1]
  })

  // Pass 2: plain-prose text nodes. Use the stricter findCandidates to avoid
  // false positives on version strings, decimals, etc.
  visit(tree, 'text', (node: Text, index, parent) => {
    if (!parent || index == null) return
    if (SKIP_PARENTS.has(parent.type)) return

    const value = node.value
    const matches = findCandidates(value)
    if (matches.length === 0) return

    const replacement: PhrasingContent[] = []
    let cursor = 0
    for (const m of matches) {
      if (m.start > cursor) {
        replacement.push({ type: 'text', value: value.slice(cursor, m.start) })
      }
      const hName = KIND_TO_HNAME[m.kind]
      replacement.push(makeChipNode(hName, m.payload, m.text) as unknown as PhrasingContent)
      cursor = m.end
    }
    if (cursor < value.length) {
      replacement.push({ type: 'text', value: value.slice(cursor) })
    }

    parent.children.splice(index, 1, ...replacement)
    return [SKIP, index + replacement.length]
  })
}
