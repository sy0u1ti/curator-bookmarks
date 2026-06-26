import { Tabs as BaseTabs } from '@base-ui/react/tabs'
import type { ComponentPropsWithoutRef } from 'react'
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
      <BaseTabs.List className="t-tabs relative flex gap-1 rounded-md border border-ds-border bg-ds-surface-1 p-1">
        {items.map((item) => (
          <BaseTabs.Tab
            key={item.value}
            value={item.value}
            className="t-tab rounded px-3 py-1.5 text-sm text-ds-text-secondary outline-none transition-colors data-active:text-ds-text-primary focus-visible:shadow-ds-focus"
          >
            {item.label}
          </BaseTabs.Tab>
        ))}
        <BaseTabs.Indicator className="t-tabs-pill" />
      </BaseTabs.List>
      {items.map((item) => (
        <BaseTabs.Panel key={item.value} value={item.value} className="outline-none">
          {item.panel}
        </BaseTabs.Panel>
      ))}
    </BaseTabs.Root>
  )
}

export type TabsRootProps = ComponentPropsWithoutRef<typeof BaseTabs.Root>
export type TabsListProps = ComponentPropsWithoutRef<typeof BaseTabs.List>
export type TabsTabProps = ComponentPropsWithoutRef<typeof BaseTabs.Tab>
export type TabsPanelProps = ComponentPropsWithoutRef<typeof BaseTabs.Panel>
export type TabsIndicatorProps = ComponentPropsWithoutRef<typeof BaseTabs.Indicator>

export function TabsRoot(props: TabsRootProps) {
  return <BaseTabs.Root {...props} />
}

export function TabsList(props: TabsListProps) {
  return <BaseTabs.List {...props} />
}

export function TabsTab(props: TabsTabProps) {
  return <BaseTabs.Tab {...props} />
}

export function TabsPanel(props: TabsPanelProps) {
  return <BaseTabs.Panel {...props} />
}

export function TabsIndicator(props: TabsIndicatorProps) {
  return <BaseTabs.Indicator {...props} />
}
