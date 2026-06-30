import type { CSSProperties } from 'react'
import {
  Archive,
  ArrowUp,
  Bot,
  BookOpen,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  CornerDownLeft,
  Download,
  Eye,
  FileText,
  Folder,
  FolderInput,
  GitBranch,
  GripVertical,
  Inbox,
  Layers,
  Lock,
  Mic,
  MicOff,
  Moon,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Pencil,
  Pin,
  Plus,
  RefreshCw,
  RotateCcw,
  ScrollText,
  Search,
  Send,
  Settings,
  Sparkles,
  Sun,
  Target,
  Trash2,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export type AppIconName =
  | 'project'
  | 'domain'
  | 'task'
  | 'agent'
  | 'agents'
  | 'archive'
  | 'attach'
  | 'back'
  | 'book'
  | 'branch'
  | 'chat'
  | 'check'
  | 'chevron-down'
  | 'chevron-left'
  | 'chevron-right'
  | 'download'
  | 'edit'
  | 'eye'
  | 'file'
  | 'files'
  | 'folder'
  | 'goal'
  | 'grip'
  | 'inbox'
  | 'lock'
  | 'mic'
  | 'mic-off'
  | 'moon'
  | 'more'
  | 'move-into'
  | 'move-up'
  | 'panel-left-close'
  | 'panel-left-open'
  | 'panel-right-close'
  | 'panel-right-open'
  | 'pin'
  | 'plan'
  | 'plus'
  | 'refresh'
  | 'restart'
  | 'scroll-bottom'
  | 'search'
  | 'send'
  | 'settings'
  | 'sparkles'
  | 'sun'
  | 'trash'
  | 'worklog'
  | 'x'
  | 'zap'

type IconTone = 'default' | 'project' | 'domain' | 'task' | 'agent' | 'status' | 'muted' | 'accent'

export interface AppIconProps {
  name: AppIconName
  size?: number
  className?: string
  style?: CSSProperties
  tone?: IconTone
  strokeWidth?: number
  'aria-hidden'?: boolean
}

const lucideIcons: Partial<Record<AppIconName, LucideIcon>> = {
  project: Layers,
  domain: Folder,
  task: ClipboardList,
  agent: Bot,
  agents: Bot,
  archive: Archive,
  attach: Plus,
  back: CornerDownLeft,
  book: BookOpen,
  branch: GitBranch,
  chat: Bot,
  check: Check,
  'chevron-down': ChevronDown,
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  download: Download,
  edit: Pencil,
  eye: Eye,
  file: FileText,
  files: Folder,
  folder: Folder,
  goal: Target,
  grip: GripVertical,
  inbox: Inbox,
  lock: Lock,
  mic: Mic,
  'mic-off': MicOff,
  moon: Moon,
  more: MoreHorizontal,
  'move-into': FolderInput,
  'move-up': ArrowUp,
  'panel-left-close': PanelLeftClose,
  'panel-left-open': PanelLeftOpen,
  'panel-right-close': PanelRightClose,
  'panel-right-open': PanelRightOpen,
  pin: Pin,
  plan: ClipboardList,
  plus: Plus,
  refresh: RefreshCw,
  restart: RotateCcw,
  'scroll-bottom': ChevronDown,
  search: Search,
  send: Send,
  settings: Settings,
  sparkles: Sparkles,
  sun: Sun,
  trash: Trash2,
  worklog: ScrollText,
  x: X,
  zap: Zap,
}

export function AppIcon({
  name,
  size = 14,
  className,
  style,
  tone = 'default',
  strokeWidth = 2,
  'aria-hidden': ariaHidden = true,
}: AppIconProps) {
  const Icon = lucideIcons[name] || Layers
  return (
    <Icon
      size={size}
      strokeWidth={strokeWidth}
      className={cn('app-icon app-icon-line', `app-icon-tone-${tone}`, className)}
      style={style}
      aria-hidden={ariaHidden}
    />
  )
}
