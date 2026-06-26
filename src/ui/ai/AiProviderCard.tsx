import type { ReactNode } from 'react'
import { Icon, Surface, type IconName, type SurfaceProps } from '../index'
import { cx } from '../base/utils'

export interface AiProviderCardProps extends Omit<SurfaceProps, 'title'> {
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
  const titleLayoutClassName = iconName
    ? 'grid min-w-0 grid-cols-[18px_minmax(0,1fr)] items-start gap-2.5'
    : 'flex min-w-0 items-center gap-2'

  return (
    <Surface className={cx('grid gap-3 p-3', className)} variant="group" {...props}>
      <header className={cx('flex items-start justify-between gap-3', headerClassName)}>
        <div className={cx('grid min-w-0 gap-1', copyClassName)}>
          <div className={cx(titleLayoutClassName, titleClassName)}>
            {iconName ? (
              <span className="mt-[2px] inline-grid size-[18px] shrink-0 place-items-center text-ds-text-secondary">
                <Icon name={iconName} size={16} strokeWidth={2} aria-hidden="true" />
              </span>
            ) : null}
            {typeof title === 'string' ? <strong className="text-sm">{title}</strong> : title}
          </div>
          {typeof description === 'string' ? (
            <p className={cx('text-sm text-ds-text-secondary', descriptionClassName)}>{description}</p>
          ) : description}
        </div>
        {status}
      </header>
      {children ? <div className={bodyClassName}>{children}</div> : null}
    </Surface>
  )
}
