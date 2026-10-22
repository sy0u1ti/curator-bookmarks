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
  const mountedRows = await list.locator('[role="treeitem"]').count()
  assert.ok(mountedRows > 0 && mountedRows <= 40, `prepare a bounded window, not all ${folderCount} folders`)
  assert.equal(await page.locator('#edit-modal').evaluate(element => getComputedStyle(element).clipPath), 'none',
    'the resizing card must not wait for a JS-generated clip-path on every frame')

  const cdp = await context.newCDPSession(page)
  const report = { folderCount, transitions: [] }
  // Measure both a normal CPU and a slower one. DOM work and continuous
  // geometry are deterministic guards; timings are retained for comparison.
  for (const rate of [1, 4]) {
    await cdp.send('Emulation.setCPUThrottlingRate', { rate })
    for (let pass = 0; pass < 4; pass++) {
      const probe = await probeDisclosure(page)
      report.transitions.push({ rate, ...probe })
      assert.equal(probe.added, 0, 'disclosure must reuse mounted rows')
      assert.equal(probe.removed, 0, 'closing must retain rows until the height reaches zero')
      assert.ok(probe.rows <= 40, 'folder count must not determine DOM size')
      assert.ok(probe.firstFrame < (rate === 1 ? 50 : 100),
        `disclosure must respond without a long mount stall: ${probe.firstFrame.toFixed(1)}ms at ${rate}x CPU`)
      assert.ok(probe.samples.filter(sample => sample.height > 1 && sample.height < probe.expandedHeight - 1).length >= 3,
        'the accordion must actually stretch, not snap or substitute a fade')
      for (let index = 1; index < probe.samples.length; index++) {
        const delta = probe.samples[index].height - probe.samples[index - 1].height
        assert.ok(probe.opening ? delta >= -0.75 : delta <= 0.75,
          'uninterrupted disclosure height must move monotonically')
      }
      assert.ok(probe.footerBottom <= probe.modalBottom && probe.footerBottom <= 600,
        'the footer must stay inside the expanded card')
      if (!probe.opening) {
        assert.ok(probe.samples.at(-1).height <= 0.5)
        const hidden = probe.samples.findIndex(sample => sample.hidden)
        assert.ok(hidden > 0 && probe.samples[hidden - 1].height <= 0.5,
          'Base UI must hide the panel only after it reaches zero')
      }
    }
  }
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 })

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
      samples.push({ at, height: panel.getBoundingClientRect().height })
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
  assert.ok(rapid.samples.at(-1).height > 120)
  assert.ok(rapid.samples.every((sample, index) => !index || Math.abs(sample.height - rapid.samples[index - 1].height) < 90),
    'rapid reversals must continue from the displayed height')
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
    return { bottom: card.bottom, footer: footer.bottom, width: card.width }
  })
  assert.ok(narrow.width <= 390 && narrow.footer <= narrow.bottom && narrow.bottom <= 600)
  await page.screenshot({ path: path.join(output, 'expanded-narrow.png') })

  await page.emulateMedia({ reducedMotion: 'reduce' })
  await trigger.click()
  await settleDisclosure(page, false)
  await trigger.click()
  await settleDisclosure(page, true)
  assert.equal(await page.locator('#edit-folder-picker').evaluate(element => getComputedStyle(element).transitionProperty), 'none')
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
    return trigger?.getAttribute('aria-expanded') === String(open) &&
      panel.getAnimations({ subtree: true }).length === 0 &&
      (open ? panel.offsetHeight > 0 : panel.offsetHeight === 0)
  }, open)
}

async function probeDisclosure(page) {
  return page.evaluate(() => new Promise(resolve => {
    const trigger = document.querySelector('#edit-folder-picker-button')
    const modal = document.querySelector('#edit-modal')
    const panel = document.querySelector('#edit-folder-picker')
    const list = document.querySelector('#edit-folder-list')
    const opening = trigger.getAttribute('aria-expanded') !== 'true'
    const samples = []
    let added = 0, removed = 0
    const observer = new MutationObserver(records => {
      for (const record of records) { added += record.addedNodes.length; removed += record.removedNodes.length }
    })
    observer.observe(list, { childList: true, subtree: true })
    const startHeight = panel.getBoundingClientRect().height
    trigger.focus({ preventScroll: true })
    const started = performance.now()
    const sample = () => {
      const at = performance.now() - started
      samples.push({ at, height: panel.getBoundingClientRect().height, hidden: Boolean(panel.hidden) })
      if (at < 500) return requestAnimationFrame(sample)
      observer.disconnect()
      const gaps = samples.map((entry, index) => index ? entry.at - samples[index - 1].at : entry.at)
      resolve({
        opening, added, removed, rows: list.querySelectorAll('[role="treeitem"]').length,
        expandedHeight: Math.max(startHeight, ...samples.map(entry => entry.height)),
        firstFrame: gaps[0], maxFrame: Math.max(...gaps),
        footerBottom: modal.querySelector('footer').getBoundingClientRect().bottom,
        modalBottom: modal.getBoundingClientRect().bottom, samples
      })
    }
    trigger.click()
    requestAnimationFrame(sample)
  }))
}
