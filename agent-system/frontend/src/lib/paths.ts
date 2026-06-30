/**
 * Normalize a file path for vault file resolution.
 *
 * - Absolute paths starting with vault root are converted to vault-relative.
 * - Other paths are returned as-is.
 */
export function normalizeVaultPath(rawPath: string, vaultRoot: string | null): string {
  if (!vaultRoot) return rawPath
  const prefix = vaultRoot.endsWith('/') ? vaultRoot : vaultRoot + '/'
  if (rawPath.startsWith(prefix)) return rawPath.slice(prefix.length)
  return rawPath
}

/**
 * Compute the vault-relative directory prefix for a working_dir.
 * E.g., vaultRoot="/vault", workingDir="/vault/projects/foo" → "projects/foo"
 * Returns empty string if workingDir === vaultRoot or is outside vault.
 */
export function workingDirPrefix(workingDir: string | undefined, vaultRoot: string | null): string {
  if (!workingDir || !vaultRoot) return ''
  const prefix = vaultRoot.endsWith('/') ? vaultRoot : vaultRoot + '/'
  if (workingDir === vaultRoot) return ''
  if (workingDir.startsWith(prefix)) return workingDir.slice(prefix.length)
  return ''
}

function taskIdToSegments(taskId: string): string[] {
  const idParts = taskId.replace(/\./g, '_').split('_')
  const folders: string[] = []
  for (let i = 1; i < idParts.length; i++) {
    folders.push(idParts.slice(0, i + 1).join('_'))
  }
  return folders
}

/** Derive ancestor node IDs from a node ID. Single source of truth — used by
 *  PMBreadcrumb, TopBar, and any other component that walks the parent chain.
 *
 *  Conventions:
 *  - "1.2.3"              → ["1.2"]                  (numbered tasks)
 *  - "scratch/foo"         → ["scratch"]              (project-root or vault-root scratch)
 *  - "1.2/scratch/foo"     → ["1.2", "scratch"]       (legacy domain-nested alias)
 *  - "scratch"             → []                        (scratch root itself)
 *
 *  Excludes the project root segment and the node itself.
 */
export function getPMAncestorIds(nodeId: string): string[] {
  if (!nodeId || nodeId === 'scratch') return []
  if (nodeId.startsWith('scratch/')) return ['scratch']
  // Legacy domain-nested alias: <numbered>/scratch/<slug>
  const nested = nodeId.match(/^(\d+(?:\.\d+)*)\/scratch\/.+$/)
  if (nested) {
    const parts = nested[1].split('.')
    const ancestors: string[] = []
    for (let i = 2; i <= parts.length; i++) {
      ancestors.push(parts.slice(0, i).join('.'))
    }
    ancestors.push('scratch')
    return ancestors
  }
  const parts = nodeId.split('.')
  const ancestors: string[] = []
  for (let i = 2; i < parts.length; i++) {
    ancestors.push(parts.slice(0, i).join('.'))
  }
  return ancestors
}

export function displayPMNodeId(nodeId: string): string {
  if (nodeId === '__scratch__') return 'scratch'
  if (nodeId.startsWith('scratch/')) return nodeId.slice('scratch/'.length)
  const nested = nodeId.match(/^(\d+(?:\.\d+)*)\/scratch\/(.+)$/)
  if (nested) return nested[2]
  return nodeId
}

export function normalizePMTaskId(project: string | null | undefined, taskId: string | null | undefined): string {
  if (!taskId) return ''
  if (project === '__scratch__' && taskId !== 'scratch' && !taskId.startsWith('scratch/')) {
    return `scratch/${taskId}`
  }
  return taskId
}

export function buildTaskFolderPath(project: string, taskId: string): string {
  if (project === '__scratch__') {
    if (taskId.startsWith('scratch/')) {
      return `Scratch/${taskId.replace('scratch/', '')}`
    }
    return `Scratch/${taskId}`
  }
  // Nested scratch under a domain: "1.2/scratch/slug" → projects/<P>/1_2/Scratch/slug
  const nestedMatch = taskId.match(/^(\d+(?:\.\d+)*)\/scratch\/(.+)$/)
  if (nestedMatch) {
    const parentId = nestedMatch[1]
    const slug = nestedMatch[2]
    const parentPath = taskIdToSegments(parentId).join('/')
    return `projects/${project}/${parentPath}/Scratch/${slug}`
  }
  if (taskId.startsWith('scratch/')) {
    return `projects/${project}/Scratch/${taskId.replace('scratch/', '')}`
  }
  return `projects/${project}/${taskIdToSegments(taskId).join('/')}`
}

export function buildTaskFilePath(project: string, taskId: string): string {
  return `${buildTaskFolderPath(project, taskId)}/task.md`
}

/**
 * Extract project name from a vault-relative path.
 * "projects/AgentSystem/1_2_foo/worklog.md" → "AgentSystem"
 */
export function extractProjectFromPath(path: string): string | null {
  if (path === 'Scratch' || path.startsWith('Scratch/')) return '__scratch__'
  const match = path.match(/^projects\/([^/]+)/)
  return match ? match[1] : null
}

/**
 * Extract task ID from a vault-relative file path by parsing
 * the immediate parent folder's numeric prefix.
 * "projects/AgentSystem/1_2_foo/1_2_3_bar/worklog.md" → "1.2.3"
 * "projects/AgentSystem/1_2/1_2_3/task.md" → "1.2.3" (ID-only folders)
 * "projects/AgentSystem/Scratch/my-task/task.md" → "scratch/my-task"
 */
export function extractTaskIdFromPath(path: string): string | null {
  // Nested scratch under a domain: projects/<P>/<numbered>/.../Scratch/<slug>/
  // Captures the LAST numbered folder before Scratch as the parent ID.
  const nestedScratch = path.match(/^projects\/[^/]+\/(?:[^/]+\/)*?(\d+(?:_\d+)*)\/Scratch\/([^/]+)\//)
  if (nestedScratch) {
    return `${nestedScratch[1].replace(/_/g, '.')}/scratch/${nestedScratch[2]}`
  }
  // Project-root or vault-root scratch: synthesize scratch/<slug> ID
  const scratchMatch = path.match(/(?:^|\/)Scratch\/([^/]+)\//)
  if (scratchMatch) return `scratch/${scratchMatch[1]}`
  const segments = path.split('/')
  if (segments.length < 2) return null
  const parentFolder = segments[segments.length - 2]
  // New convention: ID-only folder like "1_2_3" (pure digits+underscores)
  if (/^\d+(?:_\d+)*$/.test(parentFolder)) {
    return parentFolder.replace(/_/g, '.')
  }
  // Old convention: slug-based folder like "1_2_3_name"
  const match = parentFolder.match(/^(\d+(?:_\d+)*)_/)
  if (!match) return null
  return match[1].replace(/_/g, '.')
}
