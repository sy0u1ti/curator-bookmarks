import {
  type IconSettings,
  getEffectiveIconTileWidthPx,
  getIconGapPx,
  getFolderGapPx,
  getIconRowGapPx
} from './icon-settings.js'
import {
  createNewtabIconPreviewView,
  dispatchNewtabIconPreviewView
} from './newtab-icon-preview-store.js'

const PREVIEW_BOOKMARKS = [
  { title: 'React · useTransition 与并发更新', mark: 'R', ink: '#161618' },
  { title: 'React · useDeferredValue 与搜索性能', mark: 'R', ink: '#f5f5f7' },
  { title: 'MDN Web Docs — CSS container queries', mark: 'M', ink: '#161618' },
  { title: '设计系统：颜色、对比度与可访问性', mark: '设', ink: '#80bca8' }
].map(item => ({
  ...item,
  iconSource: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><text x="16" y="25" text-anchor="middle" font-family="sans-serif" font-size="26" font-weight="700" fill="${item.ink}">${item.mark}</text></svg>`)}`
}))

export function getIconPreviewSignature(settings: IconSettings): string {
  return [
    settings.pageWidth,
    settings.columnGap,
    settings.rowGap,
    settings.folderGap,
    settings.tileWidth,
    settings.iconShellSize,
    settings.layoutMode,
    settings.columns,
    settings.verticalCenter ? 1 : 0,
    settings.showTitles ? 1 : 0,
    settings.titleLines
  ].join('|')
}

export function dispatchIconPreviewViewForSettings(settings: IconSettings): void {
  const previewColumnGap = getIconGapPx(settings.columnGap)
  const previewRowGap = getIconRowGapPx(settings.rowGap)
  const effectiveTileWidth = getEffectiveIconTileWidthPx(settings)
  const previewTileWidth = effectiveTileWidth
  const previewColumns = settings.layoutMode === 'fixed'
    ? settings.columns
    : settings.showTitles ? 2 : 4

  dispatchNewtabIconPreviewView(createNewtabIconPreviewView(
    settings,
    {
      columns: previewColumns,
      previewColumnGap,
      previewRowGap,
      previewTileWidth,
      tiles: PREVIEW_BOOKMARKS.map((item, index) => ({
        id: String(index),
        ...item
      }))
    },
    {
      effectiveColumnGap: getIconGapPx(settings.columnGap),
      effectiveFolderGap: getFolderGapPx(settings.folderGap),
      effectiveRowGap: getIconRowGapPx(settings.rowGap)
    }
  ))
}
