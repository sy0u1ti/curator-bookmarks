import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { chromium, expect } from '@playwright/test'

const output = path.resolve('output/playwright/cascade-menu')
const tempRoot = path.resolve('.tmp-test')
await mkdir(output, { recursive: true })
await mkdir(tempRoot, { recursive: true })
const profile = await mkdtemp(path.join(tempRoot, 'cascade-menu-'))
const extension = path.resolve('dist')
const context = await chromium.launchPersistentContext(profile, {
  channel: 'chromium',
  headless: process.env.CURATOR_HEADLESS === '1',
  viewport: { width: 1440, height: 1000 },
  hasTouch: true,
  args: [`--load-extension=${extension}`, `--disable-extensions-except=${extension}`]
})
context.setDefaultTimeout(10000)
const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker')
const page = await context.newPage()
const errors = []
const report = {}
page.on('pageerror', error => errors.push(error.message))

try {
  const seed = await worker.evaluate(async () => {
    await chrome.storage.local.set({
      curatorBookmarkAiNamingSettings: { autoAnalyzeBookmarks: false },
      curatorBookmarkContentSnapshotSettings: { enabled: false }
    })
    const [bar] = await chrome.bookmarks.get('1')
    const folder = await chrome.bookmarks.create({ parentId: '1', title: 'Menu lab' })
    const target = await chrome.bookmarks.create({ parentId: folder.id, title: 'Menu subject', url: 'https://example.com/cascade' })
    const design = await chrome.bookmarks.create({ parentId: folder.id, title: 'Design' })
    const development = await chrome.bookmarks.create({ parentId: folder.id, title: 'Development' })
    const reading = await chrome.bookmarks.create({ parentId: folder.id, title: 'Reading' })
    for (const title of ['References', 'Components', 'Typography', 'Layouts', 'Interaction', 'Archive']) {
      await chrome.bookmarks.create({ parentId: design.id, title })
    }
    await chrome.bookmarks.create({ parentId: development.id, title: 'Documentation' })
    const longList = await chrome.bookmarks.create({ parentId: folder.id, title: 'Long list' })
    for (let index = 0; index < 40; index++) {
      const collection = await chrome.bookmarks.create({ parentId: longList.id, title: `Collection ${String(index).padStart(2, '0')}` })
      if (index === 0) await chrome.bookmarks.create({ parentId: collection.id, title: 'Nested reference' })
    }
    await chrome.storage.local.set({
      curatorBookmarkNewTabFolderSettings: { selectedFolderIds: [folder.id, reading.id], browseMode: 'expanded' },
      curatorBookmarkNewTabBackgroundSettings: { type: 'color', color: '#101013' }
    })
    return { bar, folder, target, design, development, reading }
  })
  await page.goto(`chrome-extension://${new URL(worker.url()).host}/src/newtab/newtab.html`)
  const tile = page.locator(`.bookmark-tile[data-bookmark-id="${seed.target.id}"]`).first()
  const menu = page.locator('.bookmark-edit-menu')
  const move = page.getByRole('menuitem', { name: '移动书签：Menu subject', exact: true })
  const folderItem = title => page.getByRole('menuitem', { name: `移动到：${title}`, exact: true })
  const folderPopup = title => page.getByRole('menu', { name: `移动到：${title}`, exact: true })
  const settle = () => page.evaluate(() => Promise.allSettled(document.getAnimations()
    .filter(animation => animation.effect?.getComputedTiming().iterations !== Infinity)
    .map(animation => animation.finished)))
  async function openLab() {
    if (!await menu.isVisible()) await tile.click({ button: 'right' })
    await move.hover()
    await expect(move).toHaveAttribute('aria-expanded', 'true')
    await folderItem(seed.bar.title).hover()
    await expect(folderItem(seed.bar.title)).toHaveAttribute('aria-expanded', 'true')
    await folderItem('Menu lab').hover()
    await expect(folderItem('Menu lab')).toHaveAttribute('aria-expanded', 'true')
    await settle()
  }
  async function crossParentRowDiagonally() {
    const design = folderItem('Design')
    await design.hover()
    await expect(design).toHaveAttribute('aria-expanded', 'true')
    await settle()
    const parent = await folderPopup('Menu lab').boundingBox()
    const child = await folderPopup('Design').boundingBox()
    const a = await design.boundingBox()
    let crossedRow = folderItem('Development')
    let b = await crossedRow.boundingBox()
    if (b.y + b.height / 2 > child.y + child.height) {
      // A submenu flipped above its anchor requires an upward diagonal.
      crossedRow = page.getByRole('menuitem', { name: '移动到此文件夹：Menu lab', exact: true })
      b = await crossedRow.boundingBox()
    }
    const right = await folderPopup('Design').getAttribute('data-side') === 'right'
    const edge = right ? child.x : child.x + child.width
    const direction = right ? 1 : -1
    const apex = { x: right ? parent.x + parent.width - 110 : parent.x + 110, y: a.y + a.height / 2 }
    const crossed = { x: edge - direction * 18, y: b.y + b.height / 2 }
    await page.mouse.move(apex.x, apex.y)
    await page.mouse.move(crossed.x, crossed.y)
    return { child, crossed, crossedRow, direction, edge }
  }

  await tile.click({ button: 'right' })
  await move.hover()
  await page.waitForTimeout(90)
  await expect(move).toHaveAttribute('aria-expanded', 'false')
  await page.mouse.move(5, 5)
  await page.waitForTimeout(300)
  await expect(move).toHaveAttribute('aria-expanded', 'false')
  report.cancelledHover = true

  await move.hover()
  await expect(move).toHaveAttribute('aria-expanded', 'true')
  await settle()
  const rootChild = page.getByRole('menu', { name: '移动书签：Menu subject', exact: true })
  const deleteAction = page.getByRole('menuitem', { name: '删除书签：Menu subject', exact: true })
  const deleteStyle = () => deleteAction.evaluate(element => {
    const style = getComputedStyle(element)
    return { background: style.backgroundColor, color: style.color, shadow: style.boxShadow }
  })
  const idleDeleteStyle = await deleteStyle()
  const rootBounds = await menu.boundingBox()
  const childBounds = await rootChild.boundingBox()
  const triggerBounds = await move.boundingBox()
  const deleteBounds = await deleteAction.boundingBox()
  await page.mouse.move(rootBounds.x + rootBounds.width - 110, triggerBounds.y + triggerBounds.height / 2)
  await page.mouse.move(childBounds.x - 18, deleteBounds.y + deleteBounds.height / 2)
  await page.waitForTimeout(400)
  await expect(move).toHaveAttribute('aria-expanded', 'true')
  assert.equal(await deleteAction.getAttribute('data-cascade-highlighted'), null)
  assert.deepEqual(await deleteStyle(), idleDeleteStyle, 'Safe transit must not paint the crossed delete action as hovered')
  await page.mouse.move(deleteBounds.x + 20, deleteBounds.y + deleteBounds.height / 2)
  await expect(deleteAction).toHaveAttribute('data-cascade-highlighted', 'true')
  await expect.poll(deleteStyle).not.toEqual(idleDeleteStyle)
  await expect(move).toHaveAttribute('aria-expanded', 'false')
  report.rootDiagonalHighlight = true

  await openLab()
  const diagonal = await crossParentRowDiagonally()
  await page.waitForTimeout(400)
  await expect(folderItem('Design')).toHaveAttribute('aria-expanded', 'true')
  await expect(folderItem('Development')).toHaveAttribute('aria-expanded', 'false')
  assert.equal(await folderItem('Development').getAttribute('data-cascade-highlighted'), null)
  await page.mouse.move(diagonal.edge + diagonal.direction * 40, diagonal.crossed.y)
  await page.waitForTimeout(1250)
  await expect(folderItem('Design')).toHaveAttribute('aria-expanded', 'true')
  await page.screenshot({ path: path.join(output, 'desktop.png'), animations: 'disabled' })
  report.diagonalTransit = true

  await crossParentRowDiagonally()
  await page.waitForTimeout(1300)
  await expect(folderItem('Development')).toHaveAttribute('aria-expanded', 'true')
  await expect(folderItem('Design')).toHaveAttribute('aria-expanded', 'false')
  report.safeWindow = true

  await page.mouse.move(5, 5)
  await page.waitForTimeout(120)
  await expect(move).toHaveAttribute('aria-expanded', 'true')
  await folderItem('Development').hover()
  await page.waitForTimeout(400)
  await expect(move).toHaveAttribute('aria-expanded', 'true')
  await page.mouse.move(5, 5)
  await page.waitForTimeout(450)
  await expect(move).toHaveAttribute('aria-expanded', 'false')
  await expect(menu).toBeVisible()
  report.closeGracePreservesEditor = true

  await move.focus()
  await move.press('ArrowRight')
  await expect(move).toHaveAttribute('aria-expanded', 'true')
  await page.keyboard.press('ArrowLeft')
  await expect(move).toHaveAttribute('aria-expanded', 'false')
  await expect(move).toBeFocused()
  await move.press('Enter')
  await expect(move).toHaveAttribute('aria-expanded', 'true')
  await page.keyboard.press('Escape')
  assert.equal(await page.locator('.curator-cascade-popup:not([inert])').count(), 0)
  await expect(menu).toBeHidden()
  await expect(tile).toBeFocused()
  report.keyboard = true

  await tile.click({ button: 'right' })
  const moveBounds = await move.boundingBox()
  await page.touchscreen.tap(moveBounds.x + 25, moveBounds.y + moveBounds.height / 2)
  // Base UI activates pointer presses on the next frame after focus settles.
  // Flush that render without waiting for the hover-intent delay.
  await page.evaluate(() => new Promise(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(resolve))
  }))
  assert.equal(await move.getAttribute('aria-expanded'), 'true')
  report.touchIsImmediate = true
  await page.keyboard.press('Escape')

  await tile.click({ button: 'right' })
  const dragBounds = await move.boundingBox()
  await move.dispatchEvent('dragenter', { clientX: dragBounds.x + 20, clientY: dragBounds.y + 15 })
  await page.waitForTimeout(260)
  await expect(move).toHaveAttribute('aria-expanded', 'false')
  await expect(move).toHaveAttribute('aria-expanded', 'true')
  await page.locator('body').dispatchEvent('dragend')
  await expect(move).toHaveAttribute('aria-expanded', 'false')
  report.dragIntent = true
  await page.keyboard.press('Escape')

  await openLab()
  await expect(page.getByRole('menuitem', { name: '移动到此文件夹：Menu lab', exact: true })).toBeDisabled()
  await folderItem('Long list').click()
  const longPopup = folderPopup('Long list')
  assert.ok(await longPopup.evaluate(element => element.scrollHeight > element.clientHeight))
  await folderItem('Collection 00').hover()
  await expect(folderItem('Collection 00')).toHaveAttribute('aria-expanded', 'true')
  await folderItem('Collection 39').scrollIntoViewIfNeeded()
  await expect(folderItem('Collection 39')).toBeInViewport()
  await expect(folderItem('Long list')).toHaveAttribute('aria-expanded', 'true')
  await expect(folderItem('Collection 00')).toHaveAttribute('aria-expanded', 'false')
  report.independentScroll = true
  await page.keyboard.press('Escape')

  await openLab()
  await page.evaluate(() => {
    window.__originalBookmarkMove = chrome.bookmarks.move
    chrome.bookmarks.move = () => { throw new Error('Simulated move failure') }
  })
  await folderItem('Reading').click()
  await expect(menu.locator('.bookmark-menu-error')).toContainText('Simulated move failure')
  assert.equal((await worker.evaluate(id => chrome.bookmarks.get(id), seed.target.id))[0].parentId, seed.folder.id)
  await page.evaluate(() => {
    chrome.bookmarks.move = window.__originalBookmarkMove
    delete window.__originalBookmarkMove
  })
  report.failedMovePreservesBookmark = true
  await page.keyboard.press('Escape')

  await openLab()
  await menu.getByLabel('标题', { exact: true }).fill('Unsaved title')
  await openLab()
  await folderItem('Reading').click()
  await expect(menu.locator('.bookmark-menu-status')).toContainText('Reading')
  const [moved] = await worker.evaluate(id => chrome.bookmarks.get(id), seed.target.id)
  assert.equal(moved.parentId, seed.reading.id)
  assert.equal(moved.title, seed.target.title)
  await expect(menu.getByLabel('标题', { exact: true })).toHaveValue('Unsaved title')
  report.movePreservesDraft = true
  await page.keyboard.press('Escape')

  await page.emulateMedia({ reducedMotion: 'reduce' })
  await tile.click({ button: 'right' })
  await move.click()
  const reduced = await page.locator('.curator-cascade-popup:not([inert])').evaluateAll(elements =>
    elements.map(element => {
      const style = getComputedStyle(element)
      return { transform: style.transform, durations: style.transitionDuration.split(',').map(Number.parseFloat) }
    }))
  assert.ok(reduced.length && reduced.every(style => style.transform === 'none' && style.durations.every(duration => duration <= 0.08)))
  report.reducedMotion = true
  await page.keyboard.press('Escape')
  await page.emulateMedia({ reducedMotion: 'no-preference' })

  for (const width of [768, 390]) {
    await page.setViewportSize({ width, height: 844 })
    await tile.click({ button: 'right' })
    await move.click()
    await folderItem(seed.bar.title).click()
    await folderItem('Menu lab').click()
    await settle()
    const bounds = await page.locator('.curator-cascade-popup:not([data-closed])').evaluateAll(elements =>
      elements.map(element => {
        const rect = element.getBoundingClientRect()
        return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, side: element.getAttribute('data-side') }
      }))
    assert.ok(bounds.length >= 3)
    assert.ok(bounds.every(rect => rect.left >= 0 && rect.right <= width && rect.top >= 0 && rect.bottom <= 844), JSON.stringify({ width, bounds }))
    assert.ok(bounds.some(rect => rect.side === 'left'))
    await page.screenshot({ path: path.join(output, `${width}.png`), animations: 'disabled' })
    if (width === 768) {
      const flipped = await crossParentRowDiagonally()
      assert.equal(flipped.direction, -1)
      await page.waitForTimeout(400)
      await expect(folderItem('Design')).toHaveAttribute('aria-expanded', 'true')
      await expect(folderItem('Development')).toHaveAttribute('aria-expanded', 'false')
      assert.equal(await flipped.crossedRow.getAttribute('data-cascade-highlighted'), null)
      await page.mouse.move(flipped.edge - 40, flipped.crossed.y)
      await page.waitForTimeout(1250)
      await expect(folderItem('Design')).toHaveAttribute('aria-expanded', 'true')
      report.leftDiagonalTransit = true
    }
    await page.keyboard.press('Escape')
  }
  report.viewportCollision = true
  assert.deepEqual(errors, [])
  await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2))
  console.log('Cascading menu browser regressions passed.', report)
} catch (error) {
  await page.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {})
  await writeFile(path.join(output, 'failure.txt'), await page.locator('body').innerText())
  throw error
} finally {
  await context.close()
  if (!profile.startsWith(tempRoot + path.sep)) throw new Error('Refusing to remove a profile outside the test workspace')
  await rm(profile, { recursive: true, force: true })
}
