import { useState, useMemo, useCallback, useRef, useEffect, memo } from 'react'
import {
  FileText, Folder, ChevronDown, ChevronRight, MoreVertical,
  Plus, Upload, Pencil, Trash2, FolderInput, Loader2, X, Check, Download, ExternalLink,
} from 'lucide-react'
import {
  DndContext, useDraggable, useDroppable, DragOverlay,
  closestCenter, PointerSensor, useSensor,
  type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core'
import { usePMStore } from '@/stores/pm-store.ts'
import { InlineFolderExpand } from './InlineFolderExpand.tsx'
import { MoveToDialog } from './MoveToDialog.tsx'
import { useFileDndContext } from './FileDndProvider.tsx'
import { Button } from '@/components/ui/button.tsx'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSub,
  DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuLabel,
} from '@/components/ui/dropdown-menu.tsx'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog.tsx'
import { IconButton } from '@/components/primitives'
import { useTabStore } from '@/stores/tab-store.ts'
import * as api from '@/lib/api.ts'

interface FileInfo {
  name: string
  path: string
  type: 'file' | 'folder'
  count?: number
  plan_progress?: { done: number; total: number }
  has_plan?: boolean
  has_log?: boolean
}

const SYSTEM_FILES = new Set(['worklog.md', 'task.md'])
function isSystemFile(name: string) {
  return SYSTEM_FILES.has(name) || name.startsWith('task_')
}

function fileNameFromPath(path: string): string {
  return path.split('/').pop() || path
}

// --- Individual file chip with kebab menu ---

interface ManagedFileChipProps {
  file: FileInfo
  expanded?: boolean
  selecting: boolean
  selected: boolean
  renamingPath: string | null
  folders: FileInfo[]
  nodePath: string
  isDragging?: boolean
  onToggleFolder: (path: string) => void
  onOpenFile: (path: string, name: string, type: string) => void
  onStartRename: (path: string) => void
  onFinishRename: (oldPath: string, newName: string) => void
  onCancelRename: () => void
  onDelete: (file: FileInfo) => void
  onMove: (file: FileInfo, destDir: string) => void
  onToggleSelect: (path: string) => void
  onMoveToDialog: (file: FileInfo) => void
}

function ManagedFileChip({
  file, expanded, selecting, selected, renamingPath, folders, nodePath,
  isDragging,
  onToggleFolder, onOpenFile, onStartRename, onFinishRename, onCancelRename,
  onDelete, onMove, onToggleSelect, onMoveToDialog,
}: ManagedFileChipProps) {
  const [renameValue, setRenameValue] = useState(file.name)
  const isRenaming = renamingPath === file.path
  const isSystem = isSystemFile(file.name)

  const dragData = useMemo(() => ({ file }), [file])
  const dropData = useMemo(() => ({ folder: file }), [file])

  // Draggable (non-system files only)
  const { attributes, listeners, setNodeRef: setDragRef, transform } = useDraggable({
    id: `drag-${file.path}`,
    data: dragData,
    disabled: isSystem || selecting || isRenaming,
  })

  // Droppable (folders only)
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `drop-${file.path}`,
    data: dropData,
    disabled: file.type !== 'folder',
  })

  // Combine refs for folder chips (both draggable and droppable)
  const combinedRef = useCallback((el: HTMLElement | null) => {
    setDragRef(el)
    if (file.type === 'folder') setDropRef(el)
  }, [setDragRef, setDropRef, file.type])

  const dragStyle = transform ? {
    transform: `translate(${transform.x}px, ${transform.y}px)`,
    opacity: 0.5,
    zIndex: 50,
  } : undefined

  const icon = file.type === 'folder' ? <Folder size={11} /> : <FileText size={11} />

  const handleClick = () => {
    if (selecting) {
      if (!isSystem) onToggleSelect(file.path)
      return
    }
    if (file.type === 'folder') {
      onToggleFolder(file.path)
    } else {
      onOpenFile(file.path, file.name, file.type)
    }
  }

  const handleRenameSubmit = () => {
    const trimmed = renameValue.trim()
    if (trimmed && trimmed !== file.name) {
      onFinishRename(file.path, trimmed)
    } else {
      onCancelRename()
    }
  }

  if (isRenaming) {
    // Select filename without extension
    const dotIdx = file.name.lastIndexOf('.')
    const selectEnd = file.type === 'folder' ? file.name.length : (dotIdx > 0 ? dotIdx : file.name.length)

    return (
      <span
        className="inline-flex items-center gap-1 rounded border border-[var(--color-accent)] bg-[var(--bg-surface)] px-2 py-0.5 type-micro font-mono"
        onClick={(e) => e.stopPropagation()}
      >
        {icon}
        <input
          autoFocus
          className="bg-transparent border-none outline-none text-foreground type-micro font-mono w-[120px]"
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleRenameSubmit()
            else if (e.key === 'Escape') onCancelRename()
          }}
          onBlur={handleRenameSubmit}
          onFocus={(e) => e.target.setSelectionRange(0, selectEnd)}
        />
      </span>
    )
  }

  return (
    <div
      ref={combinedRef}
      className={`group/fc flex items-center gap-1.5 px-1.5 py-[3px] rounded type-micro font-mono cursor-pointer transition-colors
        hover:bg-[var(--bg-ingrained)] ${expanded || selected || isOver ? 'bg-[var(--bg-ingrained)]' : ''}
        ${isOver ? 'ring-1 ring-[var(--color-accent)]' : ''} ${isDragging ? 'opacity-30' : ''}`}
      style={dragStyle}
      onClick={handleClick}
      title={file.path}
      {...(!isSystem && !selecting && !isRenaming ? { ...attributes, ...listeners } : {})}
    >
      {selecting && !isSystem && (
        <button
          className="bg-transparent border-none p-0 cursor-pointer inline-flex items-center"
          onClick={(e) => { e.stopPropagation(); onToggleSelect(file.path) }}
        >
          {selected
            ? <Check size={11} className="text-accent" />
            : <span className="w-[11px] h-[11px] rounded-sm border border-muted-foreground inline-block" />}
        </button>
      )}
      {file.type === 'folder' && (expanded ? <ChevronDown size={10} className="text-muted-foreground shrink-0" /> : <ChevronRight size={10} className="text-muted-foreground shrink-0" />)}
      <span className="shrink-0 text-muted-foreground">{icon}</span>
      <span className="flex-1 min-w-0 truncate text-foreground">{file.name}</span>
      {file.type === 'folder' && file.count != null && (
        <span className="type-caption text-muted-foreground shrink-0">{file.count}</span>
      )}
      {file.plan_progress && (
        <span className="type-caption text-muted-foreground shrink-0">{file.plan_progress.done}/{file.plan_progress.total}</span>
      )}
      {/* Kebab menu — hidden during selection mode */}
      {!selecting && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <IconButton
              variant="appShell"
              size="file"
              className="opacity-0 transition-opacity group-hover/fc:opacity-100"
              onClick={(e) => e.stopPropagation()}
              title="File actions"
            >
              <MoreVertical size={10} />
            </IconButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[140px]">
            <DropdownMenuItem onSelect={() => {
              if (file.type === 'folder') onToggleFolder(file.path)
              else onOpenFile(file.path, file.name, file.type)
            }}>
              Open
            </DropdownMenuItem>
            {file.type !== 'folder' && (
              <DropdownMenuItem onSelect={() => {
                useTabStore.getState().openDocTab(file.path, true)
              }}>
                <ExternalLink size={12} /> Open in new tab
              </DropdownMenuItem>
            )}
            {file.type !== 'folder' && (
              <DropdownMenuItem onSelect={() => {
                const a = document.createElement('a')
                a.href = api.downloadVaultUrl(file.path)
                a.download = file.name
                a.click()
              }}>
                <Download size={12} /> Download
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              disabled={isSystem}
              onSelect={() => {
                setRenameValue(file.name)
                onStartRename(file.path)
              }}
            >
              <Pencil size={12} /> Rename
            </DropdownMenuItem>
            {!isSystem && (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <FolderInput size={12} /> Move to…
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem onSelect={() => onMove(file, nodePath)}>
                    (task root)
                  </DropdownMenuItem>
                  {folders.filter(f => f.path !== file.path).length > 0 && <DropdownMenuSeparator />}
                  {folders
                    .filter(f => f.path !== file.path)
                    .map(f => (
                      <DropdownMenuItem key={f.path} onSelect={() => onMove(file, f.path)}>
                        {f.name}/
                      </DropdownMenuItem>
                    ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => onMoveToDialog(file)}>
                    Other task…
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={isSystem}
              className="text-red focus:text-red"
              onSelect={() => onDelete(file)}
            >
              <Trash2 size={12} /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}

// --- New item chip (inline input for creating file/folder) ---

function NewItemChip({
  type,
  onSubmit,
  onCancel,
}: {
  type: 'file' | 'folder'
  onSubmit: (name: string) => void
  onCancel: () => void
}) {
  const [value, setValue] = useState('')
  const icon = type === 'folder' ? <Folder size={11} /> : <FileText size={11} />

  const handleSubmit = () => {
    const trimmed = value.trim()
    if (trimmed) {
      // Auto-append .md for files without extension
      const name = type === 'file' && !trimmed.includes('.') ? `${trimmed}.md` : trimmed
      onSubmit(name)
    } else {
      onCancel()
    }
  }

  return (
    <span
      className="inline-flex items-center gap-1 rounded border border-[var(--color-accent)] bg-[var(--bg-surface)] px-2 py-0.5 type-micro font-mono"
      onClick={(e) => e.stopPropagation()}
    >
      {icon}
      <input
        autoFocus
        className="bg-transparent border-none outline-none text-foreground type-micro font-mono w-[120px]"
        placeholder={type === 'folder' ? 'folder name' : 'filename.md'}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSubmit()
          else if (e.key === 'Escape') onCancel()
        }}
        onBlur={handleSubmit}
      />
    </span>
  )
}

// --- Main FileSection component ---

interface FileSectionProps {
  files: FileInfo[]
  nodePath: string
}

export const FileSection = memo(function FileSection({ files, nodePath }: FileSectionProps) {
  const openFilePreview = usePMStore(s => s.openFilePreview)
  const refreshCurrentNode = usePMStore(s => s.refreshCurrentNode)

  // Detect shared DndContext from FileDndProvider (cross-card mode)
  const sharedDnd = useFileDndContext()
  const isWrapped = !!sharedDnd

  // Local files state for optimistic UI — synced from props on refresh
  const [localFiles, setLocalFiles] = useState(files)
  useEffect(() => { setLocalFiles(files) }, [files])

  // Pointer sensor — only needed when NOT wrapped (standalone DndContext)
  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: { distance: 8 },
  })
  const sensors = useMemo(() => [pointerSensor], [pointerSensor])

  const expandedFoldersList = usePMStore(s => s.expandedFolders)
  const expandedFolders = useMemo(() => new Set(expandedFoldersList), [expandedFoldersList])
  const [renamingPath, setRenamingPath] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<FileInfo | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [creating, setCreating] = useState<'file' | 'folder' | null>(null)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [selecting, setSelecting] = useState(false)
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [activeDragId, setActiveDragId] = useState<string | null>(null)

  // MoveToDialog state
  const [moveToOpen, setMoveToOpen] = useState(false)
  const [moveToFiles, setMoveToFiles] = useState<FileInfo[]>([])

  // Droppable root zone — makes this card's root a cross-card drop target
  const rootDropData = useMemo(
    () => ({ folder: { name: '(root)', path: nodePath, type: 'folder' as const } }),
    [nodePath],
  )
  const { setNodeRef: setRootDropRef, isOver: isRootOver } = useDroppable({
    id: `drop-root:${nodePath}`,
    data: rootDropData,
    disabled: !isWrapped,
  })

  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragCounter = useRef(0)

  const folders = localFiles.filter(f => f.type === 'folder')

  // --- Toggle folder expansion (stored in pm-store for snapshot persistence) ---
  const toggleFolder = usePMStore(s => s.toggleFolder)

  // --- Rename ---
  const handleFinishRename = async (oldPath: string, newName: string) => {
    setRenamingPath(null)
    // Optimistic: update name in local state
    const dir = oldPath.substring(0, oldPath.lastIndexOf('/') + 1)
    const newPath = dir + newName
    setLocalFiles(prev => prev.map(f =>
      f.path === oldPath ? { ...f, name: newName, path: newPath } : f
    ))
    try {
      await api.renameVaultItem(oldPath, newName)
    } catch (err) {
      console.error('Rename failed:', err)
    }
    refreshCurrentNode()
  }

  // --- Delete ---
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return

    setDeleting(true)
    setDeleteError(null)
    try {
      await api.deleteVaultItem(deleteTarget.path)
      setLocalFiles(prev => prev.filter(f => f.path !== deleteTarget.path))
      setDeleteTarget(null)
      refreshCurrentNode()
    } catch (err) {
      console.error('Delete failed:', err)
      setDeleteError(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setDeleting(false)
    }
  }

  // --- Move ---
  const handleMove = async (file: FileInfo, destDir: string) => {
    // Optimistic: remove from local state
    setLocalFiles(prev => prev.filter(f => f.path !== file.path))
    try {
      await api.moveVaultItems([file.path], destDir)
    } catch (err) {
      console.error('Move failed:', err)
    }
    refreshCurrentNode()
  }

  // --- Create ---
  const handleCreate = async (name: string) => {
    const type = creating === 'folder' ? 'folder' : 'file'
    setCreating(null)
    // Optimistic: add to local state immediately
    const newPath = `${nodePath}/${name}`
    setLocalFiles(prev => [...prev, { name, path: newPath, type }])
    try {
      await api.createVaultItem(nodePath, name, type)
    } catch (err) {
      console.error('Create failed:', err)
    }
    refreshCurrentNode()
  }

  // --- Upload (button or drag-and-drop) ---
  const uploadFiles = useCallback(async (fileList: FileList) => {
    setUploading(true)
    try {
      for (const file of fileList) {
        await api.uploadFile(file, nodePath)
      }
    } catch (err) {
      console.error('Upload failed:', err)
    } finally {
      setUploading(false)
      refreshCurrentNode()
    }
  }, [nodePath, refreshCurrentNode])

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      uploadFiles(e.target.files)
      e.target.value = ''
    }
  }

  // --- Drag-and-drop from desktop ---
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    dragCounter.current++
    if (e.dataTransfer?.types.includes('Files')) {
      setDragOver(true)
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    dragCounter.current--
    if (dragCounter.current === 0) setDragOver(false)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    dragCounter.current = 0
    setDragOver(false)
    if (e.dataTransfer?.files.length) {
      uploadFiles(e.dataTransfer.files)
    }
  }

  // --- Internal DnD (drag file → folder) ---
  const handleDndDragEnd = useCallback(async (event: DragEndEvent) => {
    setActiveDragId(null)
    const { active, over } = event
    if (!over) return

    const draggedFile = active.data?.current?.file as FileInfo | undefined
    const targetFolder = over.data?.current?.folder as FileInfo | undefined
    if (!draggedFile || !targetFolder) return
    if (targetFolder.type !== 'folder') return
    if (draggedFile.path === targetFolder.path) return

    // Optimistic: remove from local state
    setLocalFiles(prev => prev.filter(f => f.path !== draggedFile.path))
    try {
      await api.moveVaultItems([draggedFile.path], targetFolder.path)
    } catch (err) {
      console.error('DnD move failed:', err)
    }
    refreshCurrentNode()
  }, [refreshCurrentNode])

  const handleDndDragStart = useCallback((e: DragStartEvent) => setActiveDragId(String(e.active.id)), [])
  const handleDndDragCancel = useCallback(() => setActiveDragId(null), [])

  const activeDragFile = activeDragId
    ? localFiles.find(f => `drag-${f.path}` === activeDragId)
    : null

  // --- Multi-select ---
  const toggleSelect = (path: string) => {
    setSelectedPaths(prev => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const exitSelection = () => {
    setSelecting(false)
    setSelectedPaths(new Set())
  }

  const handleBulkDelete = async () => {
    setBulkDeleting(false)
    const pathsToDelete = new Set(selectedPaths)
    // Optimistic: remove from local state immediately
    setLocalFiles(prev => prev.filter(f => !pathsToDelete.has(f.path)))
    exitSelection()
    for (const path of pathsToDelete) {
      try {
        await api.deleteVaultItem(path)
      } catch (err) {
        console.error('Bulk delete failed for', path, err)
      }
    }
    refreshCurrentNode()
  }

  const handleBulkMove = async (destDir: string) => {
    const pathsToMove = new Set(selectedPaths)
    // Optimistic: remove from local state immediately
    setLocalFiles(prev => prev.filter(f => !pathsToMove.has(f.path)))
    exitSelection()
    try {
      await api.moveVaultItems([...pathsToMove], destDir)
    } catch (err) {
      console.error('Bulk move failed:', err)
    }
    refreshCurrentNode()
  }

  const selectedFiles = Array.from(selectedPaths).map(path => (
    localFiles.find(f => f.path === path) || { name: fileNameFromPath(path), path, type: 'file' as const }
  ))
  const deleteWarning = deleteTarget?.type === 'folder' && (deleteTarget.count ?? 0) > 0
    ? 'This folder is not empty. Deleting it will also delete everything inside it.'
    : null

  // --- MoveToDialog handlers ---
  const openMoveToForFile = (file: FileInfo) => {
    setMoveToFiles([file])
    setMoveToOpen(true)
  }

  const openMoveToForBulk = () => {
    setMoveToFiles(selectedFiles)
    setMoveToOpen(true)
  }

  const handleMoveToConfirm = async (destPath: string) => {
    const paths = moveToFiles.map(f => f.path)
    // Optimistic: remove from local state
    const pathSet = new Set(paths)
    setLocalFiles(prev => prev.filter(f => !pathSet.has(f.path)))
    if (selecting) exitSelection()
    setMoveToFiles([])
    try {
      await api.moveVaultItems(paths, destPath)
    } catch (err) {
      console.error('Move to other task failed:', err)
    }
    refreshCurrentNode()
  }

  // --- Keyboard shortcuts ---
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Escape: exit selection or cancel rename
    if (e.key === 'Escape') {
      if (selecting) { exitSelection(); e.preventDefault() }
      else if (renamingPath) { setRenamingPath(null); e.preventDefault() }
    }
    // Ctrl+A: select all non-system files
    if (e.key === 'a' && (e.ctrlKey || e.metaKey) && selecting) {
      e.preventDefault()
      const allPaths = new Set(localFiles.filter(f => !isSystemFile(f.name)).map(f => f.path))
      setSelectedPaths(allPaths)
    }
  }

  return (
    <div
      className="flex flex-col gap-1 relative"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Header row */}
      <div className="flex items-center gap-2 text-xs">
        {selecting ? (
          // Bulk toolbar
          <>
            <span className="font-semibold text-muted-foreground">
              {selectedPaths.size} selected
            </span>
            {selectedPaths.size > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="inline-flex items-center gap-[3px] px-1.5 py-0.5 rounded border border-[var(--color-border-subtle)] bg-transparent type-micro cursor-pointer text-muted-foreground hover:border-[var(--color-accent)] hover:text-accent-foreground">
                    <FolderInput size={11} /> Move
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuLabel>Move to</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => handleBulkMove(nodePath)}>
                    (task root)
                  </DropdownMenuItem>
                  {folders.map(f => (
                    <DropdownMenuItem key={f.path} onSelect={() => handleBulkMove(f.path)}>
                      {f.name}/
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={openMoveToForBulk}>
                    Other task…
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {selectedPaths.size > 0 && (
              <button
                className="inline-flex items-center gap-[3px] px-1.5 py-0.5 rounded border border-[var(--color-border-subtle)] bg-transparent type-micro cursor-pointer text-red hover:border-red"
                onClick={() => setBulkDeleting(true)}
              >
                <Trash2 size={11} /> Delete
              </button>
            )}
            <button
              className="ml-auto inline-flex items-center gap-[3px] px-1.5 py-0.5 rounded border border-[var(--color-border-subtle)] bg-transparent type-micro cursor-pointer text-muted-foreground hover:border-[var(--color-accent)] hover:text-accent-foreground"
              onClick={exitSelection}
            >
              <X size={11} /> Cancel
            </button>
          </>
        ) : (
          // Normal header
          <>
            <span className="font-semibold text-muted-foreground">Files ({localFiles.length})</span>
            <span className="flex items-center gap-1 ml-auto">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="inline-flex items-center gap-[3px] px-1.5 py-0.5 rounded border border-[var(--color-border-subtle)] bg-transparent type-micro cursor-pointer text-muted-foreground hover:border-[var(--color-accent)] hover:text-accent-foreground">
                    <Plus size={11} /> New
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => setCreating('file')}>
                    <FileText size={12} /> New file
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setCreating('folder')}>
                    <Folder size={12} /> New folder
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <button
                className="inline-flex items-center gap-[3px] px-1.5 py-0.5 rounded border border-[var(--color-border-subtle)] bg-transparent type-micro cursor-pointer text-muted-foreground hover:border-[var(--color-accent)] hover:text-accent-foreground"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={11} /> Upload
              </button>
              <button
                className="inline-flex items-center gap-[3px] px-1.5 py-0.5 rounded border border-[var(--color-border-subtle)] bg-transparent type-micro cursor-pointer text-muted-foreground hover:border-[var(--color-accent)] hover:text-accent-foreground"
                onClick={() => setSelecting(true)}
              >
                Select
              </button>
            </span>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileInputChange}
            />
          </>
        )}
      </div>

      {/* File chips grid — conditionally wrapped in DndContext.
          When inside FileDndProvider (cross-card mode), skip own DndContext;
          draggables/droppables participate in the shared context instead. */}
      {(() => {
        // Determine effective active drag ID (shared or local)
        const effectiveDragId = isWrapped ? sharedDnd!.activeDragId : activeDragId

        const chipGrid = (
          <div ref={isWrapped ? setRootDropRef : undefined} className={`flex flex-col ${isRootOver ? 'ring-2 ring-[var(--color-accent)] ring-offset-1 rounded' : ''}`}>
            {localFiles.map(f => (
              <ManagedFileChip
                key={f.path}
                file={f}
                expanded={expandedFolders.has(f.path)}
                selecting={selecting}
                selected={selectedPaths.has(f.path)}
                renamingPath={renamingPath}
                folders={folders}
                nodePath={nodePath}
                isDragging={effectiveDragId === `drag-${f.path}`}
                onToggleFolder={toggleFolder}
                onOpenFile={(path, name, type) => openFilePreview(path, name, type as 'file' | 'folder')}
                onStartRename={(path) => setRenamingPath(path)}
                onFinishRename={handleFinishRename}
                onCancelRename={() => setRenamingPath(null)}
                onDelete={(file) => setDeleteTarget(file)}
                onMove={handleMove}
                onToggleSelect={toggleSelect}
                onMoveToDialog={openMoveToForFile}
              />
            ))}
            {/* New item inline input */}
            {creating && (
              <NewItemChip
                type={creating}
                onSubmit={handleCreate}
                onCancel={() => setCreating(null)}
              />
            )}
            {/* Upload spinner */}
            {uploading && (
              <span className="inline-flex items-center gap-1 rounded border border-[var(--color-border-subtle)] bg-[var(--bg-surface)] px-2 py-0.5 type-micro font-mono text-muted-foreground">
                <Loader2 size={11} className="animate-spin" /> uploading…
              </span>
            )}
          </div>
        )

        // When wrapped by FileDndProvider, don't create a local DndContext
        if (isWrapped) return chipGrid

        return (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDndDragStart}
            onDragEnd={handleDndDragEnd}
            onDragCancel={handleDndDragCancel}
          >
            {chipGrid}
            {/* Ghost chip during drag (local mode only) */}
            <DragOverlay>
              {activeDragFile && (
                <span className="inline-flex items-center gap-1 rounded border border-[var(--color-accent)] bg-[var(--bg-surface)] px-2 py-0.5 type-micro font-mono shadow-md">
                  {activeDragFile.type === 'folder' ? <Folder size={11} /> : <FileText size={11} />}
                  {activeDragFile.name}
                </span>
              )}
            </DragOverlay>
          </DndContext>
        )
      })()}

      {/* Inline folder expansions */}
      {localFiles.filter(f => f.type === 'folder' && expandedFolders.has(f.path)).map(f => (
        <div key={f.path} className="mt-1.5 border border-[var(--color-border-subtle)] rounded-sm bg-[color-mix(in_srgb,var(--bg-surface)_50%,transparent)] p-1">
          <div className="flex items-center gap-1 type-micro text-muted-foreground font-medium mb-0.5 px-1">
            <Folder size={11} /> {f.name}/
          </div>
          <InlineFolderExpand
            path={f.path}
            onMutate={() => refreshCurrentNode()}
            insideDnd={isWrapped}
            selecting={selecting}
            selectedPaths={selectedPaths}
            onToggleSelect={(item) => toggleSelect(item.path)}
          />
        </div>
      ))}

      {/* Drag-and-drop overlay */}
      {dragOver && (
        <div className="absolute inset-0 rounded border-2 border-dashed border-[var(--color-accent)] bg-[color-mix(in_srgb,var(--color-accent)_10%,transparent)] flex items-center justify-center z-20 pointer-events-none">
          <span className="text-accent-foreground text-sm font-medium flex items-center gap-2">
            <Upload size={16} /> Drop files to upload
          </span>
        </div>
      )}

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => {
        if (!open) {
          setDeleteTarget(null)
          setDeleteError(null)
          setDeleting(false)
        }
      }}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Delete {deleteTarget?.type === 'folder' ? 'folder' : 'file'}</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This cannot be undone.
              {deleteWarning && (
                <div className="mt-2 text-red">{deleteWarning}</div>
              )}
              {deleteError && (
                <div className="mt-2 text-red">{deleteError}</div>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteTarget(null)
                setDeleteError(null)
                setDeleting(false)
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={deleting}
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk delete confirmation dialog */}
      <Dialog open={bulkDeleting} onOpenChange={(open) => !open && setBulkDeleting(false)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Delete {selectedPaths.size} items</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete these files? This cannot be undone.
              <ul className="mt-2 text-xs space-y-0.5">
                {selectedFiles.map(f => <li key={f.path}>{f.name}</li>)}
              </ul>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDeleting(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleBulkDelete}>Delete all</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Move to other task dialog */}
      <MoveToDialog
        open={moveToOpen}
        onOpenChange={setMoveToOpen}
        onMove={handleMoveToConfirm}
        currentParentPath={nodePath}
      />
    </div>
  )
})
