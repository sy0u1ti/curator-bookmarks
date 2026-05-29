import { motion } from 'motion/react'
import type { ComponentPropsWithoutRef } from 'react'
import { panelTransitions } from './transitions'

export function MotionList(props: ComponentPropsWithoutRef<typeof motion.div>) {
  return <motion.div layout {...panelTransitions.list} {...props} />
}
