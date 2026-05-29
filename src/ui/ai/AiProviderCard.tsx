import type { ReactNode } from 'react'
import { Card, Icon, type CardProps, type IconName } from '../index'
import { cx } from '../primitives/utils'

export interface AiProviderCardProps extends Omit<CardProps, 'title'> {
  title: ReactNode
  description?: ReactNode
  status?: ReactNode
  children?: ReactNode
  bodyClassName?: string
  copyClassName?: string
  descriptionClassName?: string
  headerClassName?: string
  iconName?: IconName | false
  titleClassName?: string
}

export function AiProviderCard({
  bodyClassName,
  children,
  className,
  copyClassName,
  description,
  descriptionClassName,
  headerClassName,
  iconName = 'Bot',
  status,
  title,
  titleClassName,
  ...props
}: AiProviderCardProps) {
  return (
    <Card className={cx('grid gap-3', className)} {...props}>
      <header className={cx('flex items-start justify-between gap-3', headerClassName)}>
        <div className={cx('grid min-w-0 gap-1', copyClassName)}>
          <div className={cx('flex min-w-0 items-center gap-2', titleClassName)}>
            {iconName ? <Icon name={iconName} size={17} aria-hidden="true" /> : null}
            {typeof title === 'string' ? <strong className="text-sm">{title}</strong> : title}
          </div>
          {typeof description === 'string' ? (
            <p className={cx('text-sm text-curator-text-muted', descriptionClassName)}>{description}</p>
          ) : description}
        </div>
        {status}
      </header>
      {children ? <div className={bodyClassName}>{children}</div> : null}
    </Card>
  )
}
