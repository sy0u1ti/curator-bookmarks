import type { ComponentPropsWithoutRef } from 'react'
import { iconMap, type IconName } from './icon-map'

export type { IconName }

export type IconProps = Omit<ComponentPropsWithoutRef<'svg'>, 'ref'> & {
  name: IconName
  size?: number
}

export function Icon({ name, size = 16, strokeWidth = 1.8, ...props }: IconProps) {
  const IconComponent = iconMap[name]
  return <IconComponent size={size} strokeWidth={strokeWidth} {...props} />
}
