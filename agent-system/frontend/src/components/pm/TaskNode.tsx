import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import { cn } from '@/lib/utils'
import { CheckCircle2, Circle, CircleDot, Lock, Pause, X } from 'lucide-react'

export interface TaskNodeData {
  id: string
  title: string
  status: string
  estHours: number | null
  slackHours: number | null
  critical: boolean
  [key: string]: unknown
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'done': return <CheckCircle2 size={12} className="text-green shrink-0" />
    case 'active':
    case 'executing': return <CircleDot size={12} className="text-accent shrink-0" />
    case 'propose':
    case 'conversation': return <CircleDot size={12} className="text-orange shrink-0" />
    case 'blocked': return <Lock size={12} className="text-red shrink-0" />
    case 'shelved': return <Pause size={12} className="text-muted-foreground shrink-0" />
    case 'dropped': return <X size={12} className="text-muted-foreground shrink-0" />
    default: return <Circle size={12} className="text-muted-foreground shrink-0" />
  }
}

export function TaskNode({ data, selected }: NodeProps) {
  const d = data as TaskNodeData

  const borderColor = d.status === 'done' ? 'border-green-400'
    : (d.status === 'active' || d.status === 'executing') ? 'border-blue-400'
    : 'border-gray-200'

  return (
    <>
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-gray-400 !border-none !w-2 !h-2"
      />
      <div className={cn(
        'bg-white border rounded-md px-3 py-2 min-w-[180px] max-w-[220px] shadow-sm cursor-pointer',
        borderColor,
        selected && 'ring-2 ring-blue-500'
      )}>
        <div className="flex items-center gap-1.5 type-label">
          <StatusIcon status={d.status} />
          <span className="text-gray-500 font-mono type-micro shrink-0">{d.id}</span>
          <span className="flex-1 truncate font-medium text-gray-900">{d.title}</span>
        </div>
        <div className="flex items-center gap-2 type-caption text-gray-500 mt-1">
          <span>{d.status}</span>
          {d.estHours != null && <span>{d.estHours}h</span>}
          {d.slackHours != null && d.slackHours > 0 && <span>{d.slackHours}h slack</span>}
          {d.critical && <span className="text-orange-500">★ crit</span>}
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-gray-400 !border-none !w-2 !h-2"
      />
    </>
  )
}
