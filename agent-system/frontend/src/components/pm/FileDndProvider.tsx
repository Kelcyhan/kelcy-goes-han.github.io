/**
 * FileDndProvider — Shared DndContext for cross-card file drag-and-drop.
 *
 * Wraps NodeHeader + ChildCardGrid in CardGridView. Each FileSection detects
 * this context and skips creating its own DndContext, instead just rendering
 * draggables/droppables that participate in this shared context.
 *
 * Draggable IDs: `drag:${filePath}`
 * Droppable IDs: `drop:${folderPath}` (folders) or `drop-root:${nodePath}` (task root)
 */
import { createContext, useContext, useMemo, useState, useCallback } from 'react'
import {
  DndContext, DragOverlay, closestCenter,
  PointerSensor, useSensor, type DragStartEvent, type DragEndEvent,
} from '@dnd-kit/core'
import { FileText, Folder } from 'lucide-react'
import { usePMStore } from '@/stores/pm-store.ts'
import * as api from '@/lib/api.ts'

interface FileInfo {
  name: string
  path: string
  type: 'file' | 'folder'
}

interface FileDndContextValue {
  /** When true, FileSection should NOT create its own DndContext */
  isWrapped: true
  activeDragId: string | null
}

const FileDndCtx = createContext<FileDndContextValue | null>(null)

/** FileSection calls this to check if it's inside a shared DndContext */
export function useFileDndContext(): FileDndContextValue | null {
  return useContext(FileDndCtx)
}

interface FileDndProviderProps {
  children: React.ReactNode
}

export function FileDndProvider({ children }: FileDndProviderProps) {
  const refreshCurrentNode = usePMStore(s => s.refreshCurrentNode)
  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const [activeDragFile, setActiveDragFile] = useState<FileInfo | null>(null)

  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: { distance: 8 },
  })
  const sensors = useMemo(() => [pointerSensor], [pointerSensor])

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveDragId(String(event.active.id))
    const file = event.active.data?.current?.file as FileInfo | undefined
    setActiveDragFile(file || null)
  }, [])

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    setActiveDragId(null)
    setActiveDragFile(null)
    const { active, over } = event
    if (!over) return

    const draggedFile = active.data?.current?.file as FileInfo | undefined
    if (!draggedFile) return

    // Determine destination path from droppable data
    // Droppable IDs: `drop-${folderPath}` (folder chips) or `drop-root:${nodePath}` (task root)
    // Both store { folder: FileInfo } in data — use that for the destination path.
    let destPath: string | null = null
    const targetFolder = over.data?.current?.folder as FileInfo | undefined
    if (targetFolder?.type === 'folder') {
      destPath = targetFolder.path
    }

    if (!destPath) return
    if (draggedFile.path === destPath) return
    // Don't move into self (if dragging a folder onto itself)
    if (destPath.startsWith(draggedFile.path + '/')) return

    try {
      await api.moveVaultItems([draggedFile.path], destPath)
    } catch (err) {
      console.error('Cross-card DnD move failed:', err)
    }
    refreshCurrentNode()
  }, [refreshCurrentNode])

  const handleDragCancel = useCallback(() => {
    setActiveDragId(null)
    setActiveDragFile(null)
  }, [])

  const ctxValue = useMemo<FileDndContextValue>(
    () => ({ isWrapped: true, activeDragId }),
    [activeDragId],
  )

  return (
    <FileDndCtx.Provider value={ctxValue}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        {children}
        <DragOverlay>
          {activeDragFile && (
            <span className="inline-flex items-center gap-1 rounded border border-[var(--color-accent)] bg-[var(--bg-surface)] px-2 py-0.5 type-micro font-mono shadow-md">
              {activeDragFile.type === 'folder' ? <Folder size={11} /> : <FileText size={11} />}
              {activeDragFile.name}
            </span>
          )}
        </DragOverlay>
      </DndContext>
    </FileDndCtx.Provider>
  )
}
