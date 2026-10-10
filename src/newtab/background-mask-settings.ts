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

export const BACKGROUND_MASK_META: Record<BackgroundMaskStyle, {
  label: string
  description: string
  sizeLabel?: string
  spacingLabel?: string
}> = {
  dark: { label: '深色渐变', description: '压暗上下边缘，保留画面中心的细节。' },
  frosted: { label: '磨砂玻璃', description: '降低背景饱和度，配合模糊获得柔和的磨砂质感。' },
  noise: { label: '胶片噪点', description: '细腻的胶片噪点与暗色遮罩，可独立调整背景模糊。' },
  light: { label: '柔光渐变', description: '为背景叠加柔和白光；浅色壁纸建议改用深色渐变。' },
  grain: { label: '胶片颗粒', description: '保留原图细节，叠加细密颗粒。' },
  halftone: { label: '单色网点', description: '用明暗网点重绘背景，形成单色印刷效果。', sizeLabel: '网点大小', spacingLabel: '网点间距' },
  ascii: { label: 'ASCII 字符', description: '用彩色字符重绘背景；加大间距可让字符更清晰。', sizeLabel: '字符大小', spacingLabel: '字符间距' },
  'paper-texture': { label: '纸张纹理', description: '在原图上添加纸纤维与轻微褶皱。', sizeLabel: '纤维大小', spacingLabel: '褶皱大小' },
  'fluted-glass': { label: '条纹玻璃', description: '沿竖向条纹折射背景，保留原图色彩。', sizeLabel: '条纹宽度', spacingLabel: '条纹拉伸' },
  water: { label: '水面折射', description: '以缓慢流动的水纹折射背景。', sizeLabel: '水纹大小', spacingLabel: '水纹层次' },
  'image-dithering': { label: '图像抖动', description: '将颜色转成像素色阶，呈现复古点阵质感。', sizeLabel: '像素大小', spacingLabel: '颜色层次' },
  'halftone-dots': { label: '彩色网点', description: '保留原图颜色的规则印刷网点。', sizeLabel: '网格大小', spacingLabel: '网点半径' },
  'halftone-cmyk': { label: 'CMYK 网点', description: '青、品红、黄、黑四色套印效果。', sizeLabel: '网格大小', spacingLabel: '油墨柔化' }
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
  if (value == null || typeof value === 'boolean' || String(value).trim() === '') return fallback
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) {
    return fallback
  }
  return Math.round(Math.min(100, Math.max(0, numericValue)))
}

export function normalizeBackgroundMaskBlur(value: unknown, fallback = DEFAULT_BACKGROUND_MASK_BLUR): number {
  if (value == null || typeof value === 'boolean' || String(value).trim() === '') return fallback
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

export function getBackgroundMaskOverlayGradient(value: unknown, style: unknown = 'dark'): string {
  const stops = getBackgroundMaskOverlayStops(value)
  if (style === 'light') {
    return `linear-gradient(180deg, rgb(255 255 255 / ${stops.top}%) 0%, rgb(255 255 255 / ${stops.mid}%) 42%, rgb(255 255 255 / ${stops.bottom}%) 100%)`
  }
  return `linear-gradient(180deg, rgb(0 0 0 / ${stops.top}%) 0%, rgb(0 0 0 / ${stops.mid}%) 42%, rgb(0 0 0 / ${stops.bottom}%) 100%)`
}

export function getBackgroundMaskBaseColor(value: unknown, overlay: unknown = DEFAULT_BACKGROUND_MASK_OVERLAY): string {
  if (value !== 'frosted') return 'transparent'
  return `rgb(30 34 40 / ${normalizeBackgroundMaskPercentage(overlay) * 0.16}%)`
}

export function getBackgroundMaskBackdropFilter(style: unknown, blur: unknown): string {
  if (!isLegacyBackgroundMaskStyle(style)) {
    return 'none'
  }
  const effectiveBlur = normalizeBackgroundMaskBlur(blur)
  const filter = effectiveBlur > 0 ? `blur(${effectiveBlur}px)` : ''
  if (style === 'frosted') return `${filter} saturate(0.65)`.trim()
  return filter || 'none'
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
