import type { ReactNode } from 'react'
import { Icon, type IconName } from '../icons/Icon'

export interface EmptyStateProps {
  icon?: IconName
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
}

export function EmptyState({ icon = 'Inbox', title, description, action }: EmptyStateProps) {
  return (
    <div className="grid justify-items-center gap-2 rounded-[var(--ui-radius-group)] border border-curator-border bg-curator-bg-panel p-5 text-center text-curator-text shadow-none">
      <Icon name={icon} size={24} aria-hidden="true" className="text-curator-text-subtle" />
      <strong className="text-sm">{title}</strong>
      {description ? <p className="max-w-72 text-sm text-curator-text-muted">{description}</p> : null}
      {action}
    </div>
  )
}
