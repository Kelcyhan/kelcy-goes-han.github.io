import { FolderOpen } from 'lucide-react'
import { useTabStore } from '@/stores/tab-store.ts'
import { useSessionStore } from '@/stores/session-store.ts'
import { isTaskRef } from '@/lib/clickable-code.ts'
import { searchVaultDirs, getAuthToken } from '@/lib/api.ts'
import { usePMStore } from '@/stores/pm-store.ts'
import { ActionButton } from '@/components/primitives'

interface FolderChipInlineProps {
  path: string
}

export function FolderChipInline({ path }: FolderChipInlineProps) {
  const openDocTab = useTabStore(s => s.openDocTab)

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault()
    const folderName = path.replace(/\/$/, '')
    const { sessions, activeSession } = useSessionStore.getState()
    const session = sessions.find(s => s.name === activeSession)
    const taskDir = session?.task_path
      ? session.task_path.substring(0, session.task_path.lastIndexOf('/'))
      : ''

    const dirExists = async (p: string) => {
      try { return (await fetch(`/api/vault/directory?path=${encodeURIComponent(p)}`, { headers: { Authorization: `Bearer ${getAuthToken()}` } })).ok } catch { return false }
    }

    // 1. Try absolute path / current vault-relative directly via doc tab
    if (await dirExists(folderName)) {
      openDocTab(folderName, e.ctrlKey || e.metaKey)
      return
    }

    // 2. Try as task-folder match within current task dir
    if (taskDir) {
      const candidate = `${taskDir}/${folderName}`
      if (await dirExists(candidate)) {
        const tid = isTaskRef(taskDir + '/')
        const proj = taskDir.match(/^projects\/([^/]+)/)?.[1]
        if (tid && proj) {
          await usePMStore.getState().goToTaskTarget(proj, tid)
          return
        }
        openDocTab(candidate, e.ctrlKey || e.metaKey)
        return
      }
    }

    // 3. Search vault for folder; nav to first task-owned match
    try {
      const data = await searchVaultDirs(folderName.split('/').pop() || folderName, undefined, 20)
      const matches = (data.results || [])
      const taskMatch = matches.find((r: any) => {
        const tid = isTaskRef(r.path + '/')
        return tid !== null
      })
      if (taskMatch) {
        const tid = isTaskRef(taskMatch.path + '/')
        const proj = taskMatch.path.match(/^projects\/([^/]+)/)?.[1]
        if (tid && proj) {
          await usePMStore.getState().goToTaskTarget(proj, tid)
          return
        }
      }
      // Fallback: open the first matching folder as a doc tab (server may render listing)
      if (matches.length > 0) openDocTab(matches[0].path, e.ctrlKey || e.metaKey)
    } catch {}
  }

  return (
    <ActionButton
      variant="chip"
      size="chip"
      onClick={handleClick}
      className="px-1.5 py-px rounded text-foreground [&_svg]:shrink-0"
      title={path}
    >
      <FolderOpen size={11} className="text-muted-foreground" />
      <span className="font-mono">{path}</span>
    </ActionButton>
  )
}
