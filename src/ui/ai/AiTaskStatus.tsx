import type { ReactNode } from 'react'
import { Badge } from '../base/Badge'
import { Progress } from '../base/Progress'
import { Spinner } from '../base/Spinner'
import { cx } from '../base/utils'

export interface AiTaskStatusProps {
  children?: ReactNode
  className?: string
  descriptionClassName?: string
  label?: ReactNode
  progressIndicatorClassName?: string
  progressClassName?: string
  status: 'idle' | 'running' | 'success' | 'warning' | 'error'
  statusNode?: ReactNode
  title: ReactNode
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

const AI_TASK_STATUS_LABEL_CLASS =
  'block text-[11px] font-semibold uppercase tracking-[0] text-[var(--ui-text-disabled)]'

export function AiTaskStatus({
  children,
  className,
  description,
  descriptionClassName,
  label,
  progress,
  progressIndicatorClassName,
  progressClassName,
  status,
  statusNode,
  title
}: AiTaskStatusProps) {
  return (
    <section className={cx('grid gap-2 rounded-lg border border-curator-border bg-curator-bg-panel p-3 text-curator-text', className)}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {label ? <span className={AI_TASK_STATUS_LABEL_CLASS}>{label}</span> : null}
          {status === 'running' ? <Spinner /> : null}
          {typeof title === 'string' ? <strong className="text-sm">{title}</strong> : title}
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
      {typeof progress === 'number' ? (
        <Progress
          value={progress}
          className={progressClassName}
          indicatorClassName={progressIndicatorClassName}
        />
      ) : null}
      {children}
    </section>
  )
}
