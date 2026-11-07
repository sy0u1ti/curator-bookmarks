import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'

const output = path.resolve('output/playwright/appearance')
await mkdir(output, { recursive: true })
await mkdir('.tmp-test', { recursive: true })
const profile = await mkdtemp(path.resolve('.tmp-test/appearance-'))
const errors = []
const report = { adjustments: [], blur: [], errors }
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
      curatorBookmarkNewTabBackgroundSettings: { type: 'urls', color: '#101013', url, wallpaperDim: 0, wallpaperBlur: 0 }
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
    for (const value of [0, 32]) {
      await slider(page, 'wallpaper-blur', value)
      assert.equal(await page.locator('#newtab-wallpaper-stage').evaluate(el => getComputedStyle(el).filter), value ? `blur(${value}px)` : 'none')
      assert.equal(await page.locator('#newtab-wallpaper-dim').evaluate(el => getComputedStyle(el).backdropFilter), 'none')
      const image = await pixels(page)
      const delta = await difference(page, original, image)
      assert.ok(value === 0 ? delta < 0.1 : delta > 3, `${preference}: ${value}px must change painted wallpaper: ${delta}`)
      report.blur.push({ preference, value, delta })
    }
  }
  // Reload proves the prepaint snapshot and hydrated settings agree on the exact blur.
  await page.reload()
  assert.equal(await page.evaluate(() => document.documentElement.style.getPropertyValue('--wallpaper-filter')), 'blur(32px)')
  await page.getByRole('button', { name: '打开设置', exact: true }).click()
  await page.getByRole('tab', { name: '外观', exact: true }).click()
  assert.equal(await page.locator('#wallpaper-blur-value').textContent(), '32px')
  await slider(page, 'wallpaper-blur', 0)

  // Controlled sliders previously snapped ArrowRight back to 0 or 50 forever.
  const dim = page.locator('#wallpaper-dim-root').getByRole('slider')
  for (const value of [0, 50]) {
    await slider(page, 'wallpaper-dim', value)
    await dim.focus(); await dim.press('ArrowRight')
    await page.waitForFunction(expected => document.getElementById('wallpaper-dim-value')?.textContent === `${expected}%`, value + 1)
  }
  await slider(page, 'wallpaper-dim', 0)

  // Each amount is independent: it paints alone, and zero restores the original pixels.
  for (const [id, max] of [['wallpaper-dim', 100], ['wallpaper-blur', 32]]) {
    await slider(page, id, max)
    const delta = await difference(page, original, await pixels(page))
    assert.ok(delta > 0.2, `${id} must produce a visible effect: ${delta}`)
    report.adjustments.push({ id, delta })
    await slider(page, id, 0)
    assert.ok(await difference(page, original, await pixels(page)) < 0.1, `${id}: zero must preserve the original`)
  }
  assert.equal(await page.getByRole('combobox', { name: '背景蒙版样式', exact: true }).count(), 1)
  assert.equal(await page.getByRole('switch', { name: '背景蒙版', exact: true }).count(), 1)

  await select(page, '背景类型', '视频')
  const video = await page.evaluate(async data => {
    const image = new Image()
    image.src = `data:image/png;base64,${data}`
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = image.width; canvas.height = image.height
    const ctx = canvas.getContext('2d')
    // Push frames explicitly and flush in slices: without a timeslice, headless
    // Chromium can stop the recorder before any frame is encoded, leaving only
    // a WebM header that no player can decode.
    const stream = canvas.captureStream(0)
    const track = stream.getVideoTracks()[0]
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' })
    const chunks = []
    recorder.ondataavailable = event => chunks.push(event.data)
    const done = new Promise(resolve => recorder.onstop = resolve)
    recorder.start(100)
    const drawFrame = () => { ctx.drawImage(image, 0, 0); track.requestFrame() }
    drawFrame()
    const draw = setInterval(drawFrame, 100)
    setTimeout(() => { clearInterval(draw); recorder.stop() }, 1000)
    await done
    stream.getTracks().forEach(track => track.stop())
    const bytes = new Uint8Array(await new Blob(chunks).arrayBuffer())
    let binary = ''
    for (const byte of bytes) binary += String.fromCharCode(byte)
    return btoa(binary)
  }, wallpaper)
  await page.locator('#background-video-file').setInputFiles({ name: 'appearance.webm', mimeType: 'video/webm', buffer: Buffer.from(video, 'base64') })
  await page.waitForFunction(() => document.querySelector('.newtab-background-video')?.videoWidth > 0)
  await slider(page, 'wallpaper-blur', 0)
  const videoOriginal = await pixels(page)
  await slider(page, 'wallpaper-blur', 32)
  const videoCoverage = await page.locator('.newtab-background-video').evaluate(element => {
    const rect = element.getBoundingClientRect()
    return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: innerWidth, height: innerHeight }
  })
  assert.ok(
    videoCoverage.left < 0 && videoCoverage.top < 0 && videoCoverage.right > videoCoverage.width && videoCoverage.bottom > videoCoverage.height,
    'Blurred videos must cover beyond every viewport edge, including after the responsive media reset.'
  )
  assert.ok(await difference(page, videoOriginal, await pixels(page)) > 3, 'Video blur must affect the playing video')
  await slider(page, 'wallpaper-blur', 0)
  await slider(page, 'wallpaper-dim', 50)
  assert.ok(await difference(page, videoOriginal, await pixels(page)) > 0.2, 'Dim must render on video')
  await slider(page, 'wallpaper-dim', 0)
  report.video = true
  await select(page, '背景类型', '图片链接')
  await slider(page, 'wallpaper-dim', 35)

  // One density choice updates cards and all spacing together.
  await page.locator('#icon-advanced-toggle').click()
  const densityGaps = []
  for (const preset of ['compact', 'spacious']) {
    await page.locator(`[data-preset="${preset}"]`).click()
    densityGaps.push(await page.locator('#icon-live-preview > div').evaluate(el => ({
      column: getComputedStyle(el).columnGap, row: getComputedStyle(el).rowGap,
      folder: getComputedStyle(document.querySelector('.bookmark-folder-sections')).rowGap
    })))
  }
  for (const key of ['column', 'row', 'folder']) assert.notEqual(densityGaps[0][key], densityGaps[1][key])
  assert.equal(await page.locator('#icon-column-gap-root, #icon-row-gap-root, #icon-folder-gap-root').count(), 0)
  await page.locator('[data-preset="comfortable"]').click()
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
  await page.locator('#icon-live-preview').screenshot({ path: path.join(output, 'card-preview.png') })

  const densityHeights = []
  for (const [density, value] of [['单行', 'compact'], ['胶囊', 'balanced'], ['卡片', 'comfortable']]) {
    await select(page, '时间布局密度', density)
    await page.waitForFunction(value => document.querySelector('.newtab-clock')?.dataset.clockDensity === value, value)
    densityHeights.push(await page.locator('.newtab-clock').evaluate(el => el.getBoundingClientRect().height))
  }
  assert.ok(densityHeights[0] < densityHeights[1] && densityHeights[1] < densityHeights[2], `Clock densities must change layout: ${densityHeights}`)
  await select(page, '时间布局密度', '胶囊')
  const restoreLegacyClockSize = async size => page.evaluate(async size => {
    const key = 'curatorBookmarkNewTabTimeSettings'
    const stored = await chrome.storage.local.get(key)
    await chrome.storage.local.set({ [key]: { ...stored[key], clockSize: size } })
  }, size)
  assert.equal(await page.locator('#time-clock-size-root').count(), 0)
  await restoreLegacyClockSize(70)
  await page.waitForFunction(() => document.querySelector('.newtab-clock')?.style.getPropertyValue('--clock-scale') === '0.7')
  const smallFont = await page.locator('[data-clock-time]').evaluate(el => parseFloat(getComputedStyle(el).fontSize))
  await restoreLegacyClockSize(140)
  await page.waitForFunction(() => document.querySelector('.newtab-clock')?.style.getPropertyValue('--clock-scale') === '1.4')
  assert.ok(await page.locator('[data-clock-time]').evaluate(el => parseFloat(getComputedStyle(el).fontSize)) > smallFont)
  await select(page, '时间显示内容', '仅日期')
  await page.waitForFunction(() => document.querySelector('.newtab-clock')?.dataset.clockDisplayMode === 'date')
  assert.equal(await page.locator('[data-clock-time]').count(), 0)
  assert.ok(Math.abs(await page.locator('[data-clock-date]').evaluate(el => parseFloat(getComputedStyle(el).fontSize)) - 22.4) < 0.1, 'Date-only mode uses its 16px base size at 140%')
  await select(page, '时间布局密度', '卡片')
  await page.waitForFunction(() => document.querySelector('.newtab-clock')?.dataset.clockDensity === 'comfortable')
  assert.ok(Math.abs(await page.locator('.newtab-clock').evaluate(el => el.getBoundingClientRect().height) - 75.6) < 1, 'Date-only card uses the compact 54px height at 140%')
  await select(page, '时间布局密度', '胶囊')
  await select(page, '时间显示内容', '仅时间')
  await page.waitForFunction(() => document.querySelector('.newtab-clock')?.dataset.clockDisplayMode === 'time')
  assert.equal(await page.locator('[data-clock-date]').count(), 0)
  await select(page, '时间显示内容', '时间和日期')
  await restoreLegacyClockSize(100)
  report.time = { densityHeights, fontSize: true, displayMode: true }

  await select(page, '背景类型', '纯色')
  assert.equal(await page.locator('#wallpaper-dim-row').isVisible(), false, 'A solid color has nothing to dim')
  assert.equal(await page.evaluate(() => document.documentElement.style.getPropertyValue('--wallpaper-dim')), '0')
  await select(page, '背景类型', '图片链接')
  assert.equal(await page.locator('#wallpaper-dim-value').textContent(), '35%', 'Stored amounts return with the photo')
  assert.equal(await page.evaluate(() => document.documentElement.style.getPropertyValue('--wallpaper-dim')), '1')

  await page.setViewportSize({ width: 390, height: 844 })
  await page.locator('#settings-tab-appearance').click()
  assert.equal(await page.locator('.settings-drawer-scroll').evaluate(el => el.scrollWidth <= el.clientWidth + 1), true)
  await page.screenshot({ path: path.join(output, 'narrow.png') })
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
