/**
 * MoveToDialog — Searchable command palette for moving files to any task folder.
 *
 * Shows sibling task folders from nodeCache, with lazy subfolder expansion
 * via fetchVaultDirectory. Reuses the cmdk Command component from shadcn.
 */
import { useState, useEffect, useCallback } from 'react'
import { Folder, ChevronRight, ArrowLeft, FolderInput } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog.tsx'
import {
  Command, CommandInput, CommandList, CommandEmpty,
  CommandGroup, CommandItem,
} from '@/components/ui/command.tsx'
import { usePMStore } from '@/stores/pm-store.ts'
import * as api from '@/lib/api.ts'
import { displayPMNodeId } from '@/lib/paths.ts'

interface DirEntry {
  name: string
  type: 'file' | 'dir'
  count?: number
}

interface MoveToDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Called when user picks a destination folder path */
  onMove: (destPath: string) => void
  /** Current file's parent path — used to dim "already here" entries */
  currentParentPath?: string
}

export function MoveToDialog({ open, onOpenChange, onMove, currentParentPath }: MoveToDialogProps) {
  const activeProject = usePMStore(s => s.activeProject)
  const currentNodeId = usePMStore(s => s.currentNodeId)
  const nodeCache = usePMStore(s => s.nodeCache)
  const projectNodeCache = activeProject ? (nodeCache[activeProject] || {}) : {}

  const [query, setQuery] = useState('')
  const [browsePath, setBrowsePath] = useState<string | null>(null)
  const [browseEntries, setBrowseEntries] = useState<DirEntry[]>([])
  const [browseLoading, setBrowseLoading] = useState(false)

  // Reset on open
  useEffect(() => {
    if (open) {
      setQuery('')
      setBrowsePath(null)
      setBrowseEntries([])
    }
  }, [open])

  // Load subdirectory when browsing into a folder
  useEffect(() => {
    if (browsePath === null) return
    setBrowseLoading(true)
    api.fetchVaultDirectory(browsePath)
      .then(data => {
        // Only show folders
        setBrowseEntries(data.entries.filter((e: DirEntry) => e.type === 'dir'))
        setBrowseLoading(false)
      })
      .catch(() => { setBrowseEntries([]); setBrowseLoading(false) })
  }, [browsePath])

  // Build top-level task folder list from nodeCache
  const cacheKey = currentNodeId || '__root__'
  const cached = projectNodeCache[cacheKey]
  const taskFolders: { id: string; title: string; path: string }[] = []

  if (cached) {
    // Parent node
    if (cached.parent.path) {
      taskFolders.push({
        id: cached.parent.id,
        title: `${displayPMNodeId(cached.parent.id)} ${cached.parent.title}`,
        path: cached.parent.path,
      })
    }
    // Child cards
    for (const child of cached.children) {
      if (child.path) {
        taskFolders.push({
          id: child.id,
          title: `${displayPMNodeId(child.id)} ${child.title}`,
          path: child.path,
        })
      }
    }
  }

  const handleSelect = useCallback((path: string) => {
    onMove(path)
    onOpenChange(false)
  }, [onMove, onOpenChange])

  const handleBrowseFolder = useCallback((path: string) => {
    setBrowsePath(path)
    setQuery('')
  }, [])

  const handleBrowseBack = useCallback(() => {
    if (!browsePath) return
    // Try going up one level; if at a task root, go back to listing
    const parent = browsePath.substring(0, browsePath.lastIndexOf('/'))
    // Check if parent is still within a known task folder
    const parentIsKnown = taskFolders.some(f => parent === f.path || parent.startsWith(f.path + '/'))
    if (!parent || !parentIsKnown) {
      setBrowsePath(null)
    } else {
      setBrowsePath(parent)
    }
  }, [browsePath, taskFolders])

  const isBrowsing = browsePath !== null
  const lowerQuery = query.toLowerCase()

  // Filter task folders by query
  const filteredFolders = lowerQuery
    ? taskFolders.filter(f => f.title.toLowerCase().includes(lowerQuery))
    : taskFolders

  // Filter browse entries by query
  const filteredEntries = lowerQuery
    ? browseEntries.filter(e => e.name.toLowerCase().includes(lowerQuery))
    : browseEntries

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[380px] p-0 gap-0">
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle className="text-sm flex items-center gap-1.5">
            <FolderInput size={14} /> Move to…
          </DialogTitle>
        </DialogHeader>
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={isBrowsing ? 'Filter subfolders…' : 'Search tasks…'}
            value={query}
            onValueChange={setQuery}
          />
          <CommandList className="max-h-[320px]">

            {/* Browse mode — inside a specific task folder */}
            {isBrowsing && (
              <>
                <div className="flex items-center gap-1.5 px-3 py-1.5 type-micro text-muted-foreground border-b border-border">
                  <button
                    className="bg-transparent border-none p-0 cursor-pointer text-muted-foreground hover:text-foreground"
                    onClick={handleBrowseBack}
                  >
                    <ArrowLeft size={12} />
                  </button>
                  <span className="truncate font-mono">{browsePath}</span>
                </div>
                {/* Select this folder as destination */}
                <CommandGroup>
                  <CommandItem
                    value={`select:${browsePath}`}
                    onSelect={() => handleSelect(browsePath)}
                    className="flex items-center gap-2 py-1.5 cursor-pointer font-medium"
                  >
                    <FolderInput size={14} className="text-accent shrink-0" />
                    <span className="type-label">Move here</span>
                    {currentParentPath === browsePath && (
                      <span className="type-caption text-muted-foreground ml-auto">(current)</span>
                    )}
                  </CommandItem>
                </CommandGroup>
                <CommandGroup heading="Subfolders">
                  {browseLoading ? (
                    <div className="py-4 text-center type-micro text-muted-foreground">Loading…</div>
                  ) : filteredEntries.length === 0 ? (
                    <div className="py-3 text-center type-micro text-muted-foreground">(no subfolders)</div>
                  ) : filteredEntries.map(entry => (
                    <CommandItem
                      key={entry.name}
                      value={entry.name}
                      onSelect={() => handleBrowseFolder(`${browsePath}/${entry.name}`)}
                      className="flex items-center gap-2 py-1.5 cursor-pointer"
                    >
                      <Folder size={14} className="text-muted-foreground shrink-0" />
                      <span className="type-label truncate flex-1">{entry.name}/</span>
                      {entry.count != null && (
                        <span className="type-caption text-muted-foreground">{entry.count}</span>
                      )}
                      <ChevronRight size={12} className="text-muted-foreground shrink-0" />
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}

            {/* Default mode — list all sibling task folders */}
            {!isBrowsing && (
              <CommandGroup heading="Task folders">
                {filteredFolders.length === 0 ? (
                  <CommandEmpty>No matching tasks.</CommandEmpty>
                ) : filteredFolders.map(folder => (
                  <CommandItem
                    key={folder.path}
                    value={folder.title}
                    onSelect={() => handleBrowseFolder(folder.path)}
                    className="flex items-center gap-2 py-1.5 cursor-pointer"
                  >
                    <Folder size={14} className="text-muted-foreground shrink-0" />
                    <span className="type-label truncate flex-1">{folder.title}</span>
                    {currentParentPath === folder.path && (
                      <span className="type-caption text-muted-foreground">(current)</span>
                    )}
                    <ChevronRight size={12} className="text-muted-foreground shrink-0" />
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  )
}
