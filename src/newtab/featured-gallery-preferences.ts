export interface FeaturedBackgroundPreferences {
  displaySize: number
  positionX: number
  positionY: number
}

export interface FeaturedBackgroundDisplayCss {
  backgroundSize: string
  backgroundPosition: string
}

export interface FeaturedBackgroundImageSize {
  width: number
  height: number
}

export const FEATURED_BACKGROUND_DISPLAY_LIMITS = {
  displaySize: {
    min: 100,
    max: 180
  },
  positionX: {
    min: 0,
    max: 100
  },
  positionY: {
    min: 0,
    max: 100
  }
} as const

export const DEFAULT_FEATURED_BACKGROUND_PREFERENCES: FeaturedBackgroundPreferences = {
  displaySize: 100,
  positionX: 50,
  positionY: 50
}

export function normalizeFeaturedBackgroundPreferences(rawPreferences: unknown): FeaturedBackgroundPreferences {
  if (!rawPreferences || typeof rawPreferences !== 'object' || Array.isArray(rawPreferences)) {
    return { ...DEFAULT_FEATURED_BACKGROUND_PREFERENCES }
  }

  const preferences = rawPreferences as Record<string, unknown>
  return {
    ...DEFAULT_FEATURED_BACKGROUND_PREFERENCES,
    displaySize: clampPreferenceDimension(
      preferences.displaySize,
      FEATURED_BACKGROUND_DISPLAY_LIMITS.displaySize.min,
      FEATURED_BACKGROUND_DISPLAY_LIMITS.displaySize.max,
      DEFAULT_FEATURED_BACKGROUND_PREFERENCES.displaySize
    ),
    positionX: clampPreferenceDimension(
      preferences.positionX,
      FEATURED_BACKGROUND_DISPLAY_LIMITS.positionX.min,
      FEATURED_BACKGROUND_DISPLAY_LIMITS.positionX.max,
      DEFAULT_FEATURED_BACKGROUND_PREFERENCES.positionX
    ),
    positionY: clampPreferenceDimension(
      preferences.positionY,
      FEATURED_BACKGROUND_DISPLAY_LIMITS.positionY.min,
      FEATURED_BACKGROUND_DISPLAY_LIMITS.positionY.max,
      DEFAULT_FEATURED_BACKGROUND_PREFERENCES.positionY
    )
  }
}

export function getFeaturedBackgroundDisplayCss(
  preferences: FeaturedBackgroundPreferences,
  imageSize?: FeaturedBackgroundImageSize | null
): FeaturedBackgroundDisplayCss {
  const normalized = normalizeFeaturedBackgroundPreferences(preferences)
  const aspectRatio = getValidImageAspectRatio(imageSize)
  return {
    backgroundSize: aspectRatio
      ? `max(${normalized.displaySize}vw, ${formatCssNumber(aspectRatio * normalized.displaySize)}vh) auto`
      : 'cover',
    backgroundPosition: `${normalized.positionX}% ${normalized.positionY}%`
  }
}

function clampPreferenceDimension(value: unknown, min: number, max: number, fallback: number): number {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) {
    return fallback
  }
  return Math.max(min, Math.min(max, Math.round(numericValue)))
}

function getValidImageAspectRatio(imageSize?: FeaturedBackgroundImageSize | null): number {
  if (!imageSize) {
    return 0
  }
  const width = Number(imageSize.width)
  const height = Number(imageSize.height)
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return 0
  }
  return width / height
}

function formatCssNumber(value: number): string {
  return Number(value.toFixed(4)).toString()
}
