import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { chromium } from 'playwright'
import { installGlassWallpaperFixture } from './glass-test-fixture.mjs'

const baseline = process.argv.includes('--baseline')
const output = path.resolve('output/playwright/newtab-search-stability', baseline ? 'before' : 'after')
await mkdir(output, { recursive: true })
const report = []

for (const density of [1, 1.25]) {
  const profile = await mkdtemp(path.join(tmpdir(), 'curator-search-stability-'))
  let context
  try {
    context = await chromium.launchPersistentContext(profile, {
      channel: 'chromium', headless: true, viewport: { width: 1280, height: 900 }, deviceScaleFactor: density,
      args: [`--load-extension=${path.resolve('dist')}`, `--disable-extensions-except=${path.resolve('dist')}`]
    })
    context.setDefaultTimeout(12000)
    const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker')
    const id = new URL(worker.url()).host
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    const wallpaper = await installGlassWallpaperFixture(context, page)
    await worker.evaluate(async wallpaper => {
      const folders = []
      for (const [title, count] of [['标签页', 14], ['邮箱', 2], ['TFT', 4]]) {
        const folder = await chrome.bookmarks.create({ parentId: '1', title })
        folders.push(folder.id)
        for (let index = 0; index < count; index++) await chrome.bookmarks.create({ parentId: folder.id, title: `Guide ${index}`, url: `https://example.com/guide/${folder.id}/${index}` })
      }
      await chrome.storage.local.set({
        curatorBookmarkAiNamingSettings: { autoAnalyzeBookmarks: false },
        curatorBookmarkNewTabFolderSettings: { selectedFolderIds: folders, hideFolderNames: false, browseMode: 'expanded' },
        curatorBookmarkNewTabBackgroundSettings: { type: 'urls', color: '#101013', url: wallpaper, maskEnabled: false },
        curatorBookmarkNewTabSearchSettings: { enabled: true, webSearchEnabled: true, autoVerticalCenter: false }
      })
    }, wallpaper)
    await page.goto(`chrome-extension://${id}/src/newtab/newtab.html`)
    await page.locator('.folder-section-count').first().waitFor()
    await page.waitForFunction(() => document.querySelector('.newtab-search-surface')?.dataset.glassMode === 'refraction')
    await page.evaluate(() => document.fonts.ready)
    await page.waitForFunction(() => performance.getEntriesByName('newtab.searchReady', 'mark').length > 0)
    await page.mouse.move(10, 890)
    await page.locator('.newtab-search-input').evaluate(element => element.blur())
    await page.locator('.newtab-search-shell').evaluate(element => Promise.all(element.getAnimations({ subtree: true }).map(animation => animation.finished.catch(() => {}))))
    await page.waitForFunction(() => !document.querySelector('.newtab-search-shell').matches(':focus-within,:hover'))
    await page.waitForFunction(() => new DOMMatrixReadOnly(getComputedStyle(document.querySelector('.newtab-search-shell')).transform).f === 0)
    const counters = await page.locator('.folder-section-header').evaluateAll(headers => headers.map(header => {
      const count = header.querySelector('.folder-section-count')
      const digits = count.querySelector('.t-number-value')
      const label = header.querySelector('.folder-section-title')
      const rect = header.getBoundingClientRect()
      const number = digits.getBoundingClientRect()
      const title = label.getBoundingClientRect()
      return { label: label.textContent, number: count.textContent, background: getComputedStyle(count).backgroundColor,
        centerOffset: (number.top + number.bottom - rect.top - rect.bottom) / 2,
        titleOffset: (number.top + number.bottom - title.top - title.bottom) / 2 }
    }))
    await page.locator('.bookmark-folder-section').first().screenshot({ path: path.join(output, `title-count-${density}.png`) })
    if (!baseline) await verifyFolderHeadingFeedback(page)
    const capture = () => page.evaluate(() => new Promise(resolve => {
      const selectors = ['.newtab-search-input', '.newtab-search-icon', '.newtab-search-natural', '.newtab-search-engine', '.newtab-search-submit']
      const frames = []
      const started = performance.now()
      const frame = () => {
        const shell = document.querySelector('.newtab-search-shell')
        const matrix = new DOMMatrixReadOnly(getComputedStyle(shell).transform)
        const controls = selectors.map(selector => {
          const element = document.querySelector(selector)
          const rect = element.getBoundingClientRect()
          return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
        })
        frames.push({ time: performance.now() - started, scaleX: matrix.a, scaleY: matrix.d, y: matrix.f, controls })
        if (performance.now() - started < 950) requestAnimationFrame(frame)
        else resolve(frames)
      }
      requestAnimationFrame(frame)
    }))
    const pending = capture()
    await page.locator('.newtab-search-input').click()
    const focus = await pending
    const stationary = focus.at(-1)
    const hoverPending = capture()
    await page.locator('.newtab-search-engine').hover()
    const hover = await hoverPending
    const input = page.locator('.newtab-search-input')
    await input.fill('Guide')
    await page.locator('.newtab-search-suggestion').first().waitFor()
    await page.locator('.newtab-search-shell').evaluate(element => Promise.all(element.getAnimations({ subtree: true }).map(animation => animation.finished.catch(() => {}))))
    const typingPending = capture()
    await input.pressSequentially(' 1', { delay: 35 })
    const typing = await typingPending
    await writeFile(path.join(output, `partial-${density}.json`), JSON.stringify({ density, counters, focus, hover, typing }, null, 2))
    await page.screenshot({ path: path.join(output, `focused-${density}.png`) })
    await page.locator('.newtab-search-engine').click()
    try { await page.getByRole('menu', { name: /搜索引擎/ }).waitFor({ timeout: 3000 }) }
    catch (error) {
      console.log('Engine menu state:', await page.evaluate(() => ({ expanded: document.querySelector('.newtab-search-engine')?.getAttribute('aria-expanded'), menus: [...document.querySelectorAll('.newtab-search-engine-menu')].map(element => ({ visible: element.checkVisibility(), open: element.hasAttribute('data-open') })), active: document.activeElement?.className, engineOpen: document.querySelector('.newtab-search-shell')?.dataset.engineOpen })))
      await page.screenshot({ path: path.join(output, `menu-failure-${density}.png`) })
      throw error
    }
    const menu = await capture()
    if (!baseline) {
      const rotation = await page.locator('.newtab-search-engine-caret').evaluate(element => new DOMMatrixReadOnly(getComputedStyle(element).transform).a)
      assert.ok(Math.abs(rotation + 1) < 0.001, 'The search-engine caret must show that its menu is open')
    }
    await page.keyboard.press('Escape')
    const menuClosed = await capture()
    await writeFile(path.join(output, `partial-${density}.json`), JSON.stringify({ density, counters, focus, hover, typing, menu, menuClosed }, null, 2))
    if (!baseline) {
      for (const counter of counters) {
        assert.equal(counter.background, 'rgba(0, 0, 0, 0)', `${counter.label} count should have no badge background`)
        assert.ok(Math.abs(counter.centerOffset) <= 0.6 && Math.abs(counter.titleOffset) <= 0.6, `${counter.label}: ${JSON.stringify(counter)}`)
      }
      for (const frame of focus) {
        assert.ok(Math.abs(frame.scaleX - 1) < 0.001 && Math.abs(frame.scaleY - 1) < 0.001, 'focus must not scale text or controls')
        assert.ok(frame.y >= -2.02 && frame.y <= 0.02, 'focus lift must not overshoot and snap back')
        frame.controls.forEach((control, index) => {
          const reference = stationary.controls[index]
          assert.ok(Math.abs(control.x - reference.x) < 0.1 && Math.abs(control.width - reference.width) < 0.1 && Math.abs(control.height - reference.height) < 0.1, 'focus must retain control widths, heights and horizontal positions')
          assert.ok(Math.abs((control.y - frame.y) - (reference.y - stationary.y)) < 0.1, 'all controls must travel together with the field')
        })
      }
      assert.ok(Math.abs(stationary.y + 2) < 0.02, 'retain the selected field’s two-pixel lift')
      for (const [phase, frames] of Object.entries({ hover, typing, menu, menuClosed })) {
        for (const frame of frames) {
          assert.ok(Math.abs(frame.y + 2) < 0.02 && Math.abs(frame.scaleX - 1) < 0.001, `focused search must stay steady during ${phase}: y=${frame.y}, scale=${frame.scaleX}, time=${frame.time}`)
          frame.controls.forEach((control, index) => {
            const reference = frames[0].controls[index]
            assert.ok(Math.abs(control.x - reference.x) < 0.1 && Math.abs(control.y - reference.y) < 0.1, `${phase}: inner controls must not jump`)
          })
        }
      }
      await page.locator('.newtab-search-engine').press('ArrowDown')
      await page.getByRole('menu', { name: /搜索引擎/ }).waitFor()
      await page.getByRole('menuitemradio', { name: 'Bing', exact: true }).click()
      await page.waitForFunction(() => document.activeElement === document.querySelector('.newtab-search-input'))
      assert.equal(await input.inputValue(), 'Guide 1')
      await verifySearchButtonFeedback(page)
      await page.emulateMedia({ reducedMotion: 'reduce' })
      assert.equal(await page.locator('.newtab-search-shell').evaluate(element => getComputedStyle(element).transform), 'none')
      for (const button of await page.locator('.newtab-search-chip-button').all()) {
        await button.hover()
        assert.equal(await button.evaluate(element => getComputedStyle(element, '::before').transform), 'none', 'Reduced motion must keep search button surfaces stationary')
      }
    }
    assert.deepEqual(errors, [])
    report.push({ density, counters, focus, hover, typing, menu, menuClosed, errors })
  } finally {
    await context?.close()
    assert.equal(path.dirname(path.resolve(profile)), path.resolve(tmpdir()))
    await rm(profile, { recursive: true, force: true })
  }
}

async function settleControl(control) {
  await control.evaluate(async element => {
    await new Promise(resolve => requestAnimationFrame(resolve))
    await Promise.all(element.getAnimations({ subtree: true }).map(animation => animation.finished.catch(() => {})))
  })
}

async function verifyFolderHeadingFeedback(page) {
  for (const heading of await page.locator('.folder-section-header').all()) {
    const read = () => heading.evaluate(element => {
      const bounds = element.getBoundingClientRect()
      return {
        width: bounds.width, height: bounds.height,
        text: ['.folder-section-title', '.t-number-value'].map(selector => {
          const rect = element.querySelector(selector).getBoundingClientRect()
          return [rect.x - bounds.x, rect.y - bounds.y, rect.width, rect.height]
        })
      }
    })
    await heading.scrollIntoViewIfNeeded()
    await heading.hover()
    await settleControl(heading)
    const before = await read()
    const assertStable = async phase => {
      const after = await read()
      assert.ok(Math.abs(after.width - before.width) < 0.1 && Math.abs(after.height - before.height) < 0.1,
        `Folder heading must retain its hit target during ${phase}: ${JSON.stringify({ before, after })}`)
      after.text.forEach((rect, index) => rect.forEach((value, coordinate) => {
        assert.ok(Math.abs(value - before.text[index][coordinate]) < 0.1,
          `Folder title and count must not shift or scale during ${phase}: ${JSON.stringify({ before, after })}`)
      }))
    }
    for (let index = 0; index < 3; index++) {
      await page.mouse.down()
      await settleControl(heading)
      await assertStable('press')
      await page.mouse.up()
      await settleControl(heading)
      await assertStable('release')
    }
    await heading.dblclick()
    await page.mouse.move(4, 4)
    await settleControl(heading)
    await assertStable('double click and pointer leave')
    await heading.press('Space')
    await settleControl(heading)
    await assertStable('keyboard activation')
  }
}

async function verifySearchButtonFeedback(page) {
  for (const selector of ['.newtab-search-natural', '.newtab-search-engine']) {
    const button = page.locator(selector)
    await button.scrollIntoViewIfNeeded()
    await page.mouse.move(4, 4)
    await settleControl(button)
    const read = () => button.evaluate(element => {
      const bounds = element.getBoundingClientRect()
      const surface = new DOMMatrixReadOnly(getComputedStyle(element, '::before').transform)
      const range = document.createRange()
      range.selectNodeContents(element)
      const label = range.getBoundingClientRect()
      return { width: bounds.width, height: bounds.height, labelWidth: label.width, labelHeight: label.height, scale: surface.a, y: surface.f, active: element.matches(':active'), expanded: element.getAttribute('aria-expanded') }
    })
    const before = await read()
    await button.hover()
    await settleControl(button)
    const hover = await read()
    assert.ok(Math.abs(hover.y + 1) < 0.01, `${selector} must give subtle hover feedback on its surface`)
    await page.mouse.down()
    await settleControl(button)
    const pressed = await read()
    assert.ok(pressed.scale < 0.99 && pressed.scale > 0.94, `${selector} must give bounded press feedback: ${JSON.stringify({before, hover, pressed})}`)
    for (const key of ['width', 'height', 'labelWidth', 'labelHeight']) {
      assert.ok(Math.abs(pressed[key] - before[key]) < 0.1, `${selector}: ${key} must stay steady while the surface moves`)
    }
    // Release outside the control so this geometry check does not run a search
    // or change the semantic-search preference.
    await page.mouse.move(4, 4)
    await page.mouse.up()
    if (await button.getAttribute('aria-expanded') === 'true') {
      await page.keyboard.press('Escape')
    }
    await settleControl(button)
    const released = await read()
    assert.ok(Math.abs(released.scale - 1) < 0.01 && Math.abs(released.y) < 0.01, `${selector} must fully recover after an interrupted press`)
  }
}
await writeFile(path.join(output, 'frames.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify(report.map(item => ({ density: item.density, counters: item.counters,
  focusScaleRange: [Math.min(...item.focus.map(frame => frame.scaleX)), Math.max(...item.focus.map(frame => frame.scaleX))],
  focusLiftRange: [Math.min(...item.focus.map(frame => frame.y)), Math.max(...item.focus.map(frame => frame.y))] })), null, 2))
console.log(baseline ? 'Recorded current folder counts and search focus motion.' : 'Folder counts and search motion remain centered and stable at 100% and 125% pixel density.')
