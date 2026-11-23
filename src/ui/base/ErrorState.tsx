import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Icon, type IconName } from '../icons/Icon'
import { cx } from './utils'

export interface ErrorStateProps {
  actions?: ReactNode
  className?: string
  detail?: ReactNode
  icon?: IconName
  size?: 'compact' | 'default'
  surface?: 'none' | 'card'
  title: ReactNode
  titleAs?: 'h1' | 'h2' | 'h3' | 'p'
  titleId?: string
  tone?: 'error' | 'warning' | 'neutral'
}

export function ErrorState({
  actions,
  className,
  detail,
  icon = 'AlertTriangle',
  size = 'default',
  surface = 'none',
  title,
  titleAs = 'p',
  titleId,
  tone = 'error'
}: ErrorStateProps) {
  const detailRef = useRef<HTMLDivElement>(null)
  const [overflow, setOverflow] = useState(false)

  useLayoutEffect(() => {
    const node = detailRef.current
    if (!node) return
    const measure = () => setOverflow(node.scrollHeight > node.clientHeight + 1)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [detail])

  const Heading = titleAs
  const iconSize = size === 'compact' ? 18 : 20

  return (
    <div
      className={cx('curator-error-state', className)}
      data-size={size}
      data-surface={surface}
      data-tone={tone}
    >
      <div className="curator-error-state-icon" aria-hidden="true">
        <Icon name={icon} size={iconSize} />
      </div>
      <div className="curator-error-state-copy">
        <Heading
          id={titleId}
          className="curator-error-state-title"
          role={!detail ? (tone === 'error' ? 'alert' : 'status') : undefined}
        >
          {title}
        </Heading>
        {detail ? (
          <div
            ref={detailRef}
            className="curator-error-state-detail"
            role={tone === 'error' ? 'alert' : 'status'}
            aria-atomic="true"
            tabIndex={overflow ? 0 : undefined}
          >
            {detail}
          </div>
        ) : null}
      </div>
      {actions ? <div className="curator-error-state-actions">{actions}</div> : null}
    </div>
  )
}
