import { LazyMotion, domAnimation, m, useReducedMotion } from 'motion/react'
import type { ComponentPropsWithoutRef } from 'react'
import { panelTransitions } from './transitions'

export type MotionPanelProps = ComponentPropsWithoutRef<typeof m.div> & {
  variant?: keyof typeof panelTransitions
}

export function MotionPanel({ variant = 'dialog', ...props }: MotionPanelProps) {
  const shouldReduceMotion = useReducedMotion()
  const transition = panelTransitions[variant]

  if (shouldReduceMotion) {
    return (
      <LazyMotion features={domAnimation}>
        <m.div
          initial={{ opacity: transition.initial.opacity ?? 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: transition.exit.opacity ?? 0 }}
          transition={{ duration: 0.01 }}
          {...props}
        />
      </LazyMotion>
    )
  }

  return (
    <LazyMotion features={domAnimation}>
      <m.div {...transition} {...props} />
    </LazyMotion>
  )
}
