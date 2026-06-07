import type { ReactNode } from 'react'
import { Badge, Progress, Spinner } from '../index'
import { cx } from '../base/utils'

export interface AiTaskStatusProps {
  children?: ReactNode
  className?: string
  descriptionClassName?: string
  label?: ReactNode
  progressClassName?: string
  progressId?: string
  status: 'idle' | 'running' | 'success' | 'warning' | 'error'
  statusNode?: ReactNode
  title: ReactNode
  titleId?: string
  description?: ReactNode
  progress?: number | null
}

const toneByStatus = {
  idle: 'neutral',
  running: 'neutral',
  success: 'success',
  warning: 'warning',
  error: 'danger'
} as const

export function AiTaskStatus({
  children,
  className,
  description,
  descriptionClassName,
  label,
  progress,
  progressClassName,
  progressId,
  status,
  statusNode,
  title,
  titleId
}: AiTaskStatusProps) {
  return (
    <section className={cx('grid gap-2 rounded-lg border border-curator-border bg-curator-bg-panel p-3 text-curator-text', className)}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {label ? <span className="summary-label">{label}</span> : null}
          {status === 'running' ? <Spinner /> : null}
          {typeof title === 'string' ? <strong id={titleId} className="text-sm">{title}</strong> : title}
        </div>
        {statusNode || <Badge tone={toneByStatus[status]}>{status}</Badge>}
      </div>
      {description ? (
        typeof description === 'string' ? (
          <p className={cx('text-sm text-curator-text-muted', descriptionClassName)}>{description}</p>
        ) : (
          description
        )
      ) : null}
      {typeof progress === 'number' ? <Progress id={progressId} value={progress} className={progressClassName} /> : null}
      {children}
    </section>
  )
}
