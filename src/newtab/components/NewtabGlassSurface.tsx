import type { ComponentPropsWithRef, ElementType } from 'react'
import { GlassSurface, type GlassSurfaceProps } from '../../vendor/react-bits/GlassSurface'
import { cx } from '../../ui/base/utils'

export type NewtabGlassTone = 'surface' | 'panel' | 'chip'
export type NewtabGlassSurfaceProps<T extends ElementType = 'div'> = GlassSurfaceProps<T> & {
  tone?: NewtabGlassTone
}

export function NewtabGlassSurface<T extends ElementType = 'div'>({
  tone = 'surface',
  className,
  ...props
}: NewtabGlassSurfaceProps<T>) {
  return (
    <GlassSurface<T>
      {...props as GlassSurfaceProps<T>}
      refraction={false}
      className={cx('newtab-glass', className)}
      data-glass-tone={tone}
      data-glass-renderer="react-bits"
    />
  )
}

export function NewtabFloatingSurface(props: ComponentPropsWithRef<'div'>) {
  return <NewtabGlassSurface {...props} tone="panel" />
}
