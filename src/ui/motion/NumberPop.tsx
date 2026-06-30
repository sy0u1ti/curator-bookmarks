import { useEffect, useReducer, useRef, type HTMLAttributes } from 'react'
import { cx } from '../base/utils'

export interface NumberPopProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  text: number | string
}

type NumberPopState = {
  animatedText: string | null
  targetText: string
}
type NumberPopAction =
  | { type: 'animated'; text: string }
  | { type: 'retarget'; text: string }

export function NumberPop({ className, text, ...props }: NumberPopProps) {
  const value = String(text)
  const ref = useRef<HTMLSpanElement | null>(null)
  const [state, dispatch] = useReducer(numberPopReducer, value, createNumberPopState)
  const { ['aria-label']: ariaLabel, ...spanProps } = props

  if (value !== state.targetText) {
    dispatch({ type: 'retarget', text: value })
  }

  useEffect(() => {
    if (state.animatedText === state.targetText) {
      return
    }

    const frame = window.requestAnimationFrame(() => {
      if (ref.current) {
        void ref.current.offsetHeight
      }
      dispatch({ type: 'animated', text: state.targetText })
    })

    return () => {
      window.cancelAnimationFrame(frame)
    }
  }, [state.animatedText, state.targetText])

  const chars = value.split('')

  return (
    <span
      ref={ref}
      className={cx('t-digit-group', state.animatedText === value ? 'is-animating' : '', className)}
      aria-label={ariaLabel ?? value}
      {...spanProps}
    >
      {chars.map((char, index) => (
        <span
          className="t-digit"
          data-stagger={getDigitStagger(index, chars.length)}
          aria-hidden="true"
          key={`${value}:${index}:${char}`}
        >
          {char}
        </span>
      ))}
    </span>
  )
}

function createNumberPopState(text: string): NumberPopState {
  return {
    animatedText: text,
    targetText: text
  }
}

function numberPopReducer(state: NumberPopState, action: NumberPopAction): NumberPopState {
  switch (action.type) {
    case 'animated':
      if (action.text !== state.targetText || action.text === state.animatedText) {
        return state
      }
      return {
        animatedText: action.text,
        targetText: state.targetText
      }
    case 'retarget':
      if (action.text === state.targetText) {
        return state
      }
      return {
        animatedText: state.animatedText,
        targetText: action.text
      }
  }
}

function getDigitStagger(index: number, length: number): '1' | '2' | undefined {
  if (length < 2) {
    return undefined
  }
  if (index === length - 2) {
    return '1'
  }
  if (index === length - 1) {
    return '2'
  }
  return undefined
}
