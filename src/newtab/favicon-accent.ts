import type { FaviconAccentColor } from './favicon-cache.js'

export function selectFaviconAccentColor(
  pixels: ArrayLike<number>,
  {
    minAlpha = 28,
    quantizeStep = 24
  }: {
    minAlpha?: number
    quantizeStep?: number
  } = {}
): FaviconAccentColor | null {
  const buckets = new Map<string, {
    r: number
    g: number
    b: number
    weight: number
    score: number
  }>()
  const fallback = {
    r: 0,
    g: 0,
    b: 0,
    weight: 0
  }

  for (let index = 0; index + 3 < pixels.length; index += 4) {
    const alpha = clampInteger(pixels[index + 3], 0, 255, 255)
    if (alpha < minAlpha) {
      continue
    }

    const r = clampInteger(pixels[index], 0, 255, 0)
    const g = clampInteger(pixels[index + 1], 0, 255, 0)
    const b = clampInteger(pixels[index + 2], 0, 255, 0)
    const saturation = getRgbSaturation(r, g, b)
    const luminance = getRgbLuminance(r, g, b)
    const alphaWeight = alpha / 255
    fallback.r += r * alphaWeight
    fallback.g += g * alphaWeight
    fallback.b += b * alphaWeight
    fallback.weight += alphaWeight

    if (saturation < 12 && (luminance < 56 || luminance > 216)) {
      continue
    }

    const saturationBoost = 1 + Math.min(saturation, 128) / 128
    const luminancePenalty = luminance < 32 || luminance > 238 ? 0.5 : 1
    const weight = alphaWeight * saturationBoost * luminancePenalty
    const key = [
      quantizeColorChannel(r, quantizeStep),
      quantizeColorChannel(g, quantizeStep),
      quantizeColorChannel(b, quantizeStep)
    ].join(',')
    const bucket = buckets.get(key) || {
      r: 0,
      g: 0,
      b: 0,
      weight: 0,
      score: 0
    }
    bucket.r += r * weight
    bucket.g += g * weight
    bucket.b += b * weight
    bucket.weight += weight
    bucket.score += weight
    buckets.set(key, bucket)
  }

  const rankedBuckets = [...buckets.values()]
    .filter((bucket) => bucket.weight > 0)
    .sort((left, right) => right.score - left.score)

  const bestBucket = rankedBuckets[0]
  if (bestBucket) {
    return normalizeFaviconAccentColor({
      r: bestBucket.r / bestBucket.weight,
      g: bestBucket.g / bestBucket.weight,
      b: bestBucket.b / bestBucket.weight
    })
  }

  if (fallback.weight <= 0) {
    return null
  }

  const fallbackColor = normalizeFaviconAccentColor({
    r: fallback.r / fallback.weight,
    g: fallback.g / fallback.weight,
    b: fallback.b / fallback.weight
  })
  if (!fallbackColor) {
    return null
  }

  const saturation = getRgbSaturation(fallbackColor.r, fallbackColor.g, fallbackColor.b)
  const luminance = getRgbLuminance(fallbackColor.r, fallbackColor.g, fallbackColor.b)
  return saturation < 8 && (luminance < 44 || luminance > 224)
    ? null
    : fallbackColor
}

function normalizeFaviconAccentColor(rawColor: unknown): FaviconAccentColor | null {
  if (!rawColor || typeof rawColor !== 'object' || Array.isArray(rawColor)) {
    return null
  }

  const color = rawColor as Partial<FaviconAccentColor>
  return {
    r: clampInteger(color.r, 0, 255, 0),
    g: clampInteger(color.g, 0, 255, 0),
    b: clampInteger(color.b, 0, 255, 0)
  }
}

function quantizeColorChannel(value: number, step: number): number {
  const normalizedStep = clampInteger(step, 4, 64, 24)
  return clampInteger(Math.round(value / normalizedStep) * normalizedStep, 0, 255, 0)
}

function getRgbSaturation(r: number, g: number, b: number): number {
  return Math.max(r, g, b) - Math.min(r, g, b)
}

function getRgbLuminance(r: number, g: number, b: number): number {
  return (0.2126 * r) + (0.7152 * g) + (0.0722 * b)
}

function clampInteger(value: unknown, min: number, max: number, fallback: number): number {
  const numeric = Math.round(Number(value))
  if (!Number.isFinite(numeric)) {
    return fallback
  }
  return Math.max(min, Math.min(max, numeric))
}
