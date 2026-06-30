import type { TaggedTask } from '@/stores/pm-store.ts'
import { Checkbox } from '@/components/ui/checkbox.tsx'
import { StatusSelect } from './shared/StatusSelect.tsx'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu.tsx'
import { IconButton } from '@/components/primitives'
import { MoreHorizontal, ExternalLink, Trash2 } from 'lucide-react'

export interface TaskRowProps {
  task: TaggedTask
  onOpenFull: (id: string) => void
  onRemove?: () => void
  onStatusChange?: (status: string) => void
}

export function TaskRow({ task, onOpenFull, onRemove, onStatusChange }: TaskRowProps) {
  const isDone = task.status === 'done'
  const taskTitle = task.title?.trim() || 'Untitled task'

  const handleCheckboxToggle = () => {
    onStatusChange?.(isDone ? 'todo' : 'done')
  }

  return (
    <div
      className="group grid items-center gap-1 rounded py-0.5 px-1 hover:bg-[var(--bg-ingrained)] transition-colors duration-150"
      style={{ gridTemplateColumns: '24px minmax(0,1fr) 90px 44px 28px' }}
    >
      {/* Checkbox */}
      <div className="flex items-center justify-center">
        <Checkbox
          checked={isDone}
          onCheckedChange={handleCheckboxToggle}
          className="h-3.5 w-3.5"
        />
      </div>

      {/* Title */}
      <span
        className="type-label truncate cursor-pointer hover:text-accent-foreground transition-colors"
        onClick={() => onOpenFull(task.id)}
        title={taskTitle}
      >
        {taskTitle}
      </span>

      {/* Status */}
      <StatusSelect
        value={task.status}
        onChange={(value) => onStatusChange?.(value)}
        type="task"
        compact
      />

      {/* Hours */}
      <span className="type-micro text-muted-foreground text-right tabular-nums">
        {task.est_hours != null ? `${task.est_hours}h` : '\u2014'}
      </span>

      {/* Menu */}
      <div className="flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-150">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <IconButton variant="appShell" size="xs" title="Task actions">
              <MoreHorizontal size={13} />
            </IconButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => onOpenFull(task.id)}>
              <ExternalLink size={13} />
              <span>Open full</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled>
              <span>Move to milestone...</span>
            </DropdownMenuItem>
            {onRemove && (
              <DropdownMenuItem onClick={onRemove}>
                <Trash2 size={13} />
                <span>Remove from goal</span>
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onStatusChange?.('shelved')}>
              <span>Shelve</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onStatusChange?.('done')}>
              <span>Mark done</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
