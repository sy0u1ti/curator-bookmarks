export const SEARCH_HEIGHT_MIN = 36
export const SEARCH_HEIGHT_MAX = 56
export const SEARCH_HEIGHT_STEP = 2
export const SEARCH_WIDTH_MIN_VW = 16
export const SEARCH_WIDTH_MAX_VW = 72
export const SEARCH_WIDTH_MIN_PX = 320

export const DEFAULT_SEARCH_LAYOUT = {
  autoVerticalCenter: false,
  width: 44,
  height: 40,
  offsetY: 0
}

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
  const clamped = Math.max(SEARCH_HEIGHT_MIN, Math.min(SEARCH_HEIGHT_MAX, numeric))
  const stepped = Math.round((clamped - SEARCH_HEIGHT_MIN) / SEARCH_HEIGHT_STEP) * SEARCH_HEIGHT_STEP + SEARCH_HEIGHT_MIN
  return Math.max(SEARCH_HEIGHT_MIN, Math.min(SEARCH_HEIGHT_MAX, stepped))
}

export function resetSearchLayout<T extends typeof DEFAULT_SEARCH_LAYOUT>(settings: T): T {
  return { ...settings, ...DEFAULT_SEARCH_LAYOUT }
}
