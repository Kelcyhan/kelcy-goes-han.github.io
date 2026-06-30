/**
 * InlineFolderExpand — Recursive file manager for expanded folders inside PM views.
 *
 * Historically this was a lightweight preview list with its own action model,
 * which diverged from top-level FileColumn rows. Keep the visual nesting, but
 * expose the same core affordances for nested rows: rename, delete, and DnD.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ChevronDown, ChevronRight, FileText, Folder, RefreshCw,
  Trash2, FolderOutput, FolderInput, Download, ExternalLink, Pencil, Check,
} from 'lucide-react'
import {
  DndContext, useDraggable, useDroppable, DragOverlay,
  closestCenter, PointerSensor, useSensor,
  type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core'
import { usePMStore } from '@/stores/pm-store.ts'
import { useFileDndContext } from './FileDndProvider.tsx'
import type { DirEntry } from './shared.tsx'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu.tsx'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog.tsx'
import { Button } from '@/components/ui/button.tsx'
import { IconButton } from '@/components/primitives'
import { MoveToDialog } from './MoveToDialog.tsx'
import * as api from '@/lib/api.ts'

interface NestedFileInfo {
  name: string
  path: string
  type: 'file' | 'folder'
  size?: number
  count?: number
}

function formatSize(bytes: number | undefined): string {
  if (bytes == null) return ''
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}K`
  return `${(bytes / (1024 * 1024)).toFixed(1)}M`
}

function mapEntry(parentPath: string, entry: DirEntry): NestedFileInfo {
  const path = parentPath ? `${parentPath}/${entry.name}` : entry.name
  return {
    name: entry.name,
    path,
    type: entry.type === 'dir' ? 'folder' : 'file',
    size: entry.size,
    count: entry.count,
  }
}

function NestedEntryRow({
  item,
  parentPath,
  onMutate,
  insideDnd,
  selecting,
  selected,
  selectedPaths,
  onToggleSelect,
}: {
  item: NestedFileInfo
  parentPath: string
  onMutate?: () => void
  insideDnd: boolean
  selecting?: boolean
  selected?: boolean
  selectedPaths?: Iterable<string>
  onToggleSelect?: (item: NestedFileInfo) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [moveToOpen, setMoveToOpen] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(item.name)
  const openFilePreview = usePMStore(s => s.openFilePreview)
  const refreshCurrentNode = usePMStore(s => s.refreshCurrentNode)

  const dragData = useMemo(() => ({ file: item }), [item])
  const dropData = useMemo(() => ({ folder: item }), [item])

  const { attributes, listeners, setNodeRef: setDragRef, transform } = useDraggable({
    id: `drag:${item.path}`,
    data: dragData,
    disabled: renaming || !!selecting,
  })

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `drop:${item.path}`,
    data: dropData,
    disabled: item.type !== 'folder',
  })

  const combinedRef = useCallback((el: HTMLElement | null) => {
    setDragRef(el)
    if (item.type === 'folder') setDropRef(el)
  }, [setDragRef, setDropRef, item.type])

  const rowStyle = transform ? {
    transform: `translate(${transform.x}px, ${transform.y}px)`,
    opacity: 0.5,
    zIndex: 50,
  } : undefined

  const handleDelete = async () => {
    setDeleteOpen(false)
    try {
      await api.deleteVaultItem(item.path)
    } catch (err) {
      console.error('Nested delete failed:', err)
    }
    onMutate?.()
  }

  const handleMoveToParent = async () => {
    const parentDir = parentPath.substring(0, parentPath.lastIndexOf('/')) || parentPath
    try {
      await api.moveVaultItems([item.path], parentDir)
    } catch (err) {
      console.error('Move to parent failed:', err)
    }
    onMutate?.()
  }

  const handleRenameSubmit = async () => {
    const trimmed = renameValue.trim()
    setRenaming(false)
    if (!trimmed || trimmed === item.name) {
      setRenameValue(item.name)
      return
    }
    try {
      await api.renameVaultItem(item.path, trimmed)
    } catch (err) {
      console.error('Nested rename failed:', err)
      setRenameValue(item.name)
    }
    onMutate?.()
  }

  if (renaming) {
    const dotIdx = item.name.lastIndexOf('.')
    const selectEnd = item.type === 'folder' ? item.name.length : (dotIdx > 0 ? dotIdx : item.name.length)
    return (
      <div className="flex items-center gap-1.5 px-1.5 py-[3px] type-micro font-mono">
        {item.type === 'folder' ? <Folder size={12} className="text-muted-foreground shrink-0" /> : <FileText size={12} className="text-muted-foreground shrink-0" />}
        <input
          autoFocus
          className="bg-transparent border-none outline-none text-foreground type-micro font-mono flex-1 min-w-0"
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void handleRenameSubmit()
            else if (e.key === 'Escape') {
              setRenaming(false)
              setRenameValue(item.name)
            }
          }}
          onBlur={() => { void handleRenameSubmit() }}
          onFocus={(e) => e.target.setSelectionRange(0, selectEnd)}
        />
      </div>
    )
  }

  return (
    <>
      <div
        ref={combinedRef}
        className={`group/row flex items-center gap-1.5 px-1.5 py-[3px] rounded type-micro cursor-pointer transition-colors
          hover:bg-[var(--bg-card-hover)]
          ${selected ? 'bg-[var(--bg-ingrained)]' : ''}
          ${isOver ? 'bg-[var(--bg-ingrained)] ring-1 ring-[var(--color-accent)]' : ''}`}
        style={rowStyle}
        onClick={(e) => {
          e.stopPropagation()
          if (selecting) {
            onToggleSelect?.(item)
            return
          }
          if (item.type === 'folder') setExpanded(!expanded)
          else openFilePreview(item.path, item.name, 'file')
        }}
        title={item.path}
        {...(insideDnd && !selecting ? { ...attributes, ...listeners } : {})}
      >
        {selecting && (
          <button
            className="bg-transparent border-none p-0 cursor-pointer inline-flex items-center shrink-0"
            onClick={(e) => {
              e.stopPropagation()
              onToggleSelect?.(item)
            }}
          >
            {selected
              ? <Check size={11} className="text-accent" />
              : <span className="w-[11px] h-[11px] rounded-sm border border-muted-foreground inline-block" />}
          </button>
        )}
        {item.type === 'folder' ? (
          expanded ? <ChevronDown size={10} className="text-muted-foreground shrink-0" /> : <ChevronRight size={10} className="text-muted-foreground shrink-0" />
        ) : (
          <span style={{ width: 10 }} />
        )}
        {item.type === 'folder'
          ? <Folder size={12} className="text-muted-foreground shrink-0" />
          : <FileText size={12} className="text-muted-foreground shrink-0" />}
        <span className="flex-1 min-w-0 truncate text-foreground">{item.name}</span>
        {item.type === 'file' && item.size != null && (
          <span className="type-caption text-muted-foreground shrink-0 font-mono">{formatSize(item.size)}</span>
        )}
        {item.type === 'folder' && item.count != null && (
          <span className="type-caption text-muted-foreground shrink-0">{item.count}</span>
        )}
        {!selecting && (
          <span className="inline-flex items-center gap-px shrink-0">
          {item.type === 'file' && (
            <>
              <IconButton
                variant="appShell"
                size="file"
                title="Open"
                onClick={(e) => { e.stopPropagation(); openFilePreview(item.path, item.name, 'file') }}
              >
                <ExternalLink size={11} />
              </IconButton>
              <IconButton
                variant="appShell"
                size="file"
                title="Download"
                onClick={(e) => {
                  e.stopPropagation()
                  const a = document.createElement('a')
                  a.href = api.downloadVaultUrl(item.path)
                  a.download = item.name
                  a.click()
                }}
              >
                <Download size={11} />
              </IconButton>
            </>
          )}
          <IconButton
            variant="appShell"
            size="file"
            title="Rename"
            onClick={(e) => {
              e.stopPropagation()
              setRenameValue(item.name)
              setRenaming(true)
            }}
          >
            <Pencil size={11} />
          </IconButton>
          <IconButton
            variant="appShell"
            size="file"
            className="hover:text-red"
            title="Delete"
            onClick={(e) => { e.stopPropagation(); setDeleteOpen(true) }}
          >
            <Trash2 size={11} />
          </IconButton>
          </span>
        )}
        {!selecting && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <IconButton
                variant="appShell"
                size="file"
                onClick={(e) => e.stopPropagation()}
                title="More actions"
              >
                <FolderInput size={10} />
              </IconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[140px]">
              <DropdownMenuItem onSelect={handleMoveToParent}>
                <FolderOutput size={12} /> Move to parent
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setMoveToOpen(true)}>
                <FolderInput size={12} /> Move to other task…
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-red focus:text-red"
                onSelect={() => setDeleteOpen(true)}
              >
                <Trash2 size={12} /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {item.type === 'folder' && expanded && (
        <InlineFolderExpand
          path={item.path}
          nested
          onMutate={onMutate}
          insideDnd
          selecting={selecting}
          selectedPaths={selectedPaths}
          onToggleSelect={onToggleSelect}
        />
      )}

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Delete {item.type === 'folder' ? 'folder' : 'file'}</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{item.name}</strong>? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => { void handleDelete() }}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MoveToDialog
        open={moveToOpen}
        onOpenChange={setMoveToOpen}
        onMove={async (destPath) => {
          try {
            await api.moveVaultItems([item.path], destPath)
          } catch (err) {
            console.error('Move to other task failed:', err)
          }
          onMutate?.()
          refreshCurrentNode()
        }}
        currentParentPath={parentPath}
      />
    </>
  )
}

interface InlineFolderExpandProps {
  path: string
  nested?: boolean
  onMutate?: () => void
  insideDnd?: boolean
  selecting?: boolean
  selectedPaths?: Iterable<string>
  onToggleSelect?: (item: NestedFileInfo) => void
}

export function InlineFolderExpand({
  path,
  nested,
  onMutate,
  insideDnd = false,
  selecting = false,
  selectedPaths,
  onToggleSelect,
}: InlineFolderExpandProps) {
  const [entries, setEntries] = useState<DirEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const [activeDragItem, setActiveDragItem] = useState<NestedFileInfo | null>(null)
  const sseRefreshCounter = usePMStore(s => s.sseRefreshCounter)
  const refreshCurrentNode = usePMStore(s => s.refreshCurrentNode)
  const sharedDnd = useFileDndContext()
  const nestedItems = useMemo(() => entries.map(entry => mapEntry(path, entry)), [entries, path])
  const selectedSet = useMemo(() => new Set(selectedPaths ?? []), [selectedPaths])
  const participatesInParentDnd = insideDnd || !!sharedDnd

  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: { distance: 8 },
  })
  const sensors = useMemo(() => [pointerSensor], [pointerSensor])

  const handleMutate = useCallback(() => {
    setRefreshKey(k => k + 1)
    onMutate?.()
  }, [onMutate])

  useEffect(() => {
    if (sseRefreshCounter > 0) setRefreshKey(k => k + 1)
  }, [sseRefreshCounter])

  useEffect(() => {
    setLoading(true)
    api.fetchVaultDirectory(path)
      .then(data => {
        setEntries(data.entries)
        setLoading(false)
      })
      .catch(() => {
        setEntries([])
        setLoading(false)
      })
  }, [path, refreshKey])

  const handleDndDragEnd = useCallback(async (event: DragEndEvent) => {
    setActiveDragId(null)
    setActiveDragItem(null)
    const { active, over } = event
    if (!over) return

    const draggedFile = active.data?.current?.file as NestedFileInfo | undefined
    const targetFolder = over.data?.current?.folder as NestedFileInfo | undefined
    if (!draggedFile || !targetFolder) return
    if (targetFolder.type !== 'folder') return
    if (draggedFile.path === targetFolder.path) return
    if (targetFolder.path.startsWith(draggedFile.path + '/')) return

    try {
      await api.moveVaultItems([draggedFile.path], targetFolder.path)
    } catch (err) {
      console.error('Nested DnD move failed:', err)
    }
    handleMutate()
    refreshCurrentNode()
  }, [handleMutate, refreshCurrentNode])

  const handleDndDragStart = useCallback((event: DragStartEvent) => {
    setActiveDragId(String(event.active.id))
    const file = event.active.data?.current?.file as NestedFileInfo | undefined
    setActiveDragItem(file || null)
  }, [])

  const handleDndDragCancel = useCallback(() => {
    setActiveDragId(null)
    setActiveDragItem(null)
  }, [])

  if (loading) {
    return (
      <div className="px-1 py-2">
        <RefreshCw size={12} className="animate-spin" />
      </div>
    )
  }

  if (nestedItems.length === 0) {
    return <div className="text-muted-foreground type-micro" style={{ paddingLeft: nested ? 16 : 0 }}>(empty)</div>
  }

  const content = (
    <div className={`flex flex-col gap-px ${nested ? 'ml-3 border-l border-[var(--color-border-subtle)] pl-1' : ''}`}>
      {nestedItems.map(item => (
        <NestedEntryRow
          key={item.path}
          item={item}
          parentPath={path}
          onMutate={handleMutate}
          insideDnd
          selecting={selecting}
          selected={selectedSet.has(item.path)}
          selectedPaths={selectedSet}
          onToggleSelect={onToggleSelect}
        />
      ))}
    </div>
  )

  if (participatesInParentDnd) return content

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDndDragStart}
      onDragEnd={handleDndDragEnd}
      onDragCancel={handleDndDragCancel}
    >
      {content}
      <DragOverlay>
        {activeDragId && activeDragItem && (
          <span className="inline-flex items-center gap-1 rounded border border-[var(--color-accent)] bg-[var(--bg-surface)] px-2 py-0.5 type-micro font-mono shadow-md">
            {activeDragItem.type === 'folder' ? <Folder size={11} /> : <FileText size={11} />}
            {activeDragItem.name}
          </span>
        )}
      </DragOverlay>
    </DndContext>
  )
}
