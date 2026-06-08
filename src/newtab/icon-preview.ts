import {
  type IconSettings,
  getEffectiveIconTileWidthPx,
  getIconGapPx,
  getIconRowGapPx
} from './icon-settings.js'
import { dispatchNewtabIconPreviewView } from './newtab-icon-preview-store.js'

export function getIconPreviewSignature(settings: IconSettings): string {
  return [
    settings.pageWidth,
    settings.columnGap,
    settings.rowGap,
    settings.tileWidth,
    settings.iconShellSize,
    settings.layoutMode,
    settings.columns,
    settings.verticalCenter ? 1 : 0,
    settings.showTitles ? 1 : 0,
    settings.titleLines
  ].join('|')
}

export function renderIconPreviewElement(
  preview: HTMLElement,
  settings: IconSettings
): void {
  const previewColumnGap = Math.max(4, Math.round(getIconGapPx(settings.columnGap) * 0.34))
  const previewRowGap = Math.max(4, Math.round(getIconRowGapPx(settings.rowGap) * 0.34))
  const effectiveTileWidth = getEffectiveIconTileWidthPx(settings)
  const previewTileWidth = Math.max(48, Math.round(effectiveTileWidth * 0.42))
  const previewShellSize = Math.max(18, Math.round(settings.iconShellSize * 0.62))
  const previewColumns = settings.layoutMode === 'fixed'
    ? Math.max(2, Math.min(6, settings.columns))
    : Math.max(2, Math.min(4, Math.round(settings.pageWidth / 24)))
  const previewGridMaxWidth = previewColumns * previewTileWidth + (previewColumns - 1) * previewColumnGap
  const sampleCount = Math.max(4, Math.min(8, previewColumns * 2))
  const summary = [
    settings.layoutMode === 'fixed' ? `${settings.columns} 列固定` : '自动适配',
    `${settings.tileWidth}px 卡片`,
    `${settings.iconShellSize}px 图标区`,
    settings.showTitles ? `${settings.titleLines} 行标题` : '图标模式'
  ].join(' · ')
  const signature = getIconPreviewSignature(settings)

  if (preview.dataset.iconPreviewSignature === signature && preview.firstElementChild) {
    return
  }

  const names = ['阅读', '工作台', '邮箱', '文档', '设计', '数据', '日程', '收藏']
  preview.dataset.iconPreviewSignature = signature
  dispatchNewtabIconPreviewView({
    columns: previewColumns,
    layoutMode: settings.layoutMode,
    pageWidth: settings.pageWidth,
    previewColumnGap,
    previewGridMaxWidth,
    previewRowGap,
    previewShellSize,
    previewTileWidth,
    showTitles: settings.showTitles,
    summary,
    titleLines: settings.titleLines,
    verticalCenter: settings.verticalCenter,
    tiles: Array.from({ length: sampleCount }, (_, index) => ({
      id: `${index}:${names[index] || ''}`,
      mark: names[index]?.slice(0, 1) || '*',
      title: names[index] || ''
    }))
  })
}
