import type { ReactNode } from 'react'
import { Surface } from '../index'

export interface AiConversationPanelProps {
  children: ReactNode
}

export function AiConversationPanel({ children }: AiConversationPanelProps) {
  return <Surface className="grid gap-3 p-3" variant="group">{children}</Surface>
}
