import { Button, useMotionEntrance } from '../../ui'
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

export function OptionEmptyState({
  actions = [],
  className = '',
  description,
  title
}: {
  actions?: OptionEmptyStateAction[]
  className?: string
  description: string
  title: string
}) {
  const entered = useMotionEntrance()

  return (
    <div
      className={[OPTION_EMPTY_STATE_CLASS, entered ? 'is-shown' : '', className]
        .filter(Boolean)
        .join(' ')}
    >
      <strong className={`t-stagger-line t-stagger-line--1 ${OPTION_EMPTY_STATE_TITLE_CLASS}`}>
        {title}
      </strong>
      <p className={`t-stagger-line t-stagger-line--2 ${OPTION_EMPTY_STATE_TEXT_CLASS}`}>
        {description}
      </p>
      {actions.length ? (
        <div className={`t-stagger-line t-stagger-line--3 ${OPTION_EMPTY_STATE_ACTIONS_CLASS}`}>
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
