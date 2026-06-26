import { useEffect, useState } from 'react'

function readTimeMs(variableName: string, fallback: number): number {
  if (typeof document === 'undefined') {
    return fallback
  }

  const raw = getComputedStyle(document.documentElement).getPropertyValue(variableName).trim()
  const value = Number.parseFloat(raw)
  if (!Number.isFinite(value)) {
    return fallback
  }
  return raw.endsWith('s') && !raw.endsWith('ms') ? value * 1000 : value
}

export function useTimedPresence(
  open: boolean,
  durationVariable = '--dropdown-close-dur',
  fallbackDuration = 190
) {
  const [mounted, setMounted] = useState(open)
  const [closing, setClosing] = useState(false)

  useEffect(() => {
    if (open) {
      setMounted(true)
      setClosing(false)
      return
    }

    if (!mounted) {
      return
    }

    setClosing(true)
    const timeout = window.setTimeout(() => {
      setClosing(false)
      setMounted(false)
    }, readTimeMs(durationVariable, fallbackDuration))

    return () => {
      window.clearTimeout(timeout)
    }
  }, [durationVariable, fallbackDuration, mounted, open])

  return {
    closing: closing || (mounted && !open),
    mounted
  }
}
