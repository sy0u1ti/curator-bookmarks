import { useEffect, useState, type CSSProperties, type HTMLAttributes } from 'react'
import { cx } from './utils'

const ROSE_CURVE = {
  a: 9.2,
  aBoost: 0.6,
  breathBase: 0.72,
  breathBoost: 0.28,
  detailScale: 0.78,
  durationMs: 1800,
  k: 5,
  pathSteps: 240,
  scale: 3.25,
  strokeDasharray: '1.8 4.6',
  strokeWidth: 4.2
} as const

const ROSE_CURVE_PATH = createRoseCurvePath()

export type RoseCurveLoaderProps = HTMLAttributes<HTMLSpanElement>

const roseCurveLoaderClass = 'block size-11 flex-none overflow-visible text-current [contain:layout_paint_style]'
const roseCurveSvgClass = 'block size-full overflow-visible'
const roseCurvePathClass = 'fill-none stroke-current opacity-[0.86]'

export function RoseCurveLoader({
  className,
  style,
  ...props
}: RoseCurveLoaderProps) {
  const reduceMotion = usePrefersReducedMotion()
  const pathStyle = reduceMotion ? {
    strokeDasharray: ROSE_CURVE.strokeDasharray
  } : ({
    animation: `rose-curve-loader-path ${ROSE_CURVE.durationMs}ms linear infinite`,
    strokeDasharray: ROSE_CURVE.strokeDasharray,
    strokeDashoffset: 0,
    willChange: 'stroke-dashoffset'
  } as CSSProperties)

  return (
    <span
      className={cx(roseCurveLoaderClass, className)}
      aria-hidden="true"
      style={style}
      {...props}
    >
      <svg
        className={roseCurveSvgClass}
        viewBox="0 0 100 100"
        focusable="false"
        fill="none"
      >
        <path
          className={roseCurvePathClass}
          d={ROSE_CURVE_PATH}
          pathLength={100}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={ROSE_CURVE.strokeWidth}
          style={pathStyle}
        />
      </svg>
    </span>
  )
}

function createRoseCurvePath(): string {
  const commands: string[] = []

  for (let index = 0; index <= ROSE_CURVE.pathSteps; index += 1) {
    const point = getRoseCurvePoint(index / ROSE_CURVE.pathSteps)
    commands.push(`${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
  }

  return commands.join(' ')
}

function getRoseCurvePoint(progress: number): { x: number; y: number } {
  const theta = progress * Math.PI * 2
  const a = ROSE_CURVE.a + ROSE_CURVE.detailScale * ROSE_CURVE.aBoost
  const breath = ROSE_CURVE.breathBase + ROSE_CURVE.detailScale * ROSE_CURVE.breathBoost
  const radius = a * breath * Math.cos(ROSE_CURVE.k * theta)

  return {
    x: 50 + Math.cos(theta) * radius * ROSE_CURVE.scale,
    y: 50 + Math.sin(theta) * radius * ROSE_CURVE.scale
  }
}

function usePrefersReducedMotion(): boolean {
  const [reduceMotion, setReduceMotion] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false
    }
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  })

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return
    }

    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handleChange = () => setReduceMotion(query.matches)

    handleChange()
    query.addEventListener('change', handleChange)
    return () => query.removeEventListener('change', handleChange)
  }, [])

  return reduceMotion
}
