import type { ReactNode } from 'react'
import { Icon } from '../icons/Icon'
import { cx } from '../primitives/utils'

export interface AiSetupPromptProps {
  actions?: ReactNode
  className?: string
  description: ReactNode
  descriptionClassName?: string
  iconClassName?: string
  title: ReactNode
  titleClassName?: string
}

export function AiSetupPrompt({
  actions,
  className,
  description,
  descriptionClassName,
  iconClassName,
  title,
  titleClassName
}: AiSetupPromptProps) {
  return (
    <div className={cx('ai-setup-prompt', className)}>
      <span className={cx('ai-setup-prompt-icon', iconClassName)} aria-hidden="true">
        <Icon name="Bot" size={17} />
      </span>
      <div className="ai-setup-prompt-copy">
        {typeof title === 'string' ? <p className={cx('ai-setup-prompt-title', titleClassName)}>{title}</p> : title}
        {typeof description === 'string' ? (
          <p className={cx('ai-setup-prompt-description', descriptionClassName)}>{description}</p>
        ) : (
          description
        )}
      </div>
      {actions ? <div className="ai-setup-prompt-actions">{actions}</div> : null}
    </div>
  )
}
