import { useLayoutEffect, useRef, useState, type CSSProperties, type HTMLAttributes, type ReactNode } from 'react'
import { cx } from './utils'
import './status-message.css'

type StatusMessageProps = HTMLAttributes<HTMLDivElement> & {
  lines?: 1 | 2 | 3 | 4
  /** Resting copy that sizes the slot at the current width instead of a fixed line count. */
  reserve?: readonly ReactNode[]
  tone?: 'neutral' | 'error' | 'warning' | 'success'
}

/** Feedback has a stable footprint; long failures remain readable and scrollable. */
export function StatusMessage({
  children, className, lines = 2, reserve, tone = 'neutral', role, style, ...props
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

  if (reserve?.length) {
    return (
      <div
        {...props}
        className={cx('curator-status-message', className)}
        data-reserve="true"
        data-tone={tone}
        data-empty={!children || undefined}
        role={role ?? (tone === 'error' ? 'alert' : 'status')}
        aria-atomic="true"
        style={style}
      >
        {reserve.map((copy, index) => (
          <span key={index} aria-hidden="true" className="curator-status-message-reserve">{copy}</span>
        ))}
        <div ref={ref} className="curator-status-message-live" tabIndex={overflow ? 0 : undefined}>
          {children}
        </div>
      </div>
    )
  }

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
