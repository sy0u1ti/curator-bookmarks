export const WALLPAPER_MASK_STYLES = ['dim', 'gradient', 'frosted'] as const
export type WallpaperMaskStyle = (typeof WALLPAPER_MASK_STYLES)[number]

export interface WallpaperAdjustments {
  enabled: boolean
  style: WallpaperMaskStyle
  dim: number
  blur: number
}

export interface WallpaperAdjustmentFields {
  wallpaperEnabled: boolean
  wallpaperStyle: WallpaperMaskStyle
  wallpaperDim: number
  wallpaperBlur: number
}

export const WALLPAPER_DIM_MAX = 100
export const WALLPAPER_BLUR_MAX = 32
export const WALLPAPER_MASK_PRESETS = {
  dim: { label: '均匀暗化', blur: 0 },
  gradient: { label: '柔和渐暗', blur: 0 },
  frosted: { label: '轻磨砂', blur: 8 }
} as const satisfies Record<WallpaperMaskStyle, { label: string; blur: number }>

export const DEFAULT_WALLPAPER_ADJUSTMENTS: Readonly<WallpaperAdjustments> = Object.freeze({
  enabled: false,
  style: 'dim',
  dim: 30,
  blur: 0
})

export const NO_WALLPAPER_ADJUSTMENTS: Readonly<WallpaperAdjustments> = Object.freeze({
  ...DEFAULT_WALLPAPER_ADJUSTMENTS,
  dim: 0,
  blur: 0
})

const WALLPAPER_ADJUSTMENT_KEYS = [
  'wallpaperEnabled', 'wallpaperStyle', 'wallpaperDim', 'wallpaperBlur'
] as const
const WALLPAPER_MASK_STYLE_SET = new Set<string>(WALLPAPER_MASK_STYLES)
const LEGACY_MASK_KEYS = ['maskEnabled', 'maskStyle', 'maskOverlay', 'maskBlur', 'maskFilterStrength']

export function normalizeWallpaperMaskStyle(value: unknown): WallpaperMaskStyle {
  if (value === 'dark' || value === 'light') return 'gradient'
  if (value === 'grain' || value === 'noise') return 'dim'
  return typeof value === 'string' && WALLPAPER_MASK_STYLE_SET.has(value)
    ? value as WallpaperMaskStyle
    : DEFAULT_WALLPAPER_ADJUSTMENTS.style
}

export function normalizeWallpaperAdjustment(value: unknown, max: number, fallback: number): number {
  if ((typeof value !== 'number' && typeof value !== 'string') || String(value).trim() === '') return fallback
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) return fallback
  return Math.round(Math.min(max, Math.max(0, numericValue)))
}

export function hasWallpaperAdjustmentFields(record: unknown): boolean {
  const source = asRecord(record)
  return [...WALLPAPER_ADJUSTMENT_KEYS, ...LEGACY_MASK_KEYS].some(key => Object.hasOwn(source, key))
}

export function readWallpaperAdjustments(record: unknown): WallpaperAdjustments {
  const source = asRecord(record)
  if (WALLPAPER_ADJUSTMENT_KEYS.some(key => Object.hasOwn(source, key))) {
    const style = normalizeWallpaperMaskStyle(source.wallpaperStyle)
    return {
      enabled: source.wallpaperEnabled === undefined || source.wallpaperEnabled === true,
      style,
      dim: normalizeWallpaperAdjustment(source.wallpaperDim, WALLPAPER_DIM_MAX, DEFAULT_WALLPAPER_ADJUSTMENTS.dim),
      blur: normalizeWallpaperAdjustment(source.wallpaperBlur, WALLPAPER_BLUR_MAX, WALLPAPER_MASK_PRESETS[style].blur)
    }
  }
  if (!LEGACY_MASK_KEYS.some(key => Object.hasOwn(source, key))) {
    return { ...DEFAULT_WALLPAPER_ADJUSTMENTS }
  }
  const style = normalizeWallpaperMaskStyle(source.maskStyle)
  return {
    enabled: source.maskEnabled === true,
    style,
    dim: normalizeWallpaperAdjustment(source.maskOverlay, WALLPAPER_DIM_MAX, 50),
    blur: source.maskStyle === 'grain' ? 0 : normalizeWallpaperAdjustment(source.maskBlur, WALLPAPER_BLUR_MAX, 12)
  }
}

export function toWallpaperAdjustmentFields(adjustments: WallpaperAdjustments): WallpaperAdjustmentFields {
  return {
    wallpaperEnabled: adjustments.enabled === true,
    wallpaperStyle: normalizeWallpaperMaskStyle(adjustments.style),
    wallpaperDim: normalizeWallpaperAdjustment(adjustments.dim, WALLPAPER_DIM_MAX, DEFAULT_WALLPAPER_ADJUSTMENTS.dim),
    wallpaperBlur: normalizeWallpaperAdjustment(adjustments.blur, WALLPAPER_BLUR_MAX, DEFAULT_WALLPAPER_ADJUSTMENTS.blur)
  }
}

export function doesBackgroundTypeTakeWallpaperAdjustments(type: unknown): boolean {
  return ['image', 'video', 'urls', 'featured'].includes(String(type))
}

export function haveSameWallpaperSource(previous: Record<string, unknown>, next: Record<string, unknown>): boolean {
  const keys = new Set([...Object.keys(previous), ...Object.keys(next)])
  return [...keys].every(key => WALLPAPER_ADJUSTMENT_KEYS.some(field => field === key) || Object.is(previous[key], next[key]))
}

export function getEffectiveWallpaperAdjustments(settings: WallpaperAdjustmentFields & { type: unknown }): WallpaperAdjustments {
  const adjustments = readWallpaperAdjustments(settings)
  return {
    ...adjustments,
    enabled: adjustments.enabled && doesBackgroundTypeTakeWallpaperAdjustments(settings.type)
  }
}

export function resolveStartupWallpaperAdjustments(
  snapshot: unknown,
  legacySnapshot: unknown,
  target: unknown,
  texture = false
): WallpaperAdjustments {
  if (texture) return { ...NO_WALLPAPER_ADJUSTMENTS }
  if (hasWallpaperAdjustmentFields(snapshot)) return readWallpaperAdjustments(snapshot)
  if (!asRecord(target).signature) return { ...NO_WALLPAPER_ADJUSTMENTS }
  if (hasWallpaperAdjustmentFields(legacySnapshot)) return readWallpaperAdjustments(legacySnapshot)
  if (hasWallpaperAdjustmentFields(target)) return readWallpaperAdjustments(target)
  return { ...DEFAULT_WALLPAPER_ADJUSTMENTS, enabled: true }
}

export function getWallpaperAdjustmentStyles(adjustments: WallpaperAdjustments): Record<string, string> {
  const { enabled, style, dim, blur: storedBlur } = readWallpaperAdjustments(
    toWallpaperAdjustmentFields(adjustments)
  )
  const blur = enabled ? storedBlur : 0
  return {
    '--wallpaper-filter': blur > 0 ? `blur(${blur}px)` : 'none',
    '--wallpaper-overscan': `${blur * 2}px`,
    '--wallpaper-dim': enabled && dim > 0 ? '1' : '0',
    '--wallpaper-dim-image': enabled && dim > 0 ? getWallpaperDimImage(style, dim) : 'none'
  }
}

export function applyWallpaperAdjustments(root: HTMLElement, adjustments: WallpaperAdjustments): void {
  for (const [property, value] of Object.entries(getWallpaperAdjustmentStyles(adjustments))) {
    if (root.style.getPropertyValue(property) !== value) root.style.setProperty(property, value)
  }
}

function getWallpaperDimImage(style: WallpaperMaskStyle, amount: number): string {
  if (style !== 'gradient') return `linear-gradient(rgb(0 0 0 / ${amount}%), rgb(0 0 0 / ${amount}%))`
  const bases = [44, 20, 50]
  const stops = bases.map(base => {
    const opacity = amount <= 50
      ? base * Math.pow(amount / 50, 1.08)
      : base + (100 - base) * Math.pow((amount - 50) / 50, 1.08)
    return `rgb(0 0 0 / ${Number(opacity.toFixed(1))}%)`
  })
  return `linear-gradient(180deg, ${stops[0]} 0%, ${stops[1]} 42%, ${stops[2]} 100%)`
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}
