import type { ComponentPropsWithRef, CSSProperties, ElementType } from 'react'

/**
 * React Bits GlassSurface, specialized to its Frosted rendering path.
 * See README.md and LICENSE.md in this directory for provenance and changes.
 * There is no client-side renderer negotiation: the first render is the material.
 */
type GlassSurfaceOptions<T extends ElementType> = {
  as?: T
  className?: string
  style?: CSSProperties
  width?: CSSProperties['width']
  height?: CSSProperties['height']
  borderRadius?: CSSProperties['borderRadius']
  blur?: number
  saturation?: number
  backgroundOpacity?: number
  refraction?: false
}

export type GlassSurfaceProps<T extends ElementType = 'div'> =
  GlassSurfaceOptions<T> & Omit<ComponentPropsWithRef<T>, keyof GlassSurfaceOptions<T>>

export function GlassSurface<T extends ElementType = 'div'>({
  as,
  className,
  style,
  width,
  height,
  borderRadius,
  blur,
  saturation,
  backgroundOpacity,
  refraction: _refraction,
  children,
  ...props
}: GlassSurfaceProps<T>) {
  const Component = as || 'div'
  const materialStyle = {
    ...(width !== undefined && { width }),
    ...(height !== undefined && { height }),
    ...(borderRadius !== undefined && { borderRadius }),
    ...(blur !== undefined && { '--glass-blur': `${blur}px` }),
    ...(saturation !== undefined && { '--glass-saturation': saturation }),
    ...(backgroundOpacity !== undefined && { '--glass-frost': backgroundOpacity }),
    ...style
  } as CSSProperties

  return (
    <Component
      {...props}
      className={['glass-surface glass-surface--fallback', className].filter(Boolean).join(' ')}
      style={materialStyle}
    >
      {children}
    </Component>
  )
}
