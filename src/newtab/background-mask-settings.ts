export const LEGACY_BACKGROUND_MASK_STYLES = ['dark', 'frosted', 'noise', 'light'] as const
export const WALLPAPER_FILTER_MASK_STYLES = ['grain', 'halftone', 'ascii'] as const
export const PAPER_SHADER_MASK_STYLES = [
  'paper-texture',
  'fluted-glass',
  'water',
  'image-dithering',
  'halftone-dots',
  'halftone-cmyk'
] as const
export const BACKGROUND_MASK_STYLES = [
  ...LEGACY_BACKGROUND_MASK_STYLES,
  ...WALLPAPER_FILTER_MASK_STYLES,
  ...PAPER_SHADER_MASK_STYLES
] as const

export type BackgroundMaskStyle = (typeof BACKGROUND_MASK_STYLES)[number]
export type LegacyBackgroundMaskStyle = (typeof LEGACY_BACKGROUND_MASK_STYLES)[number]
export type WallpaperFilterMaskStyle = (typeof WALLPAPER_FILTER_MASK_STYLES)[number]
export type PaperShaderMaskStyle = (typeof PAPER_SHADER_MASK_STYLES)[number]

export const DEFAULT_BACKGROUND_MASK_STYLE: BackgroundMaskStyle = 'dark'
export const DEFAULT_BACKGROUND_MASK_BLUR = 12
export const DEFAULT_BACKGROUND_MASK_OVERLAY = 50
export const DEFAULT_BACKGROUND_MASK_FILTER_STRENGTH = 50
export const DEFAULT_BACKGROUND_MASK_FILTER_SIZE = 50
export const DEFAULT_BACKGROUND_MASK_FILTER_SPACING = 50
export const DEFAULT_BACKGROUND_MASK_FILTER_HOVER = true

const DARK_BACKGROUND_MASK_OVERLAY_STOPS = {
  top: 44,
  mid: 20,
  bottom: 50
} as const

const LEGACY_BACKGROUND_MASK_BASE_COLOR_BY_STYLE: Record<LegacyBackgroundMaskStyle, string> = {
  dark: 'rgba(0, 0, 0, 0.18)',
  frosted: 'rgba(18, 18, 20, 0.1)',
  light: 'rgba(255, 255, 255, 0.075)',
  noise: 'rgba(0, 0, 0, 0.14)'
}

const BACKGROUND_MASK_STYLE_SET = new Set<string>(BACKGROUND_MASK_STYLES)
const LEGACY_BACKGROUND_MASK_STYLE_SET = new Set<string>(LEGACY_BACKGROUND_MASK_STYLES)
const WALLPAPER_FILTER_MASK_STYLE_SET = new Set<string>(WALLPAPER_FILTER_MASK_STYLES)
const PAPER_SHADER_MASK_STYLE_SET = new Set<string>(PAPER_SHADER_MASK_STYLES)

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

export function normalizeBackgroundMaskBlur(value: unknown, fallback = DEFAULT_BACKGROUND_MASK_BLUR): number {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) {
    return fallback
  }
  return Math.round(Math.min(32, Math.max(0, numericValue)))
}

export function snapBackgroundMaskPercentage(value: unknown): number {
  const normalized = normalizeBackgroundMaskPercentage(value, 50)
  if (Math.abs(normalized) <= 4) return 0
  if (Math.abs(normalized - 50) <= 4) return 50
  return normalized
}

export function isLegacyBackgroundMaskStyle(value: unknown): value is LegacyBackgroundMaskStyle {
  return LEGACY_BACKGROUND_MASK_STYLE_SET.has(String(value || ''))
}

export function isWallpaperFilterMaskStyle(value: unknown): value is WallpaperFilterMaskStyle {
  return WALLPAPER_FILTER_MASK_STYLE_SET.has(String(value || ''))
}

export function isPaperShaderMaskStyle(value: unknown): value is PaperShaderMaskStyle {
  return PAPER_SHADER_MASK_STYLE_SET.has(String(value || ''))
}

export function isBackgroundMaskFilterStyle(value: unknown): boolean {
  return isWallpaperFilterMaskStyle(value) || isPaperShaderMaskStyle(value)
}

export function doesBackgroundMaskFilterSupportGeometry(value: unknown): boolean {
  return value === 'halftone' ||
    value === 'ascii' ||
    value === 'paper-texture' ||
    value === 'fluted-glass' ||
    value === 'water' ||
    value === 'image-dithering' ||
    value === 'halftone-dots' ||
    value === 'halftone-cmyk'
}

export function doesBackgroundMaskFilterSupportHover(value: unknown): boolean {
  return value === 'halftone' || value === 'ascii'
}

export function getBackgroundMaskOverlayStops(value: unknown): {
  top: number
  mid: number
  bottom: number
} {
  const strength = normalizeBackgroundMaskPercentage(value, DEFAULT_BACKGROUND_MASK_OVERLAY)
  return {
    top: getBackgroundMaskOverlayStop(DARK_BACKGROUND_MASK_OVERLAY_STOPS.top, strength),
    mid: getBackgroundMaskOverlayStop(DARK_BACKGROUND_MASK_OVERLAY_STOPS.mid, strength),
    bottom: getBackgroundMaskOverlayStop(DARK_BACKGROUND_MASK_OVERLAY_STOPS.bottom, strength)
  }
}

export function getBackgroundMaskOverlayGradient(value: unknown): string {
  const stops = getBackgroundMaskOverlayStops(value)
  return `linear-gradient(180deg, rgb(0 0 0 / ${stops.top}%) 0%, rgb(0 0 0 / ${stops.mid}%) 42%, rgb(0 0 0 / ${stops.bottom}%) 100%)`
}

export function getBackgroundMaskBaseColor(value: unknown): string {
  return isLegacyBackgroundMaskStyle(value)
    ? LEGACY_BACKGROUND_MASK_BASE_COLOR_BY_STYLE[value]
    : 'transparent'
}

export function getBackgroundMaskBackdropFilter(style: unknown, blur: unknown): string {
  if (!isLegacyBackgroundMaskStyle(style)) {
    return 'none'
  }
  const effectiveBlur = Math.min(8, normalizeBackgroundMaskBlur(blur) / 3)
  return `blur(${Number(effectiveBlur.toFixed(4))}px) saturate(1.02) brightness(0.98)`
}

function getBackgroundMaskOverlayStop(base: number, strength: number): number {
  if (strength <= 50) {
    return roundOverlayStop(base * Math.pow(strength / 50, 1.08))
  }
  const progress = (strength - 50) / 50
  return roundOverlayStop(base + ((100 - base) * Math.pow(progress, 1.08)))
}

function roundOverlayStop(value: number): number {
  return Number(value.toFixed(1))
}
