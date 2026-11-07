import { useLayoutEffect, useRef, type RefObject } from 'react'
import { getMotionDurationMs, getMotionEasing, shouldSkipMotion } from '../../shared/motion'

interface Box { x: number; y: number; width: number; height: number }

interface Frame {
  activeId: string | null
  boxes: Map<string, Box>
  ghosts: Array<{ node: HTMLElement; box: Box }>
}

const MORPH_ID = 'popup-activity-morph'

function boxOf(element: Element, origin: DOMRect): Box {
  const rect = element.getBoundingClientRect()
  return { x: rect.left - origin.left, y: rect.top - origin.top, width: rect.width, height: rect.height }
}

function invert(first: Box, last: Box): string {
  const dx = first.x + first.width / 2 - (last.x + last.width / 2)
  const dy = first.y + first.height / 2 - (last.y + last.height / 2)
  return `translate(${dx}px, ${dy}px) scale(${first.width / last.width})`
}

function morphing(stage: HTMLElement): boolean {
  return stage.getAnimations({ subtree: true }).some(animation => animation.id === MORPH_ID)
}

function stop(stage: HTMLElement): void {
  for (const animation of stage.getAnimations({ subtree: true })) {
    if (animation.id === MORPH_ID) animation.cancel()
  }
  stage.querySelectorAll('.popup-activity-ghost').forEach(node => node.remove())
}

// Geometry is read relative to the cross-fade layer, so its own entrance
// offset cancels out of every measured box.
function layerOf(stage: HTMLElement): HTMLElement {
  return stage.querySelector<HTMLElement>('.popup-activity-transition') ?? stage
}

function measure(stage: HTMLElement): Frame {
  const origin = layerOf(stage).getBoundingClientRect()
  const card = stage.querySelector<HTMLElement>('.popup-activity-card')
  const boxes = new Map<string, Box>()
  const ghosts: Frame['ghosts'] = []
  const icon = card?.querySelector('.popup-activity-icon')
  if (icon) boxes.set('icon', boxOf(icon, origin))
  stage.querySelectorAll<HTMLElement>('[data-activity-entry]').forEach(dot => {
    boxes.set(`dot:${dot.dataset.activityEntry}`, boxOf(dot, origin))
  })
  card?.querySelectorAll<HTMLElement>('.popup-activity-copy, #popup-activity-action').forEach(source => {
    const node = source.cloneNode(true) as HTMLElement
    node.removeAttribute('id')
    node.querySelectorAll('[id]').forEach(child => child.removeAttribute('id'))
    node.classList.add('popup-activity-ghost')
    node.setAttribute('aria-hidden', 'true')
    node.inert = true
    ghosts.push({ node, box: boxOf(source, origin) })
  })
  return { activeId: card?.dataset.activityId ?? null, boxes, ghosts }
}

function play(stage: HTMLElement, previous: Frame, next: Frame): void {
  const travel = getMotionDurationMs('--ds-motion-spring', 570, stage)
  const reveal = getMotionDurationMs('--ds-motion-state', 280, stage)
  const exit = getMotionDurationMs('--ds-motion-exit-opacity', 140, stage)
  const spring = getMotionEasing('--ds-ease-spring', 'cubic-bezier(0.2, 0.9, 0.25, 1.02)')
  const settle = getMotionEasing('--ds-ease-settle', 'cubic-bezier(0.32, 0.72, 0, 1)')
  const accelerate = getMotionEasing('--ds-ease-in', 'cubic-bezier(0.4, 0, 1, 1)')
  const timing = (duration: number, easing: string, delay = 0): KeyframeAnimationOptions =>
    ({ id: MORPH_ID, duration, easing, delay, fill: 'backwards' })
  const swapped = Boolean(previous.activeId && next.activeId && previous.activeId !== next.activeId)

  stage.querySelectorAll<HTMLElement>('[data-activity-entry]').forEach(dot => {
    const id = dot.dataset.activityEntry
    const last = next.boxes.get(`dot:${id}`)
    const first = swapped && id === previous.activeId ? previous.boxes.get('icon') : previous.boxes.get(`dot:${id}`)
    if (!last) return
    if (first) {
      if (first.x !== last.x || first.y !== last.y || first.width !== last.width) {
        dot.animate([{ transform: invert(first, last) }, { transform: 'none' }], timing(travel, spring))
      }
    } else {
      dot.animate([{ opacity: 0, transform: 'scale(0.4)' }, { opacity: 1, transform: 'none' }], timing(reveal, spring, exit / 2))
    }
  })
  if (!swapped) return

  const card = stage.querySelector<HTMLElement>('.popup-activity-card')
  const icon = card?.querySelector<HTMLElement>('.popup-activity-icon')
  const iconBox = next.boxes.get('icon')
  const source = previous.boxes.get(`dot:${next.activeId}`)
  if (icon && iconBox) {
    icon.animate(source
      ? [{ transform: invert(source, iconBox) }, { transform: 'none' }]
      : [{ opacity: 0, transform: 'scale(0.5)' }, { opacity: 1, transform: 'none' }], timing(travel, spring))
  }
  const copy = card?.querySelector<HTMLElement>('.popup-activity-copy')
  copy?.animate([
    { opacity: 0, transform: 'translateX(12px)', filter: 'blur(4px)' },
    { opacity: 1, transform: 'none', filter: 'blur(0)' }
  ], timing(reveal, settle, exit))
  card?.querySelector<HTMLElement>('#popup-activity-action')?.animate([
    { opacity: 0, transform: 'scale(0.86)' },
    { opacity: 1, transform: 'none' }
  ], timing(reveal, spring, exit / 2))

  // The outgoing words collapse toward the badge that now holds them.
  for (const { node, box } of previous.ghosts) {
    Object.assign(node.style, {
      position: 'absolute', left: `${box.x}px`, top: `${box.y}px`,
      width: `${box.width}px`, height: `${box.height}px`, margin: '0',
      pointerEvents: 'none', transformOrigin: 'right center'
    })
    layerOf(stage).append(node)
    const animation = node.animate([
      { opacity: 1, transform: 'none', filter: 'blur(0)' },
      { opacity: 0, transform: 'translateX(8px) scale(0.96)', filter: 'blur(4px)' }
    ], { id: MORPH_ID, duration: exit, easing: accelerate, fill: 'forwards' })
    animation.finished.catch(() => {}).finally(() => node.remove())
  }
}

/** Shared-element morph between the main badge and its satellite dots. The
 * slot never changes size; only transforms and opacity move. */
export function usePopupActivityMorph(stage: RefObject<HTMLElement | null>, layoutKey: string) {
  const frame = useRef<Frame | null>(null)

  useLayoutEffect(() => {
    const element = stage.current
    if (!element) return
    const previous = frame.current
    stop(element)
    const next = measure(element)
    frame.current = next
    if (previous && !shouldSkipMotion()) play(element, previous, next)
  }, [layoutKey])

  useLayoutEffect(() => () => { if (stage.current) stop(stage.current) }, [])

  return () => {
    const element = stage.current
    if (element && !morphing(element)) frame.current = measure(element)
  }
}
