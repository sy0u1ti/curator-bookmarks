export interface SpeedDialFaviconLoadAttributes {
  loading: 'eager' | 'lazy'
  fetchpriority: 'high' | 'auto'
}

const SPEED_DIAL_EAGER_FAVICON_LIMIT = 8
const SPEED_DIAL_HIGH_PRIORITY_FAVICON_LIMIT = 6

export function getSpeedDialFaviconLoadAttributes(
  renderIndex: number
): SpeedDialFaviconLoadAttributes {
  const normalizedIndex = Math.max(0, Math.floor(renderIndex) || 0)
  return {
    loading: normalizedIndex < SPEED_DIAL_EAGER_FAVICON_LIMIT ? 'eager' : 'lazy',
    fetchpriority: normalizedIndex < SPEED_DIAL_HIGH_PRIORITY_FAVICON_LIMIT ? 'high' : 'auto'
  }
}
