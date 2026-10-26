import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'
import { verifyBookmarkHover } from './bookmark-hover-test.mjs'
import { installGlassWallpaperFixture } from './glass-test-fixture.mjs'

const output = path.resolve('output/playwright/bookmark-hover')
const profileRoot = path.resolve('.tmp-test')
await mkdir(output, { recursive: true })
await mkdir(profileRoot, { recursive: true })
const report = {}

for (const deviceScaleFactor of [1, 1.25, 1.5, 2]) {
  const profile = await mkdtemp(path.join(profileRoot, 'bookmark-hover-'))
  // Set DPI on the context itself: screenshot capture can reset a CDP-only override.
  const context = await chromium.launchPersistentContext(profile, {
    channel: process.env.CURATOR_BROWSER_CHANNEL || 'chromium',
    headless: true, reducedMotion: 'no-preference', deviceScaleFactor,
    viewport: { width: 1440, height: 1000 },
    args: [`--disable-extensions-except=${path.resolve('dist')}`, `--load-extension=${path.resolve('dist')}`]
  })
  try {
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker')
    const page = await context.newPage()
    const wallpaper = await installGlassWallpaperFixture(context, page)
    await worker.evaluate(async wallpaper => {
      const folder = await chrome.bookmarks.create({ parentId: '1', title: 'Bookmarks' })
      for (const title of [
        'GitHub \u4e66\u7b7e\u540d',
        '\u8fd9\u662f\u7528\u6765\u68c0\u67e5\u591a\u884c\u6587\u5b57\u4f4d\u7f6e\u7684\u957f\u4e66\u7b7e\u540d\u79f0'
      ]) {
        await chrome.bookmarks.create({ parentId: folder.id, title, url: `https://example.com/${encodeURIComponent(title)}` })
      }
      await chrome.storage.local.set({
        curatorBookmarkNewTabFolderSettings: { selectedFolderIds: [folder.id], hideFolderNames: false },
        curatorBookmarkNewTabIconSettings: { titleLines: 2 },
        curatorBookmarkNewTabBackgroundSettings: { type: 'urls', color: '#101013', url: wallpaper, maskEnabled: false }
      })
    }, wallpaper)
    await page.goto(`chrome-extension://${new URL(worker.url()).host}/src/newtab/newtab.html`)
    await page.locator('.bookmark-tile').first().waitFor()
    const dismiss = page.getByRole('button', { name: '\u6211\u77e5\u9053\u4e86', exact: true })
    if (await dismiss.isVisible()) await dismiss.click()
    await page.waitForFunction(() => document.documentElement.dataset.newtabGlassStartup !== 'pending')
    await page.evaluate(() => document.fonts.ready)
    await page.mouse.move(10, 10)

    report[deviceScaleFactor] = {}
    for (const [index, label] of [[0, 'single-line'], [1, 'multiline']]) {
      const tile = page.locator('.bookmark-tile').nth(index)
      if (index === 1) {
        assert.ok(await tile.locator('.bookmark-title').evaluate(element =>
          element.getBoundingClientRect().height > Number.parseFloat(getComputedStyle(element).lineHeight) * 1.5
        ), 'The long title must exercise multiple lines')
      }
      const directory = path.join(output, `${deviceScaleFactor}x-${label}`)
      await mkdir(directory, { recursive: true })
      report[deviceScaleFactor][label] = await verifyBookmarkHover(page, tile, directory)
    }
  } finally {
    await context.close()
    assert.ok(profile.startsWith(profileRoot + path.sep))
    await rm(profile, { recursive: true, force: true })
  }
}

await writeFile(path.join(output, 'verification.json'), JSON.stringify(report, null, 2))
console.log('Bookmark hover: single/multiline glyph pixels, neighboring tiles, and interrupted exits are stable at 1x, 1.25x, 1.5x, and 2x DPI.')
