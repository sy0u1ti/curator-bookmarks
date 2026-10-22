import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { chromium } from 'playwright'

const extensionPath = path.resolve('dist')
const profile = await mkdtemp(path.join(tmpdir(), 'curator-folder-picker-'))
const output = path.resolve('output/playwright/popup-folder-picker')
const currentUrl = 'https://example.com/folder-picker-current'
const selectAttribute = {
  smart: 'data-smart-select-folder',
  edit: 'data-select-edit-folder',
  move: 'data-select-folder'
}
let context

try {
  await mkdir(output, { recursive: true })
  context = await chromium.launchPersistentContext(profile, {
    channel: 'chromium', headless: true, viewport: { width: 800, height: 600 },
    args: [`--load-extension=${extensionPath}`, `--disable-extensions-except=${extensionPath}`]
  })
  context.setDefaultTimeout(10000)
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker')
  const fixture = await worker.evaluate(async () => {
    await chrome.storage.local.set({
      curatorBookmarkAiNamingSettings: { autoAnalyzeBookmarks: false },
      curatorBookmarkContentSnapshotSettings: { enabled: false, autoCaptureOnBookmarkCreate: false }
    })
    const parent = await chrome.bookmarks.create({ parentId: '1', title: 'Market' })
    const child = await chrome.bookmarks.create({ parentId: parent.id, title: 'AI API' })
    const target = await chrome.bookmarks.create({ parentId: parent.id, title: 'Cards' })
    const archive = await chrome.bookmarks.create({ parentId: '1', title: 'Archive' })
    const duplicate = await chrome.bookmarks.create({ parentId: archive.id, title: 'AI API' })
    for (let i = 0; i < 24; i++) {
      await chrome.bookmarks.create({ parentId: '1', title: `Reference ${i + 1}` })
    }
    const bookmark = await chrome.bookmarks.create({
      parentId: child.id, title: 'Folder picker fixture', url: 'https://example.com/folder-picker-fixture'
    })
    return { parent, child, target, duplicate, bookmark }
  })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.addInitScript(url => {
    const query = chrome.tabs.query.bind(chrome.tabs)
    chrome.tabs.query = (info, callback) => {
      if (!info.active || !info.currentWindow) return query(info, callback)
      const tabs = [{ id: 77, active: true, url, title: 'Folder picker current page' }]
      return callback ? callback(tabs) : Promise.resolve(tabs)
    }
  }, currentUrl)
  await page.goto(`chrome-extension://${new URL(worker.url()).host}/src/popup/popup.html`)
  const mainRow = page.locator(`.t-skel-content [data-folder-row-id="${fixture.child.id}"] [role="treeitem"]`)
  await mainRow.waitFor()
  const mainAppearance = await mainRow.evaluate(readRowAppearance)
  const mainHighlight = await page.locator('.popup-active-result-indicator').evaluate(readHighlightAppearance)
  const option = (mode, id) => page.locator(`[${selectAttribute[mode]}="${id}"]`)

  async function waitForModalSettled(selector) {
    await page.locator(selector).evaluate(async element => {
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      const dialog = element.closest('[role="dialog"]') || element
      await Promise.allSettled(dialog.getAnimations({ subtree: true }).map(animation => animation.finished))
    })
  }

  async function assertPickerAppearance(mode) {
    const selected = option(mode, fixture.child.id)
    await page.waitForFunction(selector => {
      const row = document.querySelector(selector)
      return row && Math.abs(row.getBoundingClientRect().height - 34) < 0.01 &&
        getComputedStyle(row, '::after').opacity === '1'
    }, `[${selectAttribute[mode]}="${fixture.child.id}"]`)
    assert.equal(await selected.getAttribute('aria-selected'), 'true')
    assert.deepEqual(await selected.evaluate(readRowAppearance), mainAppearance,
      `${mode}: row height, indentation, branch lines and typography must match the main tree`)
    assert.deepEqual(await selected.evaluate(element => {
      const style = getComputedStyle(element, '::after')
      return { background: style.backgroundColor, shadow: style.boxShadow, radius: style.borderRadius }
    }), mainHighlight, `${mode}: selection must reuse the main tree's soft highlight`)
    assert.match(await selected.getAttribute('title'), /Market.*AI API/)
    assert.ok(!(await selected.innerText()).includes('Market'), 'full paths belong in the tooltip, not a second line')
    const rows = page.locator(`#${mode === 'smart' ? 'smart-folder' : mode === 'edit' ? 'edit-folder' : 'move-folder'}-list [role="treeitem"]`)
    assert.equal(await rows.filter({ has: page.locator('[class~="rounded-full"]') }).count(), 0,
      `${mode}: no circular branch markers or pill badges`)
    const geometry = await selected.evaluate(element => {
      const button = element.getBoundingClientRect()
      const row = element.closest('[data-folder-picker-row]').getBoundingClientRect()
      return { left: button.left - row.left, width: button.width - row.width, border: getComputedStyle(element).borderColor }
    })
    assert.equal(geometry.left, 0, 'nested selections must start at the same left edge as root selections')
    assert.equal(geometry.width, 0, 'selection must cover the full row, not an inset card')
    assert.equal(geometry.border, 'rgba(0, 0, 0, 0)', 'selection must not acquire a hard border')
  }

  await page.locator('[data-current-page-action="save"]').click()
  const smartList = page.locator('#smart-folder-list')
  const smartSearch = page.locator('#smart-folder-search-input')
  await option('smart', fixture.child.id).click()
  await assertPickerAppearance('smart')
  assert.equal((await worker.evaluate(url => chrome.bookmarks.search({ url }), currentUrl)).length, 0)

  // Disclosure keeps selection separate from activation, including keyboard navigation.
  const toggle = page.locator(`[data-toggle-smart-folder="${fixture.parent.id}"]`)
  await toggle.click()
  assert.equal(await option('smart', fixture.child.id).count(), 0)
  await toggle.click()
  assert.equal(await option('smart', fixture.child.id).getAttribute('aria-selected'), 'true')
  await smartSearch.press('ArrowDown')
  assert.equal(await option('smart', '1').evaluate(element => document.activeElement === element), true)
  await page.keyboard.press('ArrowLeft')
  assert.equal(await option('smart', fixture.parent.id).count(), 0)
  await page.keyboard.press('ArrowRight')
  assert.equal(await option('smart', fixture.parent.id).count(), 1)
  await page.keyboard.press('End')
  assert.equal(await smartList.locator('[role="treeitem"]').last().evaluate(element => document.activeElement === element), true)
  assert.ok(await smartList.evaluate(element => element.scrollTop > 0))
  await page.keyboard.press('Home')
  assert.equal(await option('smart', '1').evaluate(element => document.activeElement === element), true)

  await smartSearch.fill('AI API')
  assert.notEqual(await option('smart', fixture.child.id).getAttribute('title'),
    await option('smart', fixture.duplicate.id).getAttribute('title'), 'same-name folders must keep distinct path tooltips')
  assert.ok(await option('smart', fixture.child.id).locator('mark').count() > 0)
  await smartSearch.fill('no-such-folder-fixture')
  assert.equal(await smartList.locator('[role="treeitem"]').count(), 0)
  await smartSearch.fill('')
  await option('smart', fixture.child.id).click()
  await smartSearch.focus()
  await page.mouse.move(790, 590)
  await assertPickerAppearance('smart')
  await waitForModalSettled('#smart-folder-modal')
  await page.screenshot({ path: path.join(output, 'save-folder-tree.png') })

  await page.emulateMedia({ reducedMotion: 'reduce' })
  assert.equal(await option('smart', fixture.child.id).evaluate(element =>
    getComputedStyle(element, '::after').transitionProperty), 'none')
  await page.emulateMedia({ reducedMotion: 'no-preference', forcedColors: 'active' })
  assert.equal(await option('smart', fixture.child.id).evaluate(element =>
    getComputedStyle(element, '::after').borderTopWidth), '2px')
  await page.emulateMedia({ forcedColors: 'none' })
  await page.setViewportSize({ width: 390, height: 600 })
  assert.equal(await smartList.evaluate(element => element.scrollWidth <= element.clientWidth), true)
  const saveBounds = await page.locator('#save-smart-folder-button').boundingBox()
  assert.ok(saveBounds.y + saveBounds.height <= 600)
  await waitForModalSettled('#smart-folder-modal')
  await page.screenshot({ path: path.join(output, 'save-folder-tree-narrow.png') })
  await page.setViewportSize({ width: 800, height: 600 })
  await page.locator('#close-smart-folder-modal').click()
  await page.locator('#smart-folder-modal').waitFor({ state: 'hidden' })

  const bookmarkRow = page.locator(`.t-skel-content [data-bookmark-id="${fixture.bookmark.id}"]`)
  async function openBookmarkAction(label) {
    await bookmarkRow.hover()
    await bookmarkRow.getByRole('button', { name: `${label}\uff1a${fixture.bookmark.title}`, exact: true }).click()
  }
  await openBookmarkAction('\u7f16\u8f91\u4e66\u7b7e')
  await page.locator('#edit-folder-picker-button').click()
  await assertPickerAppearance('edit')
  await option('edit', fixture.target.id).click()
  await page.waitForFunction(() => document.querySelector('#edit-folder-picker-button')?.getAttribute('aria-expanded') === 'false')
  await page.locator('#edit-folder-picker-button').click()
  assert.equal(await option('edit', fixture.target.id).getAttribute('aria-selected'), 'true')
  assert.equal(await option('edit', fixture.child.id).getAttribute('aria-selected'), 'false')
  await page.locator('#edit-folder-search-input').focus()
  await page.mouse.move(790, 590)
  await waitForModalSettled('#edit-modal')
  await page.screenshot({ path: path.join(output, 'edit-folder-tree.png') })
  await option('edit', fixture.child.id).click()
  await page.locator('#close-edit-modal').click()
  await page.locator('#edit-modal').waitFor({ state: 'hidden' })

  await openBookmarkAction('\u79fb\u52a8\u4e66\u7b7e')
  await assertPickerAppearance('move')
  await page.locator('#move-search-input').focus()
  await page.mouse.move(790, 590)
  await waitForModalSettled('#move-modal')
  await page.screenshot({ path: path.join(output, 'move-folder-tree.png') })
  await option('move', fixture.target.id).click()
  await page.locator('#move-modal').waitFor({ state: 'hidden' })
  assert.equal((await worker.evaluate(id => chrome.bookmarks.get(id), fixture.bookmark.id))[0].parentId, fixture.target.id)
  assert.deepEqual(errors, [])
  console.log('Popup folder pickers passed: shared tree geometry and glow, no circles, all three dialogs, search, disclosure, keyboard, narrow viewport and accessibility media.')
} finally {
  await context?.close()
  assert.equal(path.dirname(path.resolve(profile)), path.resolve(tmpdir()))
  await rm(profile, { recursive: true, force: true })
}

function readRowAppearance(button) {
  const style = getComputedStyle(button)
  const branch = getComputedStyle(button.firstElementChild)
  const title = getComputedStyle(button.children[1].firstElementChild)
  return {
    height: button.offsetHeight,
    indent: style.paddingLeft,
    branch: {
      width: branch.width, height: branch.height, radius: branch.borderBottomLeftRadius,
      borders: [branch.borderTopWidth, branch.borderRightWidth, branch.borderBottomWidth, branch.borderLeftWidth]
    },
    title: { size: title.fontSize, weight: title.fontWeight, lineHeight: title.lineHeight }
  }
}

function readHighlightAppearance(element) {
  const style = getComputedStyle(element)
  return { background: style.backgroundColor, shadow: style.boxShadow, radius: style.borderRadius }
}
