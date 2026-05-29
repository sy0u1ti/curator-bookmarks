import { Tabs as BaseTabs } from '@base-ui/react/tabs'
import type { ReactNode } from 'react'
import { cx } from './utils'

export interface TabItem {
  value: string
  label: ReactNode
  panel: ReactNode
}

export interface TabsProps {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  items: TabItem[]
  className?: string
}

export function Tabs({ value, defaultValue, onValueChange, items, className }: TabsProps) {
  return (
    <BaseTabs.Root
      value={value}
      defaultValue={defaultValue}
      onValueChange={onValueChange}
      className={cx('grid gap-3', className)}
    >
      <BaseTabs.List className="relative flex gap-1 rounded-md border border-curator-border bg-curator-bg-panel p-1">
        {items.map((item) => (
          <BaseTabs.Tab
            key={item.value}
            value={item.value}
            className="rounded px-3 py-1.5 text-sm text-curator-text-muted outline-none transition-colors data-[selected]:bg-curator-muted data-[selected]:text-curator-text focus-visible:ring-2 focus-visible:ring-white/20"
          >
            {item.label}
          </BaseTabs.Tab>
        ))}
      </BaseTabs.List>
      {items.map((item) => (
        <BaseTabs.Panel key={item.value} value={item.value} className="outline-none">
          {item.panel}
        </BaseTabs.Panel>
      ))}
    </BaseTabs.Root>
  )
}
