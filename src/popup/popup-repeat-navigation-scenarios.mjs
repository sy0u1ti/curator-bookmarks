import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'

const percentile = (values, fraction) => [...values].sort((a, b) => a - b)[Math.floor((values.length - 1) * fraction)] || 0
const capturingPages = new WeakSet()

export async function preparePopupRepeatPage(page, url, width = 800, height = 600) {
  await page.goto(url)
  await page.cdp('Page.bringToFront')
  await page.cdp('Emulation.setFocusEmulationEnabled', { enabled: true })
  await page.cdp('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
  await page.cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] })
  // Capture keeps an occluded desktop tab rendering. Without it Chromium can
  // throttle this 100ms interaction to 1Hz even with focus emulation enabled.
  if (capturingPages.has(page)) await page.cdp('Page.stopScreencast')
  await page.cdp('Page.startScreencast', { format: 'jpeg', quality: 20, maxWidth: 400, maxHeight: 300, everyNthFrame: 1 })
  capturingPages.add(page)
  await page.waitForSelector('.t-skel-content .popup-active-result-indicator[data-visible="true"]')
}

export async function measurePopupRepeat(page, { pane = 'bookmarks', direction = 1, start = 0, keys = 60, interval = 1000 / 30, turnAt = -1 } = {}) {
  await page.evaluate(({ pane, start }) => {
    window.__repeat.select(start, pane)
  }, { pane, start })
  await page.waitForFunction(() => {
    const indicator = document.querySelector('.t-skel-content .popup-active-result-indicator')
    return indicator.dataset.visible === 'true' && !indicator.getAnimations().some(animation => animation.playState === 'running')
  }, undefined, { timeout: 5000 })
  const raw = await page.evaluate(({ pane, direction, keys, interval, turnAt }) => new Promise(resolve => {
    const selector = pane === 'folders' ? '.t-skel-content .popup-folder-tree' : '.t-skel-content .popup-main-list'
    const viewport = document.querySelector(selector)
    const root = document.querySelector('#popup-app-shell')
    const getRect = Element.prototype.getBoundingClientRect
    let rectReads = 0
    Element.prototype.getBoundingClientRect = function (...args) {
      if (root.contains(this) && !this.closest('.t-skel-skeleton')) rectReads++
      return getRect.apply(this, args)
    }
    let mounts = 0, removals = 0
    const isRow = node => node instanceof Element && node.matches('[data-bookmark-id], [data-folder-row-id]')
    const observer = new MutationObserver(records => {
      for (const record of records) {
        mounts += [...record.addedNodes].filter(isRow).length
        removals += [...record.removedNodes].filter(isRow).length
      }
    })
    observer.observe(viewport, { childList: true })
    const commits = window.__commits
    window.__repeat.resetReads()
    const samples = []
    const began = performance.now()
    let sent = 0, previous = viewport.scrollTop, changedAt = began
    const send = () => {
      const target = document.activeElement || document
      const step = turnAt >= 0 && sent >= turnAt ? -direction : direction
      target.dispatchEvent(new KeyboardEvent('keydown', {
        key: step > 0 ? 'ArrowDown' : 'ArrowUp',
        code: step > 0 ? 'ArrowDown' : 'ArrowUp',
        repeat: sent > 0 && sent !== turnAt, bubbles: true, cancelable: true
      }))
      if (++sent === keys) clearInterval(timer)
    }
    const timer = setInterval(send, interval)
    let finished = false
    const finish = () => {
      if (finished) return
      finished = true
      clearInterval(timer)
      observer.disconnect()
      Element.prototype.getBoundingClientRect = getRect
      const indicator = document.querySelector('.t-skel-content .popup-active-result-indicator')
      const target = document.querySelector(pane === 'folders'
        ? '.t-skel-content .popup-folder-tree [aria-selected="true"]'
        : '.t-skel-content .popup-main-row[data-active="true"] .popup-list-button')
      const bounds = node => {
        if (!node) return null
        const r = node.getBoundingClientRect()
        return { top: r.top, bottom: r.bottom, left: r.left, width: r.width }
      }
      resolve({
        samples, sent, rectReads, mounts, removals, rowReads: window.__repeat.reads(),
        commits: window.__commits - commits, state: window.__repeat.state(),
        indicator: bounds(indicator), target: bounds(target), viewport: bounds(viewport),
        visible: indicator.dataset.visible, scrollTop: viewport.scrollTop,
        rows: viewport.querySelectorAll('[data-bookmark-id], [data-folder-row-id]').length,
        errors: window.__errors
      })
    }
    const tick = () => {
      if (finished) return
      const now = performance.now(), top = viewport.scrollTop
      samples.push({ time: now - began, top })
      if (top !== previous) { changedAt = now; previous = top }
      if ((sent === keys && now - changedAt >= 250 && now - began > keys * interval + 250) || now - began > 8000) finish()
      else requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }), { pane, direction, keys, interval, turnAt })
  const gaps = raw.samples.slice(1).map((sample, i) => sample.time - raw.samples[i].time)
  const steps = raw.samples.slice(1).map((sample, i) => Math.abs(sample.top - raw.samples[i].top)).filter(value => value > 0.01)
  return {
    ...raw,
    frameP95: percentile(gaps, 0.95),
    frameMax: Math.max(...gaps),
    scrollStepP95: percentile(steps, 0.95),
    scrollChanges: steps.length
  }
}

function assertSettled(report, pane, expectedIndex) {
  assert.deepEqual(report.errors, [])
  assert.equal(report.sent, 60)
  assert.equal(report.state.index, expectedIndex)
  assert.equal(report.state.pane, pane)
  assert.equal(report.visible, 'true')
  assert.ok(report.target && report.indicator)
  assert.ok(Math.abs(report.indicator.top - report.target.top) <= 1, 'Selection and scroll must settle on the same row')
  assert.ok(report.target.top >= report.viewport.top - 1 && report.target.bottom <= report.viewport.bottom + 1)
  assert.ok(report.rows < 50, 'The DOM size must not grow with the catalog')
}

export async function runPopupRepeatChecks(page, origin, directory) {
  const report = { checks: [], edges: [], errors: [] }
  try {
    for (const width of [800, 390]) {
      await preparePopupRepeatPage(page, `${origin}/?surface=${width === 390 ? 'sidepanel' : 'popup'}`, width, width === 390 ? 720 : 600)
      for (const pane of ['bookmarks', 'folders']) {
        for (const direction of [1, -1]) {
          const result = await measurePopupRepeat(page, { pane, direction, start: direction > 0 ? 0 : 60 })
          assertSettled(result, pane, direction > 0 ? 60 : 0)
          const pitch = pane === 'folders' ? 34 : 60
          assert.ok(result.frameP95 < 100, 'The test tab must not be background-throttled')
          assert.ok(result.scrollStepP95 < pitch * 0.9, 'Repeat scroll must interpolate between whole-row steps')
          assert.ok(result.scrollChanges > 60, 'Continuous scrolling must paint between key-repeat events')
          report.checks.push({ width, pane, direction, ...result })
          await writeFile(`${directory}/report.json`, JSON.stringify(report, null, 2))
        }
      }
    }
    report.edges = await runPopupRepeatEdgeChecks(page, origin)
    await writeFile(`${directory}/report.json`, JSON.stringify(report, null, 2))
    await page.screenshot({ path: `${directory}/popup-repeat-verified.png` })
    return {
      cases: report.checks.length, edgeCases: report.edges.length,
      maxFrameP95: Math.max(...report.checks.map(result => result.frameP95)),
      report: `${directory}/report.json`
    }
  } finally {
    await page.cdp('Page.stopScreencast')
    capturingPages.delete(page)
  }
}

export async function runPopupRepeatEdgeChecks(page, origin) {
  const checks = []
  await preparePopupRepeatPage(page, origin)
  const settled = () => page.waitForFunction(() => {
    const indicator = document.querySelector('.t-skel-content .popup-active-result-indicator')
    return indicator?.dataset.visible === 'true' && !indicator.getAnimations().some(animation => animation.playState === 'running')
  }, undefined, { timeout: 5000 })
  await page.focus('.t-skel-content [data-bookmark-id="bookmark-0"] .popup-list-button')
  await page.evaluate(() => {
    const indicator = document.querySelector('.t-skel-content .popup-active-result-indicator')
    window.__tap = null
    const observer = new MutationObserver(() => {
      getComputedStyle(indicator).transform
      const motion = indicator.getAnimations().find(animation => animation.transitionProperty === 'transform')
      if (!motion) return
      window.__tap = { duration: motion.effect.getTiming().duration, easing: getComputedStyle(indicator).transitionTimingFunction }
      observer.disconnect()
    })
    observer.observe(indicator, { attributes: true, attributeFilter: ['style'] })
  })
  await page.keyboard.press('ArrowDown')
  await page.waitForFunction(() => Boolean(window.__tap), undefined, { timeout: 5000 })
  const tap = await page.evaluate(() => ({ ...window.__tap, action: window.__repeat.state().lastAction }))
  assert.equal(tap.duration, 100)
  assert.ok(tap.easing.includes('cubic-bezier(0.22, 1, 0.36, 1)'))
  assert.equal(tap.action.repeat, false)
  checks.push({ name: 'original-key-tap', ...tap })
  await settled()

  await page.evaluate(() => window.__repeat.select(60, 'bookmarks'))
  await settled()
  const beforeEdge = await page.evaluate(() => {
    const indicator = document.querySelector('.t-skel-content .popup-active-result-indicator')
    return { y: indicator.getBoundingClientRect().top, translate: indicator.style.translate }
  })
  await page.keyboard.press('ArrowDown')
  await page.waitForFunction(() => window.__repeat.state().index === 61)
  await settled()
  const afterEdge = await page.evaluate(() => {
    const indicator = document.querySelector('.t-skel-content .popup-active-result-indicator')
    return { y: indicator.getBoundingClientRect().top, translate: indicator.style.translate }
  })
  assert.ok(Math.abs(beforeEdge.y - afterEdge.y) <= 1)
  assert.equal(beforeEdge.translate, afterEdge.translate, 'A discrete edge reveal must not kick the highlight up a row')
  checks.push({ name: 'tap-at-scroll-edge', beforeEdge, afterEdge })

  const reverse = await measurePopupRepeat(page, { start: 20, keys: 40, turnAt: 20 })
  assert.equal(reverse.state.index, 20)
  assert.equal(reverse.visible, 'true')
  assert.ok(Math.abs(reverse.indicator.top - reverse.target.top) <= 1)
  checks.push({ name: 'reverse-while-held', ...reverse })

  await page.evaluate(() => window.__repeat.select(60, 'bookmarks'))
  await settled()
  await page.evaluate(() => {
    const native = Element.prototype.scrollTo
    const viewport = document.querySelector('.t-skel-content .popup-main-list')
    window.__wheel = { writes: 0, afterWheel: 0, seen: false, began: 0 }
    Element.prototype.scrollTo = function (...args) {
      if (this === viewport) {
        window.__wheel.writes++
        if (window.__wheel.seen) window.__wheel.afterWheel++
      }
      return native.apply(this, args)
    }
    window.__restoreScrollTo = () => { Element.prototype.scrollTo = native }
    document.addEventListener('wheel', () => {
      window.__wheel.seen = true
      window.__wheel.began = performance.now()
    }, { capture: true, once: true })
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', repeat: true, bubbles: true, cancelable: true }))
  })
  try {
    await page.waitForFunction(() => window.__wheel.writes > 0)
    const point = await page.evaluate(() => {
      const r = document.querySelector('.t-skel-content .popup-main-list').getBoundingClientRect()
      return { x: r.left + 2, y: r.top + 24 }
    })
    await page.mouse.move(point.x, point.y, { label: 'take over list scrolling' })
    await page.mouse.wheel(0, -160, { label: 'interrupt held key scrolling' })
    await page.waitForFunction(() => window.__wheel.seen && performance.now() - window.__wheel.began > 200)
    const wheel = await page.evaluate(() => window.__wheel)
    assert.equal(wheel.afterWheel, 0, 'Wheel takeover cancels all delayed programmatic scroll writes')
    checks.push({ name: 'native-wheel-takeover', ...wheel })
  } finally {
    await page.evaluate(() => window.__restoreScrollTo())
  }

  await page.cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
  const reduced = await measurePopupRepeat(page, { start: 60, keys: 8 })
  assert.equal(reduced.state.index, 68)
  assert.ok(reduced.scrollChanges <= 8)
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.t-skel-content .popup-active-result-indicator')).transitionProperty), 'none')
  checks.push({ name: 'reduced-motion', ...reduced })
  await page.cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] })

  await page.evaluate(() => window.__repeat.select(9999, 'bookmarks'))
  await settled()
  const distant = await page.evaluate(() => ({
    last: Boolean(document.querySelector('.t-skel-content [data-bookmark-id="bookmark-9999"][data-active="true"]')),
    rows: document.querySelectorAll('.t-skel-content [data-bookmark-id]').length
  }))
  assert.equal(distant.last, true)
  assert.ok(distant.rows < 50)
  checks.push({ name: 'distant-selection', ...distant })
  await page.evaluate(() => window.__repeat.reset(13))
  await settled()
  const shrunk = await page.evaluate(() => ({
    rows: document.querySelectorAll('.t-skel-content [data-bookmark-id]').length,
    top: document.querySelector('.t-skel-content .popup-main-list').scrollTop
  }))
  assert.equal(shrunk.rows, 13)
  assert.equal(shrunk.top, 0)
  checks.push({ name: 'data-shrink', ...shrunk })

  await page.evaluate(() => window.__repeat.select(3, 'bookmarks'))
  await settled()
  const nativeTrack = await page.evaluate(() => new Promise(resolve => {
    const indicator = document.querySelector('.t-skel-content .popup-active-result-indicator')
    const viewport = document.querySelector('.t-skel-content .popup-main-list')
    const transform = indicator.style.transform
    const from = indicator.getBoundingClientRect().top
    const commits = window.__commits
    const deadline = performance.now() + 1500
    viewport.scrollTop = 16
    const sample = () => {
      const aligned = Math.abs(indicator.getBoundingClientRect().top - from + 16) <= 1
      if (!aligned && performance.now() < deadline) return requestAnimationFrame(sample)
      resolve({ aligned, sameTransform: transform === indicator.style.transform, commits: window.__commits - commits })
    }
    requestAnimationFrame(sample)
  }))
  assert.equal(nativeTrack.sameTransform, true)
  assert.equal(nativeTrack.aligned, true)
  assert.equal(nativeTrack.commits, 0)
  checks.push({ name: 'native-scroll-no-retarget', ...nativeTrack })
  await page.focus('.t-skel-content [data-bookmark-id="bookmark-3"] .popup-list-button')
  await page.keyboard.press('Tab')
  const focused = await page.evaluate(() => document.activeElement.getAttribute('aria-label'))
  assert.equal(focused, 'edit bookmark-3')
  checks.push({ name: 'keyboard-actions-available', focused })
  assert.deepEqual(await page.evaluate(() => window.__errors), [])
  return checks
}
