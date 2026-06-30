/** Shared link-handling utilities for markdown doc viewers. */

/** Returns true if href points to a file inside the vault (any extension, not external). */
export function isVaultPath(href: string): boolean {
  return /^(?!https?:\/\/)[\w.\-/ ]+\.\w+$/.test(href) && !href.includes(' ')
}

/**
 * Resolve a potentially relative href against the directory of the currently viewed file.
 * Handles `../` traversal by normalising segments client-side (server can't handle `..`).
 * Vault-rooted paths (projects/, library/, State/, Scratch/, _system/) are returned as-is.
 */
export function resolveHref(href: string, currentPath: string): string {
  // External or already-absolute paths — leave alone
  if (/^https?:\/\//.test(href) || href.startsWith('/')) return href
  // Vault-rooted top-level directories — already relative to vault root.
  // Note: `Scratch/` is NOT here because every project also has its own `Scratch/`
  // subfolder, so we must resolve it relative to the current file instead.
  if (/^(projects|library|State|_system)\//.test(href)) return href
  // Resolve relative to current file's directory
  const dir = currentPath.includes('/') ? currentPath.substring(0, currentPath.lastIndexOf('/')) : ''
  const raw = dir ? dir + '/' + href : href
  // Normalise . and .. segments
  const parts = raw.split('/')
  const out: string[] = []
  for (const p of parts) {
    if (p === '..') out.pop()
    else if (p !== '.') out.push(p)
  }
  return out.join('/')
}
