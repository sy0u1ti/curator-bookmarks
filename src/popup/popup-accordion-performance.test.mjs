import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { chromium } from 'playwright'

const extension = path.resolve('dist')
const output = path.resolve('output/playwright/popup-accordion')
const profile = await mkdtemp(path.join(tmpdir(), 'curator-accordion-regression-'))
const folderCount = 1200
const currentUrl = 'https://example.com/accordion-current'
let context

try {
  await mkdir(output, { recursive: true })
  context = await chromium.launchPersistentContext(profile, {
    channel: 'chromium', headless: true, viewport: { width: 800, height: 600 },
    args: [`--load-extension=${extension}`, `--disable-extensions-except=${extension}`]
  })
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker')
  const fixture = await worker.evaluate(async count => {
    await chrome.storage.local.set({
      curatorBookmarkAiNamingSettings: { autoAnalyzeBookmarks: false },
      curatorBookmarkContentSnapshotSettings: { enabled: false, autoCaptureOnBookmarkCreate: false }
    })
    const folders = []
    for (let index = 0; index < count; index++) {
      folders.push(await chrome.bookmarks.create({ parentId: '1', title: `Folder ${index}` }))
    }
    const bookmark = await chrome.bookmarks.create({
      parentId: folders[0].id, title: 'Accordion fixture', url: 'https://example.com/accordion'
    })
    return { folders, bookmark }
  }, folderCount)
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.addInitScript(url => {
    const query = chrome.tabs.query.bind(chrome.tabs)
    chrome.tabs.query = (info, callback) => {
      if (!info.active || !info.currentWindow) return query(info, callback)
      const tabs = [{ id: 77, active: true, url, title: 'Current page' }]
      return callback ? callback(tabs) : Promise.resolve(tabs)
    }
  }, currentUrl)
  await page.goto(`chrome-extension://${new URL(worker.url()).host}/src/popup/popup.html`)
  const bookmarkRow = page.locator(`.t-skel-content [data-bookmark-id="${fixture.bookmark.id}"]`)
  await bookmarkRow.hover()
  await bookmarkRow.locator('button[aria-label^="\u7f16\u8f91\u4e66\u7b7e"]').click()
  await page.waitForFunction(() => {
    const panel = document.querySelector('#modal-backdrop .curator-overlay-panel')
    return panel?.hasAttribute('data-open') && !panel.hasAttribute('data-starting-style') &&
      !panel.hasAttribute('data-ending-style') && panel.getAnimations({ subtree: true }).length === 0
  })
  const trigger = page.locator('#edit-folder-picker-button')
  const list = page.locator('#edit-folder-list')
  const search = page.locator('#edit-folder-search-input')
  const option = id => page.locator(`[data-select-edit-folder="${id}"]`)
  // Let startup indexing and background paint work finish so this test measures
  // the disclosure rather than unrelated popup initialization.
  await page.waitForTimeout(2500)
  const mountedRows = await list.locator('[role="treeitem"]').count()
  assert.ok(mountedRows > 0 && mountedRows <= 40, `prepare a bounded window, not all ${folderCount} folders`)
  assert.equal(await page.locator('#edit-folder-picker').evaluate(element => element.inert), true,
    'closed disclosure content must be non-interactive without being removed from layout')
  assert.equal(await page.locator('#edit-modal').evaluate(element => getComputedStyle(element).clipPath), 'none',
    'the resizing card must not wait for a JS-generated clip-path on every frame')

  const report = { folderCount, transitions: [] }
  for (const opening of [true, false, true, false]) {
    const probe = await probeDisclosure(page)
    report.transitions.push(probe)
    assert.equal(probe.opening, opening)
    assert.equal(probe.added, 0, 'disclosure must reuse mounted rows')
    assert.equal(probe.removed, 0, 'closing must retain rows until the transition completes')
    assert.ok(probe.rows <= 40, 'folder count must not determine DOM size')
    assert.ok(probe.maxFrame <= 20,
      `the stretch must not miss a display frame: max frame ${probe.maxFrame.toFixed(1)}ms while ${opening ? 'opening' : 'closing'}`)
    assert.deepEqual(probe.longFrames, [], 'the stretch must not schedule a long animation frame')
    assert.ok(probe.modalHeightSpread <= 0.5,
      'the editor card layout box must stay fixed while the visual surface expands')
    assert.ok(probe.surfaceHeightSpread <= 0.5,
      'the prewarmed visual surface must not resize during the transition')

    const settled = probe.samples.at(-1)
    assert.ok(Math.abs(settled.surfaceLeft - settled.modalLeft) <= 0.1 &&
      Math.abs(settled.surfaceRight - settled.modalRight) <= 0.1,
    'expanded and closed outlines must share the same border box, never leave a second vertical edge')
    assert.equal(settled.hidden, false, 'closed content must stay mounted for reopening')
    assert.equal(settled.panelHeight, 0, 'the disclosure panel must not animate layout height')
    assert.ok(settled.footerBottom <= settled.surfaceBottom + 0.5 && settled.footerBottom <= 600,
      'the footer must stay inside the expanded visual surface')
    if (opening) {
      assert.ok(settled.surfaceOpacity > 0.99 && settled.pickerOpacity > 0.99)
      assert.equal(settled.ariaHidden, 'false')
      assert.equal(settled.inert, false)
    } else {
      assert.ok(settled.surfaceOpacity <= 0.01 && settled.pickerOpacity <= 0.01)
      assert.equal(settled.ariaHidden, 'true')
      assert.equal(settled.inert, true)
    }

    const movingSamples = probe.samples.filter(sample => sample.at > 20 && sample.at < 260)
    assert.ok(movingSamples.length >= 8, 'the transition must be sampled across multiple frames')
    const upperMin = Math.min(...movingSamples.map(sample => sample.upperTop))
    const upperMax = Math.max(...movingSamples.map(sample => sample.upperTop))
    const lowerMin = Math.min(...movingSamples.map(sample => sample.lowerTop))
    const lowerMax = Math.max(...movingSamples.map(sample => sample.lowerTop))
    assert.ok(upperMax - upperMin > 20, 'the upper content must visibly move with the surface')
    assert.ok(lowerMax - lowerMin > 20, 'the lower content must leave room for the picker')
    assert.ok(movingSamples.filter(sample => sample.upperTop > upperMin + 0.5 && sample.upperTop < upperMax - 0.5).length >= 3,
      'the stretch must include intermediate positions rather than snap or fade')
    assert.ok(movingSamples.filter(sample => sample.lowerTop > lowerMin + 0.5 && sample.lowerTop < lowerMax - 0.5).length >= 3,
      'both content groups must move continuously through the stretch')
    assert.ok(probe.samples.some(sample => sample.surfaceOpacity > 0.05 && sample.surfaceOpacity < 0.95),
      'the prewarmed surface must cross-fade without a first-paint stall')
  }
  // Interrupt both directions before the prior transition completes.
  const rapid = await page.evaluate(() => new Promise(resolve => {
    const trigger = document.querySelector('#edit-folder-picker-button')
    const panel = document.querySelector('#edit-folder-picker')
    const before = panel.querySelector('[role="treeitem"]')
    const samples = []
    const reversals = []
    const start = performance.now()
    trigger.focus({ preventScroll: true })
    trigger.click()
    const sample = () => {
      const at = performance.now() - start
      samples.push({
        at,
        upperTop: document.querySelector('#edit-modal header').getBoundingClientRect().top,
        lowerTop: document.querySelector('#edit-modal .popup-edit-lower')?.getBoundingClientRect().top || 0
      })
      if (reversals.length === 0 && at >= 65) { trigger.click(); reversals.push(at) }
      else if (reversals.length === 1 && at >= 125) { trigger.click(); reversals.push(at) }
      if (at < 550) return requestAnimationFrame(sample)
      resolve({
        samples, reversals, expanded: trigger.getAttribute('aria-expanded'),
        sameRow: before === panel.querySelector('[role="treeitem"]')
      })
    }
    requestAnimationFrame(sample)
  }))
  assert.equal(rapid.expanded, 'true')
  assert.equal(rapid.sameRow, true)
  assert.ok(rapid.samples.every((sample, index) => !index || Math.abs(sample.upperTop - rapid.samples[index - 1].upperTop) < 90),
    'rapid reversals must continue from the displayed transform')
  report.rapid = rapid
  await page.screenshot({ path: path.join(output, 'expanded.png') })

  // Navigation must use all logical rows, including ones outside the DOM.
  await search.press('ArrowUp')
  await page.waitForFunction(() => document.activeElement?.getAttribute('data-select-edit-folder') === '2')
  await page.keyboard.press('ArrowUp')
  await page.waitForFunction(id => document.activeElement?.getAttribute('data-select-edit-folder') === id, fixture.folders.at(-1).id)
  await page.keyboard.press('Home')
  await page.waitForFunction(() => document.activeElement?.getAttribute('data-select-edit-folder') === '1')
  await page.keyboard.press('End')
  await page.waitForFunction(() => document.activeElement?.getAttribute('data-select-edit-folder') === '2')
  await search.fill(`Folder ${folderCount - 1}`)
  await option(fixture.folders.at(-1).id).waitFor()
  await search.fill('missing-folder-fixture')
  assert.equal(await list.locator('[role="treeitem"]').count(), 0)
  await search.fill('')
  await page.waitForFunction(() => document.querySelectorAll('#edit-folder-list [role="treeitem"]').length > 0)
  await search.press('ArrowDown')
  for (let index = 0; index < 45; index++) await page.keyboard.press('ArrowDown')
  await page.waitForFunction(id => document.activeElement?.getAttribute('data-select-edit-folder') === id, fixture.folders[44].id)
  assert.ok(await list.locator('[role="treeitem"]').count() <= 40)

  // Updating the path closes the disclosure; reopening must refresh selection,
  // including the cached original-location label and an externally renamed folder.
  await page.keyboard.press('Enter')
  await settleDisclosure(page, false)
  await trigger.click()
  await settleDisclosure(page, true)
  await search.fill('Folder 44')
  assert.equal(await option(fixture.folders[44].id).getAttribute('aria-selected'), 'true')
  await worker.evaluate(async id => { await chrome.bookmarks.update(id, { title: 'Renamed destination' }) }, fixture.folders[44].id)
  await search.fill('Renamed destination')
  await page.getByRole('treeitem', { name: /Renamed destination/ }).waitFor()

  await page.setViewportSize({ width: 390, height: 600 })
  await search.fill('')
  await search.press('ArrowDown')
  await settleDisclosure(page, true)
  const narrow = await page.locator('#edit-modal').evaluate(element => {
    const card = element.getBoundingClientRect()
    const footer = element.querySelector('footer').getBoundingClientRect()
    const surface = element.querySelector('.popup-edit-surface').getBoundingClientRect()
    return { bottom: surface.bottom, footer: footer.bottom, width: card.width }
  })
  assert.ok(narrow.width <= 390 && narrow.footer <= narrow.bottom && narrow.bottom <= 600)
  await page.screenshot({ path: path.join(output, 'expanded-narrow.png') })

  await page.emulateMedia({ reducedMotion: 'reduce' })
  await trigger.click()
  await settleDisclosure(page, false)
  await trigger.click()
  await settleDisclosure(page, true)
  assert.deepEqual(
    await page.locator('#edit-modal').evaluate(element => {
      const selectors = ['.popup-edit-surface', '.popup-edit-upper', '.popup-edit-lower', '.t-acc-panel-inner']
      return selectors.map(selector => getComputedStyle(element.querySelector(selector)).transitionProperty)
    }),
    ['none', 'none', 'none', 'none']
  )
  await page.setViewportSize({ width: 800, height: 600 })
  await page.locator('#save-edit').click()
  await page.locator('#edit-modal').waitFor({ state: 'hidden' })
  assert.equal((await worker.evaluate(id => chrome.bookmarks.get(id), fixture.bookmark.id))[0].parentId, fixture.folders[44].id)

  // The same virtual window serves move and save. Reaching an unmounted edge
  // must preserve their distinct immediate-move and deferred-save behavior.
  await bookmarkRow.hover()
  await bookmarkRow.locator('button[aria-label^="\u79fb\u52a8\u4e66\u7b7e"]').click()
  await page.locator('#move-search-input').press('ArrowUp')
  await page.waitForFunction(() => document.activeElement?.getAttribute('data-select-folder') === '2')
  await page.keyboard.press('ArrowUp')
  await page.waitForFunction(id => document.activeElement?.getAttribute('data-select-folder') === id, fixture.folders.at(-1).id)
  await page.keyboard.press('Enter')
  await page.locator('#move-modal').waitFor({ state: 'hidden' })
  assert.equal((await worker.evaluate(id => chrome.bookmarks.get(id), fixture.bookmark.id))[0].parentId, fixture.folders.at(-1).id)
  await page.locator('[data-current-page-action="save"]').click()
  await page.locator('#smart-folder-search-input').press('ArrowUp')
  await page.waitForFunction(() => document.activeElement?.getAttribute('data-smart-select-folder') === '2')
  await page.keyboard.press('ArrowUp')
  await page.waitForFunction(id => document.activeElement?.getAttribute('data-smart-select-folder') === id, fixture.folders.at(-1).id)
  await page.keyboard.press('Enter')
  assert.equal((await worker.evaluate(url => chrome.bookmarks.search({ url }), currentUrl)).length, 0)
  await page.locator('#save-smart-folder-button').click()
  await page.locator('#smart-folder-modal').waitFor({ state: 'hidden' })
  assert.equal((await worker.evaluate(url => chrome.bookmarks.search({ url }), currentUrl))[0].parentId, fixture.folders.at(-1).id)
  assert.deepEqual(errors, [])
  await writeFile(path.join(output, 'performance.json'), JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report.transitions.map(({ samples, ...probe }) => probe), null, 2))
  console.log('Popup accordion passed: bounded DOM, retained rows, continuous open/close and reversal, virtual keyboard navigation, search, refreshed selection, visible footer and reduced motion.')
} finally {
  await context?.close()
  assert.equal(path.dirname(path.resolve(profile)), path.resolve(tmpdir()))
  await rm(profile, { recursive: true, force: true })
}

async function settleDisclosure(page, open) {
  await page.waitForFunction(open => {
    const panel = document.querySelector('#edit-folder-picker')
    const trigger = document.querySelector('#edit-folder-picker-button')
    const surface = document.querySelector('#edit-modal .popup-edit-surface')
    const inner = panel.querySelector('.t-acc-panel-inner')
    const opacity = Number(getComputedStyle(inner).opacity)
    const surfaceOpacity = Number(getComputedStyle(surface).opacity)
    return trigger?.getAttribute('aria-expanded') === String(open) &&
      panel.getAnimations({ subtree: true }).length === 0 &&
      panel.inert === !open && panel.getAttribute('aria-hidden') === String(!open) &&
      (open ? opacity > 0.99 && surfaceOpacity > 0.99 : opacity <= 0.01 && surfaceOpacity <= 0.01)
  }, open)
}

async function probeDisclosure(page) {
  return page.evaluate(() => new Promise(resolve => {
    const trigger = document.querySelector('#edit-folder-picker-button')
    const modal = document.querySelector('#edit-modal')
    const panel = document.querySelector('#edit-folder-picker')
    const list = document.querySelector('#edit-folder-list')
    const surface = modal.querySelector('.popup-edit-surface')
    const upper = modal.querySelector('header')
    const lower = modal.querySelector('.popup-edit-lower')
    const pickerInner = panel.querySelector('.t-acc-panel-inner')
    const footer = modal.querySelector('footer')
    const opening = trigger.getAttribute('aria-expanded') !== 'true'
    const samples = []
    const longFrames = []
    let added = 0, removed = 0
    const observer = new MutationObserver(records => {
      for (const record of records) { added += record.addedNodes.length; removed += record.removedNodes.length }
    })
    observer.observe(list, { childList: true, subtree: true })
    const performanceObserver = new PerformanceObserver(entries => {
      for (const entry of entries.getEntries()) {
        longFrames.push({ duration: entry.duration, blockingDuration: entry.blockingDuration })
      }
    })
    performanceObserver.observe({ type: 'long-animation-frame' })
    trigger.focus({ preventScroll: true })
    const started = performance.now()
    const sample = () => {
      const at = performance.now() - started
      const modalRect = modal.getBoundingClientRect()
      const surfaceRect = surface.getBoundingClientRect()
      samples.push({
        at,
        ariaHidden: panel.getAttribute('aria-hidden'),
        footerBottom: footer.getBoundingClientRect().bottom,
        hidden: Boolean(panel.hidden),
        inert: panel.inert,
        lowerTop: lower.getBoundingClientRect().top,
        modalHeight: modalRect.height,
        modalLeft: modalRect.left,
        modalRight: modalRect.right,
        panelHeight: panel.getBoundingClientRect().height,
        pickerOpacity: Number(getComputedStyle(pickerInner).opacity),
        surfaceBottom: surfaceRect.bottom,
        surfaceHeight: surfaceRect.height,
        surfaceLeft: surfaceRect.left,
        surfaceRight: surfaceRect.right,
        surfaceOpacity: Number(getComputedStyle(surface).opacity),
        upperTop: upper.getBoundingClientRect().top
      })
      if (at < 500) return requestAnimationFrame(sample)
      observer.disconnect()
      performanceObserver.disconnect()
      const gaps = samples.map((entry, index) => index ? entry.at - samples[index - 1].at : entry.at)
      const settled = samples.at(-1)
      resolve({
        opening, added, removed, rows: list.querySelectorAll('[role="treeitem"]').length,
        firstFrame: gaps[0], maxFrame: Math.max(...gaps), longFrames,
        modalHeightSpread: Math.max(...samples.map(entry => entry.modalHeight)) - Math.min(...samples.map(entry => entry.modalHeight)),
        surfaceHeightSpread: Math.max(...samples.map(entry => entry.surfaceHeight)) - Math.min(...samples.map(entry => entry.surfaceHeight)),
        footerBottom: settled.footerBottom, surfaceBottom: settled.surfaceBottom, samples
      })
    }
    trigger.click()
    requestAnimationFrame(sample)
  }))
}
