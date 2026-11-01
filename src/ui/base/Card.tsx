import type { HTMLAttributes } from 'react'
import { cx } from './utils'
import './surfaces.css'

export type CardProps = HTMLAttributes<HTMLElement>

export function Card({ className, ...props }: CardProps) {
  return (
    <article
      className={cx(
        'curator-card border-0 bg-ds-surface-1 text-ds-text-primary transition-[background-color,border-color,box-shadow] duration-ds-fast ease-ds-standard motion-reduce:transition-none',
        className
      )}
      {...props}
    />
  )
}
