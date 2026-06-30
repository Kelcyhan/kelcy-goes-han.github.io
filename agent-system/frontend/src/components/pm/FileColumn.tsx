/**
 * FileColumn — Unified file management component for cards.
 *
 * Two modes:
 *   - "column"  → compact view for parent card columns (read-heavy, light actions)
 *   - "detail"  → full-featured view for leaf card detail (create, upload, rename, delete, DnD, multi-select)
 *
 * Consolidates the functionality of FileSection.tsx (detail mode) and
 * CardFileTable from ChildCardGrid.tsx (column mode) into a single reusable component.
 */
import React, { useState, useCallback, useRef, useEffect, useMemo, memo } from 'react'
import {
  FileText, Folder, ChevronDown, ChevronRight,
  Plus, Upload, Pencil, Trash2, FolderInput, Loader2, X, Check, Download, ExternalLink, CheckSquare,
} from 'lucide-react'
import {
  DndContext, useDraggable, useDroppable, DragOverlay,
  closestCenter, PointerSensor, useSensor,
  type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core'
import { usePMStore } from '@/stores/pm-store.ts'
import type { FileInfo } from '@/stores/pm-store.ts'
import { InlineFolderExpand } from './InlineFolderExpand.tsx'
import { MoveToDialog } from './MoveToDialog.tsx'
import { useFileDndContext } from './FileDndProvider.tsx'
import { Button } from '@/components/ui/button.tsx'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel,
} from '@/components/ui/dropdown-menu.tsx'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog.tsx'
import { IconButton } from '@/components/primitives'
// useTabStore removed — file open handled via onOpenFile callback
import * as api from '@/lib/api.ts'

// ── Helpers ──

const SYSTEM_FILES = new Set(['worklog.md', 'task.md'])
function isSystemFile(name: string) {
  return SYSTEM_FILES.has(name) || name.startsWith('task_')
}

function formatSize(bytes: number | undefined): string {
  if (bytes == null) return ''
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}K`
  return `${(bytes / (1024 * 1024)).toFixed(1)}M`
}

function fileNameFromPath(path: string): string {
  return path.split('/').pop() || path
}

function fileTypeIcon(type: 'file' | 'folder', size: number) {
  return type === 'folder'
    ? <Folder size={size} className="text-muted-foreground shrink-0" />
    : <FileText size={size} className="text-muted-foreground shrink-0" />
}

// ── File Row (shared between modes) ──

interface FileRowProps {
  file: FileInfo
  mode: 'column' | 'detail'
  expanded?: boolean
  selecting?: boolean
  selected?: boolean
  renamingPath?: string | null
  isDragging?: boolean
  onToggleFolder: (path: string) => void
  onOpenFile: (path: string, name: string, type: string) => void
  onStartRename?: (path: string) => void
  onFinishRename?: (oldPath: string, newName: string) => void
  onCancelRename?: () => void
  onDelete?: (file: FileInfo) => void
  onToggleSelect?: (path: string) => void
}

function FileRow({
  file, expanded, selecting, selected, renamingPath,
  isDragging,
  onToggleFolder, onOpenFile, onStartRename, onFinishRename, onCancelRename,
  onDelete, onToggleSelect,
}: FileRowProps) {
  const [renameValue, setRenameValue] = useState(file.name)
  const isRenaming = renamingPath === file.path
  const isSystem = isSystemFile(file.name)

  const dragData = useMemo(() => ({ file }), [file])
  const dropData = useMemo(() => ({ folder: file }), [file])

  // Draggable (non-system files only)
  const { attributes, listeners, setNodeRef: setDragRef, transform } = useDraggable({
    id: `drag-${file.path}`,
    data: dragData,
    disabled: isSystem || !!selecting || isRenaming,
  })

  // Droppable (folders only)
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `drop-${file.path}`,
    data: dropData,
    disabled: file.type !== 'folder',
  })

  const combinedRef = useCallback((el: HTMLElement | null) => {
    setDragRef(el)
    if (file.type === 'folder') setDropRef(el)
  }, [setDragRef, setDropRef, file.type])

  const dragStyle = transform ? {
    transform: `translate(${transform.x}px, ${transform.y}px)`,
    opacity: 0.5,
    zIndex: 50,
  } : undefined

  const handleClick = () => {
    if (selecting && !isSystem) {
      onToggleSelect?.(file.path)
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
      onFinishRename?.(file.path, trimmed)
    } else {
      onCancelRename?.()
    }
  }

  // Rename inline input
  if (isRenaming) {
    const dotIdx = file.name.lastIndexOf('.')
    const selectEnd = file.type === 'folder' ? file.name.length : (dotIdx > 0 ? dotIdx : file.name.length)
    return (
      <div className="flex items-center gap-1.5 px-1.5 py-[3px] type-micro font-mono">
        {fileTypeIcon(file.type, 12)}
        <input
          autoFocus
          className="bg-transparent border-none outline-none text-foreground type-micro font-mono flex-1 min-w-0"
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleRenameSubmit()
            else if (e.key === 'Escape') onCancelRename?.()
          }}
          onBlur={handleRenameSubmit}
          onFocus={(e) => e.target.setSelectionRange(0, selectEnd)}
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    )
  }

  return (
    <div
      ref={combinedRef}
      className={`group/row flex items-center gap-1.5 px-1.5 py-[3px] rounded type-micro cursor-pointer transition-colors
        hover:bg-[var(--bg-ingrained)]
        ${expanded || selected || isOver ? 'bg-[var(--bg-ingrained)]' : ''}
        ${isOver ? 'ring-1 ring-[var(--color-accent)]' : ''}
        ${isDragging ? 'opacity-30' : ''}
        ${isSystem ? 'opacity-50' : ''}`}
      style={dragStyle}
      onClick={handleClick}
      title={file.path}
      {...(!isSystem && !selecting && !isRenaming ? { ...attributes, ...listeners } : {})}
    >
      {/* Selection checkbox (detail mode) */}
      {selecting && !isSystem && (
        <button
          className="bg-transparent border-none p-0 cursor-pointer inline-flex items-center shrink-0"
          onClick={(e) => { e.stopPropagation(); onToggleSelect?.(file.path) }}
        >
          {selected
            ? <Check size={11} className="text-accent" />
            : <span className="w-[11px] h-[11px] rounded-sm border border-muted-foreground inline-block" />}
        </button>
      )}

      {/* Folder chevron */}
      {file.type === 'folder' && (
        expanded
          ? <ChevronDown size={10} className="text-muted-foreground shrink-0" />
          : <ChevronRight size={10} className="text-muted-foreground shrink-0" />
      )}

      {/* Type icon */}
      {fileTypeIcon(file.type, 12)}

      {/* Name */}
      <span className="flex-1 min-w-0 truncate text-foreground">{file.name}</span>

      {/* File size */}
      {file.type === 'file' && file.size != null && (
        <span className="type-caption text-muted-foreground shrink-0 font-mono">{formatSize(file.size)}</span>
      )}

      {/* Folder count */}
      {file.type === 'folder' && file.count != null && (
        <span className="type-caption text-muted-foreground shrink-0">{file.count}</span>
      )}

      {/* Plan progress */}
      {file.plan_progress && (
        <span className="type-caption text-muted-foreground shrink-0">{file.plan_progress.done}/{file.plan_progress.total}</span>
      )}

      {/* Inline action icons — visible on hover */}
      {!selecting && (
        <span className="inline-flex items-center gap-px shrink-0">
          {file.type === 'file' && (
            <IconButton
              variant="appShell"
              size="file"
              onClick={(e) => { e.stopPropagation(); onOpenFile(file.path, file.name, file.type) }}
              title="View"
            >
              <ExternalLink size={11} />
            </IconButton>
          )}
          {file.type === 'file' && (
            <IconButton
              variant="appShell"
              size="file"
              onClick={(e) => {
                e.stopPropagation()
                const a = document.createElement('a')
                a.href = api.downloadVaultUrl(file.path)
                a.download = file.name
                a.click()
              }}
              title="Download"
            >
              <Download size={11} />
            </IconButton>
          )}
          {!isSystem && (
            <IconButton
              variant="appShell"
              size="file"
              onClick={(e) => {
                e.stopPropagation()
                setRenameValue(file.name)
                onStartRename?.(file.path)
              }}
              title="Rename"
            >
              <Pencil size={11} />
            </IconButton>
          )}
          {!isSystem && (
            <IconButton
              variant="appShell"
              size="file"
              className="hover:text-red"
              onClick={(e) => { e.stopPropagation(); onDelete?.(file) }}
              title="Delete"
            >
              <Trash2 size={11} />
            </IconButton>
          )}
        </span>
      )}
    </div>
  )
}

// ── New Item inline input (detail mode only) ──

function NewItemInput({
  type,
  onSubmit,
  onCancel,
}: {
  type: 'file' | 'folder'
  onSubmit: (name: string) => void
  onCancel: () => void
}) {
  const [value, setValue] = useState('')

  const handleSubmit = () => {
    const trimmed = value.trim()
    if (trimmed) {
      const name = type === 'file' && !trimmed.includes('.') ? `${trimmed}.md` : trimmed
      onSubmit(name)
    } else {
      onCancel()
    }
  }

  return (
    <div className="flex items-center gap-1.5 px-1.5 py-[3px] type-micro font-mono border border-[var(--color-accent)] rounded">
      {fileTypeIcon(type, 12)}
      <input
        autoFocus
        className="bg-transparent border-none outline-none text-foreground type-micro font-mono flex-1 min-w-0"
        placeholder={type === 'folder' ? 'folder name' : 'filename.md'}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSubmit()
          else if (e.key === 'Escape') onCancel()
        }}
        onBlur={handleSubmit}
      />
    </div>
  )
}

// ── Main FileColumn component ──

export interface FileColumnProps {
  /** Files to display */
  files: FileInfo[]
  /** Vault path for this node (used as upload/create target) */
  nodePath: string
  /** Display mode: "column" for compact parent card, "detail" for leaf card full view */
  mode?: 'column' | 'detail'
  /** Optional max height (px) for scrollable area */
  maxHeight?: number
}

export const FileColumn = memo(function FileColumn({
  files,
  nodePath,
  mode = 'detail',
  maxHeight,
}: FileColumnProps) {
  const openFilePreview = usePMStore(s => s.openFilePreview)
  const refreshCurrentNode = usePMStore(s => s.refreshCurrentNode)


  // Shared DnD context (cross-card mode)
  const sharedDnd = useFileDndContext()
  const isWrapped = !!sharedDnd

  // Local files for optimistic UI
  const [localFiles, setLocalFiles] = useState(files)
  useEffect(() => { setLocalFiles(files) }, [files])

  // DnD sensor (standalone mode only)
  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: { distance: 8 },
  })
  const sensors = useMemo(() => [pointerSensor], [pointerSensor])

  // Folder expansion (stored in pm-store)
  const expandedFoldersList = usePMStore(s => s.expandedFolders)
  const expandedFolders = useMemo(() => new Set(expandedFoldersList), [expandedFoldersList])
  const toggleFolder = usePMStore(s => s.toggleFolder)

  const handleToggleFolder = useCallback((path: string) => {
    toggleFolder(path)
  }, [toggleFolder])

  const isFolderExpanded = useCallback((path: string) => {
    return expandedFolders.has(path)
  }, [expandedFolders])

  // Detail mode state
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
  const [moveToOpen, setMoveToOpen] = useState(false)
  const [moveToFiles, setMoveToFiles] = useState<FileInfo[]>([])

  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragCounter = useRef(0)
  const folders = localFiles.filter(f => f.type === 'folder')

  // Droppable root (cross-card DnD)
  const rootDropData = useMemo(
    () => ({ folder: { name: '(root)', path: nodePath, type: 'folder' as const } }),
    [nodePath],
  )
  const { setNodeRef: setRootDropRef, isOver: isRootOver } = useDroppable({
    id: `drop-root:${nodePath}`,
    data: rootDropData,
    disabled: !isWrapped,
  })

  // ── Detail mode handlers ──

  const handleFinishRename = async (oldPath: string, newName: string) => {
    setRenamingPath(null)
    const dir = oldPath.substring(0, oldPath.lastIndexOf('/') + 1)
    const newPath = dir + newName
    setLocalFiles(prev => prev.map(f =>
      f.path === oldPath ? { ...f, name: newName, path: newPath } : f
    ))
    try { await api.renameVaultItem(oldPath, newName) } catch (err) { console.error('Rename failed:', err) }
    refreshCurrentNode()
  }

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


  const handleCreate = async (name: string) => {
    const type = creating === 'folder' ? 'folder' : 'file'
    setCreating(null)
    const newPath = `${nodePath}/${name}`
    setLocalFiles(prev => [...prev, { name, path: newPath, type }])
    try { await api.createVaultItem(nodePath, name, type) } catch (err) { console.error('Create failed:', err) }
    refreshCurrentNode()
  }

  const uploadFiles = useCallback(async (fileList: FileList) => {
    setUploading(true)
    try {
      for (const file of fileList) { await api.uploadFile(file, nodePath) }
    } catch (err) { console.error('Upload failed:', err) }
    finally { setUploading(false); refreshCurrentNode() }
  }, [nodePath, refreshCurrentNode])

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      uploadFiles(e.target.files)
      e.target.value = ''
    }
  }

  // Desktop drag-and-drop
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault(); dragCounter.current++
    if (e.dataTransfer?.types.includes('Files')) setDragOver(true)
  }
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault(); dragCounter.current--
    if (dragCounter.current === 0) setDragOver(false)
  }
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault() }
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); dragCounter.current = 0; setDragOver(false)
    if (e.dataTransfer?.files.length) uploadFiles(e.dataTransfer.files)
  }

  // Internal DnD
  const handleDndDragEnd = useCallback(async (event: DragEndEvent) => {
    setActiveDragId(null)
    const { active, over } = event
    if (!over) return
    const draggedFile = active.data?.current?.file as FileInfo | undefined
    const targetFolder = over.data?.current?.folder as FileInfo | undefined
    if (!draggedFile || !targetFolder || targetFolder.type !== 'folder') return
    if (draggedFile.path === targetFolder.path) return
    setLocalFiles(prev => prev.filter(f => f.path !== draggedFile.path))
    try { await api.moveVaultItems([draggedFile.path], targetFolder.path) } catch (err) { console.error('DnD move failed:', err) }
    refreshCurrentNode()
  }, [refreshCurrentNode])

  const handleDndDragStart = useCallback((e: DragStartEvent) => setActiveDragId(String(e.active.id)), [])
  const handleDndDragCancel = useCallback(() => setActiveDragId(null), [])

  const activeDragFile = activeDragId
    ? localFiles.find(f => `drag-${f.path}` === activeDragId)
    : null

  // Multi-select
  const toggleSelect = (path: string) => {
    setSelectedPaths(prev => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path); else next.add(path)
      return next
    })
  }
  const exitSelection = () => { setSelecting(false); setSelectedPaths(new Set()) }
  const selectedFiles = Array.from(selectedPaths).map(path => (
    localFiles.find(f => f.path === path) || { name: fileNameFromPath(path), path, type: 'file' as const }
  ))

  const handleBulkDelete = async () => {
    setBulkDeleting(false)
    const pathsToDelete = new Set(selectedPaths)
    setLocalFiles(prev => prev.filter(f => !pathsToDelete.has(f.path)))
    exitSelection()
    for (const path of pathsToDelete) {
      try { await api.deleteVaultItem(path) } catch (err) { console.error('Bulk delete failed:', err) }
    }
    refreshCurrentNode()
  }

  const handleBulkMove = async (destDir: string) => {
    const pathsToMove = new Set(selectedPaths)
    setLocalFiles(prev => prev.filter(f => !pathsToMove.has(f.path)))
    exitSelection()
    try { await api.moveVaultItems([...pathsToMove], destDir) } catch (err) { console.error('Bulk move failed:', err) }
    refreshCurrentNode()
  }

  // MoveToDialog

  const openMoveToForBulk = () => { setMoveToFiles(selectedFiles); setMoveToOpen(true) }
  const handleMoveToConfirm = async (destPath: string) => {
    const paths = moveToFiles.map(f => f.path)
    const pathSet = new Set(paths)
    setLocalFiles(prev => prev.filter(f => !pathSet.has(f.path)))
    if (selecting) exitSelection()
    setMoveToFiles([])
    try { await api.moveVaultItems(paths, destPath) } catch (err) { console.error('Move to other task failed:', err) }
    refreshCurrentNode()
  }

  // Keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (selecting) { exitSelection(); e.preventDefault() }
      else if (renamingPath) { setRenamingPath(null); e.preventDefault() }
    }
    if (e.key === 'a' && (e.ctrlKey || e.metaKey) && selecting) {
      e.preventDefault()
      setSelectedPaths(new Set(localFiles.filter(f => !isSystemFile(f.name)).map(f => f.path)))
    }
  }

  const effectiveDragId = isWrapped ? sharedDnd!.activeDragId : activeDragId

  // ── Render ──

  const fileList = (
    <div
      ref={isWrapped ? setRootDropRef : undefined}
      className={`flex flex-col ${isRootOver ? 'ring-2 ring-[var(--color-accent)] ring-offset-1 rounded' : ''}`}
    >
      {localFiles.map(f => (
        <React.Fragment key={f.path}>
          <FileRow
            file={f}
            mode={mode}
            expanded={isFolderExpanded(f.path)}
            selecting={selecting}
            selected={selectedPaths.has(f.path)}
            renamingPath={renamingPath}
            isDragging={effectiveDragId === `drag-${f.path}`}
            onToggleFolder={handleToggleFolder}
            onOpenFile={(path, name, type) => openFilePreview(path, name, type as 'file' | 'folder')}
            onStartRename={(path) => setRenamingPath(path)}
            onFinishRename={handleFinishRename}
            onCancelRename={() => setRenamingPath(null)}
            onDelete={(file) => {
              setDeleteError(null)
              setDeleteTarget(file)
            }}
            onToggleSelect={toggleSelect}
          />
          {/* Inline folder expansion — uses InlineFolderExpand for both modes (recursive, with full actions) */}
          {f.type === 'folder' && isFolderExpanded(f.path) && (
            <div className="mt-0.5 mb-1 ml-2 border-l border-[var(--color-border-subtle)] pl-1">
              <InlineFolderExpand
                path={f.path}
                onMutate={() => refreshCurrentNode()}
                insideDnd
                selecting={selecting}
                selectedPaths={selectedPaths}
                onToggleSelect={(item) => toggleSelect(item.path)}
              />
            </div>
          )}
        </React.Fragment>
      ))}

      {/* New item input */}
      {creating && (
        <NewItemInput type={creating} onSubmit={handleCreate} onCancel={() => setCreating(null)} />
      )}

      {/* Upload spinner */}
      {uploading && (
        <div className="flex items-center gap-1 px-1.5 py-[3px] type-micro font-mono text-muted-foreground">
          <Loader2 size={11} className="animate-spin" /> uploading…
        </div>
      )}
    </div>
  )

  // Folder expansions are now rendered inline within localFiles.map above

  // Wrap in DndContext when detail mode and not already wrapped by FileDndProvider
  const wrappedFileList = !isWrapped ? (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDndDragStart}
      onDragEnd={handleDndDragEnd}
      onDragCancel={handleDndDragCancel}
    >
      {fileList}
      <DragOverlay>
        {activeDragFile && (
          <span className="inline-flex items-center gap-1 rounded border border-[var(--color-accent)] bg-[var(--bg-surface)] px-2 py-0.5 type-micro font-mono shadow-md">
            {fileTypeIcon(activeDragFile.type, 11)}
            {activeDragFile.name}
          </span>
        )}
      </DragOverlay>
    </DndContext>
  ) : fileList

  const deleteWarning = deleteTarget?.type === 'folder' && (deleteTarget.count ?? 0) > 0
    ? 'This folder is not empty. Deleting it will also delete everything inside it.'
    : null

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
      {/* Header */}
      <div className="flex items-center gap-2 text-xs">
        {selecting ? (
          /* Bulk selection toolbar */
          <>
            <span className="font-semibold text-muted-foreground">{selectedPaths.size} selected</span>
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
                  <DropdownMenuItem onSelect={() => handleBulkMove(nodePath)}>(task root)</DropdownMenuItem>
                  {folders.map(f => (
                    <DropdownMenuItem key={f.path} onSelect={() => handleBulkMove(f.path)}>{f.name}/</DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={openMoveToForBulk}>Other task…</DropdownMenuItem>
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
          /* Normal header */
          <>
            <span className="font-semibold text-muted-foreground">
              Files <span className="font-normal">({localFiles.length})</span>
            </span>
            <span className="flex items-center gap-1 ml-auto">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="inline-flex items-center gap-[3px] px-1.5 py-0.5 rounded border border-[var(--color-border-subtle)] bg-transparent type-micro cursor-pointer text-muted-foreground hover:border-[var(--color-accent)] hover:text-accent-foreground"
                    title="New file or folder"
                  >
                    <Plus size={11} />
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
                title="Upload files"
              >
                <Upload size={11} />
              </button>
              <button
                className="inline-flex items-center gap-[3px] px-1.5 py-0.5 rounded border border-[var(--color-border-subtle)] bg-transparent type-micro cursor-pointer text-muted-foreground hover:border-[var(--color-accent)] hover:text-accent-foreground"
                onClick={() => setSelecting(true)}
                title="Select files"
              >
                <CheckSquare size={11} />
              </button>
              <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileInputChange} />
            </span>
          </>
        )}
      </div>

      {/* File list (scrollable if maxHeight set) */}
      <div style={maxHeight ? { maxHeight, overflowY: 'auto' } : undefined}>
        {wrappedFileList}
      </div>

      {/* Drag-and-drop upload overlay */}
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

      {/* Bulk delete dialog */}
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
