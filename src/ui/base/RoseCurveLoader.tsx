import { useEffect, useState, type CSSProperties, type HTMLAttributes } from 'react'
import { cx } from './utils'

const ROSE_CURVE = {
  a: 9.2,
  aBoost: 0.6,
  breathBase: 0.72,
  breathBoost: 0.28,
  detailScale: 0.78,
  durationMs: 5400,
  k: 5,
  particleCount: 78,
  pathSteps: 160,
  pulseDurationMs: 4600,
  rotationDurationMs: 28000,
  scale: 3.25,
  strokeWidth: 4.5,
  trailSpan: 0.32
} as const

const ROSE_CURVE_PATH = createRoseCurvePath()
const ROSE_CURVE_PARTICLES = createRoseCurveParticles()

export type RoseCurveLoaderProps = HTMLAttributes<HTMLSpanElement>

const roseCurveLoaderClass = 'block size-11 flex-none overflow-visible text-current [contain:layout_paint_style]'
const roseCurveSvgClass = 'block size-full overflow-visible'
const roseCurveMotionClass = '[transform-box:view-box] [transform-origin:50%_50%]'
const roseCurvePathClass = 'fill-none stroke-current'
const roseCurveTrackClass = 'opacity-[0.12]'
const roseCurveParticleClass = 'fill-current [transform-box:view-box] [transform-origin:0_0]'

export function RoseCurveLoader({
  className,
  style,
  ...props
}: RoseCurveLoaderProps) {
  const reduceMotion = usePrefersReducedMotion()
  const rotateStyle = reduceMotion ? undefined : ({
    animation: `rose-curve-loader-rotate ${ROSE_CURVE.rotationDurationMs}ms linear infinite`,
    transformBox: 'view-box',
    transformOrigin: '50% 50%',
    willChange: 'transform'
  } as CSSProperties)
  const pulseStyle = reduceMotion ? undefined : ({
    animation: `rose-curve-loader-pulse ${ROSE_CURVE.pulseDurationMs}ms ease-in-out infinite`,
    transformBox: 'view-box',
    transformOrigin: '50% 50%',
    willChange: 'opacity, transform'
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
        <g className={roseCurveMotionClass} style={rotateStyle}>
          <g className={roseCurveMotionClass} style={pulseStyle}>
            <path
              className={cx(roseCurvePathClass, roseCurveTrackClass)}
              d={ROSE_CURVE_PATH}
              pathLength={100}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={ROSE_CURVE.strokeWidth}
            />
            {ROSE_CURVE_PARTICLES.map((particle) => (
              <circle
                key={particle.id}
                className={roseCurveParticleClass}
                r={particle.radius}
                style={createParticleStyle(particle, reduceMotion)}
              />
            ))}
          </g>
        </g>
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

function createRoseCurveParticles(): Array<{
  delayMs: number
  id: string
  opacity: number
  radius: number
  transform: string
}> {
  return Array.from({ length: ROSE_CURVE.particleCount }, (_, index) => {
    const tailOffset = index / (ROSE_CURVE.particleCount - 1)
    const fade = Math.pow(1 - tailOffset, 0.56)
    const progress = normalizeProgress(-tailOffset * ROSE_CURVE.trailSpan)
    const point = getRoseCurvePoint(progress)

    return {
      delayMs: -progress * ROSE_CURVE.durationMs,
      id: `rose-curve-particle-${index}`,
      opacity: 0.04 + fade * 0.96,
      radius: 0.9 + fade * 2.7,
      transform: createParticleTransform(point.x, point.y)
    }
  })
}

function createParticleStyle(
  particle: (typeof ROSE_CURVE_PARTICLES)[number],
  reduceMotion: boolean
): CSSProperties {
  return reduceMotion ? {
    opacity: particle.opacity,
    transform: particle.transform
  } : {
    animation: `rose-curve-loader-particle ${ROSE_CURVE.durationMs}ms linear infinite`,
    animationDelay: `${particle.delayMs}ms`,
    opacity: particle.opacity,
    transform: particle.transform,
    willChange: 'transform'
  }
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

function createParticleTransform(x: number, y: number): string {
  return `translate(${x.toFixed(3)}%, ${y.toFixed(3)}%) translate(-50%, -50%)`
}

function normalizeProgress(progress: number): number {
  return ((progress % 1) + 1) % 1
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
