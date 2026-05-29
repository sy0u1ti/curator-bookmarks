import { flushSync } from 'react-dom'
import { createRoot, type Root } from 'react-dom/client'
import type { CSSProperties } from 'react'
import type { TagCloudItem } from '../../shared/tag-cloud.js'
import { Button, ThemeProvider } from '../../ui'

const roots = new WeakMap<Element, Root>()

export function renderTagManagementCloudIsland(
  container: Element,
  items: TagCloudItem[]
): HTMLElement | null {
  let root = roots.get(container)
  if (!root) {
    root = createRoot(container)
    roots.set(container, root)
  }

  flushSync(() => {
    root.render(
      <ThemeProvider>
        <TagManagementCloud items={items} />
      </ThemeProvider>
    )
  })

  return container.querySelector<HTMLElement>('[data-tag-cloud-root]')
}

function TagManagementCloud({ items }: { items: TagCloudItem[] }) {
  if (!items.length) {
    return (
      <div className="detect-empty">
        还没有可管理的标签。先在 popup、书签仪表盘或智能分析里添加标签，之后这里会显示使用频率和整理操作。
      </div>
    )
  }

  return (
    <div
      className="tag-management-cloud"
      role="list"
      aria-label="标签词云，字号越大表示使用越频繁"
      data-tag-cloud-root=""
    >
      {items.map((item) => (
        <TagManagementCloudWord item={item} key={`${item.tag}:${item.rank}`} />
      ))}
    </div>
  )
}

function TagManagementCloudWord({ item }: { item: TagCloudItem }) {
  const className = [
    'tag-management-cloud-word',
    `is-${item.tier}`,
    item.accent ? 'is-prominent' : '',
    item.tail ? 'is-tail' : ''
  ].filter(Boolean).join(' ')

  return (
    <Button
      className={className}
      type="button"
      role="listitem"
      data-tag-cloud-word=""
      data-tag-fill={item.tag}
      data-tag-x={item.leftPercent}
      data-tag-y={item.topPercent}
      data-tag-tier={item.tier}
      data-tag-radius={item.radiusPx}
      data-tag-collision-width={item.collisionWidthPx}
      data-tag-collision-height={item.collisionHeightPx}
      data-tag-collision-strength={item.collisionStrength}
      data-tag-mass={item.mass}
      data-tag-phase={item.phase}
      data-tag-flow={item.flowStrength}
      style={{
        '--tag-x': `${item.leftPercent}%`,
        '--tag-y': `${item.topPercent}%`,
        '--tag-size': `${item.fontSizePx}px`,
        '--tag-alpha': item.opacity
      } as CSSProperties}
      title={item.tag}
      aria-label={`选择标签 ${item.tag}`}
      unstyled
    >
      {item.tag}
    </Button>
  )
}
