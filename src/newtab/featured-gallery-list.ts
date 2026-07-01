import type { FeaturedBackgroundItem } from './background-gallery.js'
import {
  FEATURED_BACKGROUND_PROVIDER_DISPLAY_LIMIT,
  isFeaturedBackgroundProvider
} from './featured-background-providers.js'
import { isFeaturedBackgroundStyleSuitable } from './featured-background-style.js'

export interface FeaturedBackgroundPickerListInput {
  storedItems: FeaturedBackgroundItem[]
  staticItems: FeaturedBackgroundItem[]
  favoriteIds: Iterable<string>
  selectedId: string
}

export interface FeaturedBackgroundPickerSections {
  favorites: FeaturedBackgroundItem[]
  refreshed: FeaturedBackgroundItem[]
}

export function buildFeaturedBackgroundPickerSections({
  storedItems,
  staticItems,
  favoriteIds,
  selectedId
}: FeaturedBackgroundPickerListInput): FeaturedBackgroundPickerSections {
  const favorites = new Set(Array.from(favoriteIds, (id) => String(id || '').trim()).filter(Boolean))
  const selected = String(selectedId || '').trim()
  const favoriteItems: FeaturedBackgroundItem[] = []
  const refreshedItems: FeaturedBackgroundItem[] = []
  const favoriteSeen = new Set<string>()
  const refreshedSeen = new Set<string>()
  const refreshedProviderCounts = new Map<FeaturedBackgroundItem['provider'], number>()
  const isSupportedItem = (item: FeaturedBackgroundItem) => Boolean(item.id) &&
    isFeaturedBackgroundProvider(item.provider)
  const filterItem = (item: FeaturedBackgroundItem) => isFeaturedBackgroundStyleSuitable({
    title: item.title,
    credit: item.credit,
    provider: item.provider,
    metadata: [item.sourceUrl]
  })

  const addFavoriteItems = (sourceItems: FeaturedBackgroundItem[], filter: (item: FeaturedBackgroundItem) => boolean) => {
    for (const item of sourceItems) {
      if (!isSupportedItem(item) || favoriteSeen.has(item.id) || !filter(item)) {
        continue
      }
      favoriteSeen.add(item.id)
      favoriteItems.push(item)
    }
  }

  const addRefreshedItems = (sourceItems: FeaturedBackgroundItem[], filter: (item: FeaturedBackgroundItem) => boolean) => {
    for (const item of sourceItems) {
      const pinnedByUser = favorites.has(item.id) || item.id === selected
      if (!isSupportedItem(item) || refreshedSeen.has(item.id) || !filter(item) || (!pinnedByUser && !filterItem(item))) {
        continue
      }
      const providerCount = refreshedProviderCounts.get(item.provider) || 0
      if (providerCount >= FEATURED_BACKGROUND_PROVIDER_DISPLAY_LIMIT) {
        continue
      }
      refreshedProviderCounts.set(item.provider, providerCount + 1)
      refreshedSeen.add(item.id)
      refreshedItems.push(item)
    }
  }

  addFavoriteItems(storedItems, (item) => favorites.has(item.id))
  addFavoriteItems(staticItems, (item) => favorites.has(item.id))
  addFavoriteItems(storedItems, (item) => Boolean(selected) && item.id === selected)
  addFavoriteItems(staticItems, (item) => Boolean(selected) && item.id === selected)

  const activeFavoriteIds = new Set(favoriteItems.map((item) => item.id))
  addRefreshedItems(storedItems, (item) => !activeFavoriteIds.has(item.id))

  if (!refreshedItems.length) {
    addRefreshedItems(staticItems, (item) => !activeFavoriteIds.has(item.id) && item.id !== selected)
  }

  return {
    favorites: favoriteItems,
    refreshed: refreshedItems
  }
}

export function buildFeaturedBackgroundPickerItems(input: FeaturedBackgroundPickerListInput): FeaturedBackgroundItem[] {
  const sections = buildFeaturedBackgroundPickerSections(input)
  return [...sections.favorites, ...sections.refreshed]
}
