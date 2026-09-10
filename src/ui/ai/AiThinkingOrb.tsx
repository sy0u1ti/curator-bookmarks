import { lazy, Suspense } from 'react'
import type { OrbSize, OrbState } from 'thinking-orbs'
import { cx } from '../base/utils'

// Libraries.dev's canvas renderer is only downloaded when an AI task needs it.
// It already pauses offscreen, in hidden tabs and for reduced motion, and caps DPR at 2.
const ThinkingOrb = lazy(() => import('thinking-orbs').then((module) => ({ default: module.ThinkingOrb })))

export type AiThinkingOrbState = OrbState

export interface AiThinkingOrbProps {
  className?: string
  label?: string
  paused?: boolean
  size?: OrbSize
  speed?: number
  state: OrbState
}

export function AiThinkingOrb({
  className,
  label,
  paused = false,
  size = 20,
  speed = 1,
  state
}: AiThinkingOrbProps) {
  const decorative = !label
  const accessibility = {
    role: decorative ? 'presentation' : 'img',
    'aria-hidden': decorative || undefined,
    'aria-label': label
  }

  return (
    <Suspense fallback={
      <span
        {...accessibility}
        className={cx('inline-flex flex-none items-center justify-center', className)}
        style={{ width: size, height: size }}
        data-ai-thinking-orb={state}
      >
        <span className="size-2 rounded-full bg-current opacity-60" />
      </span>
    }>
      <ThinkingOrb
        {...accessibility}
        className={cx('flex-none', className)}
        state={state}
        size={size}
        speed={speed}
        paused={paused}
        theme="dark"
        data-ai-thinking-orb={state}
      />
    </Suspense>
  )
}
