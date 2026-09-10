import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { build } from 'esbuild'
import { chromium } from 'playwright'

// Exercise the production extension in a disposable profile. No live AI calls.
const extensionPath = path.resolve('dist')
const tempRoot = path.resolve('.tmp')
const outputPath = path.resolve('output/playwright/motion-polish')
await mkdir(tempRoot, { recursive: true })
await mkdir(outputPath, { recursive: true })
const { outputFiles } = await build({
  entryPoints: ['src/ui/base/sheen-progress.ts'], bundle: true,
  format: 'esm', platform: 'node', write: false
})
const sheen = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`)
const assets = await readdir(path.join(extensionPath, 'assets'))
const orbAsset = (await Promise.all(assets.filter((name) => name.endsWith('.js')).map(async (name) => ({
  name, source: await readFile(path.join(extensionPath, 'assets', name), 'utf8')
})))).find(({ source }) => source.includes('getContext(') && source.includes('listening') && source.includes('Searching'))?.name
assert.ok(orbAsset, 'Build must retain the Libraries.dev renderer as a separate module')
const profilePath = await mkdtemp(path.join(tempRoot, 'motion-runtime-'))

const reports = {}
const profiling = process.argv.includes('--profile')
const cpuRate = process.argv.includes('--stress') || profiling ? 4 : 1
reports.cpuRate = cpuRate
const nextFrames = (page, count = 2) => page.evaluate((count) => new Promise((resolve) => {
  const tick = () => --count <= 0 ? resolve() : requestAnimationFrame(tick)
  requestAnimationFrame(tick)
}), count)
const settle = (page) => page.evaluate(() => Promise.allSettled(document.getAnimations()
  .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity)
  .map((animation) => animation.finished)))
const samplePaints = async (page) => {
  const before = await page.evaluate(() => window.__orbPaints)
  await page.waitForTimeout(180)
  return await page.evaluate(() => window.__orbPaints) - before
}

let context
try {
  context = await chromium.launchPersistentContext(profilePath, {
    headless: false,
    viewport: { width: 1280, height: 800 },
    reducedMotion: 'no-preference',
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`]
  })
  const isCuratorWorker = (worker) => worker.url().endsWith('/service-worker-loader.js')
  const worker = context.serviceWorkers().find(isCuratorWorker) ?? await context.waitForEvent('serviceworker', { predicate: isCuratorWorker, timeout: 15_000 })
  const extensionId = new URL(worker.url()).host
  const newtab = await context.newPage()
  await newtab.setViewportSize({ width: 1280, height: 800 })
  await newtab.emulateMedia({ reducedMotion: 'no-preference' })
  await newtab.goto(`chrome-extension://${extensionId}/src/newtab/newtab.html`)
  await newtab.locator('#newtab-settings-trigger').click()
  await newtab.getByRole('tab', { name: '外观', exact: true }).click()
  const segment = newtab.locator('#icon-layout-control')
  await segment.scrollIntoViewIfNeeded()
  await settle(newtab)
  // Warm the lazy inspector and both layout branches before measuring repeated input.
  const originalSegment = await segment.locator('[aria-pressed="true"]').getAttribute('data-icon-layout-mode')
  await segment.locator(`[data-icon-layout-mode="${originalSegment === 'auto' ? 'fixed' : 'auto'}"]`).click()
  await segment.locator(`[data-icon-layout-mode="${originalSegment}"]`).click()
  await settle(newtab)
  await newtab.waitForTimeout(500)
  await newtab.mouse.move(8, 8)
  const client = await context.newCDPSession(newtab)
  await client.send('Emulation.setCPUThrottlingRate', { rate: cpuRate })
  if (profiling) {
    await client.send('Profiler.enable')
    await client.send('Profiler.start')
    await client.send('Tracing.start', { categories: 'devtools.timeline', transferMode: 'ReturnAsStream' })
  }

  reports.segments = await segment.evaluate(async (element) => {
    const buttons = [...element.querySelectorAll('button')]
    const original = buttons.findIndex((button) => button.hasAttribute('data-pressed'))
    const gaps = []
    const inputGaps = []
    const longTasks = []
    const observer = new PerformanceObserver((list) => longTasks.push(...list.getEntries().map((entry) => entry.duration)))
    observer.observe({ type: 'longtask' })
    const frame = () => new Promise((resolve) => requestAnimationFrame(resolve))
    let previous = await frame()
    let immediate = true
    for (let index = 0; index < 20; index += 1) {
      const target = (original + index + 1) % buttons.length
      buttons[target].click()
      const now = await frame()
      gaps.push(now - previous)
      inputGaps.push(now - previous)
      previous = now
      immediate &&= buttons[target].getAttribute('aria-pressed') === 'true'
      // Sample the moving pill between inputs as well as the update frame.
      // Four frames per click still exercises rapid, interrupting selection.
      for (let frameIndex = 0; frameIndex < 3; frameIndex += 1) {
        const next = await frame()
        gaps.push(next - previous)
        previous = next
      }
    }
    buttons[original].click()
    await frame()
    await Promise.allSettled(element.getAnimations({ subtree: true }).map((animation) => animation.finished))
    observer.disconnect()
    const pill = getComputedStyle(element, '::before')
    const chosen = buttons[original].getBoundingClientRect()
    const pillLeft = element.getBoundingClientRect().left + element.clientLeft + Number.parseFloat(pill.left) + new DOMMatrixReadOnly(pill.transform).m41
    gaps.sort((a, b) => a - b)
    inputGaps.sort((a, b) => a - b)
    return {
      immediate, p95GapMs: gaps[Math.ceil(gaps.length * 0.95) - 1], maxGapMs: Math.max(...gaps), longTasks,
      p95InputMs: inputGaps[Math.ceil(inputGaps.length * 0.95) - 1],
      alignmentError: Math.abs(chosen.left - pillLeft),
      widthError: Math.abs(chosen.width - Number.parseFloat(pill.width)),
      transitionProperty: pill.transitionProperty
    }
  })
  assert.equal(reports.segments.immediate, true, 'Selected semantics must update by the next frame during rapid switching')
  assert.ok(reports.segments.alignmentError < 1 && reports.segments.widthError < 1, 'Selection pill must settle exactly under the active option')
  assert.ok(!/width|height|left|top/.test(reports.segments.transitionProperty), 'Pill travel must not animate layout')
  if (profiling) {
    const { profile } = await client.send('Profiler.stop')
    await writeFile(path.join(outputPath, 'segments.cpuprofile'), JSON.stringify(profile))
    const tracingComplete = new Promise((resolve) => client.once('Tracing.tracingComplete', resolve))
    await client.send('Tracing.end')
    const { stream } = await tracingComplete
    let trace = ''
    while (true) {
      const chunk = await client.send('IO.read', { handle: stream })
      trace += chunk.data
      if (chunk.eof) break
    }
    await client.send('IO.close', { handle: stream })
    await writeFile(path.join(outputPath, 'segments-trace.json'), trace)
    console.log(`Segment profile: ${JSON.stringify(reports.segments)}`)
  } else {
    assert.ok(reports.segments.p95GapMs < 50 * cpuRate, `Selection update exceeded its CPU budget: ${JSON.stringify(reports.segments)}`)
  }

  const toggle = newtab.locator('.options-switch-control:visible').first()
  await toggle.scrollIntoViewIfNeeded()
  await settle(newtab)
  reports.switch = await toggle.evaluate(async (element) => {
    const thumb = element.firstElementChild
    const frame = () => new Promise((resolve) => requestAnimationFrame(resolve))
    const position = () => thumb.getBoundingClientRect().left - element.getBoundingClientRect().left
    const initial = element.getAttribute('aria-checked')
    const originalPosition = position()
    element.click()
    await frame()
    const immediate = element.getAttribute('aria-checked') !== initial
    let moved = position()
    for (let frames = 0; frames < 12 && Math.abs(moved - originalPosition) < 0.1; frames += 1) {
      await frame()
      moved = position()
    }
    element.click()
    await frame()
    const reversed = position()
    await Promise.allSettled(thumb.getAnimations().map((animation) => animation.finished))
    return { immediate, originalPosition, moved, reversed, finalPosition: position(),
      finalChecked: element.getAttribute('aria-checked'), initial,
      retainedAnimations: thumb.getAnimations().length, willChange: getComputedStyle(thumb).willChange }
  })
  assert.equal(reports.switch.immediate, true, 'Switch value must change immediately')
  assert.ok(Math.abs(reports.switch.moved - reports.switch.originalPosition) > 0.1, 'The switch thumb must actually travel')
  assert.ok(Math.abs(reports.switch.reversed - reports.switch.originalPosition) <= Math.abs(reports.switch.moved - reports.switch.originalPosition) + 1, 'Reversing the switch must not jump to the far end')
  assert.equal(reports.switch.finalChecked, reports.switch.initial)
  assert.ok(Math.abs(reports.switch.finalPosition - reports.switch.originalPosition) < 0.1)
  assert.equal(reports.switch.retainedAnimations, 0, 'Settled switches must release their animation')
  assert.equal(reports.switch.willChange, 'auto', 'Idle switches must not retain compositor hints')
  await client.send('Emulation.setCPUThrottlingRate', { rate: 1 })
  await newtab.screenshot({ path: path.join(outputPath, 'settings-segmented-controls.png') })

  // Unmounting closed controls must not lose settings or break their keyboard input.
  await newtab.locator('#icon-advanced-toggle').click()
  const widthSlider = newtab.getByRole('slider', { name: '书签卡片页面宽度', exact: true })
  await widthSlider.waitFor({ state: 'visible' })
  const originalWidth = Number(await widthSlider.getAttribute('aria-valuenow'))
  await widthSlider.focus()
  await widthSlider.press('ArrowRight')
  await newtab.waitForFunction((value) => document.querySelector('#icon-page-width-value')?.textContent === `${value}%`, originalWidth + 1)
  await newtab.locator('#icon-advanced-toggle').click()
  await widthSlider.waitFor({ state: 'detached' })
  await newtab.locator('#icon-advanced-toggle').click()
  await widthSlider.waitFor({ state: 'visible' })
  assert.equal(Number(await widthSlider.getAttribute('aria-valuenow')), originalWidth + 1, 'Reopened controls must retain their current setting')
  await widthSlider.focus()
  await widthSlider.press('ArrowLeft')
  await newtab.locator('#icon-advanced-toggle').click()
  await widthSlider.waitFor({ state: 'detached' })

  await newtab.emulateMedia({ reducedMotion: 'reduce' })
  const reduced = await segment.evaluate((element) => ({
    duration: getComputedStyle(element, '::before').transitionDuration,
    transform: getComputedStyle(element, '::before').transform
  }))
  assert.ok(reduced.duration.split(',').every((value) => Number.parseFloat(value) === 0), 'Reduced motion must snap the pill into its selected position')

  const popup = await context.newPage()
  await popup.bringToFront()
  await popup.emulateMedia({ reducedMotion: 'no-preference' })
  const requested = []
  popup.on('request', (request) => requested.push(request.url()))
  await popup.addInitScript(() => {
    window.__orbPaints = 0
    const clear = CanvasRenderingContext2D.prototype.clearRect
    CanvasRenderingContext2D.prototype.clearRect = function (...args) {
      if (this.canvas.hasAttribute('data-ai-thinking-orb')) window.__orbPaints += 1
      return clear.apply(this, args)
    }
  })
  await popup.setViewportSize({ width: 800, height: 600 })
  await popup.goto(`chrome-extension://${extensionId}/src/popup/popup.html`)
  await popup.locator('#search-input').waitFor()
  await popup.waitForTimeout(250)
  assert.ok(!requested.some((url) => url.endsWith(orbAsset)), 'An idle popup must not load the orb renderer')
  assert.ok(!requested.some((url) => /\/ai-runtime-[^/]+\.js$/.test(url)), 'An unconfigured popup must not load the AI runtime merely to display its settings state')

  const setStatus = (status) => worker.evaluate(async (status) => {
    await chrome.storage.local.set({ curatorBookmarkAutoAnalyzeStatus: {
      status, bookmarkId: 'motion-probe', title: 'Motion verification',
      updatedAt: Date.now(), expiresAt: Date.now() + 60_000, badgeVisible: false
    } })
  }, status)
  await setStatus('processing')
  const orb = popup.locator('canvas[data-ai-thinking-orb]')
  await orb.waitFor({ state: 'visible' })
  if (await popup.locator('#auto-analyze-status button[aria-expanded]').getAttribute('aria-expanded') === 'false') {
    await popup.locator('#auto-analyze-status button[aria-expanded]').click()
  }
  await popup.waitForFunction(() => !document.hidden && window.__orbPaints > 1)
  reports.orb = { runningPaints: await samplePaints(popup) }
  assert.ok(reports.orb.runningPaints > 1, 'An active AI task should render the Libraries.dev effect')
  await popup.screenshot({ path: path.join(outputPath, 'popup-ai-orb.png') })

  // Use the production style helpers to probe all three consumers of the sheen.
  await popup.evaluate(({ trackClass, barClass, trackStyle, barStyle }) => {
    const track = document.createElement('div')
    track.id = 'motion-progress-probe'
    track.className = trackClass
    Object.assign(track.style, { position: 'fixed', left: '20px', bottom: '20px', width: '280px' })
    for (const [key, value] of Object.entries(trackStyle)) track.style.setProperty(key, String(value))
    const bar = document.createElement('span')
    bar.className = barClass
    for (const [key, value] of Object.entries(barStyle)) {
      if (key.startsWith('--')) bar.style.setProperty(key, String(value))
      else bar.style[key] = value
    }
    track.append(bar)
    document.body.append(track)
  }, { trackClass: sheen.SHEEN_PROGRESS_TRACK_CLASS, barClass: sheen.SHEEN_PROGRESS_BAR_CLASS,
    trackStyle: sheen.getSheenProgressTrackStyle(40), barStyle: sheen.getSheenProgressBarStyle(40) })
  await nextFrames(popup)
  reports.progress = await popup.locator('#motion-progress-probe').evaluate((element) => {
    const bar = element.firstElementChild
    return {
      fraction: bar.getBoundingClientRect().width / element.getBoundingClientRect().width,
      overflow: getComputedStyle(bar).overflowX,
      keys: bar.getAnimations({ subtree: true }).filter((animation) => animation.effect?.getComputedTiming().iterations === Infinity)
        .flatMap((animation) => animation.effect.getKeyframes().flatMap((frame) => Object.keys(frame)))
    }
  })
  assert.ok(Math.abs(reports.progress.fraction - 0.4) < 0.01 && reports.progress.overflow === 'hidden', 'The sheen must remain clipped inside real progress')
  assert.ok(reports.progress.keys.includes('transform'), 'The highlight must use compositor travel')
  assert.ok(!reports.progress.keys.some((key) => /background|clip|width|filter/i.test(key)), 'A running sheen must not animate painting or layout properties')

  await popup.locator('#auto-analyze-status').evaluate((element) => { element.style.transform = 'translateY(-200vh)' })
  await popup.waitForTimeout(100)
  reports.orb.offscreenPaints = await samplePaints(popup)
  assert.equal(reports.orb.offscreenPaints, 0, 'Offscreen orbs must stop canvas drawing')
  await popup.locator('#auto-analyze-status').evaluate((element) => { element.style.transform = '' })
  await popup.emulateMedia({ reducedMotion: 'reduce' })
  await popup.waitForTimeout(100)
  reports.orb.reducedPaints = await samplePaints(popup)
  assert.equal(reports.orb.reducedPaints, 0, 'Reduced motion must render a static orb')
  assert.equal(await popup.locator('.sheen-progress-bar').evaluate((element) => getComputedStyle(element, '::after').animationName), 'none')
  await popup.emulateMedia({ reducedMotion: 'no-preference' })
  await popup.locator('#auto-analyze-status button[aria-expanded]').click()
  await popup.waitForTimeout(100)
  reports.orb.collapsedPaints = await samplePaints(popup)
  assert.equal(reports.orb.collapsedPaints, 0, 'Collapsed status must not keep drawing')
  await setStatus('completed')
  await orb.waitFor({ state: 'detached' })
  for (const [percent, active] of [[100, true], [40, false]]) {
    await popup.locator('#motion-progress-probe').evaluate((element, style) => {
      for (const [key, value] of Object.entries(style)) element.style.setProperty(key, String(value))
    }, sheen.getSheenProgressTrackStyle(percent, active))
    assert.equal(await popup.locator('.sheen-progress-bar').evaluate((element) => getComputedStyle(element, '::after').animationName), 'none', 'Completed or stopped tasks must stop the sheen')
  }
  // The real popup hides its surface permanently on backgrounding because Chrome
  // destroys the popup. Check that final lifecycle step after the interactive cases.
  await setStatus('processing')
  await orb.waitFor({ state: 'visible' })
  await popup.locator('#auto-analyze-status button[aria-expanded]').click()
  await nextFrames(popup, 3)
  await popup.locator('#motion-progress-probe').evaluate((element, style) => {
    for (const [key, value] of Object.entries(style)) element.style.setProperty(key, String(value))
  }, sheen.getSheenProgressTrackStyle(40))
  // Playwright forces background tabs to appear visible. Inject the browser's
  // visibility signal while RAF stays available: the effect itself must stop it.
  await popup.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true })
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await popup.waitForFunction(() => document.documentElement.hasAttribute('data-motion-paused'))
  reports.orb.hiddenPaints = await samplePaints(popup)
  assert.equal(reports.orb.hiddenPaints, 0, 'The hidden-page signal must stop canvas drawing')
  assert.equal(await popup.locator('.sheen-progress-bar').evaluate((element) => getComputedStyle(element, '::after').animationPlayState), 'paused')
  console.log(`Motion runtime probes: ${JSON.stringify(reports)}`)
  console.log('Motion interruption, lazy loading and activity tests passed.')
} finally {
  await writeFile(path.join(outputPath, cpuRate === 1 ? 'motion-runtime.json' : 'motion-runtime-stress.json'), JSON.stringify(reports, null, 2))
  await context?.close()
  assert.ok(path.resolve(profilePath).startsWith(`${tempRoot}${path.sep}`), 'Only remove the disposable profile inside the workspace temp directory')
  await rm(profilePath, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
}
