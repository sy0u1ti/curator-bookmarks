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
    <div className="grid justify-items-center gap-2 rounded-ds-md border border-ds-border bg-ds-surface-1 p-5 text-center text-ds-text-primary shadow-none">
      <Icon name={icon} size={24} aria-hidden="true" className="text-ds-text-muted" />
      <strong className="text-sm">{title}</strong>
      {description ? <p className="max-w-72 text-sm text-ds-text-secondary">{description}</p> : null}
      {action}
    </div>
  )
}
