import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { build } from 'esbuild'
import { chromium } from 'playwright'
import '../vendor/hyalite/hyalite.js'
import { installGlassWallpaperFixture } from './glass-test-fixture.mjs'

const { outputFiles } = await build({ entryPoints: ['src/newtab/glass-settings.ts'], bundle: true, write: false, format: 'esm', platform: 'node' })
const { DEFAULT_GLASS_SETTINGS, normalizeGlassSettings, getGlassRefractionOptions } = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`)
const hash = value => createHash('sha256').update(value).digest('hex')
assert.equal(DEFAULT_GLASS_SETTINGS.blur, 12)
assert.deepEqual(normalizeGlassSettings(null), DEFAULT_GLASS_SETTINGS)
assert.equal(normalizeGlassSettings({ tint: 0, blur: ' ' }).tint, 0)
assert.equal(normalizeGlassSettings({ blur: ' ' }).blur, 12)
assert.equal(normalizeGlassSettings({ blur: 50, tint: -1 }).blur, 12)
assert.equal(normalizeGlassSettings({ tint: -1 }).tint, 0)

// Different levels must produce different pixels even on a 6px bookmark corner.
// This catches the physical clamping that made the original pixel sliders inert.
for (const radius of [6, 12, 30]) {
  for (const [key, values] of [['bevel', [4, 26, 48]], ['thickness', [2, 19, 40]]]) {
    const maps = values.map(value => {
      const options = getGlassRefractionOptions({ ...DEFAULT_GLASS_SETTINGS, [key]: value }, 380, 160, [radius, radius, radius, radius])
      const input = globalThis.Hyalite.mapInput(380, 160, [radius, radius, radius, radius], options)
      const pixels = globalThis.Hyalite.buildMapPixels(input.width, input.height, input.radii, input.options)
      return hash(pixels.outer) + ':' + pixels.maxd
    })
    assert.equal(new Set(maps).size, values.length, `${key} must remain effective on ${radius}px corners`)
  }
}

const output = path.resolve('output/playwright/hyalite-refinement')
const profileRoot = path.resolve('.tmp-test')
await mkdir(output, { recursive: true })
await mkdir(profileRoot, { recursive: true })
const profile = await mkdtemp(path.join(profileRoot, 'glass-regression-'))
const errors = []
const report = { parameters: [], errors }
let context

async function waitForLens(page, selector = '.newtab-glass-preview') {
  await page.waitForFunction(selector => {
    const element = document.querySelector(selector)
    const settings = JSON.parse(localStorage.getItem('curator-newtab-glass-v1') || '{}')
    const optics = { bevel: settings.bevel, thickness: settings.thickness, blur: settings.blur, dispersion: settings.dispersion, rim: settings.rim, light: settings.light, smooth: settings.smooth }
    return element?.dataset.glassMode === 'refraction' && element.dataset.glassOptics === JSON.stringify(optics)
  }, selector)
}

async function readLens(page, selector = '.newtab-glass-preview') {
  return page.locator(selector).evaluate(element => {
    const id = element.style.getPropertyValue('--hyalite').match(/#([^\s)"']+)/)?.[1]
    const filter = id && document.getElementById(id)
    const raster = element.dataset.glassRenderer === 'raster'
    return {
      id: raster ? element.style.getPropertyValue('--newtab-glass-texture') : id,
      background: getComputedStyle(element).backgroundColor,
      blur: raster ? Number(element.dataset.glassBlur) : Number(filter?.querySelector('feGaussianBlur[in="SourceGraphic"]')?.getAttribute('stdDeviation')),
      primitives: filter?.innerHTML,
      map: filter?.querySelector('feImage')?.getAttribute('href')
    }
  })
}

async function resetGlass(page) {
  await page.getByRole('button', { name: '恢复玻璃默认值', exact: true }).click()
  await waitForLens(page)
}

async function installWallpaper(page) {
  await page.waitForFunction(() => document.querySelector('.newtab-app')?.dataset.backgroundMedia === 'true')
}

async function readCardEdge(tile) {
  return tile.evaluate(element => {
    const style = getComputedStyle(element)
    const rect = element.getBoundingClientRect()
    const clippedBy = []
    for (let parent = element.parentElement; parent; parent = parent.parentElement) {
      if (!['hidden', 'clip', 'scroll', 'auto'].includes(getComputedStyle(parent).overflowX)) continue
      const bounds = parent.getBoundingClientRect()
      if (rect.left < bounds.left - 1 || rect.right > bounds.right + 1) clippedBy.push(parent.className)
    }
    return {
      borders: [style.borderLeft, style.borderRight, style.borderTop, style.borderBottom],
      borderOpacity: Number(style.borderLeftColor.match(/,\s*([\d.]+)\)$/)?.[1] ?? 1),
      rim: style.boxShadow.split(/,(?![^(]*\))/).filter(shadow => shadow.includes('inset')).map(shadow => shadow.trim()),
      clip: style.clipPath, mask: style.maskImage, clippedBy,
      texture: element.style.getPropertyValue('--newtab-glass-texture')
    }
  })
}

try {
  context = await chromium.launchPersistentContext(profile, {
    channel: 'chromium', headless: true, reducedMotion: 'no-preference', viewport: { width: 1440, height: 1280 },
    args: [`--disable-extensions-except=${path.resolve('dist')}`, `--load-extension=${path.resolve('dist')}`]
  })
  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker')
  const extensionId = new URL(worker.url()).host
  const url = `chrome-extension://${extensionId}/src/newtab/newtab.html`
  const page = await context.newPage()
  const wallpaperUrl = await installGlassWallpaperFixture(context, page)
  await worker.evaluate(async () => {
    const folders = []
    const bookmarks = []
    for (const title of ['开发工具', '设计资料', '阅读清单']) {
      const folder = await chrome.bookmarks.create({ parentId: '1', title })
      folders.push(folder.id)
      for (const name of ['GitHub', 'TypeScript', 'React', 'Vite', 'Figma', 'MDN']) {
        bookmarks.push((await chrome.bookmarks.create({ parentId: folder.id, title: name, url: `https://example.com/${folder.id}/${name}` })).id)
      }
    }
    await chrome.storage.local.set({
      curatorBookmarkNewTabFolderSettings: { selectedFolderIds: folders, hideFolderNames: false },
      curatorBookmarkNewTabWorkspaceSettings: { activeWorkspaceId: 'default', workspaces: [{ id: 'default', name: '常用入口', pinnedIds: bookmarks.slice(0, 4), createdAt: Date.now(), updatedAt: Date.now() }] }
    })
  })
  await worker.evaluate(async wallpaperUrl => {
    await chrome.storage.local.set({ curatorBookmarkNewTabBackgroundSettings: { type: 'urls', color: '#101013', url: wallpaperUrl, maskEnabled: false } })
  }, wallpaperUrl)
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(url)
  await page.locator('.bookmark-tile').first().waitFor()
  const dismiss = page.getByRole('button', { name: '我知道了', exact: true })
  if (await dismiss.isVisible()) await dismiss.click()
  await installWallpaper(page)
  await waitForLens(page, '.newtab-search-surface')
  await page.evaluate(() => document.fonts.ready)
  assert.equal((await readLens(page, '.newtab-search-surface')).blur, 12)
  assert.equal((await readLens(page, '.newtab-search-surface')).background, 'rgba(0, 0, 0, 0.13)')
  assert.ok(await page.evaluate(() => Number(document.documentElement.dataset.hyaliteSurfaces) <= 48))
  await page.waitForFunction(() => [...document.querySelectorAll('.bookmark-tile')].every(element => element.dataset.glassMode === 'refraction'))
  const stableMaterials = await page.locator('.bookmark-tile, .newtab-clock').evaluateAll(elements => elements.map(element => {
    const style = getComputedStyle(element)
    return [element.style.getPropertyValue('--hyalite'), element.style.getPropertyValue('--newtab-glass-texture'), style.backdropFilter, style.borderColor, style.boxShadow]
  }))
  await page.mouse.click(20, 1100)
  assert.deepEqual(await page.locator('.bookmark-tile, .newtab-clock').evaluateAll(elements => elements.map(element => {
    const style = getComputedStyle(element)
    return [element.style.getPropertyValue('--hyalite'), element.style.getPropertyValue('--newtab-glass-texture'), style.backdropFilter, style.borderColor, style.boxShadow]
  })), stableMaterials, 'Clicking blank space must never switch unrelated glass filters or highlights')
  report.stableMaterialsOnClick = true

  // Check actual painted states: the previous hover selector replaced the rim,
  // leaving the two vertical edges nearly invisible until a pointer arrived.
  const tile = page.locator('.bookmark-tile').first()
  const settleCard = () => tile.evaluate(element => Promise.all(element.getAnimations({ subtree: true }).map(animation => animation.finished.catch(() => {}))))
  const restingEdge = await readCardEdge(tile)
  const edges = { rest: restingEdge }
  await tile.screenshot({ path: path.join(output, 'card-edge-rest.png') })
  await tile.hover()
  await settleCard()
  edges.hover = await readCardEdge(tile)
  await tile.screenshot({ path: path.join(output, 'card-edge-hover.png') })
  await tile.evaluate(element => element.addEventListener('click', event => { event.preventDefault(); event.stopImmediatePropagation() }, { capture: true, once: true }))
  await page.mouse.down()
  await settleCard()
  edges.active = await readCardEdge(tile)
  await tile.screenshot({ path: path.join(output, 'card-edge-active.png') })
  await page.mouse.up()
  await page.mouse.move(20, 1100)
  await page.keyboard.press('Tab')
  await tile.focus()
  await settleCard()
  edges.focus = await readCardEdge(tile)
  assert.equal(await tile.evaluate(element => element.matches(':focus-visible')), true)
  await tile.screenshot({ path: path.join(output, 'card-edge-focus.png') })
  for (const [state, edge] of Object.entries(edges)) {
    assert.equal(new Set(edge.borders).size, 1, `${state}: every side must have the same continuous stroke`)
    assert.ok(edge.borderOpacity >= 0.18, `${state}: the resting side stroke must remain visible`)
    assert.equal(edge.clip, 'none')
    assert.equal(edge.mask, 'none')
    assert.deepEqual(edge.clippedBy, [], `${state}: no ancestor may cut off the side edges`)
    assert.ok(edge.rim.length > 0)
    assert.deepEqual(edge.rim, restingEdge.rim, `${state}: interaction must retain the complete glass rim`)
    assert.equal(edge.texture, restingEdge.texture, `${state}: interaction must preserve the cached edge`)
  }
  await page.mouse.click(20, 1100)
  await settleCard()
  assert.deepEqual(await readCardEdge(tile), restingEdge, 'Returning to rest must restore the same complete edge')
  report.cardEdges = { states: Object.keys(edges), continuousStroke: true, stableRim: true, noClipping: true }

  await page.getByRole('button', { name: '打开设置', exact: true }).click()
  await page.getByRole('tab', { name: '玻璃', exact: true }).click()
  await waitForLens(page)
  assert.equal(await page.locator('#newtab-settings-trigger').evaluate(element => getComputedStyle(element).visibility), 'hidden')
  const panel = page.locator('#settings-panel-glass')
  assert.equal(await panel.getByRole('slider').count(), 8)
  await page.getByRole('button', { name: '玻璃材质参数', exact: true }).click()
  await panel.getByRole('slider').first().waitFor({ state: 'hidden' })
  assert.equal(await panel.getByRole('slider').count(), 0, 'Every glass control must collapse together')
  await page.getByRole('button', { name: '玻璃材质参数', exact: true }).click()
  await waitForLens(page)

  for (const [key, name, low, high] of [
    ['blur', '玻璃模糊', 0, 12], ['bevel', '边缘范围', 4, 48],
    ['thickness', '折射强度', 2, 40], ['dispersion', '色散', 0, 0.16],
    ['rim', '边缘高光', 0, 1.6], ['light', '光照方向', -180, 0],
    ['smooth', '边缘柔化', 0, 3]
  ]) {
    const slider = page.getByRole('slider', { name, exact: true })
    await slider.press('Home')
    await waitForLens(page)
    await waitForLens(page, '.newtab-search-surface')
    const before = await readLens(page)
    const beforeImage = await page.locator('.newtab-glass-preview').screenshot()
    const beforeCachedImage = await page.locator('.newtab-search-surface').screenshot()
    if (key === 'light') for (let step = 0; step < 36; step++) await slider.press('ArrowRight')
    else await slider.press('End')
    await waitForLens(page)
    await waitForLens(page, '.newtab-search-surface')
    const after = await readLens(page)
    const afterImage = await page.locator('.newtab-glass-preview').screenshot()
    assert.notEqual(after.primitives, before.primitives, `${name} must update its live SVG primitives`)
    assert.notEqual(hash(afterImage), hash(beforeImage), `${name} must change actual painted pixels`)
    assert.notEqual(hash(await page.locator('.newtab-search-surface').screenshot()), hash(beforeCachedImage), `${name} must also change the cached wallpaper refraction`)
    if (['bevel', 'thickness', 'light'].includes(key)) assert.notEqual(after.map, before.map, `${name} must rebuild its lens map`)
    else assert.equal(after.map, before.map, `${name} must reuse the map when geometry does not change`)
    report.parameters.push({ key, low, high, svgChanged: true, pixelsChanged: true, cachedPixelsChanged: true })
    if (key === 'blur') {
      await writeFile(path.join(output, 'glass-blur-0.png'), beforeImage)
      await writeFile(path.join(output, 'glass-blur-12.png'), afterImage)
    }
    await resetGlass(page)
  }

  const beforeTint = await readLens(page)
  await page.getByRole('slider', { name: '底色深浅', exact: true }).press('End')
  const afterTint = await readLens(page)
  assert.equal(afterTint.background, 'rgba(0, 0, 0, 0.6)')
  assert.equal(afterTint.id, beforeTint.id, 'Tint is CSS-only and must not rebuild filters')
  await resetGlass(page)
  report.parameters.push({ key: 'tint', cssOnly: true })

  // Real storage survives a reload, including values set by keyboard on the slider.
  const blur = page.getByRole('slider', { name: '玻璃模糊', exact: true })
  await blur.press('Home')
  for (let step = 0; step < 8; step++) await blur.press('ArrowRight')
  await page.waitForFunction(() => [...document.querySelectorAll('.newtab-glass-controls output')].some(element => element.textContent === '已保存'), undefined, { timeout: 5000 }).catch(async error => {
    console.log(await page.evaluate(async () => ({ outputs: [...document.querySelectorAll('.newtab-glass-controls output')].map(element => element.textContent), stored: await chrome.storage.local.get('curatorBookmarkNewTabGlassSettings'), locks: await navigator.locks.query() })))
    throw error
  })
  assert.equal(await page.evaluate(async () => (await chrome.storage.local.get('curatorBookmarkNewTabGlassSettings')).curatorBookmarkNewTabGlassSettings?.blur), 4)
  report.beforeReload = await page.evaluate(async () => ({ cache: localStorage.getItem('curator-newtab-glass-v1'), stored: await chrome.storage.local.get('curatorBookmarkNewTabGlassSettings'), css: document.documentElement.style.getPropertyValue('--newtab-glass-background-blur') }))
  await page.reload()
  await waitForLens(page, '.newtab-search-surface')
  report.afterReload = await page.evaluate(async () => ({ cache: localStorage.getItem('curator-newtab-glass-v1'), stored: await chrome.storage.local.get('curatorBookmarkNewTabGlassSettings'), css: document.documentElement.style.getPropertyValue('--newtab-glass-background-blur') }))
  await writeFile(path.join(output, 'verification.json'), JSON.stringify(report, null, 2))
  assert.equal((await readLens(page, '.newtab-search-surface')).blur, 4)
  await page.getByRole('button', { name: '打开设置', exact: true }).click()
  await page.getByRole('tab', { name: '玻璃', exact: true }).click()
  const quickBlur = page.getByRole('slider', { name: '玻璃模糊', exact: true })
  await quickBlur.press('Home')
  for (let step = 0; step < 4; step++) await quickBlur.press('ArrowRight')
  await page.reload()
  await waitForLens(page, '.newtab-search-surface')
  assert.equal((await readLens(page, '.newtab-search-surface')).blur, 2, 'Reloading before the save debounce must preserve the last input')
  report.persistence = true
  await installWallpaper(page)
  await page.getByRole('button', { name: '打开设置', exact: true }).click()
  await page.getByRole('tab', { name: '玻璃', exact: true }).click()
  await resetGlass(page)
  await page.getByRole('button', { name: '关闭设置', exact: true }).click()
  await page.locator('.settings-drawer-panel').waitFor({ state: 'hidden' })

  const input = page.locator('.newtab-search-input')
  await input.fill('Git')
  await page.waitForFunction(() => document.querySelectorAll('#newtab-search-suggestions .newtab-search-suggestion').length >= 3)
  await page.waitForFunction(() => document.querySelector('.newtab-search-shell')?.getAttribute('data-panel-open') === 'true')
  await page.waitForFunction(() => document.querySelector('.newtab-search-shell')?.getAnimations({ subtree: true }).every(animation => animation.playState !== 'running'))
  await waitForLens(page, '.newtab-search-surface')
  const searchLens = await readLens(page, '.newtab-search-surface')
  await input.pressSequentially('Hub', { delay: 25 })
  await page.waitForTimeout(220)
  assert.equal((await readLens(page, '.newtab-search-surface')).id, searchLens.id, 'Typing must retain a stable lens')
  assert.equal(await input.evaluate(element => document.activeElement === element), true)
  assert.equal(await page.locator('.newtab-search-surface').evaluate(element => getComputedStyle(element).outlineStyle), 'none')
  assert.equal(await page.locator('.newtab-search').evaluate(element => getComputedStyle(element).borderTopWidth), '0px')
  assert.equal(await page.locator('.newtab-search-surface').evaluate(element => getComputedStyle(element).borderTopColor), 'rgba(255, 255, 255, 0.46)')
  assert.ok(await page.locator('.newtab-search-shell').evaluate(element => new DOMMatrixReadOnly(getComputedStyle(element).transform).a > 1.01), 'Focus should give the joined search surface a gentle spring expansion')
  const joinedSearch = await page.evaluate(() => {
    const surface = document.querySelector('.newtab-search-surface')
    const panel = document.querySelector('.newtab-search-suggestions-panel')
    return { surfaceCount: document.querySelectorAll('.newtab-search-surface').length, bottomGap: Math.abs(surface.getBoundingClientRect().bottom - panel.getBoundingClientRect().bottom), panelBackdrop: getComputedStyle(panel).backdropFilter }
  })
  assert.equal(joinedSearch.surfaceCount, 1)
  assert.ok(joinedSearch.bottomGap <= 1)
  assert.equal(joinedSearch.panelBackdrop, 'none')
  await page.screenshot({ path: path.join(output, 'search-suggestions-verified.png') })
  await input.press('ArrowDown')
  assert.ok(await input.getAttribute('aria-activedescendant'))
  report.search = { stableLensWhileTyping: true, singleFocusBorder: true, joinedSuggestions: true, keyboardNavigation: true }
  await page.getByRole('button', { name: '清空搜索', exact: true }).click()
  const closingSuggestions = await page.locator('#newtab-search-suggestions-panel').evaluate(element => ({ inert: element.inert, rows: element.querySelectorAll('.newtab-search-suggestion').length }))
  assert.equal(closingSuggestions.inert, true)
  assert.ok(closingSuggestions.rows >= 3, 'Outgoing recommendations should remain painted through their exit')
  await page.locator('#newtab-search-suggestions-panel').waitFor({ state: 'hidden' })
  await input.press('Escape')

  await page.getByRole('button', { name: '打开设置', exact: true }).click()
  await page.getByRole('tab', { name: '玻璃', exact: true }).click()
  await resetGlass(page)
  await page.screenshot({ path: path.join(output, 'glass-settings-verified.png') })
  await page.getByRole('button', { name: '关闭设置', exact: true }).click()
  await page.locator('.settings-drawer-panel').waitFor({ state: 'hidden' })
  await page.screenshot({ path: path.join(output, 'newtab-verified.png') })

  await page.evaluate(() => { window.Hyalite.force(false); document.dispatchEvent(new Event('visibilitychange')) })
  await page.waitForFunction(() => document.querySelector('.newtab-search-surface')?.dataset.glassMode === 'frosted')
  const fallback = await page.locator('.newtab-search-surface').evaluate(element => ({ backdrop: getComputedStyle(element).backdropFilter, background: getComputedStyle(element).backgroundColor }))
  assert.deepEqual(fallback, { backdrop: 'blur(12px)', background: 'rgba(0, 0, 0, 0.13)' })
  report.fallback = fallback
  await page.evaluate(() => { window.Hyalite.force(null); document.dispatchEvent(new Event('visibilitychange')) })
  await waitForLens(page, '.newtab-search-surface')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: '打开设置', exact: true }).click()
  await page.getByRole('tab', { name: '玻璃', exact: true }).click()
  await page.getByRole('slider', { name: '玻璃模糊', exact: true }).waitFor()
  await page.screenshot({ path: path.join(output, 'glass-settings-narrow.png') })
  assert.equal(await page.locator('.settings-drawer-panel').evaluate(element => element.scrollWidth <= element.clientWidth), true)
  await page.keyboard.press('Escape')
  await page.locator('.settings-drawer-panel').waitFor({ state: 'hidden' })
  report.narrow = true
  assert.deepEqual(errors, [])
  await writeFile(path.join(output, 'verification.json'), JSON.stringify(report, null, 2))
  console.log('Hyalite glass: all seven optical controls change live pixels; tint, persistence, typing, fallback, and narrow layout passed.')
} finally {
  await context?.close()
  assert.equal(path.dirname(profile), profileRoot)
  assert.ok(path.basename(profile).startsWith('glass-regression-'))
  await rm(profile, { recursive: true, force: true })
}
