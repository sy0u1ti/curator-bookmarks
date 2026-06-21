import type { CSSProperties, SVGAttributes } from 'react'
import { cx } from './utils'

const DOTS = [
  ['00', 6, 6, 2221, 0],
  ['01', 17, 6, 2317, 0],
  ['02', 28, 6, 869, 0],
  ['03', 39, 6, 966, 0],
  ['04', 50, 6, 1062, 0],
  ['10', 6, 17, 2124, 0],
  ['11', 17, 17, 772, 300],
  ['12', 28, 17, 97, 300],
  ['13', 39, 17, 193, 300],
  ['14', 50, 17, 1159, 0],
  ['20', 6, 28, 2028, 0],
  ['21', 17, 28, 676, 600],
  ['22', 28, 28, 0, 600],
  ['23', 39, 28, 290, 600],
  ['24', 50, 28, 1255, 0],
  ['30', 6, 39, 1931, 0],
  ['31', 17, 39, 579, 900],
  ['32', 28, 39, 483, 900],
  ['33', 39, 39, 386, 900],
  ['34', 50, 39, 1352, 0],
  ['40', 6, 50, 1834, 0],
  ['41', 17, 50, 1738, 1200],
  ['42', 28, 50, 1641, 1200],
  ['43', 39, 50, 1545, 1200],
  ['44', 50, 50, 1448, 0]
] as const

const BAR_KEYS = new Set([
  '01',
  '02',
  '03',
  '11',
  '12',
  '13',
  '21',
  '22',
  '23',
  '31',
  '32',
  '33',
  '41',
  '42',
  '43'
])

export type DotMatrixLoaderVariant = 'spiral' | 'bar'

export type DotMatrixLoaderProps = SVGAttributes<SVGSVGElement> & {
  variant?: DotMatrixLoaderVariant
}

const dotMatrixLoaderClass = 'block size-6 flex-none text-current'
const dotMatrixBgClass = 'fill-current opacity-[0.075]'
const dotMatrixLitBaseClass =
  'fill-current opacity-0 motion-reduce:animate-none motion-reduce:opacity-45'
const dotMatrixLitAnimationClass: Record<DotMatrixLoaderVariant, string> = {
  bar: 'animate-[dot-matrix-bar_1800ms_cubic-bezier(0.25,1,0.5,1)_infinite_both]',
  spiral: 'animate-[dot-matrix-spiral_2800ms_cubic-bezier(0.25,1,0.5,1)_infinite_both]'
}

export function DotMatrixLoader({
  className,
  variant = 'spiral',
  ...props
}: DotMatrixLoaderProps) {
  const safeVariant = variant === 'bar' ? 'bar' : 'spiral'

  return (
    <svg
      className={cx(dotMatrixLoaderClass, className)}
      viewBox="0 0 56 56"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {DOTS.map(([, x, y]) => (
        <circle className={dotMatrixBgClass} cx={x} cy={y} r="2.4" key={`bg-${x}-${y}`} />
      ))}
      {createLitDots(safeVariant)}
    </svg>
  )
}

function createLitDots(variant: DotMatrixLoaderVariant) {
  const dots = []

  for (const [key, x, y, spiralDelay, barDelay] of DOTS) {
    if (variant === 'bar' && !BAR_KEYS.has(key)) {
      continue
    }
    const animationDelay = variant === 'bar' ? barDelay : spiralDelay
    dots.push(
      <circle
        className={cx(dotMatrixLitBaseClass, dotMatrixLitAnimationClass[variant])}
        cx={x}
        cy={y}
        r="3.1"
        style={{ animationDelay: `${animationDelay}ms` } as CSSProperties}
        key={`lit-${key}`}
      />
    )
  }

  return dots
}
