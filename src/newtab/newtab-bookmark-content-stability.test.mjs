import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { chromium } from 'playwright'

const extensionPath = path.resolve('dist')
const profilePath = await mkdtemp(path.join(tmpdir(), 'curator-bookmark-content-stability-'))
let context

try {
  context = await chromium.launchPersistentContext(profilePath, {
    headless: false,
    viewport: { width: 1280, height: 720 },
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`
    ]
  })

  const worker = context.serviceWorkers()[0]
    ?? await context.waitForEvent('serviceworker', { timeout: 15_000 })
  const extensionId = new URL(worker.url()).host
  await seedBookmark(worker)

  const page = await context.newPage()
  await page.addInitScript(installCardStabilitySampler)
  const url = `chrome-extension://${extensionId}/src/newtab/newtab.html`

  await page.goto(url, { waitUntil: 'domcontentloaded' })
  await page.locator('.bookmark-tile').first().waitFor({ state: 'visible', timeout: 20_000 })
  await page.waitForFunction(() => Boolean(localStorage.getItem('curatorNewTabBookmarkPreboot')))
  await page.waitForTimeout(300)

  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1_200)

  const samples = await page.evaluate(() => window.__curatorCardStabilitySamples || [])
  const visibleSamples = samples.filter((sample) => sample.title && sample.icon && sample.image)
  assert.ok(visibleSamples.length > 0, 'Expected visible bookmark-card frame samples after refresh.')

  const unstableIconSample = visibleSamples.find((sample) =>
    sample.image.naturalWidth > 0 &&
    (sample.image.opacity < 0.99 || sample.fallbackOpacity > 0.01)
  )
  assert.equal(
    unstableIconSample,
    undefined,
    `A cached favicon must be fully painted on the first visible refresh frame: ${JSON.stringify(unstableIconSample)}`
  )

  const stableSample = visibleSamples.at(-1)
  assert.notEqual(
    stableSample.icon.clipPath,
    'none',
    `The settled bookmark icon shell must carry its squircle clip-path: ${JSON.stringify(stableSample)}`
  )
  const unstableClipSample = visibleSamples.find((sample) =>
    sample.icon.clipPath !== stableSample.icon.clipPath
  )
  assert.equal(
    unstableClipSample,
    undefined,
    `Bookmark icon squircle outline must be identical from the first visible refresh frame: ${JSON.stringify(unstableClipSample)}`
  )
  const unstableGeometrySample = visibleSamples.find((sample) =>
    Math.abs(sample.icon.width - stableSample.icon.width) > 0.05 ||
    Math.abs(sample.icon.height - stableSample.icon.height) > 0.05 ||
    Math.abs(sample.image.width - stableSample.image.width) > 0.05 ||
    Math.abs(sample.image.height - stableSample.image.height) > 0.05 ||
    Math.abs(sample.title.glyphWidth - stableSample.title.glyphWidth) > 0.05 ||
    sample.title.font !== stableSample.title.font
  )
  assert.equal(
    unstableGeometrySample,
    undefined,
    `Bookmark icon and title geometry must stay identical throughout preboot handoff: ${JSON.stringify(unstableGeometrySample)}`
  )

  // 裸启动（无 preboot 快照：首次安装、快照过期、视口变化）没有快照层遮盖，
  // live 图标的 squircle 轮廓必须在首个可见帧就是终态，不允许圆角→squircle 突变。
  await page.evaluate(() => localStorage.removeItem('curatorNewTabBookmarkPreboot'))
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1_200)

  const bareSamples = await page.evaluate(() => window.__curatorCardStabilitySamples || [])
  const bareVisibleSamples = bareSamples.filter((sample) =>
    sample.kind === 'live' && sample.title && sample.icon
  )
  assert.ok(bareVisibleSamples.length > 0, 'Expected live bookmark-card samples on a snapshotless boot.')
  const bareStableSample = bareVisibleSamples.at(-1)
  assert.notEqual(
    bareStableSample.icon.clipPath,
    'none',
    `The settled snapshotless icon shell must carry its squircle clip-path: ${JSON.stringify(bareStableSample)}`
  )
  const bareUnstableSample = bareVisibleSamples.find((sample) =>
    sample.icon.clipPath !== bareStableSample.icon.clipPath ||
    Math.abs(sample.icon.width - bareStableSample.icon.width) > 0.05 ||
    Math.abs(sample.icon.height - bareStableSample.icon.height) > 0.05 ||
    Math.abs(sample.title.glyphWidth - bareStableSample.title.glyphWidth) > 0.05 ||
    sample.title.font !== bareStableSample.title.font
  )
  assert.equal(
    bareUnstableSample,
    undefined,
    `Snapshotless first paint must already match the settled card (no squircle pop-in): ${JSON.stringify(bareUnstableSample)}`
  )

  const themeSamples = await page.locator('.bookmark-tile:not(.bookmark-drag-ghost)').evaluateAll((tiles) =>
    tiles.map((tile) => {
      const icon = tile.querySelector('.bookmark-icon-shell')
      const tileStyle = getComputedStyle(tile)
      const iconStyle = icon ? getComputedStyle(icon) : null
      return {
        inlineTheme: tile.style.getPropertyValue('--bookmark-card-rgb'),
        cardBackground: tileStyle.backgroundColor,
        iconBackground: iconStyle?.backgroundColor || '',
        iconBorder: iconStyle?.borderColor || ''
      }
    })
  )
  assert.ok(themeSamples.length >= 3, 'Expected multiple website cards for the neutral-theme probe.')
  assert.ok(
    themeSamples.every((sample) => !sample.inlineTheme),
    `Website-derived card theme variables must not be injected: ${JSON.stringify(themeSamples)}`
  )
  assert.equal(
    new Set(themeSamples.map((sample) => sample.cardBackground)).size,
    1,
    `All bookmark cards should share one neutral glass background: ${JSON.stringify(themeSamples)}`
  )
  assert.equal(
    new Set(themeSamples.map((sample) => `${sample.iconBackground}|${sample.iconBorder}`)).size,
    1,
    `All bookmark icon shells should share one neutral treatment: ${JSON.stringify(themeSamples)}`
  )

  console.log('Newtab bookmark content stability test passed.')
} finally {
  await context?.close()
  await rm(profilePath, { recursive: true, force: true })
}

async function seedBookmark(worker) {
  await worker.evaluate(async () => {
    const tree = await chrome.bookmarks.getTree()
    const root = tree[0]
    const bookmarksBar = root.children?.find((node) => node.id === '1') || root.children?.[0]
    if (!bookmarksBar?.id) {
      throw new Error('Bookmarks bar is unavailable')
    }

    const folder = await chrome.bookmarks.create({
      parentId: bookmarksBar.id,
      title: 'Bookmark content stability probe'
    })
    const bookmarks = [
      ['OpenAI Research Stability', 'https://openai.com/research/'],
      ['GitHub Projects Stability', 'https://github.com/features/issues'],
      ['Linear Product Stability', 'https://linear.app/']
    ]
    for (const [title, url] of bookmarks) {
      await chrome.bookmarks.create({ parentId: folder.id, title, url })
    }

    await chrome.storage.local.set({
      curatorBookmarkNewTabFolderSettings: {
        selectedFolderIds: [folder.id],
        hideFolderNames: false
      },
      curatorBookmarkNewTabIconSettings: {
        pageWidth: 76,
        columnGap: 12,
        rowGap: 12,
        folderGap: 20,
        tileWidth: 190,
        iconShellSize: 32,
        preset: 'comfortable',
        layoutMode: 'auto',
        columns: 4,
        showTitles: true,
        titleLines: 1,
        verticalCenter: false
      },
      curatorBookmarkNewTabSearchSettings: {
        enabled: true
      }
    })
  })
}

function installCardStabilitySampler() {
  const nativeAddEventListener = EventTarget.prototype.addEventListener
  EventTarget.prototype.addEventListener = function addEventListener(type, listener, options) {
    if (type === 'load' && this instanceof HTMLImageElement && typeof listener === 'function') {
      const delayedListener = function delayedImageLoadListener(event) {
        window.setTimeout(() => {
          listener.call(this, event)
        }, 120)
      }
      return nativeAddEventListener.call(this, type, delayedListener, options)
    }
    return nativeAddEventListener.call(this, type, listener, options)
  }

  window.__curatorCardStabilitySamples = []
  let frame = 0

  const isPainted = (element) => {
    if (!element) {
      return false
    }
    const style = getComputedStyle(element)
    const rect = element.getBoundingClientRect()
    return style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      Number(style.opacity) > 0 &&
      rect.width > 0 &&
      rect.height > 0
  }

  const readGlyphWidth = (element) => {
    if (!element?.firstChild) {
      return 0
    }
    const range = document.createRange()
    range.selectNodeContents(element)
    return range.getBoundingClientRect().width
  }

  const sampleFrame = () => {
    const prebootTile = document.querySelector('.newtab-bookmark-preboot-tile')
    const liveTile = document.querySelector('.bookmark-tile:not(.bookmark-drag-ghost)')
    const tile = isPainted(prebootTile) ? prebootTile : (isPainted(liveTile) ? liveTile : null)

    if (tile) {
      const preboot = tile === prebootTile
      const icon = tile.querySelector(
        preboot ? '.newtab-bookmark-preboot-icon-shell' : '.bookmark-icon-shell'
      )
      const image = tile.querySelector(
        preboot ? '.newtab-bookmark-preboot-favicon' : '.bookmark-favicon'
      )
      const fallback = tile.querySelector(
        preboot ? '.newtab-bookmark-preboot-fallback' : '.bookmark-fallback'
      )
      const title = tile.querySelector(
        preboot ? '.newtab-bookmark-preboot-title' : '.bookmark-title:not([hidden])'
      )
      const iconRect = icon?.getBoundingClientRect()
      const imageRect = image?.getBoundingClientRect()
      const imageStyle = image ? getComputedStyle(image) : null
      const titleStyle = title ? getComputedStyle(title) : null
      const iconStyle = icon ? getComputedStyle(icon) : null

      window.__curatorCardStabilitySamples.push({
        frame,
        kind: preboot ? 'preboot' : 'live',
        icon: iconRect ? {
          width: iconRect.width,
          height: iconRect.height,
          clipPath: iconStyle ? iconStyle.clipPath : 'none'
        } : null,
        image: imageRect && imageStyle ? {
          width: imageRect.width,
          height: imageRect.height,
          opacity: Number(imageStyle.opacity),
          naturalWidth: image.naturalWidth
        } : null,
        fallbackOpacity: fallback ? Number(getComputedStyle(fallback).opacity) : 0,
        title: title && titleStyle ? {
          glyphWidth: readGlyphWidth(title),
          font: [
            titleStyle.fontFamily,
            titleStyle.fontSize,
            titleStyle.fontWeight,
            titleStyle.lineHeight
          ].join('|')
        } : null
      })
    }

    frame += 1
    if (frame < 120) {
      requestAnimationFrame(sampleFrame)
    }
  }

  requestAnimationFrame(sampleFrame)
}
