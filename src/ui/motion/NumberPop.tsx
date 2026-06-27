import { useEffect, useRef, useState, type HTMLAttributes } from 'react'
import { cx } from '../base/utils'

export interface NumberPopProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  text: number | string
}

export function NumberPop({ className, text, ...props }: NumberPopProps) {
  const value = String(text)
  const ref = useRef<HTMLSpanElement | null>(null)
  const previousValueRef = useRef(value)
  const [displayText, setDisplayText] = useState(value)
  const [animating, setAnimating] = useState(false)
  const { ['aria-label']: ariaLabel, ...spanProps } = props

  useEffect(() => {
    if (previousValueRef.current === value) {
      return
    }

    previousValueRef.current = value
    setAnimating(false)
    setDisplayText(value)

    const frame = window.requestAnimationFrame(() => {
      if (ref.current) {
        void ref.current.offsetHeight
      }
      setAnimating(true)
    })

    return () => {
      window.cancelAnimationFrame(frame)
    }
  }, [value])

  const chars = displayText.split('')

  return (
    <span
      ref={ref}
      className={cx('t-digit-group', animating ? 'is-animating' : '', className)}
      aria-label={ariaLabel ?? displayText}
      {...spanProps}
    >
      {chars.map((char, index) => (
        <span
          className="t-digit"
          data-stagger={getDigitStagger(index, chars.length)}
          aria-hidden="true"
          key={`${displayText}:${index}:${char}`}
        >
          {char}
        </span>
      ))}
    </span>
  )
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
