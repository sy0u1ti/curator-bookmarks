import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { chromium } from 'playwright'

const TITLE_SETTLE_DELAY_MS = 1_600
const extensionPath = path.resolve('dist')
const profilePath = await mkdtemp(path.join(tmpdir(), 'curator-bookmark-handoff-'))
let context

try {
  context = await chromium.launchPersistentContext(profilePath, {
    headless: false,
    viewport: { width: 1558, height: 463 },
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`
    ]
  })

  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker', { timeout: 15_000 })
  const extensionId = new URL(worker.url()).host
  const seeded = await seedBookmarks(worker)
  const page = await context.newPage()
  const url = `chrome-extension://${extensionId}/src/newtab/newtab.html`

  // Simulate a browser/font environment that changes the title baseline while
  // leaving the card geometry untouched, then settles late on refresh.
  await page.addInitScript(({ settleDelayMs }) => {
    document.addEventListener('DOMContentLoaded', () => {
      const hasSnapshot = Boolean(localStorage.getItem('curatorNewTabBookmarkPreboot'))
      const freezeTitleProbe = localStorage.getItem('curatorNewTabFreezeTitleProbe') === 'true'
      const style = document.createElement('style')
      style.dataset.curatorTitleBaselineProbe = 'true'
      style.textContent = `.bookmark-title { transform: translateY(${hasSnapshot ? 8 : 4}px) !important; }`
      document.head.appendChild(style)
      if (hasSnapshot && !freezeTitleProbe) {
        window.setTimeout(() => {
          style.textContent = '.bookmark-title { transform: translateY(4px) !important; }'
        }, settleDelayMs)
      }
    }, { once: true })
  }, { settleDelayMs: TITLE_SETTLE_DELAY_MS })

  await page.goto(url, { waitUntil: 'domcontentloaded' })
  await page.locator(bookmarkTileSelector(seeded.bookmarkIds[0])).waitFor({ state: 'visible', timeout: 20_000 })
  const bookmarkRows = await page.locator('.bookmark-tile[data-bookmark-id]').evaluateAll((tiles) =>
    tiles.map((tile) => ({
      bookmarkId: tile.getAttribute('data-bookmark-id') || '',
      top: tile.getBoundingClientRect().top
    }))
  )
  const firstRowTop = bookmarkRows[0]?.top
  const secondRowBookmark = bookmarkRows.find((bookmark) =>
    firstRowTop !== undefined && bookmark.top > firstRowTop + 1
  )
  assert.ok(secondRowBookmark, `Expected a second bookmark row: ${JSON.stringify(bookmarkRows)}`)
  const bookmarkId = secondRowBookmark.bookmarkId
  await page.waitForFunction(() => Boolean(localStorage.getItem('curatorNewTabBookmarkPreboot')))
  const cachedTitleRect = await page.evaluate((bookmarkId) => {
    const rawSnapshot = localStorage.getItem('curatorNewTabBookmarkPreboot')
    const snapshot = rawSnapshot ? JSON.parse(rawSnapshot) : null
    const item = snapshot?.sections
      ?.flatMap((section) => section.items || [])
      .find((candidate) => candidate.id === bookmarkId)
    return {
      titleRect: item?.titleRect ?? null,
      updatedAt: snapshot?.updatedAt ?? null,
      version: snapshot?.version ?? null
    }
  }, bookmarkId)
  assert.equal(cachedTitleRect.version, 3)
  assert.ok(cachedTitleRect.titleRect, `Expected cached title geometry: ${JSON.stringify(cachedTitleRect)}`)
  const initialPerformance = await page.evaluate(() => ({
    firstBookmarksMs: performance.getEntriesByName('newtab.firstBookmarksMs', 'measure').at(-1)?.duration ?? null,
    firstBookmarksRenderedAt: performance.getEntriesByName('newtab.firstBookmarksRendered', 'mark').at(-1)?.startTime ?? null
  }))

  await page.addInitScript(({ bookmarkId }) => {
    window.__curatorBookmarkHandoffFrames = []
    const isPainted = (element) => {
      for (let current = element; current instanceof HTMLElement; current = current.parentElement) {
        const style = getComputedStyle(current)
        if (
          style.display === 'none' ||
          style.visibility === 'hidden' ||
          style.visibility === 'collapse' ||
          Number.parseFloat(style.opacity) <= 0.001
        ) {
          return false
        }
      }
      return true
    }
    const readTitle = (tileSelector, titleSelector) => {
      const tile = document.querySelector(tileSelector)
      const title = document.querySelector(titleSelector)
      if (!(tile instanceof HTMLElement) || !(title instanceof HTMLElement)) return null
      const tileRect = tile.getBoundingClientRect()
      const titleRect = title.getBoundingClientRect()
      return {
        absoluteLeft: titleRect.left,
        absoluteTop: titleRect.top,
        left: titleRect.left - tileRect.left,
        painted: isPainted(title),
        top: titleRect.top - tileRect.top
      }
    }
    const sample = (now) => {
      const page = document.querySelector('.newtab-page')
      const primarySlot = document.querySelector('.newtab-primary-slot')
      const prebootRoot = document.getElementById('newtab-bookmark-preboot')
      const preboot = readTitle(
        `.newtab-bookmark-preboot-tile[data-bookmark-id="${bookmarkId}"]`,
        `.newtab-bookmark-preboot-tile[data-bookmark-id="${bookmarkId}"] .newtab-bookmark-preboot-title`
      )
      const live = readTitle(
        `.bookmark-tile[data-bookmark-id="${bookmarkId}"]`,
        `.bookmark-tile[data-bookmark-id="${bookmarkId}"] .bookmark-title`
      )
      window.__curatorBookmarkHandoffFrames.push({
        collisionOffset: page instanceof HTMLElement
          ? getComputedStyle(page).getPropertyValue('--primary-collision-offset-y').trim()
          : '',
        live,
        now,
        preboot,
        primaryTransform: primarySlot instanceof HTMLElement ? getComputedStyle(primarySlot).transform : '',
        titleGuard: prebootRoot?.dataset.titleGuard === 'true',
        visible: preboot || live
      })
      if (now < 3000) requestAnimationFrame(sample)
    }
    requestAnimationFrame(sample)
  }, { bookmarkId })

  await page.route('**/*', async (route) => {
    if (/\/assets\/newtab\.html-[^/]+\.js$/.test(new URL(route.request().url()).pathname)) {
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
    await route.continue()
  })

  await page.goto(url, { waitUntil: 'commit' })
  await page.locator(prebootTileSelector(bookmarkId)).waitFor({ state: 'visible', timeout: 5_000 })
  const prebootTop = await page.locator(`${prebootTileSelector(bookmarkId)} .newtab-bookmark-preboot-title`).evaluate(
    (element) => element.getBoundingClientRect().top
  )

  await page.locator(bookmarkTileSelector(bookmarkId)).waitFor({ state: 'visible', timeout: 20_000 })
  await page.waitForFunction(() => !document.getElementById('newtab-bookmark-preboot'))
  try {
    await page.waitForFunction(({ expectedTop, selector }) => {
      const title = document.querySelector(selector)
      return title instanceof HTMLElement && Math.abs(title.getBoundingClientRect().top - expectedTop) <= 0.5
    }, {
      expectedTop: prebootTop,
      selector: `${bookmarkTileSelector(bookmarkId)} .bookmark-title`
    }, { timeout: 5_000 })
  } catch (error) {
    const current = await page.evaluate((selector) => {
      const title = document.querySelector(selector)
      const primarySlot = document.querySelector('.newtab-primary-slot')
      const frames = window.__curatorBookmarkHandoffFrames || []
      const layoutSequence = []
      for (const frame of frames) {
        const entry = `${frame.collisionOffset}|${frame.primaryTransform}|${frame.live?.absoluteTop ?? 'none'}`
        if (layoutSequence.at(-1) !== entry) layoutSequence.push(entry)
      }
      return {
        layoutSequence,
        primaryTransform: primarySlot instanceof HTMLElement ? getComputedStyle(primarySlot).transform : '',
        titleTop: title instanceof HTMLElement ? title.getBoundingClientRect().top : null
      }
    }, `${bookmarkTileSelector(bookmarkId)} .bookmark-title`)
    throw new Error(`Live bookmark title did not return to cached position: ${JSON.stringify({ current, prebootTop })}`, { cause: error })
  }

  const finalLiveTop = await page.locator(`${bookmarkTileSelector(bookmarkId)} .bookmark-title`).evaluate(
    (element) => element.getBoundingClientRect().top
  )
  const frames = await page.evaluate(() => window.__curatorBookmarkHandoffFrames || [])
  const visibleFrames = frames.filter((frame) => frame.visible)
  const visibleTopValues = visibleFrames.map((frame) => frame.visible.absoluteTop)
  const visibleTopRange = Math.max(...visibleTopValues) - Math.min(...visibleTopValues)
  const visibleRelativeTopValues = visibleFrames.map((frame) => frame.visible.top)
  const visibleRelativeTopRange = Math.max(...visibleRelativeTopValues) - Math.min(...visibleRelativeTopValues)
  const leakingLiveFrames = frames.filter((frame) =>
    frame.preboot?.painted &&
    frame.live?.painted &&
    Math.abs(frame.preboot.absoluteTop - frame.live.absoluteTop) > 0.5
  )
  const protectedLiveFrames = frames.filter((frame) =>
    frame.preboot?.painted &&
    frame.live &&
    !frame.live.painted &&
    Math.abs(frame.preboot.absoluteTop - frame.live.absoluteTop) > 0.5
  )
  const revealedLiveFrames = frames.filter((frame) => !frame.preboot && frame.live?.painted)
  const titleGuardFrames = frames.filter((frame) => frame.titleGuard)
  const diagnostics = {
    bookmarkId,
    cachedTitleRect,
    finalLiveTop,
    firstVisible: visibleFrames[0]?.visible ?? null,
    initialPerformance,
    lastVisible: visibleFrames.at(-1)?.visible ?? null,
    leakingLiveFrame: leakingLiveFrames[0] ?? null,
    leakingLiveFrameCount: leakingLiveFrames.length,
    prebootTop,
    protectedLiveFrameCount: protectedLiveFrames.length,
    revealedLiveFrameCount: revealedLiveFrames.length,
    titleGuardFrameCount: titleGuardFrames.length,
    visibleRelativeTopRange,
    visibleTopRange
  }

  assert.ok(
    Math.abs(prebootTop - finalLiveTop) <= 0.5,
    `Cached and final bookmark titles should share one position: ${JSON.stringify(diagnostics)}`
  )
  assert.ok(
    visibleTopRange <= 0.5,
    `Bookmark title should not move during cached-to-live handoff: ${JSON.stringify(diagnostics)}`
  )
  assert.ok(
    visibleRelativeTopRange <= 0.5,
    `Bookmark title should not move inside its tile during cached-to-live handoff: ${JSON.stringify(diagnostics)}`
  )
  assert.equal(
    leakingLiveFrames.length,
    0,
    `Misaligned live bookmark titles must not paint through the preboot layer: ${JSON.stringify(diagnostics)}`
  )
  assert.ok(
    protectedLiveFrames.length > 0,
    `The regression fixture must exercise a hidden misaligned live title: ${JSON.stringify(diagnostics)}`
  )
  assert.ok(
    revealedLiveFrames.length > 0,
    `Live bookmark titles must become visible after the preboot handoff: ${JSON.stringify(diagnostics)}`
  )
  assert.ok(
    titleGuardFrames.length > 0,
    `The regression fixture must cross the delayed-title guard: ${JSON.stringify(diagnostics)}`
  )

  await page.waitForFunction(({ bookmarkId, previousUpdatedAt }) => {
    const rawSnapshot = localStorage.getItem('curatorNewTabBookmarkPreboot')
    const snapshot = rawSnapshot ? JSON.parse(rawSnapshot) : null
    const storedTitleRect = snapshot?.sections
      ?.flatMap((section) => section.items || [])
      .find((candidate) => candidate.id === bookmarkId)
      ?.titleRect
    const tile = document.querySelector(`.bookmark-tile[data-bookmark-id="${bookmarkId}"]`)
    const title = tile?.querySelector('.bookmark-title')
    if (!storedTitleRect || !(tile instanceof HTMLElement) || !(title instanceof HTMLElement)) {
      return false
    }
    const tileRect = tile.getBoundingClientRect()
    const titleRect = title.getBoundingClientRect()
    return (
      Number(snapshot.updatedAt) > Number(previousUpdatedAt) &&
      Math.abs(storedTitleRect.left - (titleRect.left - tileRect.left - tile.clientLeft)) <= 0.5 &&
      Math.abs(storedTitleRect.top - (titleRect.top - tileRect.top - tile.clientTop)) <= 0.5
    )
  }, {
    bookmarkId,
    previousUpdatedAt: cachedTitleRect.updatedAt
  }, { timeout: 5_000 })

  const storedSnapshot = await page.evaluate((bookmarkId) => {
    const rawSnapshot = localStorage.getItem('curatorNewTabBookmarkPreboot')
    const snapshot = rawSnapshot ? JSON.parse(rawSnapshot) : null
    const titleRect = snapshot?.sections
      ?.flatMap((section) => section.items || [])
      .find((candidate) => candidate.id === bookmarkId)
      ?.titleRect ?? null
    return {
      titleRect,
      updatedAt: snapshot?.updatedAt ?? null
    }
  }, bookmarkId)

  await page.goto(url, { waitUntil: 'commit' })
  await page.locator(prebootTileSelector(bookmarkId)).waitFor({ state: 'visible', timeout: 5_000 })
  await page.locator(bookmarkTileSelector(bookmarkId)).waitFor({ state: 'visible', timeout: 20_000 })
  await page.waitForFunction(() => !document.getElementById('newtab-bookmark-preboot'))
  await page.waitForFunction(
    (minimumTime) => performance.now() >= minimumTime,
    TITLE_SETTLE_DELAY_MS + 300
  )

  const secondFrames = await page.evaluate(() => window.__curatorBookmarkHandoffFrames || [])
  const secondVisibleFrames = secondFrames.filter((frame) => frame.visible)
  const secondVisibleTopValues = secondVisibleFrames.map((frame) => frame.visible.absoluteTop)
  const secondVisibleTopRange = Math.max(...secondVisibleTopValues) - Math.min(...secondVisibleTopValues)
  const secondVisibleRelativeTopValues = secondVisibleFrames.map((frame) => frame.visible.top)
  const secondVisibleRelativeTopRange = (
    Math.max(...secondVisibleRelativeTopValues) - Math.min(...secondVisibleRelativeTopValues)
  )
  const secondLeakingLiveFrames = secondFrames.filter((frame) =>
    frame.preboot?.painted &&
    frame.live?.painted &&
    Math.abs(frame.preboot.absoluteTop - frame.live.absoluteTop) > 0.5
  )
  const secondProtectedLiveFrames = secondFrames.filter((frame) =>
    frame.preboot?.painted &&
    frame.live &&
    !frame.live.painted &&
    Math.abs(frame.preboot.absoluteTop - frame.live.absoluteTop) > 0.5
  )
  const secondRevealedLiveFrames = secondFrames.filter((frame) => !frame.preboot && frame.live?.painted)
  const secondTitleGuardFrames = secondFrames.filter((frame) => frame.titleGuard)
  const secondDiagnostics = {
    firstVisible: secondVisibleFrames[0]?.visible ?? null,
    lastVisible: secondVisibleFrames.at(-1)?.visible ?? null,
    leakingLiveFrameCount: secondLeakingLiveFrames.length,
    protectedLiveFrameCount: secondProtectedLiveFrames.length,
    revealedLiveFrameCount: secondRevealedLiveFrames.length,
    storedSnapshot,
    titleGuardFrameCount: secondTitleGuardFrames.length,
    visibleRelativeTopRange: secondVisibleRelativeTopRange,
    visibleTopRange: secondVisibleTopRange
  }

  assert.ok(
    secondVisibleTopRange <= 0.5,
    `Bookmark title should remain fixed across consecutive refreshes: ${JSON.stringify(secondDiagnostics)}`
  )
  assert.ok(
    secondVisibleRelativeTopRange <= 0.5,
    `Bookmark title should remain fixed inside its tile across consecutive refreshes: ${JSON.stringify(secondDiagnostics)}`
  )
  assert.equal(
    secondLeakingLiveFrames.length,
    0,
    `Misaligned live titles must stay hidden on consecutive refreshes: ${JSON.stringify(secondDiagnostics)}`
  )
  assert.ok(
    secondProtectedLiveFrames.length > 0,
    `The consecutive-refresh fixture must preserve the final title geometry: ${JSON.stringify(secondDiagnostics)}`
  )
  assert.ok(
    secondRevealedLiveFrames.length > 0,
    `Live titles must be revealed on the consecutive refresh: ${JSON.stringify(secondDiagnostics)}`
  )
  assert.ok(
    secondTitleGuardFrames.length > 0,
    `The consecutive refresh must cross the delayed-title guard: ${JSON.stringify(secondDiagnostics)}`
  )

  const renamedBookmarkTitle = 'Live renamed frozen-title probe'
  await worker.evaluate(async ({ bookmarkId, title }) => {
    await chrome.bookmarks.update(bookmarkId, { title })
  }, { bookmarkId, title: renamedBookmarkTitle })
  await page.waitForFunction(({ bookmarkId, title }) => {
    return document
      .querySelector(`.bookmark-tile[data-bookmark-id="${bookmarkId}"] .bookmark-title`)
      ?.textContent === title
  }, { bookmarkId, title: renamedBookmarkTitle })
  await page.evaluate((bookmarkId) => {
    const rawSnapshot = localStorage.getItem('curatorNewTabBookmarkPreboot')
    const snapshot = rawSnapshot ? JSON.parse(rawSnapshot) : null
    const item = snapshot?.sections
      ?.flatMap((section) => section.items || [])
      .find((candidate) => candidate.id === bookmarkId)
    if (item) {
      item.title = 'Cached stale frozen-title probe'
      localStorage.setItem('curatorNewTabBookmarkPreboot', JSON.stringify(snapshot))
    }
    localStorage.setItem('curatorNewTabFreezeTitleProbe', 'true')
  }, bookmarkId)
  await page.goto(url, { waitUntil: 'commit' })
  await page.locator(prebootTileSelector(bookmarkId)).waitFor({ state: 'visible', timeout: 5_000 })
  await page.locator('.newtab-bookmark-frozen-title').first().waitFor({ state: 'visible', timeout: 10_000 })
  await page.waitForFunction(() => !document.getElementById('newtab-bookmark-preboot'))

  const frozenBeforeScroll = await page.evaluate((bookmarkId) => {
    const scrollHost = document.querySelector('.newtab-shell')
    const tile = document.querySelector(`.bookmark-tile[data-bookmark-id="${bookmarkId}"]`)
    const sourceTitle = tile?.querySelector('.bookmark-title')
    const frozenTitle = tile?.querySelector('.newtab-bookmark-frozen-title')
    if (
      !(scrollHost instanceof HTMLElement) ||
      !(tile instanceof HTMLElement) ||
      !(sourceTitle instanceof HTMLElement) ||
      !(frozenTitle instanceof HTMLElement)
    ) {
      return null
    }
    const tileRect = tile.getBoundingClientRect()
    const frozenRect = frozenTitle.getBoundingClientRect()
    return {
      frozenText: frozenTitle.textContent,
      frozenTop: frozenRect.top,
      maxScroll: scrollHost.scrollHeight - scrollHost.clientHeight,
      relativeTop: frozenRect.top - tileRect.top,
      scrollTop: scrollHost.scrollTop,
      sourceVisibility: getComputedStyle(sourceTitle).visibility,
      sourceText: sourceTitle.textContent,
      tileTop: tileRect.top
    }
  }, bookmarkId)
  assert.ok(frozenBeforeScroll, 'Expected the frozen title transfer to be installed')
  assert.ok(
    frozenBeforeScroll.maxScroll > 40,
    `Expected a scrollable new tab shell: ${JSON.stringify(frozenBeforeScroll)}`
  )
  assert.equal(frozenBeforeScroll.sourceVisibility, 'hidden')
  assert.equal(frozenBeforeScroll.sourceText, renamedBookmarkTitle)
  assert.equal(frozenBeforeScroll.frozenText, renamedBookmarkTitle)

  await page.evaluate(() => {
    const scrollHost = document.querySelector('.newtab-shell')
    if (scrollHost instanceof HTMLElement) {
      scrollHost.scrollTop = Math.min(100, scrollHost.scrollHeight - scrollHost.clientHeight)
    }
  })
  await page.evaluate(() => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve))
  }))

  const frozenAfterScroll = await page.evaluate((bookmarkId) => {
    const scrollHost = document.querySelector('.newtab-shell')
    const tile = document.querySelector(`.bookmark-tile[data-bookmark-id="${bookmarkId}"]`)
    const frozenTitle = tile?.querySelector('.newtab-bookmark-frozen-title')
    if (!(scrollHost instanceof HTMLElement) || !(tile instanceof HTMLElement) || !(frozenTitle instanceof HTMLElement)) {
      return null
    }
    const tileRect = tile.getBoundingClientRect()
    const frozenRect = frozenTitle.getBoundingClientRect()
    return {
      frozenTop: frozenRect.top,
      relativeTop: frozenRect.top - tileRect.top,
      scrollTop: scrollHost.scrollTop,
      tileTop: tileRect.top
    }
  }, bookmarkId)
  assert.ok(frozenAfterScroll, 'Expected the transferred title to survive scrolling')
  const frozenTitleDelta = frozenAfterScroll.frozenTop - frozenBeforeScroll.frozenTop
  const frozenTileDelta = frozenAfterScroll.tileTop - frozenBeforeScroll.tileTop
  assert.ok(
    frozenAfterScroll.scrollTop > frozenBeforeScroll.scrollTop + 20,
    `Expected the shell to scroll: ${JSON.stringify({ frozenAfterScroll, frozenBeforeScroll })}`
  )
  assert.ok(
    Math.abs(frozenTitleDelta - frozenTileDelta) <= 0.5,
    `Frozen title must move with its live tile: ${JSON.stringify({ frozenAfterScroll, frozenBeforeScroll })}`
  )
  assert.ok(
    Math.abs(frozenAfterScroll.relativeTop - frozenBeforeScroll.relativeTop) <= 0.5,
    `Frozen title must keep its position inside the live tile: ${JSON.stringify({ frozenAfterScroll, frozenBeforeScroll })}`
  )

  console.log(`Newtab bookmark handoff probe: ${JSON.stringify({
    first: diagnostics,
    frozenScroll: { after: frozenAfterScroll, before: frozenBeforeScroll },
    second: secondDiagnostics
  })}`)
  console.log('Newtab bookmark handoff test passed.')
} finally {
  await context?.close()
  await rm(profilePath, { recursive: true, force: true })
}

async function seedBookmarks(worker) {
  return worker.evaluate(async () => {
    const tree = await chrome.bookmarks.getTree()
    const root = tree[0]
    const bookmarksBar = root.children?.find((node) => node.id === '1') || root.children?.[0]
    if (!bookmarksBar?.id) throw new Error('Bookmarks bar is unavailable')

    const primaryFolder = await chrome.bookmarks.create({
      parentId: bookmarksBar.id,
      title: 'Curator handoff multi-row probe'
    })
    const secondaryFolder = await chrome.bookmarks.create({
      parentId: bookmarksBar.id,
      title: 'Curator handoff next-section probe'
    })
    const bookmarks = []
    for (let index = 0; index < 15; index += 1) {
      bookmarks.push(await chrome.bookmarks.create({
        parentId: primaryFolder.id,
        title: index === 7 ? 'Second-row title handoff probe' : `Probe ${index + 1}`,
        url: `https://example.com/curator-handoff-probe/${index + 1}`
      }))
    }
    for (let index = 0; index < 3; index += 1) {
      bookmarks.push(await chrome.bookmarks.create({
        parentId: secondaryFolder.id,
        title: `Next section ${index + 1}`,
        url: `https://example.com/curator-handoff-next-section/${index + 1}`
      }))
    }

    await chrome.storage.local.set({
      curatorBookmarkNewTabFolderSettings: {
        selectedFolderIds: [primaryFolder.id, secondaryFolder.id],
        hideFolderNames: true
      },
      curatorBookmarkNewTabIconSettings: {
        pageWidth: 78,
        columnGap: 10,
        rowGap: 10,
        folderGap: 20,
        tileWidth: 184,
        iconShellSize: 32,
        preset: 'comfortable',
        layoutMode: 'auto',
        columns: 4,
        showTitles: true,
        titleLines: 1,
        verticalCenter: true
      },
      curatorBookmarkNewTabSearchSettings: {
        enabled: true
      }
    })
    return { bookmarkIds: bookmarks.map((bookmark) => bookmark.id) }
  })
}

function bookmarkTileSelector(bookmarkId) {
  return `.bookmark-tile[data-bookmark-id="${bookmarkId}"]`
}

function prebootTileSelector(bookmarkId) {
  return `.newtab-bookmark-preboot-tile[data-bookmark-id="${bookmarkId}"]`
}
