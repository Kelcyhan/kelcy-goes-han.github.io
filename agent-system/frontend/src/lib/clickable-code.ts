/** Detection functions for clickable inline code elements in chat messages. */

export function isVaultPath(s: string): boolean {
  return /^(?!https?:\/\/)[\w.\-/]+\.\w+$/.test(s) && !s.includes(' ')
}

/** Match task references: "1.2.3", "1_2_3/", "AgentSystem/1.2.3", "Scratch/slug/" */
export function isTaskRef(s: string): string | null {
  // File paths have extensions (e.g. .md, .py) — those are vault paths, not task refs
  if (/\.[a-zA-Z]\w*$/.test(s)) return null
  // Scratch tasks: Scratch/slug, scratch/slug, AgentSystem/Scratch/slug/
  const scratchMatch = s.match(/^(?:\w+\/)?[Ss]cratch\/([^/]+)\/?$/)
  if (scratchMatch) return `scratch/${scratchMatch[1]}`
  // Dot notation: 1.2.3, AgentSystem/1.2.3
  const dotMatch = s.match(/^(?:\w+\/)?(\d+(?:\.\d+)+)$/)
  if (dotMatch) return dotMatch[1]
  // Folder notation: 1_2_3, 1_2_3/, 1_2/1_2_3/, 1_7/1_7_3/1_7_3_1/artifacts/docs/
  const folderMatch = s.replace(/\/$/, '').match(/(\d+(?:_\d+)+)(?:\/[^0-9].*)?$/)
  if (folderMatch) return folderMatch[1].replace(/_/g, '.')
  return null
}

/** Match session names: task_224807f2, verifier_abcd1234, etc. */
export function isSessionName(s: string): boolean {
  return /^(task|verifier|concierge|chainlink|shadow)_[0-9a-f]{8}$/.test(s)
}

/** Match named folder paths (with or without trailing slash) that have no file extension
 *  and no numeric task ref segment. E.g. "artifacts/", "_system/agents/concierge",
 *  "State/logs/2026-04-06" — but NOT "1_2_3/" (already isTaskRef). */
export function isFolderPath(s: string): boolean {
  if (s.includes(' ')) return false
  if (/^https?:\/\//.test(s)) return false
  if (!s.includes('/')) return false          // must have at least one slash
  if (/\.[a-zA-Z]\w*$/.test(s)) return false // file extensions go to isVaultPath
  if (!/^[\w.\-/]+\/?$/.test(s)) return false
  if (isTaskRef(s) !== null) return false     // already handled
  return true
}

export function isClickableCode(s: string): boolean {
  return isVaultPath(s) || isTaskRef(s) !== null || isSessionName(s) || isFolderPath(s)
}
