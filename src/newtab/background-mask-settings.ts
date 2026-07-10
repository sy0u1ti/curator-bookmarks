export const LEGACY_BACKGROUND_MASK_STYLES = ['dark', 'frosted', 'noise', 'light'] as const
export const WALLPAPER_FILTER_MASK_STYLES = ['grain', 'halftone', 'ascii'] as const
export const BACKGROUND_MASK_STYLES = [
  ...LEGACY_BACKGROUND_MASK_STYLES,
  ...WALLPAPER_FILTER_MASK_STYLES
] as const

export type BackgroundMaskStyle = (typeof BACKGROUND_MASK_STYLES)[number]
export type LegacyBackgroundMaskStyle = (typeof LEGACY_BACKGROUND_MASK_STYLES)[number]
export type WallpaperFilterMaskStyle = (typeof WALLPAPER_FILTER_MASK_STYLES)[number]

export const DEFAULT_BACKGROUND_MASK_STYLE: BackgroundMaskStyle = 'dark'
export const DEFAULT_BACKGROUND_MASK_BLUR = 12
export const DEFAULT_BACKGROUND_MASK_FILTER_STRENGTH = 50
export const DEFAULT_BACKGROUND_MASK_FILTER_SIZE = 50
export const DEFAULT_BACKGROUND_MASK_FILTER_SPACING = 50

const BACKGROUND_MASK_STYLE_SET = new Set<string>(BACKGROUND_MASK_STYLES)
const LEGACY_BACKGROUND_MASK_STYLE_SET = new Set<string>(LEGACY_BACKGROUND_MASK_STYLES)
const WALLPAPER_FILTER_MASK_STYLE_SET = new Set<string>(WALLPAPER_FILTER_MASK_STYLES)

export function normalizeBackgroundMaskStyle(value: unknown): BackgroundMaskStyle {
  const style = String(value || '')
  return BACKGROUND_MASK_STYLE_SET.has(style)
    ? style as BackgroundMaskStyle
    : DEFAULT_BACKGROUND_MASK_STYLE
}

export function normalizeBackgroundMaskPercentage(value: unknown, fallback = 50): number {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) {
    return fallback
  }
  return Math.round(Math.min(100, Math.max(0, numericValue)))
}

export function isLegacyBackgroundMaskStyle(value: unknown): value is LegacyBackgroundMaskStyle {
  return LEGACY_BACKGROUND_MASK_STYLE_SET.has(String(value || ''))
}

export function isWallpaperFilterMaskStyle(value: unknown): value is WallpaperFilterMaskStyle {
  return WALLPAPER_FILTER_MASK_STYLE_SET.has(String(value || ''))
}

export function doesBackgroundMaskFilterSupportGeometry(value: unknown): boolean {
  return value === 'halftone' || value === 'ascii'
}
