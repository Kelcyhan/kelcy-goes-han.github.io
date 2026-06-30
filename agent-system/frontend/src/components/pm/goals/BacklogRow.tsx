import type { TaggedBacklog } from '@/stores/pm-store.ts'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu.tsx'
import { IconButton } from '@/components/primitives'
import { MoreHorizontal, Square, Trash2 } from 'lucide-react'

export interface BacklogRowProps {
  item: TaggedBacklog
  onRemove?: () => void
}

export function BacklogRow({ item, onRemove }: BacklogRowProps) {
  return (
    <div
      className="group grid items-center gap-1 rounded py-0.5 px-1 hover:bg-[var(--bg-ingrained)] transition-colors duration-150"
      style={{ gridTemplateColumns: '24px 1fr 44px 28px' }}
    >
      {/* Icon */}
      <div className="flex items-center justify-center">
        <Square size={13} className="text-muted-foreground" />
      </div>

      {/* Title */}
      <span className="type-label truncate" title={item.title}>
        {item.title}
      </span>

      {/* Hours */}
      <span className="type-micro text-muted-foreground text-right tabular-nums">
        {item.est_hours != null ? `${item.est_hours}h` : '?h'}
      </span>

      {/* Menu */}
      <div className="flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-150">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <IconButton variant="appShell" size="xs" title="Backlog actions">
              <MoreHorizontal size={13} />
            </IconButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem disabled>
              <span>Edit...</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {onRemove && (
              <DropdownMenuItem onClick={onRemove}>
                <Trash2 size={13} />
                <span>Remove from goal</span>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
