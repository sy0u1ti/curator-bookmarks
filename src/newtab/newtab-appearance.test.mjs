import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'
import { build } from 'esbuild'

const { outputFiles } = await build({ entryPoints: ['src/newtab/background-mask-settings.ts'], bundle: true, write: false, format: 'esm', platform: 'node' })
const { BACKGROUND_MASK_META } = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`)
const output = path.resolve('output/playwright/appearance')
await mkdir(output, { recursive: true })
await mkdir('.tmp-test', { recursive: true })
const profile = await mkdtemp(path.resolve('.tmp-test/appearance-'))
const errors = []
const report = { styles: [], blur: [], errors }
const context = await chromium.launchPersistentContext(profile, {
  channel: 'chromium', headless: true, viewport: { width: 1440, height: 1000 },
  args: [`--disable-extensions-except=${path.resolve('dist')}`, `--load-extension=${path.resolve('dist')}`]
})

async function select(page, name, label) {
  await page.getByRole('combobox', { name, exact: true }).click()
  await page.getByRole('option', { name: label, exact: true }).click()
}

async function slider(page, id, value) {
  const input = page.locator(`#${id}-root`).getByRole('slider')
  await input.fill(String(value))
  assert.equal(await input.inputValue(), String(value))
}

async function pixels(page) {
  await page.waitForTimeout(280)
  return (await page.screenshot({ clip: { x: 10, y: 560, width: 600, height: 320 } })).toString('base64')
}

async function difference(page, a, b) {
  return page.evaluate(async ({ a, b }) => {
    const read = async source => {
      const image = new Image()
      image.src = `data:image/png;base64,${source}`
      await image.decode()
      const canvas = document.createElement('canvas')
      canvas.width = image.width; canvas.height = image.height
      const context = canvas.getContext('2d')
      context.drawImage(image, 0, 0)
      return context.getImageData(0, 0, canvas.width, canvas.height).data
    }
    const [first, second] = await Promise.all([read(a), read(b)])
    let delta = 0
    for (let i = 0; i < first.length; i++) if (i % 4 !== 3) delta += Math.abs(first[i] - second[i])
    return delta / (first.length * 0.75)
  }, { a, b })
}

let page
try {
  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker')
  page = await context.newPage()
  const wallpaper = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 1440; canvas.height = 1000
    const ctx = canvas.getContext('2d')
    const gradient = ctx.createLinearGradient(0, 0, 1440, 1000)
    gradient.addColorStop(0, '#155878'); gradient.addColorStop(0.5, '#bd8667'); gradient.addColorStop(1, '#263950')
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 1440, 1000)
    for (let x = 0; x < 1440; x += 24) {
      ctx.fillStyle = x % 48 === 0 ? '#eff6e890' : '#173b4c90'
      ctx.fillRect(x, 0, 8, 1000)
    }
    ctx.fillStyle = '#82bdaa'; ctx.beginPath(); ctx.arc(360, 740, 100, 0, Math.PI * 2); ctx.fill()
    return canvas.toDataURL('image/png').split(',')[1]
  })
  const wallpaperUrl = 'https://example.com/appearance.png'
  await context.route(wallpaperUrl, route => route.fulfill({ contentType: 'image/png', body: Buffer.from(wallpaper, 'base64'), headers: { 'access-control-allow-origin': '*' } }))
  await worker.evaluate(async url => {
    const folder = await chrome.bookmarks.create({ parentId: '1', title: '外观验证' })
    for (const name of ['阅读资料与灵感收藏', '工作台', '邮箱', '文档']) await chrome.bookmarks.create({ parentId: folder.id, title: name, url: `https://example.com/${encodeURIComponent(name)}` })
    await chrome.storage.local.set({
      curatorBookmarkNewTabFolderSettings: { selectedFolderIds: [folder.id] },
      curatorBookmarkNewTabBackgroundSettings: { type: 'urls', color: '#101013', url, maskEnabled: true, maskStyle: 'dark', maskBlur: 0, maskOverlay: 0, maskFilterStrength: 50, maskFilterSize: 50, maskFilterSpacing: 50, maskFilterHover: false }
    })
  }, wallpaperUrl)
  page.on('pageerror', error => errors.push(error.message))
  const url = `chrome-extension://${new URL(worker.url()).host}/src/newtab/newtab.html`
  await page.goto(url)
  const dismiss = page.getByRole('button', { name: '我知道了', exact: true })
  if (await dismiss.isVisible()) await dismiss.click()
  await page.getByRole('button', { name: '打开设置', exact: true }).click()
  await page.getByRole('tab', { name: '外观', exact: true }).click()
  await page.waitForFunction(() => document.documentElement.style.getPropertyValue('--newtab-runtime-wallpaper-image').includes('appearance') || document.documentElement.style.getPropertyValue('--newtab-runtime-wallpaper-image').includes('blob:'))

  const original = await pixels(page)
  const client = await context.newCDPSession(page)
  for (const preference of ['no-preference', 'reduce']) {
    await client.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-transparency', value: preference }] })
    for (const value of [0, 12, 32]) {
      await slider(page, 'background-mask-blur', value)
      assert.equal(await page.locator('#newtab-background-mask').evaluate(el => getComputedStyle(el).backdropFilter), value ? `blur(${value}px)` : 'none')
      const image = await pixels(page)
      const delta = await difference(page, original, image)
      assert.ok(value === 0 ? delta < 0.1 : delta > 3, `${preference}: ${value}px must change painted wallpaper: ${delta}`)
      report.blur.push({ preference, value, delta })
    }
  }
  // Reload proves the prepaint snapshot and hydrated mask agree on the exact blur.
  await page.reload()
  await page.getByRole('button', { name: '打开设置', exact: true }).click()
  await page.getByRole('tab', { name: '外观', exact: true }).click()
  assert.equal(await page.locator('#background-mask-blur-value').textContent(), '32px')
  await slider(page, 'background-mask-blur', 0)

  // Controlled sliders previously snapped ArrowRight back to 0 or 50 forever.
  const overlay = page.locator('#background-mask-overlay-root').getByRole('slider')
  for (const value of [0, 50]) {
    await slider(page, 'background-mask-overlay', value)
    await overlay.focus(); await overlay.press('ArrowRight')
    await page.waitForFunction(expected => document.getElementById('background-mask-overlay-value')?.textContent === `${expected}%`, value + 1)
  }
  await slider(page, 'background-mask-overlay', 0)

  for (const [style, meta] of Object.entries(BACKGROUND_MASK_META)) {
    await select(page, '背景蒙版样式', meta.label)
    if (['dark', 'frosted', 'noise', 'light'].includes(style)) {
      await slider(page, 'background-mask-overlay', 50)
    } else {
      await slider(page, 'background-mask-filter-strength', 0)
      assert.ok(await difference(page, original, await pixels(page)) < 0.1, `${style}: strength zero must preserve the original`)
      await slider(page, 'background-mask-filter-strength', 100)
      await page.waitForFunction(style => document.querySelector('.newtab-paper-shader')?.getAttribute('data-effect') === style || document.querySelector('#newtab-wallpaper-filter')?.getAttribute('data-effect') === style, style)
      await page.waitForTimeout(450)
    }
    const delta = await difference(page, original, await pixels(page))
    assert.ok(delta > 0.2, `${style} must produce a visible effect: ${delta}`)
    report.styles.push({ style, delta })
    await page.screenshot({ path: path.join(output, `${style}.png`) })
    if (meta.sizeLabel) {
      for (const field of ['size', 'spacing']) {
        await slider(page, `background-mask-filter-${field}`, 0)
        const low = await pixels(page)
        await slider(page, `background-mask-filter-${field}`, 100)
        const high = await pixels(page)
        const geometryDelta = await difference(page, low, high)
        assert.ok(geometryDelta > 0.1, `${style} ${field} must change pixels: ${geometryDelta}`)
        report.styles.at(-1)[field] = geometryDelta
        await slider(page, `background-mask-filter-${field}`, 50)
      }
    }
    await slider(page, 'background-mask-overlay', 0)
  }

  await select(page, '背景类型', '视频')
  await page.locator('#background-filter-status').waitFor()
  assert.ok((await page.locator('#background-filter-status').textContent()).includes('静态图片'))
  assert.equal(await page.locator('#background-mask-filter-size-row').isVisible(), false)
  await page.getByRole('combobox', { name: '背景蒙版样式', exact: true }).click()
  assert.equal(await page.getByRole('option', { name: '图像抖动', exact: true }).getAttribute('aria-disabled'), 'true')
  await page.keyboard.press('Escape')
  const video = await page.evaluate(async data => {
    const image = new Image()
    image.src = `data:image/png;base64,${data}`
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = image.width; canvas.height = image.height
    const ctx = canvas.getContext('2d')
    const stream = canvas.captureStream(5)
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' })
    const chunks = []
    recorder.ondataavailable = event => chunks.push(event.data)
    const done = new Promise(resolve => recorder.onstop = resolve)
    recorder.start()
    ctx.drawImage(image, 0, 0)
    const draw = setInterval(() => ctx.drawImage(image, 0, 0), 100)
    setTimeout(() => { clearInterval(draw); recorder.stop() }, 600)
    await done
    stream.getTracks().forEach(track => track.stop())
    const bytes = new Uint8Array(await new Blob(chunks).arrayBuffer())
    let binary = ''
    for (const byte of bytes) binary += String.fromCharCode(byte)
    return btoa(binary)
  }, wallpaper)
  await page.locator('#background-video-file').setInputFiles({ name: 'appearance.webm', mimeType: 'video/webm', buffer: Buffer.from(video, 'base64') })
  await page.waitForFunction(() => document.querySelector('.newtab-background-video')?.videoWidth > 0)
  await select(page, '背景蒙版样式', '深色渐变')
  await slider(page, 'background-mask-blur', 0)
  const videoOriginal = await pixels(page)
  await slider(page, 'background-mask-blur', 32)
  assert.ok(await difference(page, videoOriginal, await pixels(page)) > 3, 'Video blur must affect the playing video')
  await slider(page, 'background-mask-blur', 0)
  for (const [style, name] of [['grain', '胶片颗粒'], ['halftone', '单色网点'], ['ascii', 'ASCII 字符']]) {
    await select(page, '背景蒙版样式', name)
    await page.waitForFunction(style => document.querySelector('#newtab-wallpaper-filter')?.dataset.effect === style, style)
    assert.ok(await difference(page, videoOriginal, await pixels(page)) > 0.2, `${style} must render on video`)
  }
  report.video = true
  await select(page, '背景类型', '图片链接')
  await select(page, '背景蒙版样式', '深色渐变')
  await slider(page, 'background-mask-overlay', 35)

  // Live card preview must respond to every spacing control, not just its label.
  await page.getByRole('button', { name: '卡片细节', exact: true }).click()
  for (const [id, property] of [['column-gap', 'columnGap'], ['row-gap', 'rowGap']]) {
    await slider(page, `icon-${id}`, 0)
    const low = await page.locator('#icon-live-preview > div').evaluate((el, property) => getComputedStyle(el)[property], property)
    await slider(page, `icon-${id}`, 100)
    const high = await page.locator('#icon-live-preview > div').evaluate((el, property) => getComputedStyle(el)[property], property)
    assert.notEqual(high, low)
    await slider(page, `icon-${id}`, 10)
  }
  await page.getByRole('button', { name: '固定列数', exact: true }).click()
  await slider(page, 'icon-columns', 8)
  await page.waitForFunction(() => {
    const live = document.querySelector('.bookmark-tile[data-bookmark-id]')
    const preview = document.querySelector('#icon-live-preview .bookmark-tile-preview')
    const grid = live?.closest('.bookmark-grid')
    if (!live || !preview || !grid) return false
    const columns = getComputedStyle(grid).gridTemplateColumns.split(' ').length
    // The preview is a crop of full-size cards; the live responsive grid decides
    // the effective columns instead of squeezing all eight requested columns in.
    return document.querySelector('#icon-live-preview-summary')?.textContent.startsWith(`${columns} 列`) &&
      Math.abs(live.getBoundingClientRect().width - preview.getBoundingClientRect().width) < 0.5
  })
  await page.getByRole('button', { name: '自动适配', exact: true }).click()
  await slider(page, 'icon-folder-gap', 88)
  assert.equal(await page.locator('#icon-folder-gap-value').textContent(), '88px')
  await slider(page, 'icon-folder-gap', 20)
  await page.locator('#icon-live-preview').screenshot({ path: path.join(output, 'card-preview.png') })

  const densityHeights = []
  for (const [density, value] of [['极简单行', 'compact'], ['平衡胶囊', 'balanced'], ['独立卡片', 'comfortable']]) {
    await select(page, '时间布局密度', density)
    await page.waitForFunction(value => document.querySelector('.newtab-clock')?.dataset.clockDensity === value, value)
    densityHeights.push(await page.locator('.newtab-clock').evaluate(el => el.getBoundingClientRect().height))
  }
  assert.ok(densityHeights[0] < densityHeights[1] && densityHeights[1] < densityHeights[2], `Clock densities must change layout: ${densityHeights}`)
  await select(page, '时间布局密度', '平衡胶囊')
  await slider(page, 'time-clock-size', 70)
  await page.waitForFunction(() => document.querySelector('.newtab-clock')?.style.getPropertyValue('--clock-scale') === '0.7')
  const smallFont = await page.locator('[data-clock-time]').evaluate(el => parseFloat(getComputedStyle(el).fontSize))
  await slider(page, 'time-clock-size', 140)
  await page.waitForFunction(() => document.querySelector('.newtab-clock')?.style.getPropertyValue('--clock-scale') === '1.4')
  assert.ok(await page.locator('[data-clock-time]').evaluate(el => parseFloat(getComputedStyle(el).fontSize)) > smallFont)
  await select(page, '时间显示内容', '仅日期')
  await page.waitForFunction(() => document.querySelector('.newtab-clock')?.dataset.clockDisplayMode === 'date')
  assert.equal(await page.locator('[data-clock-time]').count(), 0)
  assert.ok(Math.abs(await page.locator('[data-clock-date]').evaluate(el => parseFloat(getComputedStyle(el).fontSize)) - 22.4) < 0.1, 'Date-only mode uses its 16px base size at 140%')
  await select(page, '时间布局密度', '独立卡片')
  await page.waitForFunction(() => document.querySelector('.newtab-clock')?.dataset.clockDensity === 'comfortable')
  assert.ok(Math.abs(await page.locator('.newtab-clock').evaluate(el => el.getBoundingClientRect().height) - 75.6) < 1, 'Date-only card uses the compact 54px height at 140%')
  await select(page, '时间布局密度', '平衡胶囊')
  await select(page, '时间显示内容', '仅时间')
  await page.waitForFunction(() => document.querySelector('.newtab-clock')?.dataset.clockDisplayMode === 'time')
  assert.equal(await page.locator('[data-clock-date]').count(), 0)
  await select(page, '时间显示内容', '时间和日期')
  await slider(page, 'time-clock-size', 100)
  report.time = { densityHeights, fontSize: true, displayMode: true }

  await select(page, '背景类型', '纯色')
  assert.equal(await page.locator('#background-mask-blur-root').getByRole('slider').isDisabled(), true)
  await select(page, '背景类型', '图片链接')

  // Simulate a tainted pixel source: a failed filter must not cover the wallpaper.
  await slider(page, 'background-mask-overlay', 0)
  const beforeFailure = await pixels(page)
  await page.evaluate(() => {
    const getImageData = CanvasRenderingContext2D.prototype.getImageData
    const toDataURL = HTMLCanvasElement.prototype.toDataURL
    CanvasRenderingContext2D.prototype.getImageData = function(...args) {
      if (window.rejectFilterSampling) throw new DOMException('Fixture: unreadable pixels', 'SecurityError')
      return getImageData.apply(this, args)
    }
    HTMLCanvasElement.prototype.toDataURL = function(...args) {
      if (window.rejectFilterSampling) throw new DOMException('Fixture: unreadable pixels', 'SecurityError')
      return toDataURL.apply(this, args)
    }
  })
  for (const style of ['ASCII 字符', '图像抖动']) {
    await page.evaluate(() => { window.rejectFilterSampling = true })
    await select(page, '背景蒙版样式', style)
    await page.locator('#background-filter-status').filter({ hasText: '原背景' }).waitFor()
    await page.evaluate(() => { window.rejectFilterSampling = false })
    assert.ok(await difference(page, beforeFailure, await pixels(page)) < 0.1, `${style}: unreadable image must preserve original pixels`)
    await select(page, '背景蒙版样式', '深色渐变')
  }
  report.unreadableImage = true

  await select(page, '背景蒙版样式', '图像抖动')
  await page.waitForFunction(() => document.querySelector('.newtab-paper-shader canvas'))
  await page.locator('.newtab-paper-shader canvas').evaluate(canvas => canvas.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext())
  await page.locator('#background-filter-status').filter({ hasText: '上下文已中断' }).waitFor()
  assert.ok(await difference(page, beforeFailure, await pixels(page)) < 0.1, 'Lost GPU context must preserve original pixels')
  report.contextLoss = true

  await page.setViewportSize({ width: 390, height: 844 })
  await page.locator('#settings-tab-appearance').click()
  assert.equal(await page.locator('.settings-drawer-scroll').evaluate(el => el.scrollWidth <= el.clientWidth + 1), true)
  await page.screenshot({ path: path.join(output, 'narrow.png') })

  const noGpu = await context.newPage()
  await noGpu.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function(type, ...args) {
      return type === 'webgl2' ? null : getContext.call(this, type, ...args)
    }
  })
  await noGpu.goto(url)
  await noGpu.getByRole('button', { name: '打开设置', exact: true }).click()
  await noGpu.getByRole('tab', { name: '外观', exact: true }).click()
  await noGpu.locator('#background-filter-status').filter({ hasText: 'WebGL 2' }).waitFor()
  assert.equal(await noGpu.locator('.newtab-paper-shader').count(), 0)
  await noGpu.getByRole('combobox', { name: '背景蒙版样式', exact: true }).click()
  assert.equal(await noGpu.getByRole('option', { name: '图像抖动', exact: true }).getAttribute('aria-disabled'), 'true')
  await noGpu.close()
  report.unavailableGpu = true
  assert.deepEqual(errors, [])
  await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
  console.log('New Tab appearance pixel, keyboard, persistence, and preview checks passed.')
} catch (error) {
  if (!page) throw error
  await writeFile(path.join(output, 'failure.txt'), await page.locator('body').innerText())
  await writeFile(path.join(output, 'failure-media.json'), JSON.stringify(await page.evaluate(() => ({
    videos: [...document.querySelectorAll('video')].map(video => ({ src: video.currentSrc, readyState: video.readyState, width: video.videoWidth, error: video.error?.message })),
    settings: window.localStorage.getItem('curatorBookmarkNewTabBackgroundSettings')
  })), null, 2))
  await page.screenshot({ path: path.join(output, 'failure.png') })
  throw error
} finally {
  await context.close()
  await rm(profile, { recursive: true, force: true })
}
