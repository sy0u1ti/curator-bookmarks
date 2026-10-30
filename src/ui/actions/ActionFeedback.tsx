import { useEffect, useState } from 'react'
import {
  ACTION_FEEDBACK_DURATION_MS,
  getActionFeedbackStatus,
  IDLE_ACTION_FEEDBACK,
  type ActionFeedback,
  type ActionStatus
} from '../../shared/action-feedback'
import { Icon, type IconName } from '../icons/Icon'
import { TextSwap } from '../motion/TextSwap'
import './actions.css'

export function useActionFeedback(feedback: ActionFeedback = IDLE_ACTION_FEEDBACK): ActionStatus {
  const [, update] = useState(0)
  useEffect(() => {
    if (feedback.status !== 'success' && feedback.status !== 'error') return
    const remaining = feedback.updatedAt + ACTION_FEEDBACK_DURATION_MS - Date.now()
    if (remaining <= 0) return
    const timer = window.setTimeout(() => update(value => value + 1), remaining)
    return () => window.clearTimeout(timer)
  }, [feedback])
  return getActionFeedbackStatus(feedback)
}

export function ActionFeedbackIcon({ status, icon, size = 14 }: {
  status: ActionStatus
  icon: IconName
  size?: number
}) {
  const icons: Record<ActionStatus, IconName> = {
    idle: icon,
    pending: 'LoaderCircle',
    success: 'Check',
    error: 'AlertTriangle'
  }
  return (
    <span className="t-icon-swap curator-action-icon" data-feedback-state={status} aria-hidden="true">
      {(Object.keys(icons) as ActionStatus[]).map(state => (
        <span className="t-icon" data-visible={status === state} key={state}>
          <Icon
            name={icons[state]}
            size={size}
            className={state === 'pending' && status === 'pending' ? 'curator-action-spinner' : undefined}
          />
        </span>
      ))}
    </span>
  )
}

export interface ActionLabels {
  idle: string
  pending: string
  success: string
  error: string
}

export const COPY_ACTION_LABELS: ActionLabels = {
  idle: '复制链接',
  pending: '复制中',
  success: '已复制',
  error: '复制失败'
}

export function ActionFeedbackLabel({ status, labels }: { status: ActionStatus; labels: ActionLabels }) {
  return (
    <span className="curator-action-label">
      <span className="curator-action-label-reserve" aria-hidden="true">
        {Object.values(labels).map((label, index) => <span key={index}>{label}</span>)}
      </span>
      <TextSwap animate={status !== 'idle'} text={labels[status]} />
    </span>
  )
}

export function CopyActionContent({ feedback, label = COPY_ACTION_LABELS.idle }: {
  feedback: ActionFeedback
  label?: string
}) {
  const status = useActionFeedback(feedback)
  return (
    <>
      <ActionFeedbackIcon status={status} icon="Copy" size={17} />
      <span role="status" aria-live="polite" aria-atomic="true">
        <ActionFeedbackLabel status={status} labels={{ ...COPY_ACTION_LABELS, idle: label }} />
      </span>
    </>
  )
}
