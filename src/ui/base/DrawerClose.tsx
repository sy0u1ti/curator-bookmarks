import { Drawer as BaseDrawer } from '@base-ui/react/drawer'
import type { ComponentPropsWithoutRef } from 'react'

type BaseDrawerCloseProps = ComponentPropsWithoutRef<typeof BaseDrawer.Close>

export function DrawerClose(props: BaseDrawerCloseProps) {
  return <BaseDrawer.Close {...props} />
}
