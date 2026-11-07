// Only looping status effects join this clock. Entrances, exits, spinners with
// deliberate stagger and direct manipulation keep their own timing.
const AMBIENT_ANIMATIONS = new Set(['t-shimmer', 'sheen-progress-sweep'])

export function synchronizeAmbientAnimations(animations: Animation[], timelineTime: number | null): void {
  if (timelineTime === null || !Number.isFinite(timelineTime)) return
  for (const animation of animations) {
    if (!('animationName' in animation) || !AMBIENT_ANIMATIONS.has(String(animation.animationName))) continue
    if (animation.playState === 'idle' || animation.playState === 'finished') continue
    if (animation.playState === 'paused') {
      // Setting startTime on a paused animation would resume it. Keep CSS in
      // charge of visibility/reduced-motion, including nodes mounted while hidden.
      animation.currentTime = timelineTime
    } else if (animation.startTime !== 0) {
      animation.startTime = 0
    }
  }
}

export function observeAmbientMotion(): { sync: () => void; dispose: () => void } {
  const sync = () => synchronizeAmbientAnimations(
    document.getAnimations(),
    typeof document.timeline.currentTime === 'number' ? document.timeline.currentTime : null
  )
  const onAnimationStart = (event: AnimationEvent) => {
    if (!AMBIENT_ANIMATIONS.has(event.animationName) || !(event.target instanceof Element)) return
    synchronizeAmbientAnimations(
      event.target.getAnimations({ subtree: true }),
      typeof document.timeline.currentTime === 'number' ? document.timeline.currentTime : null
    )
  }
  document.addEventListener('animationstart', onAnimationStart, true)
  sync()
  return {
    sync,
    dispose: () => document.removeEventListener('animationstart', onAnimationStart, true)
  }
}
