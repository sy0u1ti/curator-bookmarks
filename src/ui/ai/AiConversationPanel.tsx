import type { ReactNode } from 'react'
import { Card } from '../index'

export interface AiConversationPanelProps {
  children: ReactNode
}

export function AiConversationPanel({ children }: AiConversationPanelProps) {
  return <Card className="grid gap-3">{children}</Card>
}
