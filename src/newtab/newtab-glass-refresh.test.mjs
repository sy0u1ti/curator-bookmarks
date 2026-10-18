import assert from 'node:assert/strict'



import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'

const browserChannel = process.env.CURATOR_BROWSER_CHANNEL || 'msedge'
import { installGlassWallpaperFixture } from './glass-test-fixture.mjs'

const selectors = ['.newtab-clock', '.newtab-search-surface', '.bookmark-tile', '.settings-trigger', '.folder-section-header', '.newtab-speed-dial']
// Only these sit directly on the wallpaper and carry a refraction rim; the rest
// use the frost/chip tiers and must keep one material from their first frame.
const lensSelectors = new Set(['.newtab-clock', '.newtab-search-surface'])

const output = path.resolve('output/playwright/glass-refresh')
await mkdir(output, { recursive: true })
await mkdir(path.resolve('.tmp-test'), { recursive: true })
const profile = await mkdtemp(path.resolve('.tmp-test/glass-refresh-'))
const context = await chromium.launchPersistentContext(profile, {
  channel: browserChannel, headless: true, viewport: { width: 1440, height: 1000 },
  args: [`--disable-extensions-except=${path.resolve('dist')}`, `--load-extension=${path.resolve('dist')}`]
})
try {
  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker')
  const page = await context.newPage()
  const wallpaperUrl = await installGlassWallpaperFixture(context, page)
  await worker.evaluate(async wallpaperUrl => {
    const folder = await chrome.bookmarks.create({ parentId: '1', title: '刷新测试' })
    for (let i = 0; i < 6; i++) await chrome.bookmarks.create({ parentId: folder.id, title: `Bookmark ${i}`, url: `https://example.com/${i}` })
    await chrome.storage.local.set({
      curatorBookmarkOnboardingState: { completed: true },
      curatorBookmarkNewTabModuleSettings: { version: 1, speedDial: true, order: ['speedDial'] },
      curatorBookmarkNewTabFolderSettings: { selectedFolderIds: [folder.id], hideFolderNames: false },
      curatorBookmarkNewTabBackgroundSettings: { type: 'urls', color: '#101013', url: wallpaperUrl, maskEnabled: false }
    })
  }, wallpaperUrl)
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await context.addInitScript(selectors => {
    window.glassFrames = []
    const delay = Number(new URL(location.href).searchParams.get('glass-worker-delay'))
    if (new URL(location.href).searchParams.has('glass-worker-error')) {
      window.Worker = class { constructor() { throw new Error('Fixture: worker unavailable') } }
    }
    if (delay) {
      const NativeWorker = Worker
      window.Worker = class extends NativeWorker {
        first = true
        postMessage(...args) {
          if (!this.first) return super.postMessage(...args)
          this.first = false
          setTimeout(() => super.postMessage(...args), delay)
        }
      }
    }
    const start = performance.now()
    function sample() {
      const surfaces = selectors.flatMap(selector => {
        const element = document.querySelector(selector)
        if (!element) return []
        const css = getComputedStyle(element)
        if (!element.getBoundingClientRect().width) return []
        let visible = true
        let opacity = 1
        for (let ancestor = element; ancestor; ancestor = ancestor.parentElement) {
          const style = getComputedStyle(ancestor)
          if (style.visibility === 'hidden' || Number(style.opacity) === 0) visible = false
          opacity *= Number(style.opacity)
        }
        return [{ selector, visible, opacity, border: css.border, shadow: css.boxShadow, backdrop: css.backdropFilter,
          background: css.backgroundColor, clip: css.clipPath, filter: css.filter,
          image: Number(getComputedStyle(element, '::before').opacity) > 0 && element.style.getPropertyValue('--newtab-glass-texture') ? 'texture' : 'none',
          animation: css.animationName,
          mode: element.dataset.glassMode, renderer: element.dataset.glassRenderer, surface: element.dataset.hyaliteSurface }]
      })
      const previous = window.glassFrames.at(-1)
      if (!previous || JSON.stringify(previous.surfaces) !== JSON.stringify(surfaces)) {
        window.glassFrames.push({ time: Math.round(performance.now() - start), startup: document.documentElement.dataset.newtabGlassStartup, surfaces })
      }
      if (performance.now() - start < (delay > 3000 ? 6000 : 3500)) requestAnimationFrame(sample)
      else window.glassSamplingDone = true
    }
    requestAnimationFrame(sample)
  }, selectors)
  const url = `chrome-extension://${new URL(worker.url()).host}/src/newtab/newtab.html`
  await page.goto(url)
  await verifyRefresh(page, 'cold-start', 'auto')

  for (const reducedMotion of ['no-preference', 'reduce']) {
    await page.emulateMedia({ reducedMotion })
    await page.reload()
    await verifyRefresh(page, `reload-${reducedMotion}`)
  }

  const freshPage = await context.newPage()
  await freshPage.goto(url)
  await verifyRefresh(freshPage, 'new-tab')
  await freshPage.close()
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto(url + '?glass-worker-delay=650')
  await verifyRefresh(page, 'slow-worker')
  await page.screenshot({ path: path.join(output, 'settled.png') })
  await page.goto(url + '?glass-worker-delay=3500')
  await verifyRefresh(page, 'cached-late-worker')
  await page.getByRole('button', { name: '打开设置', exact: true }).click()
  await page.getByRole('tab', { name: '玻璃', exact: true }).waitFor()
  await page.mouse.move(0, 0)
  await page.goto(url + '?glass-worker-error=1')
  await verifyRefresh(page, 'cached-unavailable-worker')
  await page.locator('.newtab-search-input').fill('Bookmark')
  await page.locator('.newtab-search-suggestion').first().waitFor()
  // A cached lens must never be stretched into a different viewport or reused
  // for different optics. With rendering disabled, these must be cache misses.
  await page.setViewportSize({ width: 1280, height: 1000 })
  await page.goto(url + '?glass-worker-error=1')
  await verifyRefresh(page, 'changed-viewport', true)
  await page.setViewportSize({ width: 1440, height: 1000 })
  await worker.evaluate(() => chrome.storage.local.set({ curatorBookmarkNewTabGlassSettings: { rim: 1.6 } }))
  await page.goto(url + '?glass-worker-error=1')
  await verifyRefresh(page, 'changed-optics', true)
  await worker.evaluate(() => chrome.storage.local.remove('curatorBookmarkNewTabGlassSettings'))
  await page.evaluate(() => caches.delete('curator-glass-textures-v1'))
  await page.goto(url + '?glass-worker-delay=3500')
  await verifyRefresh(page, 'uncached-late-worker', true)
  await page.evaluate(() => caches.delete('curator-glass-textures-v1'))
  await page.goto(url + '?glass-worker-error=1')
  await verifyRefresh(page, 'uncached-unavailable-worker', true)
  assert.deepEqual(errors, [])

  async function verifyRefresh(target, name, expectedFallback = false) {
    await target.waitForFunction(() => document.documentElement.dataset.newtabGlassStartup !== 'pending')
    const fallback = await target.evaluate(() => document.documentElement.dataset.newtabGlassStartup === 'fallback')
    if (expectedFallback !== 'auto') assert.equal(fallback, expectedFallback, `${name}: cached refresh must retain full refraction`)
    const surface = target.locator('.newtab-search-surface')
    // The decoded wallpaper replaces the cached crop independently of the
    // shell; compare texture pixels once that layer and the glyphs have settled.
    await target.waitForFunction(
      () => document.documentElement.dataset.instantWallpaperRemoteReady === 'true',
      undefined,
      { timeout: 8000 }
    ).catch(() => {})
    await target.evaluate(() => document.fonts.ready)
    const firstPixels = await surface.screenshot({ path: path.join(output, `${name}-first.png`) })
    await target.waitForFunction(() => window.glassSamplingDone)
    const settledPixels = await surface.screenshot({ path: path.join(output, `${name}-settled.png`) })
    const frames = await target.evaluate(() => window.glassFrames)
    await writeFile(path.join(output, `${name}.json`), JSON.stringify(frames, null, 2))
    const firstPaints = []
    const refractionCommits = []
    for (const selector of selectors) {
      const samples = frames.flatMap(frame => frame.surfaces.filter(surface => surface.selector === selector && surface.visible))
      const message = `${name} ${selector}`
      assert.ok(samples.length, `${message}: must become visible`)
      firstPaints.push(frames.find(frame => frame.surfaces.some(surface => surface.selector === selector && surface.visible)).time)
      const material = ({ border, shadow, backdrop, background, clip, filter, image }) => JSON.stringify({ border, shadow, backdrop, background, clip, filter, image })
      assert.ok(samples.every(sample => sample.opacity === 1), `${message}: present the whole surface without an opacity entrance`)
      assert.ok(samples.every(sample => sample.animation === 'none'), `${message}: the rim must never animate in`)
      const refractionSamples = samples.filter(sample => sample.mode === 'refraction')
      const compatibleSamples = samples.filter(sample => sample.mode !== 'refraction')
      if (!lensSelectors.has(selector)) {
        assert.ok(samples.every(sample => sample.image === 'none' && !sample.mode), `${message}: non-lens tiers must never receive a refraction rim`)
        assert.equal(new Set(samples.map(material)).size, 1, `${message}: non-lens tiers must keep one material`)
      } else if (fallback) {
        // A cold cache may finish lenses after the guard. The fallback is final:
        // no texture may paint once the compatible material was presented.
        assert.ok(samples.every(sample => sample.image === 'none'), `${message}: the fallback must never paint a late texture`)
      } else {
        // The compatible material may own the first frame so content is never
        // hidden; refraction must then arrive atomically and never be patched.
        assert.ok(refractionSamples.length > 0, `${message}: cached refraction must become visible`)
        assert.ok(compatibleSamples.every(sample => sample.image === 'none'), `${message}: no frame may precede its finished texture`)
        assert.ok(refractionSamples.every(sample => sample.image === 'texture'), `${message}: refraction must carry a finished texture`)
        assert.equal(new Set(refractionSamples.map(material)).size, 1, `${message}: refraction must not be patched after it is shown`)
      }
      if (!fallback && lensSelectors.has(selector)) {
        refractionCommits.push(frames.find(frame => frame.surfaces.some(surface => surface.selector === selector && surface.mode === 'refraction')).time)
      }
    }
    // The whole first viewport must swap to refraction in one frame.
    if (!fallback) assert.equal(new Set(refractionCommits).size, 1, `${name}: all initial glass surfaces must swap to refraction together`)
    // Content must paint without waiting for the lens pass: comfortably inside
    // the startup guard even on a cold profile, and much sooner when cached.
    const contentBudget = name === 'cold-start' ? 500 : 250
    assert.ok(firstPaints.every(time => time < contentBudget), `${name}: content must paint immediately (${firstPaints.join(', ')}ms, budget ${contentBudget}ms)`)
    if (!fallback) assert.ok(refractionCommits.every(time => time < 800), `${name}: refraction must settle within the startup window (${refractionCommits.join(', ')}ms)`)
    // Compare decoded pixels: GPU compositing can round a channel by one level
    // across captures, which also changes the entire compressed PNG byte stream.
    const pixelDifference = await target.evaluate(async ([first, settled]) => {
      const decode = async base64 => {
        const image = new Image()
        image.src = 'data:image/png;base64,' + base64
        await image.decode()
        const canvas = document.createElement('canvas')
        canvas.width = image.naturalWidth
        canvas.height = image.naturalHeight
        const context = canvas.getContext('2d')
        context.drawImage(image, 0, 0)
        return { width: canvas.width, height: canvas.height, pixels: context.getImageData(0, 0, canvas.width, canvas.height).data }
      }
      const [a, b] = await Promise.all([decode(first), decode(settled)])
      if (a.width !== b.width || a.height !== b.height) return { sameSize: false, maxDelta: 255 }
      let maxDelta = 0
      for (let i = 0; i < a.pixels.length; i++) maxDelta = Math.max(maxDelta, Math.abs(a.pixels[i] - b.pixels[i]))
      return { sameSize: true, maxDelta }
    }, [firstPixels.toString('base64'), settledPixels.toString('base64')])
    // Two levels of headroom: this already flaked on the pre-change baseline
    // because the compositor can round a channel twice on dark backdrops.
    assert.ok(pixelDifference.sameSize && pixelDifference.maxDelta <= 2, `${name}: decoded texture pixels must remain stable (maximum channel delta ${pixelDifference.maxDelta})`)
    assert.ok(firstPaints[0] < (fallback ? 800 : 350), `${name}: startup must stay bounded (${firstPaints[0]}ms)`)
    const cacheHits = await target.evaluate(() => performance.getEntriesByName('newtab.glassCacheHit').length)
    if (name.startsWith('cached-')) assert.ok(cacheHits >= lensSelectors.size, `${name}: use cached textures even without a working renderer`)
    console.log(`${name}: ${selectors.length} ${fallback ? 'compatible' : 'full-refraction'} surfaces together at ${firstPaints[0]}ms; ${cacheHits} cache hits; first/settled pixels match.`)
  }
} finally {
  await context.close()
  await rm(profile, { recursive: true, force: true })
}

