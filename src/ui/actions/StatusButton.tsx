import type { ActionFeedback } from '../../shared/action-feedback'
import { Button, type ButtonProps } from '../base/Button'
import { cx } from '../base/utils'
import type { IconName } from '../icons/Icon'
import {
  ActionFeedbackIcon,
  ActionFeedbackLabel,
  useActionFeedback,
  type ActionLabels
} from './ActionFeedback'

export type StatusButtonProps = Omit<ButtonProps, 'children'> & {
  feedback: ActionFeedback
  labels: ActionLabels
  icon: IconName
  iconOnly?: boolean
}

export function StatusButton({
  feedback, labels, icon, iconOnly = false, className, disabled,
  focusableWhenDisabled, 'aria-label': ariaLabel, title, ...props
}: StatusButtonProps) {
  const status = useActionFeedback(feedback)
  const busy = feedback.status === 'pending'
  const accessibleLabel = ariaLabel || labels.idle
  const statusAnnouncement = status === 'idle' ? '' : `${accessibleLabel}：${labels[status]}`
  return (
    <>
      <Button
        {...props}
        className={cx(!iconOnly && 'curator-status-button', className)}
        disabled={disabled || busy}
        focusableWhenDisabled={focusableWhenDisabled ?? busy}
        aria-busy={busy || undefined}
        aria-label={accessibleLabel}
        title={iconOnly ? labels[status] : title}
        data-feedback-state={status}
      >
        <ActionFeedbackIcon status={status} icon={icon} />
        {!iconOnly ? <ActionFeedbackLabel status={status} labels={labels} /> : null}
      </Button>
      <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {statusAnnouncement}
      </span>
    </>
  )
}
