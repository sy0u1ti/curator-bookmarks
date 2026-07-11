import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { cx } from '../../ui/base/utils'

/**
 * 推理强度选择器 —— 交互与视觉复刻自 zanwei/claude-model-selector（MIT），
 * 以 React + 设计系统令牌重实现：磁吸拖拽、速度采样、欠阻尼弹簧吸附、
 * 方向感知的档名换字动画、键盘操作与 prefers-reduced-motion 降级。
 * 档位集合可配置（随模型能力联动），去掉了原作最高档的 Canvas 像素场。
 */

export interface ReasoningEffortLevel {
  id: string
  label: string
}

export interface ReasoningEffortSelectorProps {
  levels: ReasoningEffortLevel[]
  value: string
  onChange: (id: string) => void
  disabled?: boolean
  /** 面板弹出方向；表单上下文一般用 down。 */
  direction?: 'up' | 'down'
  ariaLabel?: string
}

const TRACK_PAD_PX = 1
const THUMB_W_PX = 24
const SPRING_STIFFNESS = 920
const SPRING_DAMPING = 40
const VELOCITY_WINDOW_MS = 90
const VELOCITY_MAX = 8
const LABEL_SWAP_MS = 200

const PANEL_CLASS = cx(
  'absolute right-0 z-[30] w-full min-w-56 rounded-ds-lg border border-ds-border bg-ds-surface-2 p-4',
  '[filter:var(--ds-filter-popover)]'
)
const TRIGGER_CLASS = cx(
  'inline-flex min-h-8 w-max items-center rounded-ds-sm border border-ds-border bg-ds-surface-1 px-3 py-1 text-xs font-semibold text-ds-text-primary',
  'transition-[background-color,border-color,transform] duration-ds-fast ease-ds-standard',
  'hover:bg-ds-hover hover:border-ds-border-hover active:scale-[0.96]',
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-focus',
  'disabled:cursor-default disabled:opacity-55 disabled:hover:bg-ds-surface-1 disabled:active:scale-100'
)
const TITLE_CLASS = 'flex items-baseline gap-2 text-sm font-medium text-ds-text-secondary'
const LEVEL_STAGE_CLASS = 'effort-level-stage relative inline-grid text-sm font-semibold text-ds-text-primary'
const AXIS_CLASS = 'mt-4 flex items-center justify-between text-xs font-medium text-ds-text-muted'
const TRACK_SHELL_CLASS = 'relative mt-2 h-11 cursor-ew-resize touch-none select-none'
const TRACK_CLASS = 'absolute inset-x-0 inset-y-2 overflow-hidden rounded-[10px] bg-[rgba(245,245,247,0.07)] shadow-[inset_0_1px_1px_rgba(0,0,0,0.18)]'
const TICKS_CLASS = 'pointer-events-none absolute inset-y-0 flex items-center justify-between'
const THUMB_CLASS = cx(
  'absolute top-1/2 h-[26px] w-6 -translate-y-1/2 rounded-ds-sm border border-[rgba(245,245,247,0.28)] bg-[#f5f5f7]',
  'shadow-[0_1px_2px_rgba(0,0,0,0.35),0_2px_6px_rgba(0,0,0,0.22)]',
  'outline-none focus-visible:shadow-[0_0_0_3px_var(--ds-accent-soft)]'
)

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
  const [closing, setClosing] = useState(false)
  const [position, setPosition] = useState(valueIndex)
  const [labelSwap, setLabelSwap] = useState<{ outgoing: string; direction: 1 | -1; key: number } | null>(null)

  const rootRef = useRef<HTMLDivElement | null>(null)
  const trackShellRef = useRef<HTMLDivElement | null>(null)
  const thumbRef = useRef<HTMLDivElement | null>(null)
  const positionRef = useRef(position)
  const levelIndexRef = useRef(valueIndex)
  const draggingRef = useRef(false)
  const samplesRef = useRef<Array<{ time: number; value: number }>>([])
  const springFrameRef = useRef(0)
  const closeTimerRef = useRef(0)
  const labelTimerRef = useRef(0)

  positionRef.current = position

  const reducedMotion = useMemo(
    () => (typeof window === 'undefined' ? false : window.matchMedia('(prefers-reduced-motion: reduce)').matches),
    []
  )

  const levelIndex = Math.min(maxIndex, Math.max(0, Math.round(position)))
  const currentLevel = levels[levelIndex] ?? levels[0]
  const widestLabel = useMemo(
    () => levels.reduce((widest, level) => (level.label.length > widest.length ? level.label : widest), ''),
    [levels]
  )

  const announceLevelChange = useCallback((nextIndex: number, animate: boolean) => {
    const previousIndex = levelIndexRef.current
    if (nextIndex === previousIndex) {
      return
    }
    levelIndexRef.current = nextIndex
    if (!animate || reducedMotion) {
      setLabelSwap(null)
      return
    }
    window.clearTimeout(labelTimerRef.current)
    setLabelSwap({
      outgoing: levels[previousIndex]?.label ?? '',
      direction: nextIndex > previousIndex ? 1 : -1,
      key: Date.now() + nextIndex
    })
    labelTimerRef.current = window.setTimeout(() => setLabelSwap(null), LABEL_SWAP_MS)
  }, [levels, reducedMotion])

  const setSliderPosition = useCallback((nextValue: number, { animateLabel = false } = {}) => {
    const clamped = Math.min(maxIndex, Math.max(0, nextValue))
    announceLevelChange(Math.min(maxIndex, Math.max(0, Math.round(clamped))), animateLabel)
    setPosition(clamped)
  }, [announceLevelChange, maxIndex])

  const commitLevel = useCallback((index: number) => {
    const level = levels[Math.min(maxIndex, Math.max(0, index))]
    if (level && level.id !== value) {
      onChange(level.id)
    }
  }, [levels, maxIndex, onChange, value])

  // 外部受控值变化（含模型切换导致的档位集合变化）时同步滑块。
  useEffect(() => {
    if (!draggingRef.current && !springFrameRef.current) {
      setPosition(valueIndex)
      levelIndexRef.current = valueIndex
    }
  }, [valueIndex])

  useEffect(() => () => {
    window.cancelAnimationFrame(springFrameRef.current)
    window.clearTimeout(closeTimerRef.current)
    window.clearTimeout(labelTimerRef.current)
  }, [])

  const close = useCallback(() => {
    if (!open) {
      return
    }
    setOpen(false)
    if (reducedMotion) {
      return
    }
    setClosing(true)
    window.clearTimeout(closeTimerRef.current)
    closeTimerRef.current = window.setTimeout(() => setClosing(false), 120)
  }, [open, reducedMotion])

  useEffect(() => {
    if (!open) {
      return
    }
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && event.target instanceof Node && !rootRef.current.contains(event.target)) {
        close()
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        close()
      }
    }
    document.addEventListener('pointerdown', onPointerDown, { capture: true })
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, { capture: true })
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [close, open])

  /** 磁吸：靠近档位中心时按 t² 增强拉力，两档中点自由滑动。 */
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

  const valueFromPointer = useCallback((clientX: number) => {
    const shell = trackShellRef.current
    if (!shell) {
      return positionRef.current
    }
    const rect = shell.getBoundingClientRect()
    const usable = rect.width - TRACK_PAD_PX * 2 - THUMB_W_PX
    if (usable <= 0) {
      return positionRef.current
    }
    const ratio = (clientX - rect.left - TRACK_PAD_PX - THUMB_W_PX / 2) / usable
    return Math.min(maxIndex, Math.max(0, ratio * maxIndex))
  }, [maxIndex])

  const startSpring = useCallback((initialVelocity: number) => {
    const target = Math.min(maxIndex, Math.max(0, Math.round(positionRef.current)))
    const settle = () => {
      setSliderPosition(target, { animateLabel: true })
      springFrameRef.current = 0
      commitLevel(target)
    }
    if (reducedMotion || Math.abs(positionRef.current - target) < 0.001) {
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
      setSliderPosition(springPosition, { animateLabel: true })
      if (Math.abs(springPosition - target) < 0.001 && Math.abs(velocity) < 0.01) {
        settle()
        return
      }
      springFrameRef.current = window.requestAnimationFrame(step)
    }
    window.cancelAnimationFrame(springFrameRef.current)
    springFrameRef.current = window.requestAnimationFrame(step)
  }, [commitLevel, maxIndex, reducedMotion, setSliderPosition])

  const onTrackPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || event.button !== 0) {
      return
    }
    event.preventDefault()
    window.cancelAnimationFrame(springFrameRef.current)
    springFrameRef.current = 0
    draggingRef.current = true
    samplesRef.current = []
    event.currentTarget.setPointerCapture(event.pointerId)
    const magnetValue = applyMagnet(valueFromPointer(event.clientX))
    samplesRef.current.push({ time: performance.now(), value: magnetValue })
    setSliderPosition(magnetValue, { animateLabel: true })
    thumbRef.current?.focus({ preventScroll: true })
  }, [applyMagnet, disabled, setSliderPosition, valueFromPointer])

  const onTrackPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) {
      return
    }
    const magnetValue = applyMagnet(valueFromPointer(event.clientX))
    const now = performance.now()
    samplesRef.current.push({ time: now, value: magnetValue })
    samplesRef.current = samplesRef.current.filter((sample) => now - sample.time <= VELOCITY_WINDOW_MS).slice(-5)
    setSliderPosition(magnetValue, { animateLabel: true })
  }, [applyMagnet, setSliderPosition, valueFromPointer])

  const onTrackPointerUp = useCallback(() => {
    if (!draggingRef.current) {
      return
    }
    draggingRef.current = false
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
    setSliderPosition(clampedIndex)
    commitLevel(clampedIndex)
  }, [commitLevel, disabled, maxIndex, setSliderPosition])

  const progress = maxIndex > 0 ? position / maxIndex : 0
  const panelVisible = open || closing

  return (
    <div className="relative inline-flex" ref={rootRef}>
      <button
        type="button"
        className={TRIGGER_CLASS}
        aria-controls={panelId}
        aria-expanded={open}
        aria-label={`${ariaLabel}：${currentLevel?.label ?? ''}`}
        disabled={disabled}
        onClick={() => (open ? close() : setOpen(true))}
      >
        <span className="tabular-nums">{currentLevel?.label ?? '—'}</span>
      </button>
      {panelVisible ? (
        <section
          id={panelId}
          aria-label={ariaLabel}
          className={cx(
            PANEL_CLASS,
            direction === 'up' ? 'bottom-[calc(100%+8px)]' : 'top-[calc(100%+8px)]',
            closing && !open ? 'effort-panel-closing' : ''
          )}
        >
          <div className={TITLE_CLASS}>
            <span>{ariaLabel}</span>
            <span className={LEVEL_STAGE_CLASS} aria-live="polite" aria-atomic="true">
              <span className="invisible col-start-1 row-start-1 whitespace-nowrap" aria-hidden="true">{widestLabel}</span>
              {labelSwap ? (
                <span
                  key={`out-${labelSwap.key}`}
                  className="effort-level-outgoing col-start-1 row-start-1 whitespace-nowrap"
                  style={{ '--effort-exit-y': labelSwap.direction > 0 ? '-3px' : '3px' } as React.CSSProperties}
                  aria-hidden="true"
                >
                  {labelSwap.outgoing}
                </span>
              ) : null}
              <span
                key={labelSwap ? `in-${labelSwap.key}` : 'label-static'}
                className={cx('col-start-1 row-start-1 whitespace-nowrap', labelSwap ? 'effort-level-incoming' : '')}
                style={labelSwap ? ({ '--effort-enter-y': labelSwap.direction > 0 ? '3px' : '-3px' } as React.CSSProperties) : undefined}
              >
                {currentLevel?.label ?? ''}
              </span>
            </span>
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
          >
            <div className={TRACK_CLASS} aria-hidden="true">
              <div
                className="absolute inset-y-0 left-0 rounded-l-[9px] bg-[rgba(245,245,247,0.13)]"
                style={{ width: `calc((100% - ${TRACK_PAD_PX * 2}px - ${THUMB_W_PX}px) * ${progress} + ${THUMB_W_PX / 2}px)` }}
              />
              <div className={TICKS_CLASS} style={{ left: TRACK_PAD_PX + THUMB_W_PX / 2 - 2, right: TRACK_PAD_PX + THUMB_W_PX / 2 - 2 }}>
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
              style={{ left: `calc(${TRACK_PAD_PX}px + (100% - ${TRACK_PAD_PX * 2}px - ${THUMB_W_PX}px) * ${progress})` }}
            />
          </div>
        </section>
      ) : null}
    </div>
  )
}
