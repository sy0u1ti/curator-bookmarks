import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/** Selection actions are a separate layer, never inserted ahead of the clicked row. */
export function SelectionDock({ open, children, label }: {
  open: boolean
  children: ReactNode
  label: string
}) {
  const [bounds, setBounds] = useState({ left: 16, width: 320, bottom: 16 })
  const panelRef = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if (!open) return
    const main = document.getElementById('options-main')
    const panel = panelRef.current
    const opener = document.activeElement instanceof HTMLElement && document.activeElement !== document.body
      ? document.activeElement : main
    let focusInDock = false
    const trackFocus = (event: FocusEvent) => {
      focusInDock = event.target instanceof Node && Boolean(panel?.contains(event.target))
    }
    const measure = () => {
      const rect = main?.getBoundingClientRect()
      const leftEdge = Math.max(0, rect?.left ?? 0)
      const rightEdge = Math.min(innerWidth, rect?.right ?? innerWidth)
      const width = Math.max(0, Math.min(1040, rightEdge - leftEdge - 32))
      setBounds({ left: leftEdge + (rightEdge - leftEdge - width) / 2, width, bottom: 16 })
    }
    measure()
    const observer = new ResizeObserver(measure)
    if (main) observer.observe(main)
    window.addEventListener('resize', measure)
    document.addEventListener('focusin', trackFocus)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
      document.removeEventListener('focusin', trackFocus)
      if (focusInDock) (opener?.isConnected ? opener : main)?.focus({ preventScroll: true })
    }
  }, [open])
  if (!open) return null

  return createPortal(
    <div ref={panelRef} className="options-selection-dock" role="region" aria-label={label} style={bounds}>
      {children}
    </div>,
    document.body
  )
}
