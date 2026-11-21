import { ZapIcon } from 'lucide-react'
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import { getMotionDurationMs, getMotionEasing, shouldSkipMotion } from '../../shared/motion'
import { advanceSpring, springSettled } from '../../shared/motion-spring'
import { Button } from '../../ui/base/Button'
import { Popover } from '../../ui/base/Popover'
import { cx } from '../../ui/base/utils'
import { advanceSliderWeight, createSliderWeight, type SliderWeightState } from '../../ui/base/slider-weight'
import { OPTIONS_REDUCED_MOTION_SURFACE_CLASS } from './options-motion-classes.js'

/**
 * React adaptation of zanwei/chatgpt-model-selector (MIT). The interaction
 * model is preserved while tiers remain dynamic so each provider can expose
 * only the reasoning levels its current model actually supports.
 */

export interface ReasoningEffortLevel {
  id: string
  label: string
  hint?: string
}

export interface ReasoningEffortSelectorProps {
  levels: ReasoningEffortLevel[]
  value: string
  onChange: (id: string) => void
  disabled?: boolean
  direction?: 'up' | 'down'
  ariaLabel?: string
  modelName?: string
}

interface TrackMetrics {
  rect: DOMRect
  width: number
  span: number
}

const FALLBACK_LEVEL: ReasoningEffortLevel = { id: 'default', label: '—' }
const FALLBACK_LEVELS: ReasoningEffortLevel[] = [FALLBACK_LEVEL]
const KNOB_DIAMETER_PX = 34
const TRACK_HEIGHT_PX = 28
const TRACK_CAP_INSET_PX = (KNOB_DIAMETER_PX - TRACK_HEIGHT_PX) / 2

const PANEL_CLASS = cx(
  'reasoning-effort-popover !block !w-[var(--anchor-width)] !min-w-0 !max-w-[calc(100vw-24px)] !overflow-hidden !rounded-ds-lg !border-ds-border !bg-ds-surface-2 !p-0',
  '[filter:var(--ds-filter-popover)]',
  OPTIONS_REDUCED_MOTION_SURFACE_CLASS
)

const TRIGGER_CLASS = cx(
  'reasoning-effort-trigger group relative inline-flex min-h-[42px] w-full min-w-0 touch-manipulation select-none items-center rounded-ds-sm border border-ds-border bg-ds-surface-2 px-3.5 text-sm text-ds-text-primary outline-none',
  'transition-[background-color,border-color,transform,scale] duration-ds-fast ease-ds-standard',
  'hover:not-disabled:border-ds-border-hover hover:not-disabled:bg-ds-surface-3 active:not-disabled:scale-[var(--ds-press-scale)]',
  'focus-visible:border-ds-focus focus-visible:bg-ds-surface-3 focus-visible:shadow-ds-focus',
  'disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-colors motion-reduce:duration-[80ms] motion-reduce:active:not-disabled:scale-100'
)

const HEADER_LAYER_CLASS = cx(
  'absolute inset-0 flex items-center opacity-0 translate-y-[3px] pointer-events-none',
  'transition-[opacity,transform] duration-[var(--text-swap-dur)] ease-[var(--text-swap-ease)]',
  'data-[active=true]:translate-y-0 data-[active=true]:opacity-100',
  'motion-reduce:translate-y-0 motion-reduce:transition-opacity motion-reduce:duration-[80ms]'
)

const SLIDER_CLASS = cx(
  'reasoning-effort-slider relative h-[42px] touch-none select-none cursor-grab outline-none',
  'data-[dragging=true]:cursor-grabbing',
  'focus-visible:after:pointer-events-none focus-visible:after:absolute focus-visible:after:inset-[-4px] focus-visible:after:rounded-full focus-visible:after:border-2 focus-visible:after:border-ds-focus'
)

const KNOB_CLASS = cx(
  'reasoning-effort-knob absolute left-0 top-1/2 z-20 size-[34px] -translate-y-1/2 rounded-full border border-[rgba(255,255,255,0.18)] bg-ds-text-primary',
  'shadow-[0_1px_2px_rgba(6,9,14,0.35),0_2px_6px_rgba(6,9,14,0.24)]',
  'before:absolute before:inset-0 before:rounded-full before:shadow-[0_2px_3px_rgba(6,9,14,0.28),0_4px_10px_rgba(6,9,14,0.3)] before:opacity-0 before:transition-opacity before:duration-ds-fast',
  'data-[dragging=true]:[scale:var(--slider-grip-press-scale)] data-[dragging=true]:before:opacity-100',
  'transition-[scale] duration-[var(--slider-grip-settle)] ease-ds-standard motion-reduce:transition-none'
)

export function ReasoningEffortSelector({
  levels,
  value,
  onChange,
  disabled = false,
  direction = 'down',
  ariaLabel = '推理强度',
  modelName = '当前模型'
}: ReasoningEffortSelectorProps) {
  const panelId = useId()
  const sliderDescriptionId = useId()
  const resolvedLevels = levels.length ? levels : FALLBACK_LEVELS
  const maxIndex = Math.max(0, resolvedLevels.length - 1)
  const valueIndex = Math.max(0, resolvedLevels.findIndex((level) => level.id === value))
  const [open, setOpen] = useState(false)
  const [previewIndex, setPreviewIndex] = useState(valueIndex)
  const [dragging, setDragging] = useState(false)
  const [trackElement, setTrackElement] = useState<HTMLDivElement | null>(null)

  const tierLabelRef = useRef<HTMLSpanElement | null>(null)
  const sliderRef = useRef<HTMLDivElement | null>(null)
  const trackRef = useRef<HTMLDivElement | null>(null)
  const handleTrackRef = useCallback((node: HTMLDivElement | null) => {
    trackRef.current = node
    setTrackElement(node)
  }, [])
  const fillRef = useRef<HTMLDivElement | null>(null)
  const knobRef = useRef<HTMLDivElement | null>(null)
  const previewIndexRef = useRef(valueIndex)
  const positionRef = useRef(maxIndex > 0 ? valueIndex / maxIndex : 0)
  const draggingRef = useRef(false)
  const activePointerRef = useRef<number | null>(null)
  const trackMetricsRef = useRef<TrackMetrics | null>(null)
  const dragWeightRef = useRef<SliderWeightState | null>(null)
  const dragSampleRef = useRef<{ progress: number; time: number; velocity: number } | null>(null)
  const releaseVelocityRef = useRef(0)
  const grabOffsetRef = useRef(0)
  const springFrameRef = useRef(0)
  const previousAnimatedIndexRef = useRef(valueIndex)

  const safePreviewIndex = Math.min(maxIndex, Math.max(0, previewIndex))
  const currentLevel = resolvedLevels[safePreviewIndex] ?? resolvedLevels[0]
  const isHighestLevel = maxIndex > 0 && safePreviewIndex === maxIndex
  const widestLabel = useMemo(
    () => resolvedLevels.reduce(
      (widest, level) => (level.label.length > widest.length ? level.label : widest),
      ''
    ),
    [resolvedLevels]
  )
  const speedLabel = getSpeedLabel(currentLevel?.id, safePreviewIndex, maxIndex)

  const readTrackMetrics = useCallback((): TrackMetrics | null => {
    const track = trackRef.current
    if (!track) {
      return null
    }
    const width = track.clientWidth
    if (width <= 0) {
      return null
    }
    const rect = track.getBoundingClientRect()
    return {
      rect,
      width,
      span: Math.max(0, width - KNOB_DIAMETER_PX)
    }
  }, [])

  const updatePreviewIndex = useCallback((index: number) => {
    const nextIndex = Math.min(maxIndex, Math.max(0, index))
    if (previewIndexRef.current === nextIndex) {
      return
    }
    previewIndexRef.current = nextIndex
    setPreviewIndex(nextIndex)
  }, [maxIndex])

  const updateVisualProgress = useCallback((nextProgress: number, updatePreview = true) => {
    const progress = Math.min(1, Math.max(0, nextProgress))
    positionRef.current = progress
    const metrics = trackMetricsRef.current ?? readTrackMetrics()
    if (metrics && metrics.width > 0) {
      trackMetricsRef.current = metrics
      const knobOffset = progress * metrics.span
      if (knobRef.current) {
        knobRef.current.style.translate = `${knobOffset}px -50%`
      }
      if (fillRef.current) {
        const fillRight = Math.min(metrics.width, knobOffset + KNOB_DIAMETER_PX - TRACK_CAP_INSET_PX)
        const clippedLeft = Math.min(fillRight, Math.max(0, TRACK_CAP_INSET_PX - knobOffset))
        const clippedRight = Math.max(0, metrics.width - fillRight)
        fillRef.current.style.clipPath = `inset(0 ${clippedRight}px 0 ${clippedLeft}px round 9999px)`
      }
    }
    sliderRef.current?.style.setProperty('--reasoning-progress', String(progress))
    if (updatePreview) {
      updatePreviewIndex(maxIndex > 0 ? Math.round(progress * maxIndex) : 0)
    }
  }, [maxIndex, readTrackMetrics, updatePreviewIndex])

  const cancelSpring = useCallback(() => {
    window.cancelAnimationFrame(springFrameRef.current)
    springFrameRef.current = 0
  }, [])

  const commitLevel = useCallback((index: number) => {
    const level = resolvedLevels[Math.min(maxIndex, Math.max(0, index))]
    if (level && level.id !== value) {
      onChange(level.id)
    }
  }, [maxIndex, onChange, resolvedLevels, value])

  const startSpring = useCallback((targetIndex: number) => {
    cancelSpring()
    const targetProgress = maxIndex > 0 ? targetIndex / maxIndex : 0
    const rawVelocity = releaseVelocityRef.current
    releaseVelocityRef.current = 0
    const settle = () => {
      updateVisualProgress(targetProgress)
      springFrameRef.current = 0
    }
    if (shouldSkipMotion() || Math.abs(positionRef.current - targetProgress) < 0.001) {
      settle()
      return
    }

    const responseSeconds = getMotionDurationMs('--slider-grip-settle', 150) / 1000
    const displacement = targetProgress - positionRef.current
    const maxMonotonicVelocity = Math.min(
      12,
      0.75 * (2 * Math.PI / Math.max(0.05, responseSeconds)) * Math.abs(displacement)
    )
    const initialVelocity = rawVelocity * displacement > 0
      ? Math.sign(displacement) * Math.min(Math.abs(rawVelocity), maxMonotonicVelocity)
      : 0
    const axis = {
      position: positionRef.current,
      velocity: initialVelocity
    }
    const spring = { response: responseSeconds, damping: 1 }
    let previousTime = performance.now()
    const step = (time: number) => {
      if (shouldSkipMotion() || document.hidden) { settle(); return }
      const delta = (time - previousTime) / 1000
      previousTime = time
      advanceSpring(axis, targetProgress, delta, spring)
      updateVisualProgress(axis.position, false)
      if (springSettled(axis, targetProgress, 0.001, 0.01)) {
        settle()
        return
      }
      springFrameRef.current = window.requestAnimationFrame(step)
    }
    springFrameRef.current = window.requestAnimationFrame(step)
  }, [cancelSpring, maxIndex, updateVisualProgress])

  const progressFromPointer = useCallback((clientX: number) => {
    const metrics = trackMetricsRef.current ?? readTrackMetrics()
    if (!metrics || metrics.width <= KNOB_DIAMETER_PX || metrics.rect.width <= 0) {
      return positionRef.current
    }
    trackMetricsRef.current = metrics
    const fraction = (clientX - grabOffsetRef.current - metrics.rect.left) / metrics.rect.width
    return Math.min(1, Math.max(0, (fraction * metrics.width - KNOB_DIAMETER_PX / 2) / metrics.span))
  }, [readTrackMetrics])

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || event.button !== 0 || activePointerRef.current !== null) {
      return
    }
    event.preventDefault()
    cancelSpring()
    activePointerRef.current = event.pointerId
    draggingRef.current = true
    setDragging(true)
    trackMetricsRef.current = readTrackMetrics()
    const knob = knobRef.current
    const knobBounds = knob?.getBoundingClientRect()
    grabOffsetRef.current = knobBounds && event.target instanceof Node && knob.contains(event.target)
      ? event.clientX - (knobBounds.left + knobBounds.width / 2)
      : 0
    event.currentTarget.setPointerCapture(event.pointerId)
    event.currentTarget.focus({ preventScroll: true })
    const progress = progressFromPointer(event.clientX)
    dragWeightRef.current = createSliderWeight(progress)
    dragSampleRef.current = { progress, time: performance.now(), velocity: 0 }
    releaseVelocityRef.current = 0
    updateVisualProgress(progress)
  }, [cancelSpring, disabled, progressFromPointer, readTrackMetrics, updateVisualProgress])

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current || activePointerRef.current !== event.pointerId) {
      return
    }
    const progress = progressFromPointer(event.clientX)
    const metrics = trackMetricsRef.current
    const weighted = advanceSliderWeight(dragWeightRef.current ?? createSliderWeight(positionRef.current), progress, {
      min: 0, max: 1, step: 0.0001,
      trackPixels: metrics?.span || 1,
      detents: maxIndex > 0 ? resolvedLevels.map((_, index) => index / maxIndex) : []
    })
    dragWeightRef.current = weighted
    const now = performance.now()
    const sample = dragSampleRef.current
    if (sample) {
      const elapsedSeconds = (now - sample.time) / 1000
      if (elapsedSeconds > 0.004) {
        const instantVelocity = (weighted.value - sample.progress) / elapsedSeconds
        const smoothedVelocity = sample.velocity * 0.35 + instantVelocity * 0.65
        const clampedVelocity = Math.max(-12, Math.min(12, smoothedVelocity))
        dragSampleRef.current = { progress: weighted.value, time: now, velocity: clampedVelocity }
      }
    } else {
      dragSampleRef.current = { progress: weighted.value, time: now, velocity: 0 }
    }
    updateVisualProgress(weighted.value)
  }, [maxIndex, progressFromPointer, resolvedLevels, updateVisualProgress])

  const handlePointerRelease = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current || activePointerRef.current !== event.pointerId) {
      return
    }
    draggingRef.current = false
    activePointerRef.current = null
    setDragging(false)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    dragWeightRef.current = null
    const sample = dragSampleRef.current
    dragSampleRef.current = null
    releaseVelocityRef.current = sample && performance.now() - sample.time < 80
      ? sample.velocity
      : 0
    const targetIndex = maxIndex > 0 ? Math.round(positionRef.current * maxIndex) : 0
    // 语义状态在指针释放时立即提交；弹簧只负责随后跟手的视觉收尾。
    // 这样用户马上点击“保存/测试连接”时，请求不会仍读取上一个强度。
    commitLevel(targetIndex)
    updatePreviewIndex(targetIndex)
    startSpring(targetIndex)
  }, [commitLevel, maxIndex, startSpring, updatePreviewIndex])

  const cancelDrag = useCallback(() => {
    const pointerId = activePointerRef.current
    activePointerRef.current = null
    draggingRef.current = false
    dragWeightRef.current = null
    dragSampleRef.current = null
    releaseVelocityRef.current = 0
    setDragging(false)
    cancelSpring()
    if (pointerId !== null && sliderRef.current?.hasPointerCapture(pointerId)) {
      sliderRef.current.releasePointerCapture(pointerId)
    }
    updateVisualProgress(maxIndex > 0 ? valueIndex / maxIndex : 0)
  }, [cancelSpring, maxIndex, updateVisualProgress, valueIndex])

  const handleSliderKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) {
      return
    }
    const currentIndex = previewIndexRef.current
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
    cancelSpring()
    const clampedIndex = Math.min(maxIndex, Math.max(0, nextIndex))
    updateVisualProgress(maxIndex > 0 ? clampedIndex / maxIndex : 0)
    commitLevel(clampedIndex)
  }, [cancelSpring, commitLevel, disabled, maxIndex, updateVisualProgress])

  useLayoutEffect(() => {
    trackMetricsRef.current = readTrackMetrics()
    updateVisualProgress(positionRef.current, false)
  }, [open, trackElement, readTrackMetrics, updateVisualProgress])

  useEffect(() => {
    if (draggingRef.current || springFrameRef.current) {
      return
    }
    const nextIndex = Math.min(maxIndex, Math.max(0, valueIndex))
    previewIndexRef.current = nextIndex
    setPreviewIndex(nextIndex)
    updateVisualProgress(maxIndex > 0 ? nextIndex / maxIndex : 0, false)
  }, [maxIndex, updateVisualProgress, valueIndex])

  useLayoutEffect(() => {
    if (previousAnimatedIndexRef.current === safePreviewIndex) {
      return
    }
    previousAnimatedIndexRef.current = safePreviewIndex
    const label = tierLabelRef.current
    if (!label || shouldSkipMotion() || draggingRef.current || !label.animate) {
      return
    }
    label.getAnimations().forEach((animation) => animation.cancel())
    label.animate(
      [
        { opacity: 0.72 },
        { opacity: 1 }
      ],
      {
        // 和 newtab-controller 的拖拽落位一样从 token 读，字面量只当 fallback：
        // 档位标签是原地换值，走 text swap 的时长。
        duration: getMotionDurationMs('--text-swap-dur', 130),
        easing: getMotionEasing('--text-swap-ease', 'cubic-bezier(0.2, 0.8, 0.2, 1)')
      }
    )
  }, [safePreviewIndex])

  useEffect(() => {
    if (!open) {
      return undefined
    }
    const focusFrame = window.requestAnimationFrame(() => {
      trackMetricsRef.current = readTrackMetrics()
      updateVisualProgress(positionRef.current, false)
      sliderRef.current?.focus({ preventScroll: true })
    })
    return () => window.cancelAnimationFrame(focusFrame)
  }, [open, readTrackMetrics, updateVisualProgress])

  useEffect(() => {
    if (!trackElement || typeof ResizeObserver === 'undefined') {
      return undefined
    }
    const observer = new ResizeObserver(() => {
      trackMetricsRef.current = readTrackMetrics()
      updateVisualProgress(positionRef.current, false)
    })
    observer.observe(trackElement)
    return () => observer.disconnect()
  }, [trackElement, readTrackMetrics, updateVisualProgress])

  useEffect(() => () => {
    cancelSpring()
  }, [cancelSpring])

  useEffect(() => {
    if (disabled) cancelDrag()
    const handleBlur = () => { if (draggingRef.current) cancelDrag() }
    window.addEventListener('blur', handleBlur)
    return () => window.removeEventListener('blur', handleBlur)
  }, [cancelDrag, disabled])

  const handleOpenChange = (nextOpen: boolean) => {
    if (disabled && nextOpen) {
      return
    }
    if (!nextOpen) {
      cancelDrag()
    }
    setOpen(nextOpen)
  }

  const trigger = (
    <Button
      unstyled
      type="button"
      className={TRIGGER_CLASS}
      aria-label={`${ariaLabel}：${currentLevel?.label ?? '—'}；模型：${modelName}`}
      disabled={disabled}
    >
      <ZapIcon
        className={cx(
          'mr-2 size-3.5 flex-none fill-current',
          isHighestLevel ? 'text-ds-warning' : 'text-ds-text-primary'
        )}
        aria-hidden="true"
      />
      <span className="inline-grid min-w-0 flex-1 font-semibold">
        <span className="invisible col-start-1 row-start-1 whitespace-nowrap text-left" aria-hidden="true">{widestLabel}</span>
        <span
          className={cx(
            'col-start-1 row-start-1 truncate text-left',
            isHighestLevel ? 'text-ds-warning-text' : ''
          )}
          ref={tierLabelRef}
        >
          {currentLevel?.label ?? '—'}
        </span>
      </span>
      <span className="ml-2 flex-none whitespace-nowrap text-xs font-normal text-ds-text-secondary">
        {speedLabel}
      </span>
    </Button>
  )

  return (
    <Popover
      id={panelId}
      align="start"
      side={direction === 'up' ? 'top' : 'bottom'}
      sideOffset={8}
      showArrow={false}
      collisionPadding={12}
      open={open}
      onOpenChange={handleOpenChange}
      popupClassName={PANEL_CLASS}
      trigger={trigger}
      triggerNativeButton
    >
      <div className="px-4 pb-3.5 pt-3">
        <div className="mb-2.5 flex h-5 items-center justify-between gap-2">
          <span className="whitespace-nowrap text-xs text-ds-text-secondary">更快</span>
          <div className="relative flex h-5 min-w-0 flex-1 items-center justify-end">
            <div
              className={cx(HEADER_LAYER_CLASS, 'justify-end')}
              data-active={!isHighestLevel}
              aria-hidden={isHighestLevel}
            >
              <span className="whitespace-nowrap text-xs text-ds-text-secondary">更深入</span>
            </div>
            <div
              className={cx(HEADER_LAYER_CLASS, 'justify-end')}
              data-active={isHighestLevel}
              aria-hidden={!isHighestLevel}
            >
              <span className="whitespace-nowrap text-xs font-semibold text-ds-warning-text">消耗更多用量</span>
            </div>
          </div>
        </div>

        <div
          className={SLIDER_CLASS}
          ref={sliderRef}
          role="slider"
          tabIndex={disabled ? -1 : 0}
          aria-label={ariaLabel}
          aria-describedby={sliderDescriptionId}
          aria-valuemin={0}
          aria-valuemax={maxIndex}
          aria-valuenow={safePreviewIndex}
          aria-valuetext={currentLevel?.hint
            ? `${currentLevel.label} — ${currentLevel.hint}`
            : currentLevel?.label ?? '—'}
          aria-orientation="horizontal"
          data-dragging={dragging}
          data-highest={isHighestLevel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerRelease}
          onPointerCancel={cancelDrag}
          onLostPointerCapture={() => { if (draggingRef.current) cancelDrag() }}
          onKeyDown={handleSliderKeyDown}
        >
          <span className="sr-only" id={sliderDescriptionId}>
            向左获得更快响应，向右获得更深入推理。
          </span>
          <div
            className="reasoning-effort-track absolute inset-x-0 top-1/2 h-7 -translate-y-1/2 overflow-hidden rounded-full bg-ds-surface-3 shadow-[inset_0_1px_1px_rgba(6,9,14,0.22)]"
            ref={handleTrackRef}
            aria-hidden="true"
          >
            <div className="absolute inset-0 z-0">
              {resolvedLevels.map((level, index) => (
                <span
                  key={level.id}
                  className="absolute top-1/2 size-[5px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-ds-text-muted"
                  style={{
                    left: getTickPosition(index, maxIndex)
                  }}
                />
              ))}
            </div>
            <div
              ref={fillRef}
              className="reasoning-effort-fill absolute inset-0 z-10 overflow-hidden rounded-full bg-ds-accent after:pointer-events-none after:absolute after:inset-0 after:z-0 after:bg-ds-warning after:opacity-0 after:transition-opacity after:duration-[var(--ds-motion-state)] after:ease-ds-standard data-[highest=true]:after:opacity-100 motion-reduce:after:transition-opacity motion-reduce:after:duration-[80ms]"
              data-highest={isHighestLevel}
            />
          </div>
          <div
            className={KNOB_CLASS}
            ref={knobRef}
            data-dragging={dragging}
            aria-hidden="true"
          />
        </div>
      </div>
    </Popover>
  )
}

function getSpeedLabel(id: string | undefined, index: number, maxIndex: number): string {
  if (id === 'medium' || id === 'default') {
    return '均衡'
  }
  if (id === 'none' || id === 'minimal' || id === 'low') {
    return '快'
  }
  if (id === 'high') {
    return '较慢'
  }
  if (id === 'xhigh' || id === 'max') {
    return '最慢'
  }
  if (maxIndex <= 0) {
    return '由模型决定'
  }
  const progress = index / maxIndex
  if (progress <= 0.25) {
    return '快'
  }
  if (progress <= 0.5) {
    return '均衡'
  }
  if (progress <= 0.75) {
    return '较慢'
  }
  return '最慢'
}

function getTickPosition(index: number, maxIndex: number): string {
  const progress = maxIndex > 0 ? index / maxIndex : 0
  const percentage = progress * 100
  const pixelOffset = KNOB_DIAMETER_PX / 2 - KNOB_DIAMETER_PX * progress
  return `calc(${percentage}% + ${pixelOffset}px)`
}
