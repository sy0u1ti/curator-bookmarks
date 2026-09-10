import { useEffect, type ReactNode } from 'react'

export function ThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const updateActivity = () => {
      document.documentElement.toggleAttribute('data-motion-paused', document.hidden)
    }
    updateActivity()
    document.addEventListener('visibilitychange', updateActivity)
    return () => {
      document.removeEventListener('visibilitychange', updateActivity)
      document.documentElement.removeAttribute('data-motion-paused')
    }
  }, [])

  return <div className="curator-react-root dark">{children}</div>
}
