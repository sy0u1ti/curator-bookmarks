import { useEffect, useReducer, useRef, type HTMLAttributes } from 'react'
import { cx } from '../base/utils'

type TextSwapPhase = 'enter-start' | 'exit' | 'idle'
type TextSwapState = {
  displayText: string
  phase: TextSwapPhase
  targetText: string
}
type TextSwapAction =
  | { type: 'idle' }
  | { type: 'retarget'; text: string }
  | { type: 'swap'; text: string }

export interface TextSwapProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  text: string
}

export function TextSwap({ className, text, ...props }: TextSwapProps) {
  const ref = useRef<HTMLSpanElement | null>(null)
  const [state, dispatch] = useReducer(textSwapReducer, text, createTextSwapState)

  if (text !== state.targetText) {
    dispatch({ type: 'retarget', text })
  }

  useEffect(() => {
    if (state.phase !== 'exit' || state.displayText === state.targetText) {
      return
    }

    const duration = getTextSwapDurationMs()
    const targetText = state.targetText
    const timeout = window.setTimeout(() => {
      dispatch({ type: 'swap', text: targetText })
    }, duration)

    return () => {
      window.clearTimeout(timeout)
    }
  }, [state.displayText, state.phase, state.targetText])

  useEffect(() => {
    if (state.phase !== 'enter-start') {
      return
    }

    const frame = window.requestAnimationFrame(() => {
      if (ref.current) {
        void ref.current.offsetHeight
      }
      dispatch({ type: 'idle' })
    })

    return () => {
      window.cancelAnimationFrame(frame)
    }
  }, [state.displayText, state.phase])

  return (
    <span
      ref={ref}
      className={cx(
        't-text-swap',
        state.phase === 'exit' ? 'is-exit' : '',
        state.phase === 'enter-start' ? 'is-enter-start' : '',
        className
      )}
      {...props}
    >
      {state.displayText}
    </span>
  )
}

function createTextSwapState(text: string): TextSwapState {
  return {
    displayText: text,
    phase: 'idle',
    targetText: text
  }
}

function textSwapReducer(state: TextSwapState, action: TextSwapAction): TextSwapState {
  switch (action.type) {
    case 'idle':
      return state.phase === 'idle' ? state : { ...state, phase: 'idle' }
    case 'retarget':
      if (action.text === state.targetText) {
        return state
      }
      if (action.text === state.displayText) {
        return {
          displayText: state.displayText,
          phase: 'idle',
          targetText: action.text
        }
      }
      return {
        displayText: state.displayText,
        phase: 'exit',
        targetText: action.text
      }
    case 'swap':
      if (action.text !== state.targetText || action.text === state.displayText) {
        return state
      }
      return {
        displayText: action.text,
        phase: 'enter-start',
        targetText: action.text
      }
  }
}

function getTextSwapDurationMs() {
  const rawValue = getComputedStyle(document.documentElement).getPropertyValue('--text-swap-dur').trim()
  const parsed = Number.parseFloat(rawValue)
  if (!Number.isFinite(parsed)) {
    return 150
  }
  return rawValue.endsWith('s') && !rawValue.endsWith('ms') ? parsed * 1000 : parsed
}
