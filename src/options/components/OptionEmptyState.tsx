import { Button } from '../../ui/base/Button'
import { navigateToOptionsEmptyStateAction } from '../options-section-store.js'
import {
  OPTION_EMPTY_STATE_ACTIONS_CLASS,
  OPTION_EMPTY_STATE_CLASS,
  OPTION_EMPTY_STATE_TEXT_CLASS,
  OPTION_EMPTY_STATE_TITLE_CLASS
} from './option-layout-classes.js'

interface OptionEmptyStateAction {
  action?: string
  label: string
  onClick?: () => void
  variant?: 'primary' | 'secondary'
}

const EMPTY_OPTION_EMPTY_STATE_ACTIONS: OptionEmptyStateAction[] = []

const OPTION_EMPTY_STATE_EMBEDDED_CLASS = 'text-left'

export function OptionEmptyState({
  actions = EMPTY_OPTION_EMPTY_STATE_ACTIONS,
  className = '',
  description,
  embedded = false,
  title
}: {
  actions?: OptionEmptyStateAction[]
  className?: string
  description?: string
  embedded?: boolean
  title: string
}) {
  return (
    <div
      className={[embedded ? OPTION_EMPTY_STATE_EMBEDDED_CLASS : OPTION_EMPTY_STATE_CLASS, className]
        .filter(Boolean)
        .join(' ')}
    >
      <strong className={OPTION_EMPTY_STATE_TITLE_CLASS}>
        {title}
      </strong>
      {description ? <p className={OPTION_EMPTY_STATE_TEXT_CLASS}>
        {description}
      </p> : null}
      {actions.length ? (
        <div className={OPTION_EMPTY_STATE_ACTIONS_CLASS}>
          {actions.map((item) => (
            <Button
              key={`${item.action || item.label}:${item.label}`}
              size="sm"
              type="button"
              variant={item.variant || 'secondary'}
              onClick={() => {
                if (item.onClick) {
                  item.onClick()
                  return
                }
                if (item.action) {
                  navigateToOptionsEmptyStateAction(item.action)
                }
              }}
            >
              {item.label}
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
