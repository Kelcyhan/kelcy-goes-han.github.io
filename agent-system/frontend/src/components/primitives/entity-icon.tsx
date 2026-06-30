import { getEntityTypeConfig, statusToGroup, groupColors } from './status-utils'
import { AppIcon, type AppIconName } from './app-icon'

/**
 * EntityIcon — Renders the correct icon shape for a project/domain/task entity type.
 * Icon shape is determined by entity type (Layers/Folder/ClipboardList).
 * Color follows PM status when provided, falls back to entity type default color.
 */

export interface EntityIconProps {
  type?: string
  status?: string
  size?: number
  className?: string
}

export function EntityIcon({ type, status, size = 12, className }: EntityIconProps) {
  const config = getEntityTypeConfig(type)
  const iconName: AppIconName =
    config.icon === 'Layers' ? 'project' :
    config.icon === 'Folder' ? 'domain' :
    'task'
  const color = status ? groupColors[statusToGroup(status)] : config.iconColor
  return <AppIcon name={iconName} size={size} className={className} style={{ color, flexShrink: 0 }} />
}
