// ── Design System: Single source of truth ──
export {
  // PM status
  statusToGroup, pmStatusLabel, entityStatusLabel, progressLabel,
  groupColors, groupBgColors, groupBadgeVariants,
  PM_STATUS_OPTIONS, GOAL_STATUS_OPTIONS,
  // Entity types
  entityTypeConfig, getEntityTypeConfig,
  // Agent session status
  toAgentSessionStatus, agentSessionColors,
  // Types
  type StatusGroup, type EntityType, type AgentSessionStatus, type EntityTypeConfig, type StripePosition,
} from './status-utils'

// ── Primitives ──
export { StatusBadge, statusBadgeVariants, type StatusBadgeProps } from './status-badge'
export { StatusDot, statusDotVariants, type StatusDotProps } from './status-dot'
export { StatusPill, type StatusPillProps } from './status-pill'
export { PMStatusDot, type PMStatusDotProps } from './pm-status-dot'
export { AppIcon, type AppIconName, type AppIconProps } from './app-icon'
export { EntityIcon, type EntityIconProps } from './entity-icon'
export { Text, textVariants, type TextProps } from './text'
export { ActionButton, actionButtonVariants, type ActionButtonProps } from './action-button'
export { IconButton, iconButtonVariants, type IconButtonProps } from './icon-button'
export { Toolbar, ToolbarGroup, toolbarVariants, type ToolbarProps } from './toolbar'
export { ProgressBar, type ProgressBarProps } from './progress-bar'
export { CollapsibleCard, CollapsibleCardHeader, CollapsibleCardBody, collapsibleCardVariants, type CollapsibleCardProps } from './collapsible-card'
export { FileChip, fileChipVariants, type FileChipProps } from './file-chip'
export { GlassPanel, glassPanelVariants, type GlassPanelProps } from './glass-panel'
export { PMBadge, pmBadgeVariants, type PMBadgeProps } from './pm-badge'
export { SegmentedControl, segmentedControlVariants, segmentButtonVariants, type SegmentedControlProps, type SegmentItem } from './segmented-control'
export { GlanceTooltip, type GlanceTooltipProps, type GlanceSection } from './GlanceTooltip'
export { TypedTitleConfirmDialog, type TypedTitleConfirmDialogProps } from './TypedTitleConfirmDialog'
