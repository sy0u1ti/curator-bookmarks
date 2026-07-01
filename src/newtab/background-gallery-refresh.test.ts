import type { FeaturedBackgroundItem } from './background-gallery.js'
import { buildFeaturedBackgroundPickerSections } from './featured-gallery-list.js'
import {
  fetchFreshFeaturedBackgroundItems,
  getFeaturedBackgroundRefreshProviderCount,
  getFeaturedBackgroundRefreshRequestOrigins,
  mergeFeaturedGalleryRefresh
} from './background-gallery-refresh.js'

async function run(): Promise<void> {
  testMergeKeepsOlderRefreshedItemsOutsideTheLatestBatch()
  testMergePrefersFreshNonFavoriteDuplicates()
  testMergeDropsUnavailableProviderItems()
  testMergeCapsStoredItemsPerProvider()
  testPickerSectionsDropUnavailableProviderItems()
  testPickerSectionsCapRefreshedItemsPerProvider()
  testRefreshProviderCountReflectsActualProviders()
  testRefreshOriginsExcludeUnavailableArticIiifSource()
  await testNasaRefreshNormalizesImageAssetUrlsToHttps()
}

function testMergeKeepsOlderRefreshedItemsOutsideTheLatestBatch(): void {
  const existingItems = Array.from({ length: 30 }, (_, index) => createItem(`existing-${index}`, `https://example.com/existing-${index}.jpg`, 'met'))
  const freshProviders: FeaturedBackgroundItem['provider'][] = ['nasa', 'wikimedia', 'cleveland']
  const fetchedItems = Array.from({ length: 24 }, (_, index) => {
    const provider = freshProviders[index % freshProviders.length] || 'nasa'
    return createItem(`fresh-${index}`, `https://example.com/fresh-${index}.jpg`, provider)
  })

  const merged = mergeFeaturedGalleryRefresh({
    existingItems,
    favoriteIds: ['existing-29'],
    fetchedItems
  })

  assert(
    merged[0]?.id === 'existing-29',
    'favorite items should stay pinned before refreshed items'
  )
  assert(
    fetchedItems.every((item) => merged.some((mergedItem) => mergedItem.id === item.id)),
    'the latest refreshed batch should be present'
  )
  assert(
    merged.some((item) => item.id === 'existing-0'),
    'older non-favorite refreshed items should remain in the rotation pool'
  )
}

function testMergePrefersFreshNonFavoriteDuplicates(): void {
  const merged = mergeFeaturedGalleryRefresh({
    existingItems: [createItem('duplicate', 'https://example.com/old.jpg')],
    favoriteIds: [],
    fetchedItems: [createItem('duplicate', 'https://example.com/new.jpg')]
  })

  assert(
    merged.length === 1,
    `expected duplicate IDs to collapse to one item, got ${merged.length}`
  )
  assert(
    merged[0]?.imageUrl === 'https://example.com/new.jpg',
    'fresh duplicate items should replace older non-favorite entries'
  )
}

function testMergeDropsUnavailableProviderItems(): void {
  const merged = mergeFeaturedGalleryRefresh({
    existingItems: [createUnavailableProviderItem('stale-artic')],
    favoriteIds: ['stale-artic'],
    fetchedItems: [createItem('fresh-nasa')]
  })

  assert(
    merged.every((item) => item.provider !== ('artic' as FeaturedBackgroundItem['provider'])),
    'refresh merge should drop stale Art Institute of Chicago items from cached gallery data'
  )
  assert(
    merged.some((item) => item.id === 'fresh-nasa'),
    'refresh merge should keep supported freshly fetched items'
  )
}

function testMergeCapsStoredItemsPerProvider(): void {
  const existingItems = [
    ...Array.from({ length: 30 }, (_, index) => createItem(`old-wikimedia-${index}`, `https://example.com/old-wikimedia-${index}.jpg`, 'wikimedia')),
    ...Array.from({ length: 30 }, (_, index) => createItem(`old-cleveland-${index}`, `https://example.com/old-cleveland-${index}.jpg`, 'cleveland'))
  ]
  const fetchedItems = [
    ...Array.from({ length: 6 }, (_, index) => createItem(`fresh-nasa-${index}`, `https://example.com/fresh-nasa-${index}.jpg`, 'nasa')),
    ...Array.from({ length: 12 }, (_, index) => createItem(`fresh-wikimedia-${index}`, `https://example.com/fresh-wikimedia-${index}.jpg`, 'wikimedia')),
    ...Array.from({ length: 12 }, (_, index) => createItem(`fresh-cleveland-${index}`, `https://example.com/fresh-cleveland-${index}.jpg`, 'cleveland'))
  ]
  const merged = mergeFeaturedGalleryRefresh({
    existingItems,
    favoriteIds: [],
    fetchedItems
  })
  const counts = countByProvider(merged)

  assert(
    Math.max(...Object.values(counts)) <= 12,
    `refresh merge should cap non-favorite cached items per provider, got ${JSON.stringify(counts)}`
  )
}

function testPickerSectionsDropUnavailableProviderItems(): void {
  const sections = buildFeaturedBackgroundPickerSections({
    storedItems: [createUnavailableProviderItem('stale-artic')],
    staticItems: [],
    favoriteIds: ['stale-artic'],
    selectedId: 'stale-artic'
  })
  const renderedItems = [...sections.favorites, ...sections.refreshed]

  assert(
    renderedItems.every((item) => item.provider !== ('artic' as FeaturedBackgroundItem['provider'])),
    'picker sections should drop stale Art Institute of Chicago items from in-memory gallery data'
  )
}

function testPickerSectionsCapRefreshedItemsPerProvider(): void {
  const sections = buildFeaturedBackgroundPickerSections({
    storedItems: [
      ...Array.from({ length: 30 }, (_, index) => createItem(`stored-wikimedia-${index}`, `https://example.com/stored-wikimedia-${index}.jpg`, 'wikimedia')),
      ...Array.from({ length: 30 }, (_, index) => createItem(`stored-cleveland-${index}`, `https://example.com/stored-cleveland-${index}.jpg`, 'cleveland')),
      ...Array.from({ length: 6 }, (_, index) => createItem(`stored-nasa-${index}`, `https://example.com/stored-nasa-${index}.jpg`, 'nasa'))
    ],
    staticItems: [],
    favoriteIds: [],
    selectedId: ''
  })
  const counts = countByProvider(sections.refreshed)

  assert(
    Math.max(...Object.values(counts)) <= 12,
    `picker refreshed section should cap visible items per provider, got ${JSON.stringify(counts)}`
  )
}

function testRefreshProviderCountReflectsActualProviders(): void {
  const count = getFeaturedBackgroundRefreshProviderCount([
    createItem('nasa-a', 'https://example.com/nasa-a.jpg', 'nasa'),
    createItem('nasa-b', 'https://example.com/nasa-b.jpg', 'nasa'),
    createItem('wikimedia-a', 'https://example.com/wikimedia-a.jpg', 'wikimedia'),
    createUnavailableProviderItem('stale-artic')
  ])

  assert(
    count === 2,
    `refresh provider count should use actual supported fetched providers, got ${count}`
  )
}

function testRefreshOriginsExcludeUnavailableArticIiifSource(): void {
  const origins = getFeaturedBackgroundRefreshRequestOrigins()

  assert(
    origins.every((origin) => !origin.includes('artic.edu')),
    'refresh origins should not include Art Institute of Chicago because its IIIF images are blocked in extension image loads'
  )
}

async function testNasaRefreshNormalizesImageAssetUrlsToHttps(): Promise<void> {
  const items = await fetchFreshFeaturedBackgroundItems({
    fetchJson: async (url) => {
      if (url.startsWith('https://images-api.nasa.gov/search')) {
        return {
          collection: {
            items: [
              {
                href: 'http://images-assets.nasa.gov/image/earth-landscape/collection.json',
                data: [
                  {
                    nasa_id: 'earth-landscape',
                    title: 'Earth landscape horizon',
                    center: 'NASA',
                    description: 'High resolution earth landscape horizon photograph',
                    keywords: ['earth', 'landscape', 'horizon']
                  }
                ]
              }
            ]
          }
        }
      }
      if (url === 'https://images-assets.nasa.gov/image/earth-landscape/collection.json') {
        return ['http://images-assets.nasa.gov/image/earth-landscape/earth-landscape~orig.jpg']
      }
      if (url.startsWith('https://commons.wikimedia.org/')) {
        return { query: { pages: {} } }
      }
      if (url.startsWith('https://collectionapi.metmuseum.org/')) {
        return { objectIDs: [] }
      }
      if (url.startsWith('https://openaccess-api.clevelandart.org/')) {
        return { data: [] }
      }
      throw new Error(`unexpected URL ${url}`)
    },
    getImageSize: async () => ({ width: 3200, height: 1800 })
  }, {
    refreshSeed: 'nasa-https'
  })

  const nasaItem = items.find((item) => item.provider === 'nasa')
  assert(
    nasaItem?.imageUrl === 'https://images-assets.nasa.gov/image/earth-landscape/earth-landscape~orig.jpg',
    'NASA refresh should normalize image asset URLs to HTTPS'
  )
}

function createUnavailableProviderItem(id: string): FeaturedBackgroundItem {
  return {
    ...createItem(id, `https://www.artic.edu/iiif/2/${id}/full/2560,/0/default.jpg`),
    provider: 'artic'
  } as unknown as FeaturedBackgroundItem
}

function createItem(
  id: string,
  imageUrl = `https://example.com/${id}.jpg`,
  provider: FeaturedBackgroundItem['provider'] = 'nasa'
): FeaturedBackgroundItem {
  return {
    id,
    title: id,
    provider,
    imageUrl,
    sourceUrl: `https://example.com/${id}`,
    credit: 'NASA',
    license: 'Test image',
    accentColor: '#101820',
    dynamic: true,
    width: 3200,
    height: 1800
  }
}

function countByProvider(items: FeaturedBackgroundItem[]): Record<string, number> {
  return items.reduce<Record<string, number>>((counts, item) => {
    counts[item.provider] = (counts[item.provider] || 0) + 1
    return counts
  }, {})
}

function assert(value: unknown, message: string): void {
  if (!value) {
    throw new Error(message)
  }
}

run().then(() => {
  console.log('Background gallery refresh tests passed.')
}).catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
