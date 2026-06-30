import type { CSSProperties, ReactElement, ReactNode } from 'react'
import type { AppIconName } from './app-icon'

export interface CustomIconProps {
  size?: number
  className?: string
  style?: CSSProperties
}

export type CustomIconComponent = (props: CustomIconProps) => ReactElement

function SvgIcon({
  size = 18,
  className,
  style,
  children,
  viewBox = '0 0 24 24',
}: CustomIconProps & { children: ReactNode; viewBox?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={viewBox}
      fill="none"
      className={className}
      style={style}
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  )
}

/*
 * ICON REPLACEMENT WORKFLOW
 *
 * 1. Export/copy one SVG from Figma.
 * 2. Copy only the inner shapes: <path>, <rect>, <circle>, <polygon>, etc.
 * 3. Paste them inside the matching component below.
 * 4. Prefer these fills:
 *    - Main shape:      fill="currentColor"
 *    - Secondary shape: fill="var(--icon-secondary, currentColor)" opacity="0.35"
 *
 * Do not edit product components like TopBar, ChildCardGrid, NodeHeader, or Chat.
 * They already call <AppIcon name="..." />.
 */

function ProjectIcon(props: CustomIconProps) {
  return (
    <SvgIcon {...props}>
      {/* project: PASTE SVG SHAPES HERE */}
      <path fill="var(--icon-secondary, currentColor)" opacity="0.38" d="M7 7.8h8.8a3.2 3.2 0 0 1 0 6.4H7a3.2 3.2 0 0 1 0-6.4Z" />
      <path fill="currentColor" d="M4.2 10.2h10.4a3.2 3.2 0 0 1 0 6.4H4.2a3.2 3.2 0 0 1 0-6.4Z" />
      <path fill="currentColor" opacity="0.72" d="M9.4 4.6h10.4a3.2 3.2 0 0 1 0 6.4H9.4a3.2 3.2 0 0 1 0-6.4Z" />
    </SvgIcon>
  )
}

function DomainIcon(props: CustomIconProps) {
  return (
    <SvgIcon {...props}>
      {/* domain: PASTE SVG SHAPES HERE */}
      <path fill="var(--icon-secondary, currentColor)" opacity="0.42" d="M5 7.2a2 2 0 0 1 2-2h4.2l1.7 2H19a2 2 0 0 1 2 2v1H5V7.2Z" />
      <path fill="currentColor" d="M4 9.2h16a2 2 0 0 1 2 2v5.6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-5.6a2 2 0 0 1 2-2Z" />
    </SvgIcon>
  )
}

function TaskIcon(props: CustomIconProps) {
  return (
    <SvgIcon {...props}>
      {/* task: PASTE SVG SHAPES HERE */}
      <path fill="currentColor" d="M7 3.8h10a2.2 2.2 0 0 1 2.2 2.2v12a2.2 2.2 0 0 1-2.2 2.2H7A2.2 2.2 0 0 1 4.8 18V6A2.2 2.2 0 0 1 7 3.8Z" />
      <path fill="var(--icon-secondary, #fff)" opacity="0.55" d="M8.2 8.1h7.6v1.8H8.2V8.1Zm0 4h7.6v1.8H8.2v-1.8Z" />
    </SvgIcon>
  )
}

function AgentIcon(props: CustomIconProps) {
  return (
    <SvgIcon {...props}>
      {/* agent: PASTE SVG SHAPES HERE */}
      <path fill="var(--icon-secondary, currentColor)" opacity="0.38" d="M8.5 4.4h7a3.2 3.2 0 0 1 3.2 3.2v3.2H5.3V7.6a3.2 3.2 0 0 1 3.2-3.2Z" />
      <path fill="currentColor" d="M6.2 9.2h11.6a3.2 3.2 0 0 1 3.2 3.2v2.2a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4v-2.2a3.2 3.2 0 0 1 3.2-3.2Z" />
      <path fill="var(--icon-secondary, #fff)" opacity="0.7" d="M8 13.1h2v2H8v-2Zm6 0h2v2h-2v-2Z" />
    </SvgIcon>
  )
}

function ArchiveIcon(props: CustomIconProps) {
  return (
    <SvgIcon {...props}>
      {/* archive: PASTE SVG SHAPES HERE */}
      <path fill="var(--icon-secondary, currentColor)" opacity="0.35" d="M4 4.5h16v4H4v-4Z" />
      <path fill="currentColor" d="M5.5 8h13v10.2a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2V8Zm4 3.2v2h5v-2h-5Z" />
    </SvgIcon>
  )
}

function AttachIcon(props: CustomIconProps) {
  return (
    <SvgIcon {...props}>
      {/* attach: PASTE SVG SHAPES HERE */}
      <path fill="currentColor" d="M10.8 3.8h2.4v6.9h7v2.5h-7v7h-2.4v-7h-7v-2.5h7V3.8Z" />
    </SvgIcon>
  )
}

function BackIcon(props: CustomIconProps) {
  return (
    <SvgIcon {...props}>
      {/* back: PASTE SVG SHAPES HERE */}
      <path fill="currentColor" d="M10.3 5.1 4.2 11l6.1 5.9 1.7-1.8-3-2.9h8.9a2 2 0 0 1 2 2v4h2.5v-4a4.5 4.5 0 0 0-4.5-4.5H9l3-2.9-1.7-1.7Z" />
    </SvgIcon>
  )
}

function BookIcon(props: CustomIconProps) {
  return (
    <SvgIcon {...props}>
      {/* book: PASTE SVG SHAPES HERE */}
      <path fill="currentColor" d="M5.4 4.2h6a2.8 2.8 0 0 1 2.8 2.8v13.1a3.8 3.8 0 0 0-2.8-1.2h-6a2.2 2.2 0 0 1-2.2-2.2V6.4a2.2 2.2 0 0 1 2.2-2.2Z" />
      <path fill="var(--icon-secondary, currentColor)" opacity="0.35" d="M14.2 7a2.8 2.8 0 0 1 2.8-2.8h1.6a2.2 2.2 0 0 1 2.2 2.2v10.3a2.2 2.2 0 0 1-2.2 2.2H17a3.8 3.8 0 0 0-2.8 1.2V7Z" />
    </SvgIcon>
  )
}

function BranchIcon(props: CustomIconProps) {
  return (
    <SvgIcon {...props}>
      {/* branch: PASTE SVG SHAPES HERE */}
      <path fill="currentColor" d="M6 4a3 3 0 0 1 1.2 5.75v4.5A5.2 5.2 0 0 0 12 9h2.1a3 3 0 1 1 0 2.4H12a2.8 2.8 0 0 0-2.8 2.8v.05A3 3 0 1 1 4.8 17V9.75A3 3 0 0 1 6 4Z" />
    </SvgIcon>
  )
}

function ChatIcon(props: CustomIconProps) {
  return (
    <SvgIcon {...props}>
      {/* chat: PASTE SVG SHAPES HERE */}
      <path fill="currentColor" d="M5.5 5h13A3.5 3.5 0 0 1 22 8.5v5.2a3.5 3.5 0 0 1-3.5 3.5H10l-5.2 3.1v-3.4A3.5 3.5 0 0 1 2 13.5v-5A3.5 3.5 0 0 1 5.5 5Z" />
      <path fill="var(--icon-secondary, #fff)" opacity="0.55" d="M7.2 9.6h9.6v1.7H7.2V9.6Zm0 3.5h6.2v1.7H7.2v-1.7Z" />
    </SvgIcon>
  )
}

function CheckIcon(props: CustomIconProps) {
  return (
    <SvgIcon {...props}>
      {/* check: PASTE SVG SHAPES HERE */}
      <path fill="currentColor" d="m9.5 16.1-4.2-4.2-1.8 1.8 6 6 11-11-1.8-1.8-9.2 9.2Z" />
    </SvgIcon>
  )
}

function ChevronDownIcon(props: CustomIconProps) {
  return (
    <SvgIcon {...props}>
      {/* chevron-down: PASTE SVG SHAPES HERE */}
      <path fill="currentColor" d="m12 15.8-6.3-6.2 1.7-1.7 4.6 4.5 4.6-4.5 1.7 1.7-6.3 6.2Z" />
    </SvgIcon>
  )
}

function ChevronLeftIcon(props: CustomIconProps) {
  return (
    <SvgIcon {...props}>
      {/* chevron-left: PASTE SVG SHAPES HERE */}
      <path fill="currentColor" d="m8.2 12 6.2-6.3 1.7 1.7-4.5 4.6 4.5 4.6-1.7 1.7L8.2 12Z" />
    </SvgIcon>
  )
}

function ChevronRightIcon(props: CustomIconProps) {
  return (
    <SvgIcon {...props}>
      {/* chevron-right: PASTE SVG SHAPES HERE */}
      <path fill="currentColor" d="m15.8 12-6.2 6.3-1.7-1.7 4.5-4.6-4.5-4.6 1.7-1.7 6.2 6.3Z" />
    </SvgIcon>
  )
}

function DownloadIcon(props: CustomIconProps) {
  return (
    <SvgIcon {...props}>
      {/* download: PASTE SVG SHAPES HERE */}
      <path fill="currentColor" d="M10.8 4h2.4v8.2l3.1-3.1 1.7 1.7-6 6-6-6 1.7-1.7 3.1 3.1V4Z" />
      <path fill="var(--icon-secondary, currentColor)" opacity="0.35" d="M4.5 18h15v2.4h-15V18Z" />
    </SvgIcon>
  )
}

function EditIcon(props: CustomIconProps) {
  return (
    <SvgIcon {...props}>
      {/* edit: PASTE SVG SHAPES HERE */}
      <path fill="currentColor" d="M15.8 3.8a2.4 2.4 0 0 1 3.4 0l1 1a2.4 2.4 0 0 1 0 3.4L9.7 18.7 4 20l1.3-5.7L15.8 3.8Z" />
      <path fill="var(--icon-secondary, currentColor)" opacity="0.35" d="M14.2 5.4 18.6 9l-1.7 1.7-4.4-3.6 1.7-1.7Z" />
    </SvgIcon>
  )
}

function EyeIcon(props: CustomIconProps) {
  return (
    <SvgIcon {...props}>
      {/* eye: PASTE SVG SHAPES HERE */}
      <path fill="var(--icon-secondary, currentColor)" opacity="0.35" d="M2.2 12s3.4-6.4 9.8-6.4 9.8 6.4 9.8 6.4-3.4 6.4-9.8 6.4S2.2 12 2.2 12Z" />
      <path fill="currentColor" d="M12 8.4a3.6 3.6 0 1 1 0 7.2 3.6 3.6 0 0 1 0-7.2Z" />
    </SvgIcon>
  )
}

function FileIcon(props: CustomIconProps) {
  return (
    <SvgIcon {...props}>
      {/* file: PASTE SVG SHAPES HERE */}
      <path fill="currentColor" d="M6.6 3.2H14l4.4 4.4v11.8a1.8 1.8 0 0 1-1.8 1.8h-10a1.8 1.8 0 0 1-1.8-1.8V5a1.8 1.8 0 0 1 1.8-1.8Z" />
      <path fill="var(--icon-secondary, #fff)" opacity="0.5" d="M13.8 3.4v4.7h4.7l-4.7-4.7Z" />
    </SvgIcon>
  )
}

function FolderIcon(props: CustomIconProps) {
  return <DomainIcon {...props} />
}

function GoalIcon(props: CustomIconProps) {
  return (
    <SvgIcon {...props}>
      {/* goal: PASTE SVG SHAPES HERE */}
      <path fill="var(--icon-secondary, currentColor)" opacity="0.3" d="M12 3.2a8.8 8.8 0 1 1 0 17.6 8.8 8.8 0 0 1 0-17.6Z" />
      <path fill="currentColor" d="M12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z" />
    </SvgIcon>
  )
}

function GripIcon(props: CustomIconProps) {
  return (
    <SvgIcon {...props}>
      {/* grip: PASTE SVG SHAPES HERE */}
      <path fill="currentColor" d="M8 6a1.6 1.6 0 1 1 0 3.2A1.6 1.6 0 0 1 8 6Zm8 0a1.6 1.6 0 1 1 0 3.2A1.6 1.6 0 0 1 16 6ZM8 10.4a1.6 1.6 0 1 1 0 3.2 1.6 1.6 0 0 1 0-3.2Zm8 0a1.6 1.6 0 1 1 0 3.2 1.6 1.6 0 0 1 0-3.2ZM8 14.8a1.6 1.6 0 1 1 0 3.2 1.6 1.6 0 0 1 0-3.2Zm8 0a1.6 1.6 0 1 1 0 3.2 1.6 1.6 0 0 1 0-3.2Z" />
    </SvgIcon>
  )
}

function InboxIcon(props: CustomIconProps) {
  return (
    <SvgIcon {...props}>
      {/* inbox: PASTE SVG SHAPES HERE */}
      <path fill="var(--icon-secondary, currentColor)" opacity="0.32" d="M4.8 4.8h14.4l2 8.2H16l-1.4 2.4H9.4L8 13H2.8l2-8.2Z" />
      <path fill="currentColor" d="M3 12.2h5.6l1.4 2.4h4l1.4-2.4H21v4.6a2.4 2.4 0 0 1-2.4 2.4H5.4A2.4 2.4 0 0 1 3 16.8v-4.6Z" />
    </SvgIcon>
  )
}

function LockIcon(props: CustomIconProps) {
  return (
    <SvgIcon {...props}>
      {/* lock: PASTE SVG SHAPES HERE */}
      <path fill="var(--icon-secondary, currentColor)" opacity="0.36" d="M7.5 9V7.4a4.5 4.5 0 0 1 9 0V9h-2.4V7.4a2.1 2.1 0 0 0-4.2 0V9H7.5Z" />
      <path fill="currentColor" d="M6.2 8.8h11.6a2 2 0 0 1 2 2v7.4a2 2 0 0 1-2 2H6.2a2 2 0 0 1-2-2v-7.4a2 2 0 0 1 2-2Z" />
    </SvgIcon>
  )
}

function MicIcon(props: CustomIconProps) {
  return (
    <SvgIcon {...props}>
      {/* mic: PASTE SVG SHAPES HERE */}
      <path fill="currentColor" d="M12 3.2a3.4 3.4 0 0 1 3.4 3.4v5.2a3.4 3.4 0 0 1-6.8 0V6.6A3.4 3.4 0 0 1 12 3.2Z" />
      <path fill="var(--icon-secondary, currentColor)" opacity="0.38" d="M5.5 10.8h2.2a4.3 4.3 0 0 0 8.6 0h2.2a6.5 6.5 0 0 1-5.4 6.4v3h-2.2v-3a6.5 6.5 0 0 1-5.4-6.4Z" />
    </SvgIcon>
  )
}

function MicOffIcon(props: CustomIconProps) {
  return (
    <SvgIcon {...props}>
      {/* mic-off: PASTE SVG SHAPES HERE */}
      <path fill="currentColor" d="M7.1 4.1 20 17l-1.7 1.7L5.4 5.8l1.7-1.7Z" />
      <path fill="var(--icon-secondary, currentColor)" opacity="0.38" d="M12 3.2a3.4 3.4 0 0 1 3.4 3.4v5l-6.8-6.8A3.4 3.4 0 0 1 12 3.2Zm-6.5 7.6h2.2a4.3 4.3 0 0 0 5.4 4.2l1.7 1.7a6.2 6.2 0 0 1-1.7.5v3h-2.2v-3a6.5 6.5 0 0 1-5.4-6.4Z" />
    </SvgIcon>
  )
}

function MoonIcon(props: CustomIconProps) {
  return (
    <SvgIcon {...props}>
      {/* moon: PASTE SVG SHAPES HERE */}
      <path fill="currentColor" d="M15.8 3.5a8.3 8.3 0 1 0 4.7 12.8A7.2 7.2 0 0 1 15.8 3.5Z" />
    </SvgIcon>
  )
}

function MoreIcon(props: CustomIconProps) {
  return (
    <SvgIcon {...props}>
      {/* more: PASTE SVG SHAPES HERE */}
      <path fill="currentColor" d="M6 10.2a1.8 1.8 0 1 1 0 3.6 1.8 1.8 0 0 1 0-3.6Zm6 0a1.8 1.8 0 1 1 0 3.6 1.8 1.8 0 0 1 0-3.6Zm6 0a1.8 1.8 0 1 1 0 3.6 1.8 1.8 0 0 1 0-3.6Z" />
    </SvgIcon>
  )
}

function MoveIntoIcon(props: CustomIconProps) {
  return (
    <SvgIcon {...props}>
      {/* move-into: PASTE SVG SHAPES HERE */}
      <path fill="var(--icon-secondary, currentColor)" opacity="0.35" d="M3 6h7l1.6 2H21v10.2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6Z" />
      <path fill="currentColor" d="m12.8 10.2 4.3 3.8-4.3 3.8v-2.5H7v-2.6h5.8v-2.5Z" />
    </SvgIcon>
  )
}

function MoveUpIcon(props: CustomIconProps) {
  return (
    <SvgIcon {...props}>
      {/* move-up: PASTE SVG SHAPES HERE */}
      <path fill="currentColor" d="m12 3.8 6 6-1.7 1.7-3.1-3.1v11.8h-2.4V8.4l-3.1 3.1L6 9.8l6-6Z" />
    </SvgIcon>
  )
}

function PanelLeftCloseIcon(props: CustomIconProps) {
  return (
    <SvgIcon {...props}>
      {/* panel-left-close: PASTE SVG SHAPES HERE */}
      <path fill="var(--icon-secondary, currentColor)" opacity="0.35" d="M3.5 4.5h17v15h-17v-15Z" />
      <path fill="currentColor" d="M6 6.8h4v10.4H6V6.8Zm9.2 2.3L12.4 12l2.8 2.9-1.6 1.6L9.2 12l4.4-4.5 1.6 1.6Z" />
    </SvgIcon>
  )
}

function PanelLeftOpenIcon(props: CustomIconProps) {
  return (
    <SvgIcon {...props}>
      {/* panel-left-open: PASTE SVG SHAPES HERE */}
      <path fill="var(--icon-secondary, currentColor)" opacity="0.35" d="M3.5 4.5h17v15h-17v-15Z" />
      <path fill="currentColor" d="M6 6.8h4v10.4H6V6.8Zm6.2 2.3 1.6-1.6 4.4 4.5-4.4 4.5-1.6-1.6L15 12l-2.8-2.9Z" />
    </SvgIcon>
  )
}

function PanelRightCloseIcon(props: CustomIconProps) {
  return (
    <SvgIcon {...props}>
      {/* panel-right-close: PASTE SVG SHAPES HERE */}
      <path fill="var(--icon-secondary, currentColor)" opacity="0.35" d="M3.5 4.5h17v15h-17v-15Z" />
      <path fill="currentColor" d="M14 6.8h4v10.4h-4V6.8ZM8.8 9.1 11.6 12l-2.8 2.9 1.6 1.6 4.4-4.5-4.4-4.5-1.6 1.6Z" />
    </SvgIcon>
  )
}

function PanelRightOpenIcon(props: CustomIconProps) {
  return (
    <SvgIcon {...props}>
      {/* panel-right-open: PASTE SVG SHAPES HERE */}
      <path fill="var(--icon-secondary, currentColor)" opacity="0.35" d="M3.5 4.5h17v15h-17v-15Z" />
      <path fill="currentColor" d="M14 6.8h4v10.4h-4V6.8Zm1.2 2.3-1.6-1.6L9.2 12l4.4 4.5 1.6-1.6L12.4 12l2.8-2.9Z" />
    </SvgIcon>
  )
}

function PlanIcon(props: CustomIconProps) {
  return (
    <SvgIcon {...props}>
      {/* plan: PASTE SVG SHAPES HERE */}
      <path fill="currentColor" d="M6.5 3.5h11A2.5 2.5 0 0 1 20 6v12a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 18V6a2.5 2.5 0 0 1 2.5-2.5Z" />
      <path fill="var(--icon-secondary, #fff)" opacity="0.55" d="M8 7.5h8v1.8H8V7.5Zm0 3.6h8v1.8H8v-1.8Zm0 3.6h5.4v1.8H8v-1.8Z" />
    </SvgIcon>
  )
}

function RefreshIcon(props: CustomIconProps) {
  return (
    <SvgIcon {...props}>
      {/* refresh: PASTE SVG SHAPES HERE */}
      <path fill="var(--icon-secondary, currentColor)" opacity="0.28" d="M12 4.2a7.8 7.8 0 1 1-7.8 7.8h2.4a5.4 5.4 0 1 0 1.58-3.82L10.5 10.5H4.2V4.2l2.28 2.28A7.75 7.75 0 0 1 12 4.2Z" />
      <path fill="currentColor" d="M12 4.2a7.77 7.77 0 0 1 7.65 6.38h-2.48A5.4 5.4 0 0 0 8.18 8.18L10.5 10.5H4.2V4.2l2.28 2.28A7.75 7.75 0 0 1 12 4.2Z" />
    </SvgIcon>
  )
}

function RestartIcon(props: CustomIconProps) {
  return (
    <SvgIcon {...props}>
      {/* restart: PASTE SVG SHAPES HERE */}
      <path fill="currentColor" d="M10.8 3.8h2.4v8.1h-2.4V3.8Z" />
      <path fill="var(--icon-secondary, currentColor)" opacity="0.35" d="M7.7 6.2A8.2 8.2 0 1 0 16.3 6.2l-1.25 2.05a5.8 5.8 0 1 1-6.1 0L7.7 6.2Z" />
      <path fill="currentColor" d="M6.45 4.95A10.2 10.2 0 1 0 17.55 4.95l-1.32 2.12a7.75 7.75 0 1 1-8.46 0L6.45 4.95Z" />
    </SvgIcon>
  )
}

function SearchIcon(props: CustomIconProps) {
  return (
    <SvgIcon {...props}>
      {/* search: PASTE SVG SHAPES HERE */}
      <path fill="currentColor" d="M10.4 4a6.4 6.4 0 1 1 0 12.8 6.4 6.4 0 0 1 0-12.8Zm0 2.4a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" />
      <path fill="currentColor" d="m15.1 16.8 1.7-1.7 4 4-1.7 1.7-4-4Z" />
    </SvgIcon>
  )
}

function SendIcon(props: CustomIconProps) {
  return (
    <SvgIcon {...props}>
      {/* send: PASTE SVG SHAPES HERE */}
      <path fill="currentColor" d="M4 4.2 21 12 4 19.8v-6l8.5-1.8L4 10.2v-6Z" />
    </SvgIcon>
  )
}

function SettingsIcon(props: CustomIconProps) {
  return (
    <SvgIcon {...props}>
      {/* settings: PASTE SVG SHAPES HERE */}
      <path fill="var(--icon-secondary, currentColor)" opacity="0.35" d="M10.8 2.8h2.4l.7 2.2a7.2 7.2 0 0 1 1.6.7l2.1-1.1 1.7 1.7-1.1 2.1c.3.5.5 1 .7 1.6l2.2.7v2.4l-2.2.7a7.2 7.2 0 0 1-.7 1.6l1.1 2.1-1.7 1.7-2.1-1.1c-.5.3-1 .5-1.6.7l-.7 2.2h-2.4l-.7-2.2a7.2 7.2 0 0 1-1.6-.7l-2.1 1.1-1.7-1.7 1.1-2.1c-.3-.5-.5-1-.7-1.6L2.8 13v-2.4L5 9.9c.2-.6.4-1.1.7-1.6L4.6 6.2l1.7-1.7 2.1 1.1c.5-.3 1-.5 1.6-.7l.8-2.1Z" />
      <path fill="currentColor" d="M12 8.2a3.8 3.8 0 1 1 0 7.6 3.8 3.8 0 0 1 0-7.6Z" />
    </SvgIcon>
  )
}

function SparklesIcon(props: CustomIconProps) {
  return (
    <SvgIcon {...props}>
      {/* sparkles: PASTE SVG SHAPES HERE */}
      <path fill="currentColor" d="m10.8 2.8 1.8 5.2 5.2 1.8-5.2 1.8-1.8 5.2L9 11.6 3.8 9.8 9 8l1.8-5.2Z" />
      <path fill="var(--icon-secondary, currentColor)" opacity="0.48" d="m18.2 13.2.9 2.7 2.7.9-2.7.9-.9 2.7-.9-2.7-2.7-.9 2.7-.9.9-2.7Z" />
    </SvgIcon>
  )
}

function SunIcon(props: CustomIconProps) {
  return (
    <SvgIcon {...props}>
      {/* sun: PASTE SVG SHAPES HERE */}
      <path fill="currentColor" d="M12 7.4a4.6 4.6 0 1 1 0 9.2 4.6 4.6 0 0 1 0-9.2Z" />
      <path fill="var(--icon-secondary, currentColor)" opacity="0.42" d="M10.8 2h2.4v3.2h-2.4V2Zm0 16.8h2.4V22h-2.4v-3.2ZM2 10.8h3.2v2.4H2v-2.4Zm16.8 0H22v2.4h-3.2v-2.4ZM5.1 3.8l2.3 2.3-1.7 1.7-2.3-2.3 1.7-1.7Zm13.2 12.4 2.3 2.3-1.7 1.7-2.3-2.3 1.7-1.7Zm2.3-10.7-2.3 2.3-1.7-1.7 2.3-2.3 1.7 1.7ZM5.7 16.2l1.7 1.7-2.3 2.3-1.7-1.7 2.3-2.3Z" />
    </SvgIcon>
  )
}

function TrashIcon(props: CustomIconProps) {
  return (
    <SvgIcon {...props}>
      {/* trash: PASTE SVG SHAPES HERE */}
      <path fill="var(--icon-secondary, currentColor)" opacity="0.35" d="M8.8 3.5h6.4l.8 2H21v2.4H3V5.5h5l.8-2Z" />
      <path fill="currentColor" d="M5.2 8.8h13.6l-.8 10a2.4 2.4 0 0 1-2.4 2.2H8.4A2.4 2.4 0 0 1 6 18.8l-.8-10Z" />
    </SvgIcon>
  )
}

function WorklogIcon(props: CustomIconProps) {
  return (
    <SvgIcon {...props}>
      {/* worklog: PASTE SVG SHAPES HERE */}
      <path fill="currentColor" d="M6 3.5h12a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2Z" />
      <path fill="var(--icon-secondary, #fff)" opacity="0.55" d="M8 7h8v1.7H8V7Zm0 3.4h8v1.7H8v-1.7Zm0 3.4h5.5v1.7H8v-1.7Z" />
    </SvgIcon>
  )
}

function XIcon(props: CustomIconProps) {
  return (
    <SvgIcon {...props}>
      {/* x: PASTE SVG SHAPES HERE */}
      <path fill="currentColor" d="m7.1 5.4 4.9 4.9 4.9-4.9 1.7 1.7-4.9 4.9 4.9 4.9-1.7 1.7-4.9-4.9-4.9 4.9-1.7-1.7 4.9-4.9-4.9-4.9 1.7-1.7Z" />
    </SvgIcon>
  )
}

function ZapIcon(props: CustomIconProps) {
  return (
    <SvgIcon {...props}>
      {/* zap: PASTE SVG SHAPES HERE */}
      <path fill="currentColor" d="M13.3 2.8 4.8 13.2h6.1l-1.2 8 9.5-11.6h-6.4l.5-6.8Z" />
    </SvgIcon>
  )
}

export const customIconComponents: Partial<Record<AppIconName, CustomIconComponent>> = {
  project: ProjectIcon,
  domain: DomainIcon,
  task: TaskIcon,
  agent: AgentIcon,
  agents: AgentIcon,
  archive: ArchiveIcon,
  attach: AttachIcon,
  back: BackIcon,
  book: BookIcon,
  branch: BranchIcon,
  chat: ChatIcon,
  check: CheckIcon,
  'chevron-down': ChevronDownIcon,
  'chevron-left': ChevronLeftIcon,
  'chevron-right': ChevronRightIcon,
  download: DownloadIcon,
  edit: EditIcon,
  eye: EyeIcon,
  file: FileIcon,
  files: FolderIcon,
  folder: FolderIcon,
  goal: GoalIcon,
  grip: GripIcon,
  inbox: InboxIcon,
  lock: LockIcon,
  mic: MicIcon,
  'mic-off': MicOffIcon,
  moon: MoonIcon,
  more: MoreIcon,
  'move-into': MoveIntoIcon,
  'move-up': MoveUpIcon,
  'panel-left-close': PanelLeftCloseIcon,
  'panel-left-open': PanelLeftOpenIcon,
  'panel-right-close': PanelRightCloseIcon,
  'panel-right-open': PanelRightOpenIcon,
  plan: PlanIcon,
  plus: AttachIcon,
  refresh: RefreshIcon,
  restart: RestartIcon,
  'scroll-bottom': ChevronDownIcon,
  search: SearchIcon,
  send: SendIcon,
  settings: SettingsIcon,
  sparkles: SparklesIcon,
  sun: SunIcon,
  trash: TrashIcon,
  worklog: WorklogIcon,
  x: XIcon,
  zap: ZapIcon,
}
