const ICON_PAGE_WIDTH_REFERENCE_PX = 1920

export const ICON_LAYOUT_PRESETS = {
  compact: {
    tileWidth: 72,
    iconShellSize: 36,
    pageWidth: 56,
    columnGap: 6,
    rowGap: 6,
    folderGap: 12,
    layoutMode: 'auto',
    columns: 8,
    showTitles: true,
    titleLines: 1
  },
  comfortable: {
    tileWidth: 82,
    iconShellSize: 44,
    pageWidth: 64,
    columnGap: 18,
    rowGap: 18,
    folderGap: 22,
    layoutMode: 'auto',
    columns: 6,
    showTitles: true,
    titleLines: 2
  },
  spacious: {
    tileWidth: 98,
    iconShellSize: 54,
    pageWidth: 76,
    columnGap: 30,
    rowGap: 28,
    folderGap: 34,
    layoutMode: 'auto',
    columns: 5,
    showTitles: true,
    titleLines: 2
  }
} as const

export type IconLayoutPresetKey = keyof typeof ICON_LAYOUT_PRESETS
export type IconLayoutMode = 'auto' | 'fixed'

export interface IconSettings {
  pageWidth: number
  columnGap: number
  rowGap: number
  folderGap: number
  tileWidth: number
  iconShellSize: number
  preset: string
  layoutMode: IconLayoutMode
  columns: number
  showTitles: boolean
  titleLines: number
  verticalCenter: boolean
}

type IconPresetValues = Omit<IconSettings, 'preset' | 'verticalCenter'>

export const ICON_PRESET_META: Record<IconLayoutPresetKey, {
  name: string
  desc: string
  detail: string
  cols: number
  rows: number
}> = {
  compact: { name: '紧凑', desc: '8 列 · 36px', detail: '高频访问 · 单行标题', cols: 5, rows: 3 },
  comfortable: { name: '均衡', desc: '6 列 · 44px', detail: '日常桌面 · 双行标题', cols: 4, rows: 3 },
  spacious: { name: '展示', desc: '5 列 · 54px', detail: '大屏展示 · 宽松间距', cols: 3, rows: 2 }
}

export const DEFAULT_ICON_SETTINGS: IconSettings = {
  pageWidth: 64,
  columnGap: 18,
  rowGap: 18,
  folderGap: 22,
  tileWidth: 82,
  iconShellSize: 44,
  preset: 'comfortable',
  layoutMode: 'auto',
  columns: 6,
  showTitles: true,
  titleLines: 2,
  verticalCenter: false
}

const SUPPORTED_LAYOUT_MODES = new Set(['auto', 'fixed'])

export function normalizeIconSettings(rawSettings: unknown): IconSettings {
  const settings = rawSettings && typeof rawSettings === 'object' && !Array.isArray(rawSettings)
    ? rawSettings as Record<string, unknown>
    : {}
  const legacySpacing = settings.spacing

  const pageWidth = clampNumber(settings.pageWidth, 16, 100, DEFAULT_ICON_SETTINGS.pageWidth)
  const columnGap = clampNumber(
    settings.columnGap ?? legacySpacing,
    0,
    100,
    DEFAULT_ICON_SETTINGS.columnGap
  )
  const rowGap = clampNumber(
    settings.rowGap ?? legacySpacing,
    0,
    100,
    DEFAULT_ICON_SETTINGS.rowGap
  )
  const folderGap = clampNumber(settings.folderGap, 0, 120, DEFAULT_ICON_SETTINGS.folderGap)
  const tileWidth = clampNumber(settings.tileWidth, 60, 126, DEFAULT_ICON_SETTINGS.tileWidth)
  const iconShellSize = clampNumber(settings.iconShellSize, 28, 72, DEFAULT_ICON_SETTINGS.iconShellSize)
  const layoutMode = SUPPORTED_LAYOUT_MODES.has(String(settings.layoutMode))
    ? String(settings.layoutMode) as IconLayoutMode
    : DEFAULT_ICON_SETTINGS.layoutMode
  const columns = clampNumber(settings.columns, 3, 12, DEFAULT_ICON_SETTINGS.columns)
  const showTitles = typeof settings.showTitles === 'boolean'
    ? settings.showTitles
    : DEFAULT_ICON_SETTINGS.showTitles
  const titleLines = clampNumber(settings.titleLines, 1, 2, DEFAULT_ICON_SETTINGS.titleLines)
  const verticalCenter = typeof settings.verticalCenter === 'boolean'
    ? settings.verticalCenter
    : DEFAULT_ICON_SETTINGS.verticalCenter

  const preset = detectPresetFromValues({
    pageWidth,
    columnGap,
    rowGap,
    folderGap,
    tileWidth,
    iconShellSize,
    layoutMode,
    columns,
    showTitles,
    titleLines
  })

  return {
    pageWidth,
    columnGap,
    rowGap,
    folderGap,
    tileWidth,
    iconShellSize,
    preset,
    layoutMode,
    columns,
    showTitles,
    titleLines,
    verticalCenter
  }
}

export function detectPresetFromValues(settings: IconPresetValues): string {
  for (const [key, preset] of Object.entries(ICON_LAYOUT_PRESETS)) {
    if (
      settings.pageWidth === preset.pageWidth &&
      settings.columnGap === preset.columnGap &&
      settings.rowGap === preset.rowGap &&
      settings.folderGap === preset.folderGap &&
      settings.tileWidth === preset.tileWidth &&
      settings.iconShellSize === preset.iconShellSize &&
      settings.layoutMode === preset.layoutMode &&
      settings.columns === preset.columns &&
      settings.showTitles === preset.showTitles &&
      settings.titleLines === preset.titleLines
    ) {
      return key
    }
  }
  return 'custom'
}

export function getIconPageWidthPx(pageWidth: number): number {
  return Math.round((clampNumber(pageWidth, 16, 100, DEFAULT_ICON_SETTINGS.pageWidth) / 100) * ICON_PAGE_WIDTH_REFERENCE_PX)
}

export function getIconGapPx(spacing: number): number {
  return clampNumber(14 + spacing, 14, 114, 32)
}

export function getIconRowGapPx(spacing: number): number {
  return clampNumber(2 + spacing, 2, 102, 20)
}

export function getFolderGapPx(folderGap: number): number {
  return clampNumber(folderGap, 0, 120, DEFAULT_ICON_SETTINGS.folderGap)
}

export function getFixedIconGridWidthPx(settings: IconSettings): number {
  const columns = clampNumber(settings.columns, 3, 12, DEFAULT_ICON_SETTINGS.columns)
  const gap = getIconGapPx(settings.columnGap)
  return Math.round(columns * settings.tileWidth + Math.max(columns - 1, 0) * gap)
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const numeric = Math.round(Number(value))
  if (!Number.isFinite(numeric)) {
    return fallback
  }
  return Math.max(min, Math.min(max, numeric))
}
