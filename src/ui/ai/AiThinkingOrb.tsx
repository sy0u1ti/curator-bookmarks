import { ThinkingOrb, type OrbSize, type OrbState } from 'thinking-orbs'
import { cx } from '../base/utils'

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

  return (
    <ThinkingOrb
      className={cx('flex-none', className)}
      state={state}
      size={size}
      speed={speed}
      paused={paused}
      theme="dark"
      role={decorative ? 'presentation' : 'img'}
      aria-hidden={decorative || undefined}
      aria-label={label}
      data-ai-thinking-orb={state}
    />
  )
}
