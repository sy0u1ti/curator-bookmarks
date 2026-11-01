import { useLayoutEffect, useRef, useState, type CSSProperties, type HTMLAttributes } from 'react'
import { cx } from './utils'
import './status-message.css'

type StatusMessageProps = HTMLAttributes<HTMLDivElement> & {
  lines?: 1 | 2 | 3 | 4
  tone?: 'neutral' | 'error' | 'warning' | 'success'
}

/** Feedback has a stable footprint; long failures remain readable and scrollable. */
export function StatusMessage({
  children, className, lines = 2, tone = 'neutral', role, style, ...props
}: StatusMessageProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [overflow, setOverflow] = useState(false)
  useLayoutEffect(() => {
    const node = ref.current
    if (!node) return
    const measure = () => setOverflow(node.scrollHeight > node.clientHeight + 1)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [children])

  return (
    <div
      {...props}
      ref={ref}
      className={cx('curator-status-message', className)}
      data-tone={tone}
      data-empty={!children || undefined}
      role={role ?? (tone === 'error' ? 'alert' : 'status')}
      aria-atomic="true"
      tabIndex={overflow ? 0 : undefined}
      style={{ ...style, '--status-message-lines': lines } as CSSProperties}
    >
      {children}
    </div>
  )
}

export function StableLabel({ text, reserve, className }: {
  text: string
  reserve: readonly string[]
  className?: string
}) {
  return (
    <span className={cx('curator-stable-label', className)}>
      {reserve.map((label) => <span key={label} aria-hidden="true" className="curator-stable-label-reserve">{label}</span>)}
      <span>{text}</span>
    </span>
  )
}
