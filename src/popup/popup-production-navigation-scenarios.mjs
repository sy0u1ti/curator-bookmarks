import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'

async function keepProductionFrames(page, everyNthFrame) {
  await page.cdp('Page.stopScreencast')
  await page.cdp('Page.startScreencast', { format: 'jpeg', quality: 10, maxWidth: 160, maxHeight: 120, everyNthFrame })
}

export async function prepareProductionNavigation(page, origin, {
  count = 10000, width = 800, height = 600, surface = 'popup', isolated = false
} = {}) {
  await page.cdp('Emulation.setFocusEmulationEnabled', { enabled: true })
  await page.cdp('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
  await page.cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] })
  // Short motion checks need every frame: sparse capture can let an occluded
  // Chromium window fall to 1Hz even though selection commits within 1-5ms.
  await keepProductionFrames(page, 1)
  const url = `${origin}/?count=${count}&surface=${surface}`
  // Extension documents do not receive other extensions' ordinary content
  // scripts. An opaque top-level fixture reproduces that isolation without
  // disabling anything in the user's browser profile.
  if (isolated) await loadIsolatedProductionDocument(page, url, origin, surface)
  else await page.goto(url)
  await page.waitForFunction(() => window.__productionNavigation && !window.__productionNavigation.read().loading &&
    !window.__productionNavigation.read().metadataPending, undefined, { timeout: 20000 })
}

async function loadIsolatedProductionDocument(page, url, origin, surface) {
  const [html, css, io, script, icon] = await Promise.all([
    fetch(url).then(response => response.text()),
    fetch(`${origin}/${surface}.css`).then(response => response.text()),
    fetch(`${origin}/io.js`).then(response => response.text()),
    fetch(`${origin}/popup-production-navigation.fixture.js`).then(response => response.text()),
    fetch(`${origin}/src/assets/icon128.png`).then(response => response.arrayBuffer())
  ])
  const image = `data:image/png;base64,${Buffer.from(icon).toString('base64')}`
  const inlineScript = `window.__curatorFixtureIcon=${JSON.stringify(image)};\n{${io}}\n${script}`
    .replaceAll('../assets/icon128.png', image).replaceAll('</script', '<\\/script')
  const document = html.replace(/<link rel="stylesheet" href="\/(?:popup|sidepanel)\.css">/,
    () => `<style>${css.replaceAll('</style', '<\\/style')}</style>`)
    .replace(/<script type="module">import '\/io.js';import '\/popup-production-navigation.fixture.js';<\/script>/,
      () => `<script type="module">${inlineScript}\n//# sourceURL=${origin}/popup-production-navigation.fixture.js</script>`)
  // Embed owned local assets rather than weakening loopback/CORS protections.
  await page.goto(`data:text/html;charset=utf-8,<title>Curator isolated navigation</title><meta name="fixture-run" content="${Date.now()}">`)
  const { frameTree } = await page.cdp('Page.getFrameTree')
  await page.cdp('Page.setDocumentContent', { frameId: frameTree.frame.id, html: document })
}

export async function measureProductionHold(page, {
  pane = 'bookmarks', start = 100, direction = 1, durationMs = 30000, hz = 30, sampleEdges = true
} = {}) {
  // Use a lighter capture during the long throughput sample. Its rAF timing
  // remains diagnostic; occlusion gaps are not compositor frame-drop proof.
  await keepProductionFrames(page, 4)
  await page.evaluate(({ pane, start }) => {
    document.activeElement?.blur?.()
    window.__productionNavigation.select(start, pane)
  }, { pane, start })
  await page.keyboard.press(direction > 0 ? 'ArrowDown' : 'ArrowUp')
  await page.waitForSelector('.t-skel-content .popup-active-result-indicator[data-visible="true"]')
  await page.waitForFunction(() => !document.querySelector('.t-skel-content .popup-active-result-indicator').getAnimations().some(a => a.playState === 'running'))
  await page.evaluate(({ pane, direction, durationMs, hz, sampleEdges }) => {
    const viewport = document.querySelector(pane === 'folders' ? '.t-skel-content .popup-folder-tree' : '.t-skel-content .popup-main-list')
    const key = direction > 0 ? 'ArrowDown' : 'ArrowUp'
    const began = performance.now()
    performance.mark('curator.hold.begin')
    const initial = window.__productionNavigation.read()
    const initialCommits = window.__commits
    let lastInput = began
    let sent = 0
    let nativeScrollEvents = 0
    let stopped = false
    const frames = [], inputs = [], edges = [], longTasks = []
    let lastEdge = began
    let frame = 0
    const observer = new PerformanceObserver(list => {
      longTasks.push(...list.getEntries().map(entry => ({ start: entry.startTime - began, duration: entry.duration })))
    })
    observer.observe({ type: 'longtask', buffered: false })
    const onScroll = () => { nativeScrollEvents++ }
    viewport.addEventListener('scroll', onScroll, { passive: true })
    const finish = () => {
      if (stopped) return
      stopped = true
      clearInterval(timer)
      performance.mark('curator.hold.end')
      document.dispatchEvent(new KeyboardEvent('keyup', { key, code: key, bubbles: true }))
      requestAnimationFrame(() => requestAnimationFrame(() => {
        cancelAnimationFrame(frame)
        observer.disconnect()
        viewport.removeEventListener('scroll', onScroll)
        window.removeEventListener('blur', finish)
        window.__productionHold = {
          done: true, elapsed: performance.now() - began, initial, final: window.__productionNavigation.read(), frames, inputs, edges,
          lastInput: lastInput - began, sent, nativeScrollEvents, commits: window.__commits - initialCommits,
          longTasks, errors: window.__errors,
          renderedRows: viewport.querySelectorAll('[data-bookmark-id], [data-folder-row-id]').length
        }
      }))
    }
    const timer = setInterval(() => {
      const now = performance.now()
      if (now - began >= durationMs) { finish(); return }
      const target = document.activeElement || document
      const before = performance.now()
      target.dispatchEvent(new KeyboardEvent('keydown', { key, code: key, repeat: true, bubbles: true, cancelable: true }))
      inputs.push({ at: before - began, duration: performance.now() - before })
      sent++
      lastInput = now
    }, 1000 / hz)
    window.addEventListener('blur', finish)
    const sample = time => {
      frames.push(time - began)
      if (sampleEdges && !stopped && time - lastEdge >= 500) {
        lastEdge = time
        const indicator = document.querySelector('.t-skel-content .popup-active-result-indicator')
        const r = indicator.getBoundingClientRect(), v = viewport.getBoundingClientRect()
        edges.push({ at: time - began, top: r.top - v.top, bottom: v.bottom - r.bottom, scrollTop: viewport.scrollTop })
      }
      frame = requestAnimationFrame(sample)
    }
    window.__productionHold = { done: false }
    frame = requestAnimationFrame(sample)
  }, { pane, direction, durationMs, hz, sampleEdges })
  // This is a timed benchmark, not a UI readiness wait. Repeated DevTools
  // evaluations during the sample themselves interrupt the renderer.
  await new Promise(resolve => setTimeout(resolve, durationMs + 100))
  await page.waitForFunction(() => window.__productionHold.done, undefined, { timeout: 15000 })
  const result = await page.evaluate(() => window.__productionHold)
  await page.waitForFunction(pane => {
    const viewport = document.querySelector(pane === 'folders' ? '.t-skel-content .popup-folder-tree' : '.t-skel-content .popup-main-list')
    return !viewport.querySelector('.popup-row-layer').getAnimations().some(animation => animation.playState === 'running')
  }, pane)
  result.finalEdge = await page.evaluate(pane => {
    const viewport = document.querySelector(pane === 'folders' ? '.t-skel-content .popup-folder-tree' : '.t-skel-content .popup-main-list')
    const v = viewport.getBoundingClientRect(), r = document.querySelector('.t-skel-content .popup-active-result-indicator').getBoundingClientRect()
    const row = viewport.querySelector(pane === 'folders' ? '[aria-selected="true"]' : '.popup-list-button[data-active="true"]').getBoundingClientRect()
    return { top: r.top - v.top, bottom: v.bottom - r.bottom, rowTop: row.top - v.top, rowBottom: v.bottom - row.bottom }
  }, pane)
  const gaps = result.frames.slice(1).map((time, index) => ({
    at: time, gap: time - result.frames[index]
  })).filter(sample => sample.at >= 1000 && sample.at <= result.lastInput)
  const sorted = gaps.map(sample => sample.gap).sort((a, b) => a - b)
  const percentile = ratio => sorted[Math.floor((sorted.length - 1) * ratio)] || 0
  const budget = percentile(0.25)
  assert.equal(result.final.index, result.initial.index + direction * result.sent, 'Production navigation must not lose key repeats')
  assert.ok(Math.abs((direction > 0 ? result.finalEdge.bottom : result.finalEdge.top) - 8) <= 1,
    'The last highlighted row must stay at the held directional edge')
  assert.ok(Math.abs((direction > 0 ? result.finalEdge.rowBottom : result.finalEdge.rowTop) - 8) <= 1,
    'The selected bookmark/folder itself must settle under the edge highlight')
  assert.deepEqual(result.errors, [])
  assert.ok(result.elapsed >= durationMs - 100, 'The foreground stress run must not stop early')
  assert.ok(result.commits <= result.sent * 1.1 + 5, 'Navigation must not enqueue redundant React commits')
  assert.ok(result.nativeScrollEvents < result.sent * 0.75 + 4,
    'Long-list native scroll synchronization must be batched without skipping visual steps')
  return {
    ...result, frameMedian: percentile(0.5), frameP95: percentile(0.95), frameP99: percentile(0.99),
    frameMax: Math.max(...sorted), frameBudget: budget,
    missedFrames: gaps.filter(sample => sample.gap > budget * 1.75),
    longGaps: gaps.filter(sample => sample.gap > 16.8)
  }
}

export async function saveProductionMeasurement(path, measurement) {
  await writeFile(path, JSON.stringify(measurement, null, 2))
}

export async function centerProductionSelection(page, pane, index = 100) {
  await keepProductionFrames(page, 1)
  await page.evaluate(({ pane, index }) => {
    document.activeElement?.blur?.()
    window.__productionNavigation.select(index, pane)
  }, { pane, index })
  await page.keyboard.press('ArrowDown')
  await page.waitForSelector('.t-skel-content .popup-active-result-indicator[data-visible="true"]')
  // First assert that cold navigation revealed its row, then arrange a
  // centered starting pose after the side-panel disclosure finishes. Centering
  // against an intermediate viewport is not a stable test precondition.
  await page.waitForFunction(() => !document.querySelector('.t-skel-content .popup-workspace').getAnimations()
    .some(animation => animation.playState === 'running'))
  await page.evaluate(pane => {
    const viewport = document.querySelector(pane === 'folders' ? '.t-skel-content .popup-folder-tree' : '.t-skel-content .popup-main-list')
    const active = viewport.querySelector(pane === 'folders' ? '[aria-selected="true"]' : '.popup-list-button[data-active="true"]')
    const v = viewport.getBoundingClientRect(), a = active.getBoundingClientRect()
    viewport.scrollTo({ top: viewport.scrollTop + a.top - v.top - (v.height - a.height) / 2, behavior: 'instant' })
  }, pane)
  await page.waitForFunction(pane => {
    const viewport = document.querySelector(pane === 'folders' ? '.t-skel-content .popup-folder-tree' : '.t-skel-content .popup-main-list')
    const indicator = document.querySelector('.t-skel-content .popup-active-result-indicator')
    const r = indicator.getBoundingClientRect(), v = viewport.getBoundingClientRect()
    return Math.abs((r.top + r.bottom) / 2 - (v.top + v.bottom) / 2) <= 1 &&
      !indicator.getAnimations().some(a => a.playState === 'running')
  }, pane)
}

// Geometry reads belong to this short motion-correctness check, not the
// separate throughput benchmark. Record the journey, not just its endpoint.
export async function captureProductionMotion(page, {
  pane = 'bookmarks', durationMs = 300, events = [{ at: 0, key: 'ArrowDown', repeat: false }]
} = {}) {
  await keepProductionFrames(page, 1)
  return page.evaluate(({ pane, durationMs, events }) => new Promise(resolve => {
    const viewport = document.querySelector(pane === 'folders' ? '.t-skel-content .popup-folder-tree' : '.t-skel-content .popup-main-list')
    const indicator = document.querySelector('.t-skel-content .popup-active-result-indicator')
    const samples = [], inputs = [], mutations = [], longTasks = []
    const pitch = viewport.querySelector('[data-popup-row-index]').getBoundingClientRect().height
    const began = performance.now()
    const observer = new MutationObserver(() => mutations.push(performance.now() - began))
    observer.observe(indicator, { attributes: true })
    const tasks = new PerformanceObserver(list => longTasks.push(...list.getEntries().map(entry =>
      ({ at: entry.startTime - began, duration: entry.duration }))))
    tasks.observe({ type: 'longtask', buffered: false })
    const sample = () => {
      const v = viewport.getBoundingClientRect(), r = indicator.getBoundingClientRect()
      const layer = viewport.querySelector('.popup-row-layer').getBoundingClientRect()
      const firstIndex = Number(viewport.querySelector('[data-popup-row-index]').dataset.popupRowIndex)
      const targetTop = new DOMMatrixReadOnly(indicator.style.transform || 'none').m42 +
        Number.parseFloat(indicator.style.translate.split(/\s+/)[1] || '0') +
        indicator.offsetParent.getBoundingClientRect().top - v.top
      samples.push({
        at: performance.now() - began, index: window.__productionNavigation.read().index,
        top: r.top - v.top, targetTop, bottom: v.bottom - r.bottom, visible: indicator.dataset.visible === 'true',
        scroll: viewport.scrollTop, visualScroll: firstIndex * pitch - (layer.top - v.top), pitch,
        viewportHeight: v.height, layerTop: layer.top - v.top, layerBottom: layer.bottom - v.top
      })
    }
    const dispatch = event => {
      const before = window.__productionNavigation.read().index
      const at = performance.now() - began
      document.dispatchEvent(new KeyboardEvent('keydown', {
        key: event.key, code: event.key, repeat: Boolean(event.repeat), bubbles: true, cancelable: true
      }))
      inputs.push({ ...event, at, duration: performance.now() - began - at,
        before, immediate: window.__productionNavigation.read().index })
    }
    sample()
    const timers = events.map(event => event.at <= 0 ? dispatch(event) : setTimeout(() => dispatch(event), event.at))
    const frame = () => {
      sample()
      if (performance.now() - began < durationMs) { requestAnimationFrame(frame); return }
      timers.forEach(clearTimeout)
      observer.disconnect()
      tasks.disconnect()
      for (const key of ['ArrowUp', 'ArrowDown']) {
        document.dispatchEvent(new KeyboardEvent('keyup', { key, code: key, bubbles: true }))
      }
      const report = { samples, inputs, mutations, longTasks, errors: window.__errors }
      window.__lastProductionMotion = report
      resolve(report)
    }
    requestAnimationFrame(frame)
  }), { pane, durationMs, events })
}

function assertContinuousMotion(report, label) {
  assert.deepEqual(report.errors, [], label)
  assert.ok(report.samples.every(sample => sample.visible), `${label}: the moving highlight must never disappear`)
  const low = Math.min(...report.samples.map(sample => sample.top)), high = Math.max(...report.samples.map(sample => sample.top))
  assert.ok(high - low > 4, `${label}: the selection must travel`)
  assert.ok(report.samples.filter(sample => Math.abs(sample.top - sample.targetTop) > 1 &&
    sample.top > low + 1 && sample.top < high - 1).length >= 2,
    `${label}: verify intermediate positions, not an instant jump to the endpoint`)
  assert.ok(report.samples.every(sample => sample.layerTop <= 9 && sample.layerBottom >= sample.viewportHeight - 9),
    `${label}: virtualization must paint the entire journey, including reversal`)
}

function assertHeldRowsAnimate(report, label) {
  const lastInput = report.inputs.at(-1).at
  const steady = report.samples.filter(sample => sample.at >= 140 && sample.at <= lastInput + 30)
  const phases = new Set(steady.map(sample =>
    ((sample.visualScroll % sample.pitch + sample.pitch) % sample.pitch).toFixed(1)))
  assert.ok(phases.size >= 4, `${label}: rows must interpolate between keys, not merely jump under a moving highlight`)
}

export async function runProductionNavigationChecks(page, origin, directory, { durationMs = 10000, isolated = false } = {}) {
  const report = []
  for (const viewport of [
    { width: 800, height: 600, surface: 'popup', direction: 1 },
    { width: 390, height: 844, surface: 'sidepanel', direction: -1 }
  ]) {
    await prepareProductionNavigation(page, origin, { ...viewport, isolated })
    try {
      for (const pane of ['bookmarks', 'folders']) {
        const label = `${viewport.surface}-${pane}`
        await centerProductionSelection(page, pane)
        const tap = await captureProductionMotion(page, { pane, durationMs: 240 })
        assertContinuousMotion(tap, `${label} tap`)
        assert.equal(tap.inputs[0].immediate, tap.inputs[0].before + 1, 'A tap commits selection in the input turn')

        await centerProductionSelection(page, pane)
        const rapid = await captureProductionMotion(page, { pane, durationMs: 300, events: [
          { at: 0, key: 'ArrowDown' }, { at: 35, key: 'ArrowDown' }, { at: 70, key: 'ArrowUp' }
        ] })
        assertContinuousMotion(rapid, `${label} rapid taps`)
        for (const input of rapid.inputs) assert.equal(input.immediate, input.before + (input.key === 'ArrowDown' ? 1 : -1))

        await centerProductionSelection(page, pane)
        const repeats = key => Array.from({ length: 8 }, (_, index) => ({ at: index * 33, key, repeat: true }))
        const dock = await captureProductionMotion(page, { pane, durationMs: 410, events: repeats('ArrowDown') })
        assertContinuousMotion(dock, `${label} dock`)
        assertHeldRowsAnimate(dock, `${label} dock`)
        assert.ok(Math.abs(dock.samples.at(-1).bottom - 8) <= 1, 'Downward holds settle at the bottom edge')
        const reverse = await captureProductionMotion(page, { pane, durationMs: 410, events: repeats('ArrowUp') })
        assertContinuousMotion(reverse, `${label} reversal`)
        // Reversing from the bottom edge first glides through the visible rows.
        // Only a hold long enough to reach the top edge scrolls the list.
        const reverseStart = reverse.samples[0]
        const glideTop = reverseStart.top - 8 * reverseStart.pitch
        if (glideTop < 8) {
          assertHeldRowsAnimate(reverse, `${label} reversal`)
          assert.ok(Math.abs(reverse.samples.at(-1).top - 8) <= 1, 'Upward holds settle at the top edge')
        } else {
          assert.ok(Math.abs(reverse.samples.at(-1).top - glideTop) <= 1, `${label}: a reversal glides row by row`)
          assert.ok(reverse.samples.every(sample => Math.abs(sample.visualScroll - reverseStart.visualScroll) <= 1),
            `${label}: rows stay put while the highlight is still inside the viewport`)
        }

        await centerProductionSelection(page, pane)
        const interrupted = await captureProductionMotion(page, { pane, durationMs: 320, events: [
          { at: 0, key: 'ArrowDown', repeat: true }, { at: 45, key: 'ArrowUp', repeat: true },
          { at: 80, key: 'ArrowDown', repeat: true }, { at: 115, key: 'ArrowUp', repeat: true }
        ] })
        assertContinuousMotion(interrupted, `${label} interrupted hold`)
        // A short hold glides through visible rows; it must not jump to an
        // edge. Two steps down and two up return the highlight to its row.
        const startTop = interrupted.samples[0].top, pitch = interrupted.samples[0].pitch
        assert.ok(Math.abs(interrupted.samples.at(-1).top - startTop) <= 1,
          `${label}: a balanced short hold returns to its starting row`)
        assert.ok(interrupted.samples.every(sample => Math.abs(sample.top - startTop) <= pitch + 1),
          `${label}: a short hold must not jump toward either edge`)

        await centerProductionSelection(page, pane)
        await page.cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
        const reduced = await captureProductionMotion(page, { pane, durationMs: 100 })
        const from = reduced.samples[0].top, to = reduced.samples.at(-1).top
        assert.ok(reduced.samples.every(sample => Math.abs(sample.top - from) <= 1 || Math.abs(sample.top - to) <= 1),
          'Reduced motion must not interpolate spatial changes')
        assert.equal(reduced.inputs[0].immediate, reduced.inputs[0].before + 1)
        await page.cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] })

        const hold = await measureProductionHold(page, {
          pane, durationMs, direction: viewport.direction, start: viewport.direction > 0 ? 100 : 5000, sampleEdges: false
        })
        assert.ok(hold.renderedRows <= 100, '10,000 records must not create an unbounded DOM')
        const item = { label, tap, rapid, dock, reverse, interrupted, reduced, hold }
        await writeFile(`${directory}/${label}.json`, JSON.stringify(item, null, 2))
        const summary = {
          label, tapCommitMs: tap.mutations[0] - tap.inputs[0].at,
          inputs: hold.sent, commits: hold.commits, nativeScrollEvents: hold.nativeScrollEvents, rows: hold.renderedRows,
          frameMedian: hold.frameMedian, frameP95: hold.frameP95, frameP99: hold.frameP99,
          frameMax: hold.frameMax, longTasks: hold.longTasks, missedFrameSamples: hold.missedFrames.length
        }
        report.push(summary)
        console.log(summary)
      }

      await checkProductionTakeover(page)
      if (viewport.surface === 'sidepanel') await checkProductionFolderDisclosure(page)
      await checkProductionActivation(page)
      await page.screenshot({ path: `${directory}/${viewport.surface}.png` })
    } finally {
      await page.cdp('Page.stopScreencast')
    }
  }
  await writeFile(`${directory}/report.json`, JSON.stringify(report, null, 2))
  return report
}

async function checkProductionFolderDisclosure(page) {
  await centerProductionSelection(page, 'folders', 100)
  await page.click('[aria-controls="sidepanel-folder-tree"]', { label: 'collapse folder pane' })
  await page.waitForSelector('#sidepanel-folder-tree', { state: 'hidden' })
  await page.focus('.t-skel-content input[placeholder="筛选文件夹"]')
  await page.keyboard.press('ArrowDown')
  await page.waitForSelector('#sidepanel-folder-tree', { state: 'visible' })
  assert.equal(await page.evaluate(() =>
    document.querySelector('[aria-controls="sidepanel-folder-tree"]').getAttribute('aria-expanded')
  ), 'true', 'Keyboard navigation must reopen a collapsed folder viewport')
}

async function checkProductionTakeover(page) {
  await centerProductionSelection(page, 'bookmarks', 200)
  const point = await page.evaluate(() => {
    const r = document.querySelector('.t-skel-content .popup-main-list').getBoundingClientRect()
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
  })
  await page.mouse.move(point.x, point.y, { label: 'test wheel takeover' })
  await page.evaluate(() => {
    const key = 'ArrowDown'
    const viewport = document.querySelector('.t-skel-content .popup-main-list')
    window.__wheelLastScrollAt = performance.now()
    const onScroll = () => { window.__wheelLastScrollAt = performance.now() }
    viewport.addEventListener('scroll', onScroll, { passive: true })
    const timer = setInterval(() => document.dispatchEvent(new KeyboardEvent('keydown',
      { key, code: key, repeat: true, bubbles: true, cancelable: true })), 33)
    const stop = () => {
      clearInterval(timer)
      document.dispatchEvent(new KeyboardEvent('keyup', { key, code: key, bubbles: true }))
    }
    document.addEventListener('wheel', stop, { capture: true, once: true })
    setTimeout(stop, 4000)
    setTimeout(() => viewport.removeEventListener('scroll', onScroll), 5000)
  })
  await page.waitForSelector('.t-skel-content .popup-main-list[data-keyboard-scroll="true"]')
  await page.mouse.wheel(0, 160, { label: 'interrupt held scrolling' })
  await page.waitForFunction(() => {
    const viewport = document.querySelector('.t-skel-content .popup-main-list')
    return !viewport.hasAttribute('data-keyboard-scroll') &&
      !viewport.querySelector('.popup-row-layer').getAnimations().some(a => a.playState === 'running') &&
      performance.now() - window.__wheelLastScrollAt >= 150
  })
  const before = await page.evaluate(() => ({
    index: window.__productionNavigation.read().index,
    top: document.querySelector('.t-skel-content .popup-main-list').scrollTop
  }))
  await new Promise(resolve => setTimeout(resolve, 180))
  assert.deepEqual(await page.evaluate(() => ({
    index: window.__productionNavigation.read().index,
    top: document.querySelector('.t-skel-content .popup-main-list').scrollTop
  })), before, 'Wheel takeover must leave no queued selection or delayed scroll write')
}

async function checkProductionActivation(page) {
  // Click a real mounted row after many virtual-window changes. Chrome I/O
  // records the intended URL without opening a tab or touching user data.
  const target = await page.evaluate(() => {
    const viewport = document.querySelector('.t-skel-content .popup-main-list')
    const v = viewport.getBoundingClientRect()
    const row = [...viewport.querySelectorAll('[data-bookmark-id]')].find(row => {
      const r = row.getBoundingClientRect()
      return r.top >= v.top + 12 && r.bottom <= v.bottom - 12
    })
    return { id: row.dataset.bookmarkId, opens: window.__io.opens.length }
  })
  await page.click(`.t-skel-content [data-bookmark-id="${target.id}"] .popup-list-button`, { label: 'verify bookmark identity' })
  await page.waitForFunction(count => window.__io.opens.length > count, target.opens)
  const opened = await page.evaluate(() => window.__io.opens.at(-1))
  assert.equal(opened.url, `https://example.test/reference/${Number(target.id) - 100}`)
  await page.fill('#search-input', 'Reference 00420')
  await page.waitForFunction(() => window.__productionNavigation.read().query === 'Reference 00420' &&
    Boolean(document.querySelector('.t-skel-content [role="row"]')))
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')
  await page.waitForFunction(count => window.__io.opens.length > count + 1, target.opens)
  assert.equal(await page.evaluate(() => window.__io.opens.at(-1).url), 'https://example.test/reference/419',
    'Keyboard activation must still use the selected search result')
  await page.waitForFunction(() => [...document.images].every(image => image.complete && image.naturalWidth > 0))
  assert.deepEqual(await page.evaluate(() => window.__errors), [])
}
