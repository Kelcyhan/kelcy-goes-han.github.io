import { useState } from 'react'
import { usePMStore } from '@/stores/pm-store.ts'
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from 'react-resizable-panels'
import { GoalDetailMain } from './GoalDetailMain.tsx'
import { GoalDetailSidebar } from './GoalDetailSidebar.tsx'
import { DeleteGoalDialog } from './DeleteGoalDialog.tsx'
import { EditGoalDialog } from './EditGoalDialog.tsx'
import { ActionButton } from '@/components/primitives'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu.tsx'
import { ArrowLeft, MoreHorizontal, Trash2, Pencil } from 'lucide-react'

export interface GoalDetailProps {
  goalId: string
}

export function GoalDetail({ goalId }: GoalDetailProps) {
  const state = usePMStore(s => s.state)
  const clearSelectedGoal = usePMStore(s => s.clearSelectedGoal)
  const updateGoal = usePMStore(s => s.updateGoal)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)

  const goBack = () => {
    clearSelectedGoal()
    // Go home (no project tabs anymore — domain view isn't useful context after editing a goal)
    usePMStore.setState({ activeProject: null, state: null })
  }

  const goal = state?.goals?.find(g => g.id === goalId)

  if (!goal) {
    return (
      <div className="flex flex-col gap-3 p-3">
        <ActionButton
          variant="back"
          size="toolbar"
          className="self-start gap-1"
          onClick={goBack}
        >
          <ArrowLeft size={14} /> Back
        </ActionButton>
        <div className="text-muted-foreground text-sm">
          Goal &ldquo;{goalId}&rdquo; not found.
        </div>
      </div>
    )
  }

  return (
    <>
    <DeleteGoalDialog
      open={deleteDialogOpen}
      onOpenChange={setDeleteDialogOpen}
      goal={goal}
    />
    <EditGoalDialog
      open={editDialogOpen}
      onOpenChange={setEditDialogOpen}
      goal={goal}
    />
    <div className="flex flex-col h-full">
      {/* Header bar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border shrink-0">
        <ActionButton
          variant="back"
          size="toolbar"
          className="gap-1"
          onClick={goBack}
        >
          <ArrowLeft size={14} /> Back
        </ActionButton>

        <span className="flex-1 text-sm font-semibold text-foreground truncate">
          {goal.id} &mdash; {goal.title}
        </span>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <ActionButton variant="appShell" size="appShell">
              <MoreHorizontal size={14} /> Actions
            </ActionButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => setEditDialogOpen(true)}>
              <Pencil size={13} />
              Edit goal...
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => updateGoal(goalId, { status: 'archived' })}
            >
              Archive
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-red focus:text-red"
              onClick={() => setDeleteDialogOpen(true)}
            >
              <Trash2 size={13} />
              Delete...
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Resizable panels */}
      <PanelGroup orientation="horizontal" className="flex-1 min-h-0">
        <Panel defaultSize={70} minSize={50}>
          <GoalDetailMain goal={goal} />
        </Panel>

        <PanelResizeHandle className="w-1.5 bg-border hover:bg-accent transition-colors cursor-col-resize flex items-center justify-center">
          <div className="w-px h-8 bg-muted-foreground/30 rounded-full" />
        </PanelResizeHandle>

        <Panel defaultSize={30} minSize={0} collapsible>
          <GoalDetailSidebar goal={goal} />
        </Panel>
      </PanelGroup>
    </div>
    </>
  )
}
