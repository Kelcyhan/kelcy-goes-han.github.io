import { useEffect, useRef, useState, useCallback } from 'react'
import { usePMStore } from '@/stores/pm-store.ts'
import * as api from '@/lib/api.ts'
import { NodeHeader } from './NodeHeader.tsx'
import {
  ChildCardGrid,
  MoveToParentDropZone,
  CardContent,
  UndoToast,
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  sortableKeyboardCoordinates,
  type MoveUndoInfo,
  type DragStartEvent,
  type DragEndEvent,
} from './ChildCardGrid.tsx'
import { FilePreview } from './FilePreview.tsx'
import { FileDndProvider } from './FileDndProvider.tsx'

export function CardGridView() {
  const activeProject = usePMStore(s => s.activeProject)
  const currentNodeId = usePMStore(s => s.currentNodeId)
  const nodeCache = usePMStore(s => s.nodeCache)
  const nodeLoading = usePMStore(s => s.nodeLoading)
  const nodeError = usePMStore(s => s.nodeError)
  const filePreview = usePMStore(s => s.filePreview)
  const navigateFileBack = usePMStore(s => s.navigateFileBack)
  const navigateBack = usePMStore(s => s.navigateBack)
  const navigationStack = usePMStore(s => s.navigationStack)
  const reorderChildren = usePMStore(s => s.reorderChildren)
  const moveTask = usePMStore(s => s.moveTask)

  const [activeId, setActiveId] = useState<string | null>(null)
  const [undoInfo, setUndoInfo] = useState<MoveUndoInfo | null>(null)
  const dismissUndo = useCallback(() => setUndoInfo(null), [])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const lastDataRef = useRef<{ parent: any; children: any[]; project?: string | null } | null>(null)
  const cacheKey = currentNodeId || '__root__'
  const currentData = activeProject ? nodeCache[activeProject]?.[cacheKey] : undefined

  useEffect(() => {
    if (!activeProject) return
    if (currentData) return
    if (currentNodeId) {
      usePMStore.getState().navigateTo(currentNodeId)
    } else {
      usePMStore.getState().refreshCurrentNode()
    }
  }, [activeProject, currentNodeId, currentData])

  // Prefetch children for cards with has_children — makes clicking instant.
  useEffect(() => {
    if (!activeProject || !currentData) return
    const projectCache = nodeCache[activeProject] || {}
    const toFetch = currentData.children.filter(
      (c: any) => c.has_children && !projectCache[c.id]
    )
    if (toFetch.length === 0) return
    for (const child of toFetch) {
      api.fetchChildren(activeProject, child.id).then(result => {
        usePMStore.setState(s => ({
          nodeCache: {
            ...s.nodeCache,
            [activeProject]: {
              ...(s.nodeCache[activeProject] || {}),
              [child.id]: result,
            },
          },
        }))
      }).catch(() => {})
    }
  }, [activeProject, currentNodeId, currentData, nodeCache])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement).isContentEditable) return
      if (!(e.target as HTMLElement).closest('[data-pm-workspace]')) return
      if (e.key === 'Escape' || e.key === 'Backspace') {
        e.preventDefault()
        if (filePreview) {
          navigateFileBack()
        } else if (currentNodeId || navigationStack.length > 0) {
          navigateBack()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [filePreview, currentNodeId, navigationStack, navigateFileBack, navigateBack])

  if (filePreview) {
    return <FilePreview />
  }

  const data = currentData

  if (data) {
    lastDataRef.current = { ...data, project: activeProject }
  } else if (lastDataRef.current?.project !== activeProject) {
    lastDataRef.current = null
  }

  const display = data || lastDataRef.current

  if (!display) {
    if (nodeLoading) {
      return (
        <div className="flex items-center justify-center p-10 text-muted-foreground text-sm">
          Loading…
        </div>
      )
    }
    if (nodeError) {
      return (
        <div className="flex flex-col items-center justify-center gap-3 p-10 text-sm">
          <span className="text-muted-foreground">{nodeError}</span>
          <button
            className="text-xs text-accent-foreground hover:underline cursor-pointer bg-transparent border-none p-0"
            onClick={navigateBack}
          >
            Go back
          </button>
        </div>
      )
    }
    return <div className="flex flex-col text-[var(--color-text-subtle)] type-body-sm py-6 text-center">No data available</div>
  }

  const showUp = !!(currentNodeId || navigationStack.length > 0)
  // status-blind: completed (done) and other states stay in the main grid;
  // only physically-archived items (server's archived_children) are bucketed.
  const activeCards = display.children
  const activeIds = activeCards.map((c: any) => c.id)
  const archivedChildren = (display as any).archived_children || []
  const draggedCard = activeId ? display.children.find((c: any) => c.id === activeId) : null

  const getParentOfCurrent = (): string => {
    if (!currentNodeId) return ''
    if (currentNodeId === 'scratch') return ''
    if (currentNodeId.startsWith('scratch/')) return 'scratch'
    const nestedMatch = currentNodeId.match(/^(\d+(?:\.\d+)*)\/scratch\/.+$/)
    if (nestedMatch) return nestedMatch[1]
    const parts = currentNodeId.split('.')
    return parts.length <= 2 ? '' : parts.slice(0, -1).join('.')
  }

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)
    if (!over) return

    const overId = over.id as string

    // Cross-level move: to parent
    if (overId === '__move_to_parent__') {
      const parentOfCurrent = getParentOfCurrent()
      const result = await moveTask(active.id as string, parentOfCurrent)
      if (result) {
        setUndoInfo({
          taskId: active.id as string,
          oldParentId: currentNodeId || '',
          newId: result.new_id,
          message: `Moved ${active.id} to parent level`,
        })
      }
      return
    }

    // Cross-level move: into a card
    if (overId.startsWith('__move_into__')) {
      const targetId = overId.replace('__move_into__', '')
      const result = await moveTask(active.id as string, targetId)
      if (result) {
        const targetCard = display.children.find((c: any) => c.id === targetId)
        setUndoInfo({
          taskId: active.id as string,
          oldParentId: currentNodeId || '',
          newId: result.new_id,
          message: `Moved ${active.id} into ${targetCard?.title || targetId}`,
        })
      }
      return
    }

    // Drag into the Archived bucket → physically archive (folder move).
    if (overId === '__archive__') {
      if (!activeProject) return
      try {
        await api.archiveTask({ project: activeProject, task_id: active.id as string })
        usePMStore.getState().silentRefreshCurrentNode()
      } catch (err) {
        console.error('Failed to archive task:', err)
      }
      return
    }

    // Normal reorder within parent
    if (active.id === over.id) return
    const oldIndex = activeIds.indexOf(active.id as string)
    const newIndex = activeIds.indexOf(over.id as string)
    if (oldIndex < 0 || newIndex < 0) return

    const newOrder = [...activeIds]
    newOrder.splice(oldIndex, 1)
    newOrder.splice(newIndex, 0, active.id as string)
    reorderChildren(currentNodeId || '', newOrder)
  }

  const handleDragCancel = () => {
    setActiveId(null)
  }

  const handleUndo = async () => {
    if (!undoInfo) return
    await moveTask(undoInfo.newId, undoInfo.oldParentId)
    setUndoInfo(null)
  }

  return (
    <FileDndProvider>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className={`flex flex-col gap-4 transition-opacity duration-150 ${data ? 'opacity-100' : 'opacity-60'}`}>
          {showUp && activeId ? <MoveToParentDropZone /> : null}
          <NodeHeader node={display.parent} childCount={display.children.length} />
          <ChildCardGrid cards={display.children} archivedCards={archivedChildren} isDragActive={!!activeId} draggedId={activeId} project={activeProject || undefined} parentId={display.parent?.id} parentTitle={display.parent?.title} />
        </div>
        <DragOverlay>
          {draggedCard ? (
            // Mirror the SortableCard wrapper (relative + pl-4) so the overlay's
            // visual content lines up with the original card position; otherwise
            // the card "jumps" right of the cursor when dragging starts because
            // the original CardContent sits 16px right of the outer dnd-kit ref.
            <div className="relative pl-4">
              <CardContent card={draggedCard} isDragging />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>


      {undoInfo && (
        <UndoToast info={undoInfo} onUndo={handleUndo} onDismiss={dismissUndo} />
      )}
    </FileDndProvider>
  )
}
