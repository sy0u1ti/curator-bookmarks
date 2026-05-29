import type { ReactNode } from 'react'

export function ThemeProvider({ children }: { children: ReactNode }) {
  return <div className="curator-react-root dark">{children}</div>
}
