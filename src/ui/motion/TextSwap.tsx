import { useEffect, useRef, useState, type HTMLAttributes } from 'react'
import { cx } from '../base/utils'

type TextSwapPhase = 'enter-start' | 'exit' | 'idle'

export interface TextSwapProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  text: string
}

export function TextSwap({ className, text, ...props }: TextSwapProps) {
  const ref = useRef<HTMLSpanElement | null>(null)
  const [displayText, setDisplayText] = useState(text)
  const [phase, setPhase] = useState<TextSwapPhase>('idle')

  useEffect(() => {
    if (text === displayText) {
      return
    }

    const duration = getTextSwapDurationMs()
    let frame = 0
    const timeout = window.setTimeout(() => {
      setDisplayText(text)
      setPhase('enter-start')
      frame = window.requestAnimationFrame(() => {
        if (ref.current) {
          void ref.current.offsetHeight
        }
        setPhase('idle')
      })
    }, duration)

    setPhase('exit')

    return () => {
      window.clearTimeout(timeout)
      if (frame) {
        window.cancelAnimationFrame(frame)
      }
    }
  }, [displayText, text])

  return (
    <span
      ref={ref}
      className={cx(
        't-text-swap',
        phase === 'exit' ? 'is-exit' : '',
        phase === 'enter-start' ? 'is-enter-start' : '',
        className
      )}
      {...props}
    >
      {displayText}
    </span>
  )
}

function getTextSwapDurationMs() {
  const rawValue = getComputedStyle(document.documentElement).getPropertyValue('--text-swap-dur').trim()
  const parsed = Number.parseFloat(rawValue)
  if (!Number.isFinite(parsed)) {
    return 150
  }
  return rawValue.endsWith('s') && !rawValue.endsWith('ms') ? parsed * 1000 : parsed
}
