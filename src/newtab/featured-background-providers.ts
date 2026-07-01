export const FEATURED_BACKGROUND_PROVIDERS = [
  'nasa',
  'wikimedia',
  'met',
  'cleveland'
] as const
export const FEATURED_BACKGROUND_PROVIDER_DISPLAY_LIMIT = 12

export type FeaturedBackgroundProvider = typeof FEATURED_BACKGROUND_PROVIDERS[number]

export function isFeaturedBackgroundProvider(value: unknown): value is FeaturedBackgroundProvider {
  return FEATURED_BACKGROUND_PROVIDERS.includes(value as FeaturedBackgroundProvider)
}
