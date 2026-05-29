import type { SVGAttributes } from 'react'
import { cx } from './utils'

const DOTS = [
  ['00', 6, 6],
  ['01', 17, 6],
  ['02', 28, 6],
  ['03', 39, 6],
  ['04', 50, 6],
  ['10', 6, 17],
  ['11', 17, 17],
  ['12', 28, 17],
  ['13', 39, 17],
  ['14', 50, 17],
  ['20', 6, 28],
  ['21', 17, 28],
  ['22', 28, 28],
  ['23', 39, 28],
  ['24', 50, 28],
  ['30', 6, 39],
  ['31', 17, 39],
  ['32', 28, 39],
  ['33', 39, 39],
  ['34', 50, 39],
  ['40', 6, 50],
  ['41', 17, 50],
  ['42', 28, 50],
  ['43', 39, 50],
  ['44', 50, 50]
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

export function DotMatrixLoader({
  className,
  variant = 'spiral',
  ...props
}: DotMatrixLoaderProps) {
  const safeVariant = variant === 'bar' ? 'bar' : 'spiral'

  return (
    <svg
      className={cx('dot-matrix-loader', `dot-matrix-loader--${safeVariant}`, className)}
      viewBox="0 0 56 56"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {DOTS.map(([, x, y]) => (
        <circle className="dot-matrix-loader-bg" cx={x} cy={y} r="2.4" key={`bg-${x}-${y}`} />
      ))}
      {DOTS.filter(([key]) => safeVariant === 'spiral' || BAR_KEYS.has(key)).map(([key, x, y]) => (
        <circle
          className={`dot-matrix-loader-lit dot-matrix-loader-d${key}`}
          cx={x}
          cy={y}
          r="3.1"
          key={`lit-${key}`}
        />
      ))}
    </svg>
  )
}
