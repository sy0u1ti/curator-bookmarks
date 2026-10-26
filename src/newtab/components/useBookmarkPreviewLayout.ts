import { useLayoutEffect, useState } from 'react'
import { useNewtabBookmarkContentView } from '../newtab-bookmark-content-store'
import { getNewtabContentLayoutNodes, subscribeNewtabContentLayoutNodes } from '../newtab-content-store'
import { useNewtabSettingsDrawerView } from '../newtab-settings-drawer-store'

interface BookmarkPreviewLayout {
  columns: number
  columnGap: number
  rowGap: number
  tileWidth: number
}

export function useBookmarkPreviewLayout(): BookmarkPreviewLayout | null {
  const view = useNewtabBookmarkContentView()
  const drawer = useNewtabSettingsDrawerView()
  const enabled = drawer.open && drawer.activeGroup === 'appearance'
  const [layout, setLayout] = useState<BookmarkPreviewLayout | null>(null)

  useLayoutEffect(() => {
    if (!enabled) return
    let content: HTMLElement | null = null
    let grid: HTMLElement | null = null
    const measure = () => {
      if (!grid?.isConnected) return
      const style = getComputedStyle(grid)
      // Computed grid tracks include auto-fill expansion and the mobile CSS
      // overrides. The configured minimum width is not the rendered card width.
      const columns = style.gridTemplateColumns.split(/\s+/).map(Number.parseFloat).filter(Number.isFinite)
      if (!columns.length || columns[0] <= 0) return
      const next = {
        columns: columns.length,
        columnGap: Number.parseFloat(style.columnGap) || 0,
        rowGap: Number.parseFloat(style.rowGap) || 0,
        tileWidth: columns[0]
      }
      setLayout(current => current && Object.keys(next).every(key =>
        current[key as keyof BookmarkPreviewLayout] === next[key as keyof BookmarkPreviewLayout]
      ) ? current : next)
    }
    const observer = new ResizeObserver(measure)
    const connect = () => {
      observer.disconnect()
      content = getNewtabContentLayoutNodes().primaryContent
      grid = content?.querySelector<HTMLElement>('.bookmark-grid') || null
      if (content) observer.observe(content)
      if (grid) observer.observe(grid)
      else setLayout(null)
      measure()
    }
    connect()
    const unsubscribe = subscribeNewtabContentLayoutNodes(connect)
    window.addEventListener('resize', measure)
    return () => {
      observer.disconnect()
      unsubscribe()
      window.removeEventListener('resize', measure)
    }
  }, [enabled, view])

  return layout
}
