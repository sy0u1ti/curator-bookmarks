import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { chromium } from 'playwright'

const extensionPath = path.resolve('dist')
const profile = await mkdtemp(path.join(tmpdir(), 'curator-quick-save-'))
const output = path.resolve('output/playwright/popup-quick-save')
const sourceUrl = 'https://example.com/quick-save-fixture'
const sourceTitle = 'Draven Fast 9 TFT Comp Guide (Patch 18.2b)'
let context

try {
  await mkdir(output, { recursive: true })
  context = await chromium.launchPersistentContext(profile, {
    channel: 'chromium', headless: true, viewport: { width: 800, height: 600 },
    args: [`--load-extension=${extensionPath}`, `--disable-extensions-except=${extensionPath}`]
  })
  context.setDefaultTimeout(10000)
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker')
  const extensionId = new URL(worker.url()).host
  const folders = await worker.evaluate(async () => {
    await chrome.storage.local.set({ curatorBookmarkContentSnapshotSettings: { enabled: false, autoCaptureOnBookmarkCreate: false } })
    const parent = await chrome.bookmarks.create({ parentId: '1', title: '游戏攻略' })
    const child = await chrome.bookmarks.create({ parentId: parent.id, title: '云顶之弈' })
    for (let i = 0; i < 24; i++) await chrome.bookmarks.create({ parentId: '1', title: `参考资料 ${i + 1}` })
    return { parent: parent.id, child: child.id }
  })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  // The popup is hosted in a test tab. Only substitute its active-page metadata;
  // successful saves still use the real service worker and Chrome bookmarks API.
  await page.addInitScript(({ sourceUrl, sourceTitle }) => {
    const query = chrome.tabs.query.bind(chrome.tabs)
    chrome.tabs.query = (info, callback) => {
      if (!info.active || !info.currentWindow) return query(info, callback)
      const tabs = [{ id: 77, active: true, url: sourceUrl, title: sourceTitle }]
      return callback ? callback(tabs) : Promise.resolve(tabs)
    }
    window.saveProbe = { calls: 0, failNext: false, hold: false, resume: null }
    const send = chrome.runtime.sendMessage.bind(chrome.runtime)
    chrome.runtime.sendMessage = (message, ...args) => {
      if (message?.type !== 'bookmark:save') return send(message, ...args)
      const probe = window.saveProbe
      probe.calls++
      if (probe.failNext) {
        probe.failNext = false
        args[0]({ ok: false, error: '测试保存失败，请重试' })
        return
      }
      if (probe.hold) { probe.resume = () => send(message, ...args); return }
      return send(message, ...args)
    }
  }, { sourceUrl, sourceTitle })
  await page.goto(`chrome-extension://${extensionId}/src/popup/popup.html`)
  const trigger = page.locator('[data-current-page-action="save"]')
  const modal = page.locator('#smart-folder-modal')
  const title = page.locator('#smart-folder-title-input')
  const search = page.locator('#smart-folder-search-input')
  const save = page.locator('#save-smart-folder-button')
  const bookmarks = () => worker.evaluate(url => chrome.bookmarks.search({ url }), sourceUrl)
  const waitTitleFocus = () => page.waitForFunction(() => {
    const input = document.querySelector('#smart-folder-title-input')
    return input && document.activeElement === input && input.selectionStart === 0 && input.selectionEnd === input.value.length
  })

  // Cancel and reopen must reinitialize the title and select all text each time.
  await trigger.click()
  await waitTitleFocus()
  assert.equal(await title.inputValue(), sourceTitle)
  assert.equal(await page.locator('[data-smart-select-folder="1"]').getAttribute('aria-selected'), 'true')
  await title.fill('取消的草稿')
  await title.press('Escape')
  await modal.waitFor({ state: 'hidden' })
  assert.equal((await bookmarks()).length, 0)
  await trigger.click()
  await waitTitleFocus()
  assert.equal(await title.inputValue(), sourceTitle)

  await title.fill('  ')
  assert.equal(await save.isDisabled(), true)
  assert.equal(await title.inputValue(), '  ', 'an empty draft must not spring back to the page title')
  await title.press('Enter')
  assert.equal((await bookmarks()).length, 0)
  await title.fill('德莱文 · 九五阵容攻略')
  await title.dispatchEvent('keydown', { key: 'Enter', code: 'Enter', isComposing: true })
  assert.equal(await page.evaluate(() => window.saveProbe.calls), 0, 'IME confirmation must not save')

  await search.fill('云顶')
  await search.press('Enter')
  assert.equal(await page.evaluate(() => window.saveProbe.calls), 0, 'folder search Enter must not submit')
  await search.press('ArrowDown')
  await page.waitForFunction(() => document.activeElement?.hasAttribute('data-smart-select-folder'))
  await page.locator(`[data-smart-select-folder="${folders.child}"]`).click()
  assert.equal((await bookmarks()).length, 0, 'choosing a folder must not save prematurely')
  assert.equal(await title.inputValue(), '德莱文 · 九五阵容攻略')
  await search.fill('')
  assert.equal(await page.locator(`[data-smart-select-folder="${folders.child}"]`).getAttribute('aria-selected'), 'true')
  assert.match(await page.locator('#smart-folder-selected-path').innerText(), /游戏攻略.*云顶之弈/)

  // Reproduce an over-tall Chrome popup host and verify the new footer remains visible.
  await page.evaluate(() => { document.getElementById('popup-root').style.height = '1200px' })
  const bounds = await page.evaluate(() => {
    const button = document.querySelector('#save-smart-folder-button').getBoundingClientRect()
    const list = document.querySelector('#smart-folder-list').getBoundingClientRect()
    return { buttonBottom: button.bottom, listHeight: list.height, viewport: innerHeight }
  })
  assert.ok(bounds.buttonBottom <= bounds.viewport && bounds.listHeight >= 120, JSON.stringify(bounds))
  await page.screenshot({ path: path.join(output, 'save-bookmark.png') })

  const customTitle = `自定义完整名称 ${'保留详细内容和符号 / & — '.repeat(12)}`.trim()
  assert.ok(customTitle.length > 90 && customTitle.length < 512)
  await title.fill(`  ${customTitle}  `)
  await page.evaluate(() => { window.saveProbe.failNext = true })
  await save.click()
  await page.locator('#smart-folder-error').waitFor()
  assert.match(await page.locator('#smart-folder-error').innerText(), /测试保存失败/)
  assert.equal(await title.inputValue(), `  ${customTitle}  `)
  assert.match(await page.locator('#smart-folder-selected-path').innerText(), /云顶之弈/)
  assert.equal((await bookmarks()).length, 0)

  // Hold the retry to prove busy controls and repeated Enter cannot create duplicates.
  await page.evaluate(() => { window.saveProbe.hold = true })
  await title.press('Enter')
  await page.waitForFunction(() => window.saveProbe.calls === 2)
  assert.equal(await save.isDisabled(), true)
  assert.equal(await title.isDisabled(), true)
  assert.equal(await search.isDisabled(), true)
  assert.equal(await page.locator('#close-smart-folder-modal').isDisabled(), true)
  await page.keyboard.press('Escape')
  assert.equal(await modal.isVisible(), true)
  await title.dispatchEvent('keydown', { key: 'Enter', repeat: true })
  assert.equal(await page.evaluate(() => window.saveProbe.calls), 2)
  await page.evaluate(() => window.saveProbe.resume())
  await modal.waitFor({ state: 'hidden' })
  await page.locator('[data-current-page-action="edit"]').waitFor()
  const saved = await bookmarks()
  assert.equal(saved.length, 1)
  assert.equal(saved[0].title, customTitle, 'custom titles longer than 90 characters must save without truncation')
  assert.equal(saved[0].parentId, folders.child)
  await page.locator('[data-current-page-action="edit"]').click()
  assert.equal(await page.locator('#edit-title-input').inputValue(), customTitle)
  assert.deepEqual(errors, [])
  console.log('Popup quick save passed: rename, folder selection, cancel/reopen focus, empty/IME guards, viewport, failed retry, busy controls, exact stored title and no duplicates.')
} finally {
  await context?.close()
  assert.equal(path.dirname(path.resolve(profile)), path.resolve(tmpdir()))
  await rm(profile, { recursive: true, force: true })
}
