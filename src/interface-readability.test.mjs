import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { chromium } from 'playwright'

const output = path.resolve('output/playwright/apple-ui')
await mkdir(output, { recursive: true })
const profile = await mkdtemp(path.join(tmpdir(), 'curator-readability-'))
const extension = path.resolve('dist')
const reportOnly = process.argv.includes('--report-only')
let context
let page
const errors = []
const audits = []

// Measure actual rendered text. Disabled controls are intentionally distinct;
// hidden labels, icon glyphs and offscreen virtual rows do not count as copy.
async function auditText(root, name) {
  const result = await root.evaluate(element => {
    const rgba = value => {
      const values = value.match(/[\d.]+/g)?.map(Number)
      return values?.length >= 3 ? [values[0], values[1], values[2], values[3] ?? 1] : [0, 0, 0, 0]
    }
    const blend = (foreground, background) => foreground.slice(0, 3).map((c, i) => c * foreground[3] + background[i] * (1 - foreground[3]))
    const luminance = color => color.reduce((sum, c, i) => {
      const value = c / 255
      return sum + (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4) * [0.2126, 0.7152, 0.0722][i]
    }, 0)
    const samples = []
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
    while (walker.nextNode()) {
      const node = walker.currentNode
      const text = node.textContent?.trim()
      const parent = node.parentElement
      if (!text || !parent || parent.closest('svg,script,style,[hidden],[aria-hidden=true],.sr-only,:disabled,[data-disabled],[aria-disabled=true]')) continue
      const rect = parent.getBoundingClientRect()
      if (rect.width < 2 || rect.height < 2 || rect.bottom <= 0 || rect.top >= innerHeight) continue
      const style = getComputedStyle(parent)
      if (style.visibility !== 'visible' || style.display === 'none') continue
      const layers = []
      let opacity = 1
      let complexBackground = false
      for (let cursor = parent; cursor; cursor = cursor.parentElement) {
        const css = getComputedStyle(cursor)
        opacity *= Number(css.opacity)
        layers.push(rgba(css.backgroundColor))
        complexBackground ||= css.backgroundImage !== 'none' || css.backdropFilter !== 'none'
      }
      if (opacity < 0.01) continue
      let background = [0, 0, 0]
      for (const color of layers.reverse()) background = blend(color, background)
      const foreground = rgba(style.color)
      foreground[3] *= opacity
      const color = blend(foreground, background)
      const a = luminance(color), b = luminance(background)
      const contrast = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
      samples.push({
        text: text.slice(0, 100), font: parseFloat(style.fontSize), contrast: Number(contrast.toFixed(2)),
        opacity, complexBackground, classes: String(parent.className).slice(0, 260)
      })
    }
    return { samples: samples.length, small: samples.filter(s => s.font < 12), lowContrast: samples.filter(s => !s.complexBackground && s.contrast < 4.5) }
  })
  audits.push({ name, ...result })
}

async function frames(count = 2) {
  await page.evaluate(count => new Promise(resolve => {
    function frame() { if (--count <= 0) resolve(); else requestAnimationFrame(frame) }
    requestAnimationFrame(frame)
  }), count)
}

try {
  context = await chromium.launchPersistentContext(profile, {
    channel: 'chromium', headless: true, viewport: { width: 800, height: 600 },
    args: ['--disable-extensions-except=' + extension, '--load-extension=' + extension]
  })
  // Fixtures remain local to this profile, with no model calls or remote content capture.
  await context.route(/^https?:/, route => route.fulfill({ status: 200, contentType: 'text/html', body: '<title>UI fixture</title><p>Example</p>' }))
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker')
  const id = new URL(worker.url()).host
  await worker.evaluate(async () => {
    const folders = [], bookmarks = [], now = Date.now()
    await chrome.storage.local.set({
      curatorBookmarkContentSnapshotSettings: { enabled: false, autoCaptureOnBookmarkCreate: false },
      curatorBookmarkAiNamingSettings: { baseUrl: 'http://127.0.0.1:1', model: 'ui-fixture', apiKey: '', autoAnalyzeBookmarks: false }
    })
    for (let index = 0; index < 3; index++) {
      const folder = await chrome.bookmarks.create({ parentId: '1', title: ['开发资料', '设计参考', '阅读清单'][index] })
      folders.push(folder)
      for (let i = 0; i < 12; i++) bookmarks.push(await chrome.bookmarks.create({ parentId: folder.id, title: '界面与交互设计文档 ' + (index * 12 + i + 1), url: 'https://example.net/readability/' + index + '/' + i }))
    }
    await chrome.storage.local.set({
      curatorBookmarkNewTabFolderSettings: { selectedFolderIds: folders.map(f => f.id), hideFolderNames: false },
      curatorBookmarkNewTabWorkspaceSettings: { activeWorkspaceId: 'default', workspaces: [{ id: 'default', name: '常用入口', pinnedIds: bookmarks.slice(0, 4).map(b => b.id), createdAt: now, updatedAt: now }] }
    })
  })
  page = await context.newPage()
  page.on('pageerror', error => errors.push(error.message))
  const base = 'chrome-extension://' + id
  await page.goto(base + '/src/popup/popup.html')
  await page.locator('.t-skel-content .popup-main-row').first().waitFor()
  await page.waitForFunction(() => getComputedStyle(document.querySelector('.popup-workspace-reveal .t-skel-content')).opacity === '1')
  await auditText(page.locator('#popup-app-shell'), 'popup')
  await page.screenshot({ path: path.join(output, 'popup-after.png') })

  const surfaces = await page.evaluate(() => ({
    currentPage: getComputedStyle(document.querySelector('.popup-page-content')).backgroundColor,
    list: getComputedStyle(document.querySelector('.popup-main-pane')).backgroundColor
  }))
  assert.equal(surfaces.currentPage, surfaces.list, 'current-page toolbar uses the same gray as bookmark panels')
  const hint = page.locator('.popup-keyboard-hint')
  const initialHint = await hint.evaluate(e => ({ color: getComputedStyle(e).color, opacity: getComputedStyle(e).opacity, width: e.clientWidth, contentWidth: e.scrollWidth, font: parseFloat(getComputedStyle(e).fontSize) }))
  await page.locator('#search-input').focus()
  await frames()
  await page.locator('.t-skel-content .popup-main-pane').click({ position: { x: 8, y: 8 } })
  await frames()
  const blurredHint = await hint.evaluate(e => ({ color: getComputedStyle(e).color, opacity: getComputedStyle(e).opacity }))
  assert.equal(initialHint.opacity, '1')
  assert.equal(blurredHint.opacity, '1')
  assert.equal(initialHint.color, blurredHint.color)
  assert.ok(initialHint.width >= initialHint.contentWidth && initialHint.font >= 12, 'keyboard help must fit without fading or truncation')

  // Hold the FIRST physical click across module loading; it used to replace
  // the pressed trigger during hover, losing pointer-up/click.
  const trigger = page.locator('#search-help-toggle')
  const triggerBox = await trigger.boundingBox()
  assert.ok(triggerBox.width >= 28 && triggerBox.height >= 28)
  await page.mouse.move(triggerBox.x + triggerBox.width / 2, triggerBox.y + triggerBox.height / 2)
  await page.mouse.down()
  await page.waitForTimeout(120)
  await page.mouse.up()
  const help = page.locator('#search-help-popover')
  await help.waitFor({ state: 'visible', timeout: 4000 })
  assert.equal(await trigger.getAttribute('aria-expanded'), 'true')
  await page.waitForFunction(() => getComputedStyle(document.querySelector('#search-help-popover')).opacity === '1')
  assert.equal(await help.evaluate(e => { const r = e.getBoundingClientRect(); return e.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)) }), true, 'the help panel must paint above popup content and receive pointer hits')
  await auditText(help, 'popup help')
  await page.screenshot({ path: path.join(output, 'popup-help-after.png') })
  await page.keyboard.press('Escape')
  await help.waitFor({ state: 'hidden' })
  assert.equal(await trigger.evaluate(e => e === document.activeElement), true)
  await trigger.press('ArrowDown')
  await help.waitFor({ state: 'visible' })
  await page.locator('.popup-keyboard-hint').click()
  await help.waitFor({ state: 'hidden' })

  const settings = page.locator('#open-settings')
  const box = await settings.boundingBox()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await frames(3)
  const press = await settings.evaluate(e => [e, e.querySelector('svg'), e.querySelector('span')].map(n => {
    const s = getComputedStyle(n)
    return { transform: s.transform, scale: s.scale, color: s.color, opacity: s.opacity, transition: s.transitionProperty }
  }))
  assert.ok(press[0].transition.includes('scale'), 'button scale must interpolate, not snap')
  assert.equal(press[1].transform, 'none')
  assert.equal(press[1].scale, 'none')
  assert.equal(press[2].transform, 'none')
  assert.equal(press[2].scale, 'none')
  assert.equal(press[1].color, press[2].color)
  await page.mouse.move(box.x - 50, box.y + 90)
  await page.mouse.up()

  await page.emulateMedia({ reducedMotion: 'reduce' })
  await trigger.click()
  await help.waitFor({ state: 'visible' })
  await page.keyboard.press('Escape')
  await help.waitFor({ state: 'hidden' })
  await page.emulateMedia({ reducedMotion: 'no-preference' })

  const optionsPromise = context.waitForEvent('page')
  await settings.click()
  const optionsPage = await optionsPromise
  await optionsPage.waitForURL(/options\.html/)
  page = optionsPage
  page.on('pageerror', error => errors.push(error.message))

  // Audit all settings sections and each new-tab settings group.
  await page.setViewportSize({ width: 1440, height: 1000 })
  for (const section of ['general','backup','availability','history','redirects','ignore','duplicates','folder-cleanup','recycle','ai','bookmark-history']) {
    await page.goto(base + '/src/options/options.html#' + section)
    const panel = page.locator('section#' + section)
    await panel.waitFor({ state: 'visible' })
    await page.waitForTimeout(280)
    if (section === 'general') {
      const helpButton = panel.getByRole('button', { name: '自动分析说明', exact: true })
      await helpButton.click()
      const explanation = page.getByRole('dialog', { name: '自动分析', exact: true })
      await explanation.waitFor({ state: 'visible' })
      await page.waitForFunction(() => [...document.querySelectorAll('[role=dialog]')].some(e => e.textContent.includes('自动分析') && getComputedStyle(e).opacity === '1'))
      assert.equal(await explanation.evaluate(e => {const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))}), true)
      await page.keyboard.press('Escape')
      await explanation.waitFor({ state: 'hidden' })
      assert.equal(await helpButton.evaluate(e => e === document.activeElement), true)
    }
    const scroll = page.locator('#options-main')
    const metrics = await scroll.evaluate(e => ({ max: e.scrollHeight - e.clientHeight, height: e.clientHeight }))
    for (let offset = 0; offset <= metrics.max + metrics.height; offset += metrics.height) {
      await scroll.evaluate((e, y) => e.scrollTo(0, y), Math.min(offset, metrics.max))
      await frames()
      await auditText(panel, 'options ' + section + ' @' + Math.min(offset, metrics.max))
      if (offset >= metrics.max) break
    }
    assert.equal(await panel.evaluate(e => e.scrollWidth <= e.clientWidth + 2), true, section + ' content fits')
  }
  await page.goto(base + '/src/newtab/newtab.html')
  await page.locator('.bookmark-tile').first().waitFor()
  await page.waitForTimeout(320)
  await auditText(page.locator('.newtab-app'), 'newtab')
  await page.screenshot({ path: path.join(output, 'newtab-after.png') })
  await page.locator('#newtab-settings-trigger').click()
  const drawer = page.locator('.settings-drawer-panel')
  await drawer.waitFor({ state: 'visible' })
  for (const name of ['来源', '外观', '搜索', '高级设置']) {
    await page.getByRole('tab', { name, exact: true }).click()
    await page.waitForTimeout(220)
    const scroll = page.locator('.settings-drawer-scroll')
    const metrics = await scroll.evaluate(e => ({ max: e.scrollHeight - e.clientHeight, height: e.clientHeight }))
    for (let offset = 0; offset <= metrics.max + metrics.height; offset += metrics.height) {
      await scroll.evaluate((e, y) => e.scrollTo(0, y), Math.min(offset, metrics.max))
      await frames()
      await auditText(drawer, 'newtab settings ' + name + ' @' + Math.min(offset, metrics.max))
      if (offset >= metrics.max) break
    }
    await page.screenshot({ path: path.join(output, 'newtab-settings-' + name + '.png') })
  }
  const violations = audits.filter(a => a.small.length || a.lowContrast.length)
  await writeFile(path.join(output, 'readability.json'), JSON.stringify({ surfaces, initialHint, press, audits, errors, violations }, null, 2))
  assert.deepEqual(errors, [])
  if (!reportOnly) assert.deepEqual(violations, [], 'visible enabled copy must be at least 12px with sufficient contrast on solid surfaces')
  await rm(path.join(output, 'failure.png'), { force: true })
  await rm(path.join(output, 'failure.txt'), { force: true })
  console.log(JSON.stringify({ scans: audits.length, samples: audits.reduce((n, a) => n + a.samples, 0), violations: violations.length, errors }))
} catch (error) {
  if (page && !page.isClosed()) {
    await page.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {})
    await writeFile(path.join(output, 'failure.txt'), await page.locator('body').ariaSnapshot()).catch(() => {})
  }
  throw error
} finally {
  await context?.close()
  const resolved = path.resolve(profile)
  assert.ok(resolved.startsWith(path.resolve(tmpdir()) + path.sep) && path.basename(resolved).startsWith('curator-readability-'))
  await rm(resolved, { recursive: true, force: true })
}
