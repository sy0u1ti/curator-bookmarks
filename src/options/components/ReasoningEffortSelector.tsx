import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import { Popover } from '../../ui/base/Popover'
import { cx } from '../../ui/base/utils'
import { prefersReducedMotion } from '../../shared/motion'

export interface ReasoningEffortLevel {
  id: string
  label: string
}

export interface ReasoningEffortSelectorProps {
  levels: ReasoningEffortLevel[]
  value: string
  onChange: (id: string) => void
  disabled?: boolean
  direction?: 'up' | 'down'
  ariaLabel?: string
}

const TRACK_PAD_PX = 1
const THUMB_W_PX = 24
const SPRING_STIFFNESS = 920
const SPRING_DAMPING = 40
const VELOCITY_WINDOW_MS = 90
const VELOCITY_MAX = 8

const PANEL_CLASS = cx(
  'w-64 min-w-64 rounded-ds-lg border border-ds-border bg-ds-surface-2 p-4',
  '[filter:var(--ds-filter-popover)]'
)
const TRIGGER_CLASS = cx(
  'inline-flex min-h-8 w-max items-center rounded-ds-sm border border-ds-border bg-ds-surface-1 px-3 py-1 text-xs font-semibold text-ds-text-primary',
  'transition-[background-color,border-color,transform] duration-ds-fast ease-ds-standard',
  'hover:bg-ds-hover hover:border-ds-border-hover active:scale-[0.96]',
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-focus',
  'disabled:cursor-default disabled:opacity-55 disabled:hover:bg-ds-surface-1 disabled:active:scale-100',
  'motion-reduce:transition-colors motion-reduce:duration-[80ms] motion-reduce:active:scale-100'
)
const TITLE_CLASS = 'flex items-baseline gap-2 text-sm font-medium text-ds-text-secondary'
const LEVEL_STAGE_CLASS = 'relative inline-grid text-sm font-semibold text-ds-text-primary'
const AXIS_CLASS = 'mt-4 flex items-center justify-between text-xs font-medium text-ds-text-muted'
const TRACK_SHELL_CLASS = 'relative mt-2 h-11 cursor-ew-resize touch-none select-none [--effort-progress:0]'
const TRACK_CLASS = 'absolute inset-x-0 inset-y-2 overflow-hidden rounded-[10px] bg-[rgba(245,245,247,0.07)] shadow-[inset_0_1px_1px_rgba(0,0,0,0.18)]'
const TRACK_PROGRESS_CLASS = 'absolute inset-0 origin-left rounded-[9px] bg-[rgba(245,245,247,0.13)] [transform:scaleX(var(--effort-progress))]'
const TICKS_CLASS = 'pointer-events-none absolute inset-y-0 flex items-center justify-between'
const THUMB_CLASS = cx(
  'absolute top-1/2 h-[26px] w-6 -translate-y-1/2 rounded-ds-sm border border-[rgba(245,245,247,0.28)] bg-[#f5f5f7]',
  'shadow-[0_1px_2px_rgba(0,0,0,0.35),0_2px_6px_rgba(0,0,0,0.22)]',
  'outline-none focus-visible:shadow-[0_0_0_3px_var(--ds-accent-soft)]'
)

interface TrackMetrics {
  left: number
  usable: number
}

export function ReasoningEffortSelector({
  levels,
  value,
  onChange,
  disabled = false,
  direction = 'down',
  ariaLabel = '推理强度'
}: ReasoningEffortSelectorProps) {
  const panelId = useId()
  const maxIndex = Math.max(0, levels.length - 1)
  const valueIndex = Math.max(0, levels.findIndex((level) => level.id === value))
  const [open, setOpen] = useState(false)
  const [levelIndex, setLevelIndex] = useState(valueIndex)
  const trackShellRef = useRef<HTMLDivElement | null>(null)
  const thumbRef = useRef<HTMLDivElement | null>(null)
  const positionRef = useRef(valueIndex)
  const levelIndexRef = useRef(valueIndex)
  const draggingRef = useRef(false)
  const samplesRef = useRef<Array<{ time: number; value: number }>>([])
  const trackMetricsRef = useRef<TrackMetrics | null>(null)
  const springFrameRef = useRef(0)
  const currentLevel = levels[levelIndex] ?? levels[0]
  const widestLabel = useMemo(
    () => levels.reduce((widest, level) => (level.label.length > widest.length ? level.label : widest), ''),
    [levels]
  )

  const updateVisualPosition = useCallback((nextValue: number) => {
    const clamped = Math.min(maxIndex, Math.max(0, nextValue))
    positionRef.current = clamped
    const nextLevelIndex = Math.min(maxIndex, Math.max(0, Math.round(clamped)))
    if (nextLevelIndex !== levelIndexRef.current) {
      levelIndexRef.current = nextLevelIndex
      setLevelIndex(nextLevelIndex)
    }
    const progress = maxIndex > 0 ? clamped / maxIndex : 0
    trackShellRef.current?.style.setProperty('--effort-progress', String(progress))
  }, [maxIndex])

  const commitLevel = useCallback((index: number) => {
    const level = levels[Math.min(maxIndex, Math.max(0, index))]
    if (level && level.id !== value) {
      onChange(level.id)
    }
  }, [levels, maxIndex, onChange, value])

  useEffect(() => {
    if (draggingRef.current || springFrameRef.current) {
      return
    }
    positionRef.current = valueIndex
    levelIndexRef.current = valueIndex
    setLevelIndex(valueIndex)
    updateVisualPosition(valueIndex)
  }, [updateVisualPosition, valueIndex])

  useLayoutEffect(() => {
    if (open) {
      updateVisualPosition(positionRef.current)
    }
  }, [open, updateVisualPosition])

  useEffect(() => () => {
    window.cancelAnimationFrame(springFrameRef.current)
  }, [])

  const applyMagnet = useCallback((rawValue: number) => {
    const nearest = Math.round(rawValue)
    const delta = rawValue - nearest
    const distance = Math.abs(delta)
    if (distance < 0.001 || distance > 0.5) {
      return rawValue
    }
    const t = 1 - distance / 0.5
    const strength = 0.68 + 0.42 * t
    return rawValue - delta * strength * t * t
  }, [])

  const readTrackMetrics = useCallback((): TrackMetrics | null => {
    const shell = trackShellRef.current
    if (!shell) {
      return null
    }
    const rect = shell.getBoundingClientRect()
    return {
      left: rect.left,
      usable: Math.max(0, rect.width - TRACK_PAD_PX * 2 - THUMB_W_PX)
    }
  }, [])

  const valueFromPointer = useCallback((clientX: number) => {
    const metrics = trackMetricsRef.current ?? readTrackMetrics()
    if (!metrics || metrics.usable <= 0 || maxIndex <= 0) {
      return positionRef.current
    }
    const ratio = (clientX - metrics.left - TRACK_PAD_PX - THUMB_W_PX / 2) / metrics.usable
    return Math.min(maxIndex, Math.max(0, ratio * maxIndex))
  }, [maxIndex, readTrackMetrics])

  const startSpring = useCallback((initialVelocity: number) => {
    const target = Math.min(maxIndex, Math.max(0, Math.round(positionRef.current)))
    const settle = () => {
      updateVisualPosition(target)
      springFrameRef.current = 0
      commitLevel(target)
    }
    if (prefersReducedMotion() || Math.abs(positionRef.current - target) < 0.001) {
      settle()
      return
    }

    let springPosition = positionRef.current
    let velocity = Math.max(-VELOCITY_MAX, Math.min(VELOCITY_MAX, initialVelocity))
    let previousTime = performance.now()
    const step = (time: number) => {
      const delta = Math.min((time - previousTime) / 1000, 0.032)
      previousTime = time
      const acceleration = -SPRING_STIFFNESS * (springPosition - target) - SPRING_DAMPING * velocity
      velocity += acceleration * delta
      springPosition = Math.min(maxIndex, Math.max(0, springPosition + velocity * delta))
      updateVisualPosition(springPosition)
      if (Math.abs(springPosition - target) < 0.001 && Math.abs(velocity) < 0.01) {
        settle()
        return
      }
      springFrameRef.current = window.requestAnimationFrame(step)
    }
    window.cancelAnimationFrame(springFrameRef.current)
    springFrameRef.current = window.requestAnimationFrame(step)
  }, [commitLevel, maxIndex, updateVisualPosition])

  const onTrackPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || event.button !== 0) {
      return
    }
    event.preventDefault()
    window.cancelAnimationFrame(springFrameRef.current)
    springFrameRef.current = 0
    draggingRef.current = true
    samplesRef.current = []
    trackMetricsRef.current = readTrackMetrics()
    event.currentTarget.setPointerCapture(event.pointerId)
    const magnetValue = applyMagnet(valueFromPointer(event.clientX))
    samplesRef.current.push({ time: performance.now(), value: magnetValue })
    updateVisualPosition(magnetValue)
    thumbRef.current?.focus({ preventScroll: true })
  }, [applyMagnet, disabled, readTrackMetrics, updateVisualPosition, valueFromPointer])

  const onTrackPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) {
      return
    }
    const magnetValue = applyMagnet(valueFromPointer(event.clientX))
    const now = performance.now()
    samplesRef.current.push({ time: now, value: magnetValue })
    samplesRef.current = samplesRef.current
      .filter((sample) => now - sample.time <= VELOCITY_WINDOW_MS)
      .slice(-5)
    updateVisualPosition(magnetValue)
  }, [applyMagnet, updateVisualPosition, valueFromPointer])

  const onTrackPointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) {
      return
    }
    draggingRef.current = false
    trackMetricsRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    const samples = samplesRef.current
    let velocity = 0
    if (samples.length >= 2) {
      const first = samples[0]
      const last = samples[samples.length - 1]
      const elapsed = (last.time - first.time) / 1000
      if (elapsed > 0) {
        velocity = (last.value - first.value) / elapsed
      }
    }
    startSpring(velocity)
  }, [startSpring])

  const onThumbKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) {
      return
    }
    const currentIndex = levelIndexRef.current
    const nextIndexByKey: Record<string, number> = {
      ArrowRight: currentIndex + 1,
      ArrowUp: currentIndex + 1,
      PageUp: currentIndex + 1,
      ArrowLeft: currentIndex - 1,
      ArrowDown: currentIndex - 1,
      PageDown: currentIndex - 1,
      Home: 0,
      End: maxIndex
    }
    const nextIndex = nextIndexByKey[event.key]
    if (nextIndex === undefined) {
      return
    }
    event.preventDefault()
    const clampedIndex = Math.min(maxIndex, Math.max(0, nextIndex))
    updateVisualPosition(clampedIndex)
    commitLevel(clampedIndex)
  }, [commitLevel, disabled, maxIndex, updateVisualPosition])

  const initialProgress = maxIndex > 0 ? valueIndex / maxIndex : 0
  const trigger = (
    <button
      type="button"
      className={TRIGGER_CLASS}
      aria-label={`${ariaLabel}：${currentLevel?.label ?? ''}`}
      disabled={disabled}
    >
      <span className="tabular-nums">{currentLevel?.label ?? '—'}</span>
    </button>
  )

  return (
    <Popover
      id={panelId}
      align="end"
      side={direction === 'up' ? 'top' : 'bottom'}
      sideOffset={8}
      showArrow={false}
      open={open}
      onOpenChange={setOpen}
      popupClassName={PANEL_CLASS}
      trigger={trigger}
      triggerNativeButton
    >
      <div className={TITLE_CLASS}>
        <span>{ariaLabel}</span>
        <output className={LEVEL_STAGE_CLASS} aria-live="polite" aria-atomic="true">
          <span className="invisible col-start-1 row-start-1 whitespace-nowrap" aria-hidden="true">{widestLabel}</span>
          <span className="col-start-1 row-start-1 whitespace-nowrap">{currentLevel?.label ?? ''}</span>
        </output>
      </div>
      <div className={AXIS_CLASS} aria-hidden="true">
        <span>更快</span>
        <span>更深入</span>
      </div>
      <div
        className={TRACK_SHELL_CLASS}
        ref={trackShellRef}
        onPointerDown={onTrackPointerDown}
        onPointerMove={onTrackPointerMove}
        onPointerUp={onTrackPointerUp}
        onPointerCancel={onTrackPointerUp}
        style={{ '--effort-progress': String(initialProgress) } as React.CSSProperties}
      >
        <div className={TRACK_CLASS} aria-hidden="true">
          <div className={TRACK_PROGRESS_CLASS} />
          <div
            className={TICKS_CLASS}
            style={{ left: TRACK_PAD_PX + THUMB_W_PX / 2 - 2, right: TRACK_PAD_PX + THUMB_W_PX / 2 - 2 }}
          >
            {levels.map((level, index) => (
              <span
                key={level.id}
                className={cx(
                  'h-1 w-1 rounded-full',
                  index === maxIndex ? 'bg-ds-accent opacity-100' : 'bg-[rgba(245,245,247,0.4)] opacity-80'
                )}
              />
            ))}
          </div>
        </div>
        <div
          className={THUMB_CLASS}
          ref={thumbRef}
          role="slider"
          tabIndex={disabled ? -1 : 0}
          aria-label={ariaLabel}
          aria-valuemin={0}
          aria-valuemax={maxIndex}
          aria-valuenow={levelIndex}
          aria-valuetext={currentLevel?.label ?? ''}
          aria-orientation="horizontal"
          onKeyDown={onThumbKeyDown}
          style={{ left: `calc(${TRACK_PAD_PX}px + (100% - ${TRACK_PAD_PX * 2}px - ${THUMB_W_PX}px) * var(--effort-progress))` }}
        />
      </div>
    </Popover>
  )
}
