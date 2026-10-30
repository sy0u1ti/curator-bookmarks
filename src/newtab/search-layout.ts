export const SEARCH_HEIGHT_MIN = 36
export const SEARCH_HEIGHT_MAX = 56
export const SEARCH_WIDTH_MIN_VW = 16
export const SEARCH_WIDTH_MAX_VW = 72
export const SEARCH_WIDTH_MIN_PX = 320

export const DEFAULT_SEARCH_LAYOUT = {
  autoVerticalCenter: false,
  width: 44,
  height: 40,
  offsetY: 0
}

export const SEARCH_SIZE_PRESETS = {
  compact: 36,
  standard: DEFAULT_SEARCH_LAYOUT.height,
  comfortable: 48
} as const

export type SearchSizePreset = keyof typeof SEARCH_SIZE_PRESETS

export function getAdaptiveSearchWidthBounds({
  viewportWidth,
  containerWidth,
  automaticWidth = false,
  minWidthVw = SEARCH_WIDTH_MIN_VW,
  maxWidthVw = SEARCH_WIDTH_MAX_VW,
  minWidthPx = SEARCH_WIDTH_MIN_PX
}: {
  viewportWidth: number
  containerWidth: number
  automaticWidth?: boolean
  minWidthVw?: number
  maxWidthVw?: number
  minWidthPx?: number
}): { min: number; max: number } {
  const absoluteMin = Math.max(1, Math.floor(Math.min(minWidthVw, maxWidthVw)))
  const absoluteMax = Math.max(absoluteMin, Math.ceil(Math.max(minWidthVw, maxWidthVw)))
  const viewport = Number.isFinite(viewportWidth) ? Math.max(1, viewportWidth) : 1
  const container = Number.isFinite(containerWidth) ? Math.max(0, containerWidth) : 0
  const max = Math.min(absoluteMax, Math.max(absoluteMin, Math.floor(container / viewport * 100)))
  // Offer only widths the field can actually render. A collapsed range means
  // the available space owns the width, not a slider with no visible effect.
  const min = Math.min(max, Math.max(absoluteMin, Math.ceil(Math.max(0, minWidthPx) / viewport * 100)))
  return { min: automaticWidth ? max : min, max }
}

export function normalizeSearchHeight(value: unknown): number {
  const numeric = typeof value === 'number' || (typeof value === 'string' && value.trim())
    ? Number(value)
    : Number.NaN
  if (!Number.isFinite(numeric)) return DEFAULT_SEARCH_LAYOUT.height
  return Math.max(SEARCH_HEIGHT_MIN, Math.min(SEARCH_HEIGHT_MAX, Math.round(numeric)))
}

export function getSearchSizePreset(height: number): SearchSizePreset | 'custom' {
  return (Object.keys(SEARCH_SIZE_PRESETS) as SearchSizePreset[])
    .find(key => SEARCH_SIZE_PRESETS[key] === height) || 'custom'
}

export function resetSearchLayout<T extends typeof DEFAULT_SEARCH_LAYOUT>(settings: T): T {
  return { ...settings, ...DEFAULT_SEARCH_LAYOUT }
}
