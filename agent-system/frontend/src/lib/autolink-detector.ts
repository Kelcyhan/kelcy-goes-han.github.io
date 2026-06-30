/**
 * Plain-prose entity-ref detector for the chat auto-link pipeline.
 *
 * Backticked code paths keep using the looser detectors in clickable-code.ts.
 * This module applies stricter rules so plain prose doesn't false-positive on
 * version numbers, decimals, hostnames, etc.
 */

export type RefKind = 'entity' | 'session' | 'file' | 'folder'

export interface RefMatch {
  start: number
  end: number
  kind: RefKind
  text: string
  /** Per-kind structured payload, passed through to the chip component. */
  payload: Record<string, string>
}

const SESSION_RE = /(?:^|(?<=[\s(\[{<"',;:]))(task|verifier|concierge|chainlink|shadow)_([0-9a-f]{8})(?=$|[\s)\]}>"',;:.!?])/g

/** Namespaced task ref: AgentSystem/1.2.3, Project/1.2.3.4.
 * Require 3+ dot segments to avoid false-positives on framework version strings
 * like "Flask/2.0", "React/18.3", "Node/20.1". Task IDs in this system always
 * have at least 3 segments in practice (project > domain > task). 2-segment
 * refs in plain prose are still chippable via folder-id notation (1_2/). */
const NS_TASK_RE = /(?:^|(?<=[\s(\[{<"',;:]))([A-Z][A-Za-z0-9]+)\/(\d+(?:\.\d+){2,})(?=$|[\s)\]}>"',;:.!?])/g

/** Folder-id task ref: 1_2_3/ or 1_2/1_2_6/1_2_6_1/ — trailing slash required, distinctive in prose */
const FOLDER_ID_RE = /(?:^|(?<=[\s(\[{<"',;:]))((?:\d+(?:_\d+)+\/)+)(?=$|[\s)\]}>"',;:.!?])/g

/** Scratch slug: Scratch/<slug>/ or AgentSystem/Scratch/<slug>/ */
const SCRATCH_RE = /(?:^|(?<=[\s(\[{<"',;:]))(?:([A-Z][A-Za-z0-9]+)\/)?[Ss]cratch\/([A-Za-z0-9_-]+)\/?(?=$|[\s)\]}>"',;:.!?])/g

/** Known folder prefixes (only these match plain-prose folder paths). */
const KNOWN_FOLDER_PREFIXES = [
  'projects/',
  '_system/',
  'State/',
  'library/',
  'Scratch/',
  'artifacts/_workers/',
  'artifacts/_verifier/',
]

/**
 * Vault path detection in plain prose. Must contain a `/` (absolute or relative)
 * OR start with `/` (absolute). Hostnames-without-paths (TLD-only) are dropped.
 */
const VAULT_PATH_RE = /(?:^|(?<=[\s(\[{<"',;:]))(\/?(?:[\w.\-]+\/)+[\w.\-]+\.[A-Za-z0-9]+)(?=$|[\s)\]}>"',;:.!?])/g

/** Bare folder path with at least one `/` and no extension. */
const FOLDER_PATH_RE = /(?:^|(?<=[\s(\[{<"',;:]))((?:[\w.\-]+\/)+[\w.\-]*\/?)(?=$|[\s)\]}>"',;:.!?])/g

const URL_RE = /https?:\/\/\S+/g

const TLD_BLOCKLIST = new Set([
  'com', 'org', 'net', 'io', 'dev', 'app', 'co', 'ai', 'gov', 'edu', 'info',
])

/** PM-managed filenames that route through EntityChip rather than FileChipInline. */
const PM_FILES = new Set(['task.md', 'worklog.md'])

interface Span {
  start: number
  end: number
}

function overlaps(span: Span, taken: Span[]): boolean {
  return taken.some(t => span.start < t.end && span.end > t.start)
}

function nearUrl(text: string, idx: number): boolean {
  const before = text.slice(Math.max(0, idx - 8), idx)
  return /https?:\/\//.test(before)
}

function stripTrailingPunct(match: string, start: number): { text: string; end: number } {
  let end = start + match.length
  while (end > start && /[.,;:!?]/.test(match[match.length - 1])) {
    match = match.slice(0, -1)
    end -= 1
  }
  return { text: match, end }
}

/**
 * Find all auto-linkable ref candidates in a plain-text string.
 *
 * Detection order: sessions → namespaced task refs → folder-id task refs →
 * scratch refs → vault paths → folder paths. First match wins on overlap.
 */
export function findCandidates(text: string): RefMatch[] {
  const matches: RefMatch[] = []
  const taken: Span[] = []

  const skipUrls = (): Span[] => {
    URL_RE.lastIndex = 0
    const urlSpans: Span[] = []
    let m: RegExpExecArray | null
    while ((m = URL_RE.exec(text)) !== null) {
      urlSpans.push({ start: m.index, end: m.index + m[0].length })
    }
    return urlSpans
  }
  const urlSpans = skipUrls()
  const inUrl = (s: Span) => urlSpans.some(u => s.start >= u.start && s.end <= u.end)

  const tryMatch = (
    re: RegExp,
    handler: (m: RegExpExecArray) => RefMatch | null,
  ) => {
    re.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(text)) !== null) {
      const result = handler(m)
      if (!result) continue
      const span: Span = { start: result.start, end: result.end }
      if (overlaps(span, taken)) continue
      if (inUrl(span)) continue
      if (nearUrl(text, span.start)) continue
      matches.push(result)
      taken.push(span)
    }
  }

  // 1. Session names
  tryMatch(SESSION_RE, (m) => {
    const role = m[1]
    const hex = m[2]
    const start = m.index
    const matchStr = `${role}_${hex}`
    return {
      start,
      end: start + matchStr.length,
      kind: 'session',
      text: matchStr,
      // 'sessionname' avoids rehype-sanitize's clobber prefix on the 'name' attribute
      payload: { sessionname: matchStr, role },
    }
  })

  // 2. Namespaced task refs (project prefix + dotted ID)
  tryMatch(NS_TASK_RE, (m) => {
    const project = m[1]
    const taskid = m[2]
    const start = m.index
    const matchStr = `${project}/${taskid}`
    return {
      start,
      end: start + matchStr.length,
      kind: 'entity',
      text: matchStr,
      payload: { project, taskid, source: 'task-ref' },
    }
  })

  // 3. Folder-id task refs (1_2/1_2_6/1_2_6_1/)
  tryMatch(FOLDER_ID_RE, (m) => {
    const raw = m[1]
    const start = m.index
    // Take the deepest numeric folder — that's the actual task ID
    const segments = raw.replace(/\/$/, '').split('/').filter(Boolean)
    const deepest = segments[segments.length - 1]
    if (!/^\d+(?:_\d+)+$/.test(deepest)) return null
    const taskid = deepest.replace(/_/g, '.')
    return {
      start,
      end: start + raw.length,
      kind: 'entity',
      text: raw,
      payload: { taskid, source: 'folder-id' },
    }
  })

  // 4. Scratch refs
  tryMatch(SCRATCH_RE, (m) => {
    const project = m[1] || ''
    const slug = m[2]
    const start = m.index
    const matchStr = m[0]
    return {
      start,
      end: start + matchStr.length,
      kind: 'entity',
      text: matchStr,
      payload: {
        taskid: `scratch/${slug}`,
        ...(project ? { project } : {}),
        source: 'scratch',
      },
    }
  })

  // 5. Vault paths (file with extension; must contain / or be absolute)
  tryMatch(VAULT_PATH_RE, (m) => {
    let raw = m[1]
    const startIdx = m.index
    const stripped = stripTrailingPunct(raw, startIdx)
    raw = stripped.text
    const end = stripped.end

    // Filter: TLD-blocklisted hostname-only tokens (e.g. "example.com")
    const slashCount = (raw.match(/\//g) || []).length
    const ext = raw.slice(raw.lastIndexOf('.') + 1).toLowerCase()
    if (slashCount === 0 && TLD_BLOCKLIST.has(ext)) return null
    // Require at least one slash OR absolute start
    if (slashCount === 0 && !raw.startsWith('/')) return null

    // Special case: task.md / worklog.md → EntityChip
    const filename = raw.split('/').pop() || raw
    if (PM_FILES.has(filename)) {
      const entityResult: RefMatch = {
        start: startIdx,
        end,
        kind: 'entity',
        text: raw,
        payload: { path: raw, filename, source: 'pm-file' },
      }
      return entityResult
    }

    const fileResult: RefMatch = {
      start: startIdx,
      end,
      kind: 'file',
      text: raw,
      payload: { path: raw, ext },
    }
    return fileResult
  })

  // 6. Folder paths — only known vault prefixes
  tryMatch(FOLDER_PATH_RE, (m) => {
    const raw = m[1]
    const startIdx = m.index
    // Strip trailing punctuation
    const stripped = stripTrailingPunct(raw, startIdx)
    let path = stripped.text
    const end = stripped.end
    // Must end with / for clarity, no extension
    if (/\.[A-Za-z0-9]+$/.test(path)) return null
    // Must match a known prefix
    if (!KNOWN_FOLDER_PREFIXES.some(p => path.startsWith(p))) return null
    return {
      start: startIdx,
      end,
      kind: 'folder',
      text: path,
      payload: { path },
    }
  })

  matches.sort((a, b) => a.start - b.start)
  return matches
}
