import type { ReactNode } from 'react'
import { Button } from '../index'
import { cx } from '../primitives/utils'

export interface AiModelOptionCardProps {
  active?: boolean
  children: ReactNode
  current?: boolean
  modelId: string
  tabIndex?: number
  tags?: string[]
}

export function AiModelOptionCard({
  active = false,
  children,
  current = false,
  modelId,
  tabIndex = -1,
  tags = []
}: AiModelOptionCardProps) {
  return (
    <Button
      className={cx('scope-folder-card ai-model-card', current ? 'current' : '')}
      type="button"
      role="option"
      aria-selected={current ? 'true' : 'false'}
      data-ai-model-id={modelId}
      data-ai-model-active={active ? 'true' : undefined}
      tabIndex={tabIndex}
      title={modelId}
      unstyled
    >
      <div className="scope-folder-head">
        <strong>{children}</strong>
      </div>
      {tags.length ? (
        <span className="ai-model-card-tags">
          {tags.map((tag) => (
            <span className="ai-model-card-tag" key={tag}>
              {tag}
            </span>
          ))}
        </span>
      ) : null}
    </Button>
  )
}
