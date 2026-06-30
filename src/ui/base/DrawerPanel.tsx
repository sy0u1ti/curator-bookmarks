import { Drawer as BaseDrawer } from '@base-ui/react/drawer'
import type { ComponentPropsWithoutRef, Ref } from 'react'
import { MotionPanel } from '../motion/MotionPanel'
import { cx } from './utils'

type BaseDrawerPopupProps = ComponentPropsWithoutRef<typeof BaseDrawer.Popup>

export interface DrawerPanelProps extends Omit<BaseDrawerPopupProps, 'className' | 'render'> {
  className?: string
  motionClassName?: string
  motionVariant?: ComponentPropsWithoutRef<typeof MotionPanel>['variant']
  ref?: Ref<HTMLDivElement>
  unanimated?: boolean
}

export function DrawerPanel({
  className,
  motionClassName,
  motionVariant = 'drawer',
  ref,
  unanimated = false,
  children,
  ...popupProps
}: DrawerPanelProps) {
  const content = <BaseDrawer.Content className="contents">{children}</BaseDrawer.Content>

  if (unanimated) {
    return (
      <BaseDrawer.Popup ref={ref} className={className} {...popupProps}>
        {content}
      </BaseDrawer.Popup>
    )
  }

  return (
    <BaseDrawer.Popup
      ref={ref}
      render={<MotionPanel variant={motionVariant} className={cx(className, motionClassName)} />}
      {...popupProps}
    >
      {content}
    </BaseDrawer.Popup>
  )
}
