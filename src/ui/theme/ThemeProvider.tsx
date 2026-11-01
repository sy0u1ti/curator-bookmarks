import { useEffect, type ReactNode } from 'react'
import { observeMotionPreferences } from '../../shared/motion-preferences'

export function ThemeProvider({ children }: { children: ReactNode }) {
  useEffect(observeMotionPreferences, [])

  return <div className="curator-react-root dark">{children}</div>
}
