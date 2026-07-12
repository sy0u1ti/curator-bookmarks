import assert from 'node:assert/strict'
import {
  NEWTAB_BOOKMARK_PREBOOT_STORAGE_KEY,
  createNewtabBookmarkPrebootSnapshot,
  getNewtabBookmarkPrebootFaviconLoadAttributes,
  isRenderableNewtabBookmarkPrebootSnapshot,
  writeNewtabBookmarkPrebootSnapshotFromView,
  type NewtabBookmarkPrebootItemView,
  type NewtabBookmarkPrebootView
} from './newtab-bookmark-preboot.js'
import { readFileSync } from 'node:fs'
import {
  isNewtabFaviconReady,
  markNewtabFaviconNotReady,
  markNewtabFaviconReady
} from './newtab-favicon-readiness.js'

function run(): void {
  testSnapshotKeepsVisibleCardsAndExactCardRect()
  testSnapshotPreservesEachLiveCardOffset()
  testSnapshotSkipsInlineCustomIconPayloads()
  testSnapshotWritesToStorage()
  testSnapshotClearsStorageWhenWriteFails()
  testSnapshotClearsStorageWhenNoCardsRemain()
  testSnapshotRejectsMismatchedViewport()
  testPrebootHandoffIsAtomic()
  testFaviconReadinessHandoff()
  testPrebootFaviconLoadingPriorities()
}

function testPrebootFaviconLoadingPriorities(): void {
  assert.deepEqual(
    getNewtabBookmarkPrebootFaviconLoadAttributes(0),
    { fetchPriority: 'high', loading: 'eager' }
  )
  assert.deepEqual(
    getNewtabBookmarkPrebootFaviconLoadAttributes(6),
    { fetchPriority: 'low', loading: 'eager' }
  )
  assert.deepEqual(
    getNewtabBookmarkPrebootFaviconLoadAttributes(12),
    { fetchPriority: 'low', loading: 'lazy' }
  )
}

function testFaviconReadinessHandoff(): void {
  const source = 'chrome-extension://extension-id/_favicon/?pageUrl=https%3A%2F%2Fexample.com%2F&size=64'
  assert.equal(isNewtabFaviconReady(source), false)
  markNewtabFaviconReady(source)
  assert.equal(isNewtabFaviconReady(source), true)
  markNewtabFaviconNotReady(source)
  assert.equal(isNewtabFaviconReady(source), false)

  const inlineSource = 'data:image/png;base64,large-payload'
  markNewtabFaviconReady(inlineSource)
  assert.equal(isNewtabFaviconReady(inlineSource), false)
}

function testPrebootHandoffIsAtomic(): void {
  const source = readFileSync('src/newtab/newtab-bookmark-preboot.ts', 'utf8')
  assert(source.includes('root.remove()'))
  assert(!source.includes('window.setTimeout(() => {\n    root.remove()'))
  assert(source.includes('transition: none;'))
}

function testSnapshotKeepsVisibleCardsAndExactCardRect(): void {
  const snapshot = createNewtabBookmarkPrebootSnapshot(createBookmarkContentView(), {
    now: 123456,
    sectionsElement: createMeasuredElement({ height: 160, left: 188, top: 286, width: 904 }),
    viewportHeight: 900,
    viewportWidth: 1280
  })

  assert(snapshot)
  assert.equal(snapshot.updatedAt, 123456)
  assert.equal(snapshot.content.layoutMode, 'fixed')
  assert.equal(snapshot.content.columns, 4)
  assert.equal(snapshot.rect.left, 188)
  assert.equal(snapshot.rect.top, 286)
  assert.equal(snapshot.rect.width, 904)
  assert.equal(snapshot.sections.length, 1)
  assert.equal(snapshot.sections[0].items.length, 2)
  assert.equal(snapshot.sections[0].items[0].title, 'GitHub')
  assert.equal(snapshot.sections[0].items[0].faviconSrc, 'chrome-extension://extension-id/_favicon/?pageUrl=https%3A%2F%2Fgithub.com%2F&size=32')
  assert.equal(snapshot.sections[0].items[0].rgb, '245 245 247')
  assert.deepEqual(
    pickItemRect(snapshot.sections[0].items[0]),
    { height: 50, left: 0, top: 30, width: 440 }
  )
}

function testSnapshotPreservesEachLiveCardOffset(): void {
  const view = createBookmarkContentView()
  view.sections.push(
    { folderId: 'empty', grid: null },
    {
      folderId: '2',
      grid: {
        items: [createBookmarkTile({
          fallbackLabel: 'D',
          id: '12',
          rgb: '',
          src: 'chrome-extension://extension-id/_favicon/?pageUrl=https%3A%2F%2Fdeveloper.mozilla.org%2F&size=32',
          title: 'MDN',
          url: 'https://developer.mozilla.org/'
        })]
      }
    }
  )

  const snapshot = createNewtabBookmarkPrebootSnapshot(view, {
    sectionsElement: createMeasuredElement({
      tiles: [
        { height: 50, id: '10', left: 188, top: 316, width: 440 },
        { height: 50, id: '11', left: 652, top: 316, width: 440 },
        { height: 50, id: '12', left: 224, top: 478, width: 832 }
      ],
      height: 242,
      left: 188,
      top: 286,
      width: 904
    }),
    viewportHeight: 900,
    viewportWidth: 1280
  })

  assert(snapshot)
  assert.equal(snapshot.sections.length, 2)
  assert.deepEqual(
    snapshot.sections.map(({ folderId, items }) => ({
      folderId,
      rects: items.map(pickItemRect)
    })),
    [
      {
        folderId: '1',
        rects: [
          { height: 50, left: 0, top: 30, width: 440 },
          { height: 50, left: 464, top: 30, width: 440 }
        ]
      },
      {
        folderId: '2',
        rects: [{ height: 50, left: 36, top: 192, width: 832 }]
      }
    ]
  )
}

function testSnapshotSkipsInlineCustomIconPayloads(): void {
  const view = createBookmarkContentView()
  const firstItem = view.sections[0].grid?.items[0]
  assert(firstItem)
  firstItem.customIcon = true
  firstItem.favicon.src = 'data:image/png;base64,large-payload'

  const snapshot = createNewtabBookmarkPrebootSnapshot(view, {
    sectionsElement: createMeasuredElement({ height: 160, left: 188, top: 286, width: 904 }),
    viewportHeight: 900,
    viewportWidth: 1280
  })

  assert(snapshot)
  assert.equal(snapshot.sections[0].items[0].faviconSrc, '')
}

function testSnapshotWritesToStorage(): void {
  const storage = new MemoryStorage()
  const snapshot = writeNewtabBookmarkPrebootSnapshotFromView(createBookmarkContentView(), {
    now: 789,
    sectionsElement: createMeasuredElement({ height: 160, left: 188, top: 286, width: 904 }),
    viewportHeight: 900,
    viewportWidth: 1280
  }, storage)
  const rawSnapshot = storage.getItem(NEWTAB_BOOKMARK_PREBOOT_STORAGE_KEY)

  assert(snapshot)
  assert(rawSnapshot)
  assert.equal(JSON.parse(rawSnapshot).updatedAt, 789)
}

function testSnapshotClearsStorageWhenWriteFails(): void {
  const backingStorage = new MemoryStorage()
  backingStorage.setItem(NEWTAB_BOOKMARK_PREBOOT_STORAGE_KEY, '{"stale":true}')
  const storage: Pick<Storage, 'getItem' | 'removeItem' | 'setItem'> = {
    getItem: (key) => backingStorage.getItem(key),
    removeItem: (key) => backingStorage.removeItem(key),
    setItem: () => {
      throw new Error('quota exceeded')
    }
  }

  const snapshot = writeNewtabBookmarkPrebootSnapshotFromView(createBookmarkContentView(), {
    sectionsElement: createMeasuredElement({ height: 160, left: 188, top: 286, width: 904 }),
    viewportHeight: 900,
    viewportWidth: 1280
  }, storage)

  assert.equal(snapshot, null)
  assert.equal(backingStorage.getItem(NEWTAB_BOOKMARK_PREBOOT_STORAGE_KEY), null)
}

function testSnapshotClearsStorageWhenNoCardsRemain(): void {
  const storage = new MemoryStorage()
  storage.setItem(NEWTAB_BOOKMARK_PREBOOT_STORAGE_KEY, '{"stale":true}')
  const view = createBookmarkContentView()
  view.sections[0].grid = null

  const snapshot = writeNewtabBookmarkPrebootSnapshotFromView(view, {
    sectionsElement: createMeasuredElement({ height: 160, left: 188, top: 286, width: 904 }),
    viewportHeight: 900,
    viewportWidth: 1280
  }, storage)

  assert.equal(snapshot, null)
  assert.equal(storage.getItem(NEWTAB_BOOKMARK_PREBOOT_STORAGE_KEY), null)
}

function testSnapshotRejectsMismatchedViewport(): void {
  const snapshot = createNewtabBookmarkPrebootSnapshot(createBookmarkContentView(), {
    sectionsElement: createMeasuredElement({ height: 160, left: 188, top: 286, width: 904 }),
    viewportHeight: 900,
    viewportWidth: 1280
  })

  assert(snapshot)
  assert.equal(isRenderableNewtabBookmarkPrebootSnapshot(snapshot, {
    innerHeight: 900,
    innerWidth: 1281
  }), true)
  assert.equal(isRenderableNewtabBookmarkPrebootSnapshot(snapshot, {
    innerHeight: 900,
    innerWidth: 1282
  }), false)
}

function createBookmarkContentView(): NewtabBookmarkPrebootView {
  return {
    content: {
      columnGap: 24,
      columns: 4,
      fixedGridWidth: 832,
      folderGap: 20,
      iconShellSize: 32,
      layoutMode: 'fixed',
      pageWidth: 1229,
      rowGap: 12,
      showTitles: true,
      tileWidth: 184,
      titleLines: 1
    },
    sections: [
      {
        folderId: '1',
        grid: {
          items: [
            createBookmarkTile({
              fallbackLabel: 'G',
              id: '10',
              rgb: '245 245 247',
              src: 'chrome-extension://extension-id/_favicon/?pageUrl=https%3A%2F%2Fgithub.com%2F&size=32',
              title: 'GitHub',
              url: 'https://github.com/'
            }),
            createBookmarkTile({
              fallbackLabel: 'Y',
              id: '11',
              rgb: '',
              src: 'chrome-extension://extension-id/_favicon/?pageUrl=https%3A%2F%2Fyoutube.com%2F&size=32',
              title: 'YouTube',
              url: 'https://youtube.com/'
            })
          ]
        }
      }
    ]
  }
}

function createBookmarkTile({
  fallbackLabel,
  id,
  rgb,
  src,
  title,
  url
}: {
  fallbackLabel: string
  id: string
  rgb: string
  src: string
  title: string
  url: string
}): NewtabBookmarkPrebootItemView {
  return {
    customIcon: false,
    fallbackLabel,
    favicon: {
      src
    },
    id,
    style: rgb ? { '--bookmark-card-rgb': rgb } : undefined,
    title,
    url
  }
}

function createMeasuredElement({
  height,
  left,
  tiles,
  top,
  width
}: {
  height: number
  left: number
  tiles?: Array<{
    height: number
    id: string
    left: number
    top: number
    width: number
  }>
  top: number
  width: number
}): HTMLElement {
  const tileElements = (tiles ?? [
    { height: 50, id: '10', left, top: top + 30, width: 440 },
    { height: 50, id: '11', left: left + 464, top: top + 30, width: 440 }
  ]).map((tile) => ({
    dataset: { bookmarkId: tile.id },
    getBoundingClientRect: () => createDomRect(tile)
  })) as unknown as NodeListOf<HTMLElement>

  return {
    getBoundingClientRect: () => createDomRect({ height, left, top, width }),
    querySelectorAll: () => tileElements
  } as unknown as HTMLElement
}

function pickItemRect(item: {
  height: number
  left: number
  top: number
  width: number
}): {
  height: number
  left: number
  top: number
  width: number
} {
  return {
    height: item.height,
    left: item.left,
    top: item.top,
    width: item.width
  }
}

function createDomRect({
  height,
  left,
  top,
  width
}: {
  height: number
  left: number
  top: number
  width: number
}): DOMRect {
  return {
    bottom: top + height,
    height,
    left,
    right: left + width,
    top,
    width,
    x: left,
    y: top,
    toJSON: () => ({})
  } as DOMRect
}

class MemoryStorage implements Pick<Storage, 'getItem' | 'removeItem' | 'setItem'> {
  private readonly items = new Map<string, string>()

  getItem(key: string): string | null {
    return this.items.get(key) ?? null
  }

  removeItem(key: string): void {
    this.items.delete(key)
  }

  setItem(key: string, value: string): void {
    this.items.set(key, value)
  }
}

run()
console.log('Newtab bookmark preboot tests passed.')
