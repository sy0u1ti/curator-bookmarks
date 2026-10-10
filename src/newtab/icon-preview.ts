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
  const previewColumnGap = Math.round(getIconGapPx(settings.columnGap) * 0.34)
  const previewRowGap = Math.round(getIconRowGapPx(settings.rowGap) * 0.34)
  const effectiveTileWidth = getEffectiveIconTileWidthPx(settings)
  const previewTileWidth = Math.max(48, Math.round(effectiveTileWidth * 0.42))
  const previewShellSize = Math.max(18, Math.round(settings.iconShellSize * 0.62))
  const previewColumns = settings.layoutMode === 'fixed'
    ? settings.columns
    : Math.max(2, Math.min(4, Math.round(settings.pageWidth / 24)))
  const previewGridMaxWidth = previewColumns * previewTileWidth + (previewColumns - 1) * previewColumnGap
  const sampleCount = previewColumns * 2
  const summary = [
    settings.layoutMode === 'fixed' ? `${settings.columns} 列固定` : '自动适配',
    `${effectiveTileWidth}px 卡片`,
    `${settings.iconShellSize}px 图标区`,
    settings.showTitles ? `${settings.titleLines} 行标题` : '图标模式'
  ].join(' · ')

  const names = ['阅读', '工作台', '邮箱', '文档', '设计', '数据', '日程', '收藏']
  dispatchNewtabIconPreviewView(createNewtabIconPreviewView(
    settings,
    {
      columns: previewColumns,
      previewColumnGap,
      previewGridMaxWidth,
      previewRowGap,
      previewShellSize,
      previewTileWidth,
      summary,
      tiles: Array.from({ length: sampleCount }, (_, index) => ({
        id: String(index),
        mark: names[index % names.length].slice(0, 1),
        title: names[index % names.length]
      }))
    },
    {
      effectiveColumnGap: getIconGapPx(settings.columnGap),
      effectiveFolderGap: getFolderGapPx(settings.folderGap),
      effectiveRowGap: getIconRowGapPx(settings.rowGap)
    }
  ))
}
