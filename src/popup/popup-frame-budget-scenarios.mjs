import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { centerProductionSelection, prepareProductionNavigation } from './popup-production-navigation-scenarios.mjs'

export function analyzePopupFrameTrace(events) {
  const begin = events.find(event => event.name === 'curator.native.begin')
  const lastInput = events.find(event => event.name === 'curator.native.last-input')
  const end = events.find(event => event.name === 'curator.native.end')
  assert.ok(begin && lastInput && end, 'The trace must contain the complete owned input interval')
  const own = events.filter(event => event.pid === begin.pid)
  const until = Math.min(end.ts, lastInput.ts + 100000)
  const measured = own.filter(event => event.ts >= begin.ts && event.ts <= until)
  const frameKey = event => `${event.args.layerTreeId}:${event.args.frameSeqId}`
  const begins = measured.filter(event => event.name === 'BeginFrame')
  const drawn = new Set(measured.filter(event => event.name === 'DrawFrame').map(frameKey))
  const drops = new Map()
  for (const event of measured.filter(event => event.name === 'DroppedFrame')) drops.set(frameKey(event), event)
  const partial = [...drops.values()].filter(event => event.args.hasPartialUpdate).length
  const frameTimes = begins.map(event => event.ts).sort((a, b) => a - b)
  const intervals = frameTimes.slice(1).map((time, index) => (time - frameTimes[index]) / 1000)
  const sorted = intervals.filter(value => value > 0).sort((a, b) => a - b)
  const median = sorted[Math.floor(sorted.length / 2)] || 0
  const elapsedMs = (until - begin.ts) / 1000
  const presentationActive = begins.length >= elapsedMs * 0.045 && median > 0 && median < 25
  return {
    renderer: begin.pid, elapsedMs, expectedFrames: begins.length, drawnFrames: drawn.size,
    droppedFrames: drops.size, partialFrames: partial, fullyDroppedFrames: drops.size - partial,
    nominalFrameMs: median, maxBeginGapMs: Math.max(0, ...intervals), presentationActive,
    zeroDroppedFrames: presentationActive && drops.size === 0,
    ownEvents: own
  }
}

async function readFrameTrace(page) {
  await page.cdp('Tracing.end')
  let stream
  for (let attempt = 0; attempt < 50 && !stream; attempt++) {
    const events = await page.events()
    stream = events.find(event => event.method === 'Tracing.tracingComplete')?.params?.stream
    if (!stream) await new Promise(resolve => setTimeout(resolve, 100))
  }
  if (!stream) throw new Error('The frame trace did not produce a stream')
  const chunks = []
  try {
    while (true) {
      const chunk = await page.cdp('IO.read', { handle: stream, size: 1048576 })
      chunks.push(chunk.base64Encoded ? Buffer.from(chunk.data, 'base64').toString('utf8') : chunk.data)
      if (chunk.eof) break
    }
  } finally {
    await page.cdp('IO.close', { handle: stream })
  }
  return JSON.parse(chunks.join('')).traceEvents
}

export async function measurePopupNativeFrames(page, origin, directory, {
  label = 'frames', pane = 'bookmarks', direction = 1, durationMs = 5000, hz = 30,
  width = 800, height = 600, surface = 'popup', capture = false, control = false
} = {}) {
  if (control) {
    await page.cdp('Emulation.setFocusEmulationEnabled', { enabled: true })
    await page.cdp('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
    await page.goto(`data:text/html,<title>Curator frame control ${Date.now()}</title>`)
    const { frameTree } = await page.cdp('Page.getFrameTree')
    await page.cdp('Page.setDocumentContent', { frameId: frameTree.frame.id, html: `<!doctype html>
      <title>Curator compositor control</title><style>
      html,body{margin:0;height:100%;overflow:hidden;background:#111}
      main{position:absolute;inset:30px;overflow:hidden;border-radius:12px}
      div{height:1600px;background:repeating-linear-gradient(#242424 0px 59px,#555 59px 60px);
      animation:scroll 333.333ms linear infinite;will-change:transform}
      @keyframes scroll{to{transform:translate3d(0,-600px,0)}}
      </style><main><div></div></main><script>
      let index=5000;window.__errors=[];window.__commits=0;
      window.__productionNavigation={read:()=>({index,pane:'bookmarks'})};
      document.addEventListener('keydown',event=>{if(event.key==='ArrowDown'||event.key==='ArrowUp'){
        event.preventDefault();index+=event.key==='ArrowDown'?1:-1;
      }});
      </script>` })
  } else {
    await prepareProductionNavigation(page, origin, { width, height, surface, isolated: true })
    await centerProductionSelection(page, pane, direction > 0 ? 100 : 5000)
  }
  await page.cdp('Page.bringToFront')
  await page.cdp('Page.stopScreencast')
  if (capture) await page.cdp('Page.startScreencast', { format: 'jpeg', quality: 10, maxWidth: 160, maxHeight: 120, everyNthFrame: 1 })
  // No per-frame JavaScript observer, screenshots, or cc debug internals:
  // those can themselves create main-thread animation demand and missed frames.
  await page.cdp('Tracing.start', {
    transferMode: 'ReturnAsStream', streamFormat: 'json',
    traceConfig: {
      includedCategories: ['disabled-by-default-devtools.timeline.frame', 'blink.user_timing'],
      enableArgumentFilter: true, traceBufferSizeInKb: 32768, recordMode: 'recordUntilFull'
    }
  })
  let tracing = true
  const count = Math.floor(durationMs * hz / 1000)
  const key = direction > 0 ? 'ArrowDown' : 'ArrowUp'
  const code = direction > 0 ? 40 : 38
  try {
    await page.evaluate(({ key, count }) => {
      const initial = window.__productionNavigation.read()
      const received = []
      const onKey = event => {
        if (event.key !== key || !event.repeat) return
        received.push({ at: performance.now(), inputDelay: performance.now() - event.timeStamp, trusted: event.isTrusted })
        if (received.length === count) performance.mark('curator.native.last-input')
      }
      const observer = new PerformanceObserver(list => window.__nativeFrames.longTasks.push(
        ...list.getEntries().map(entry => ({ at: entry.startTime, duration: entry.duration }))
      ))
      window.__nativeFrames = { initial, received, longTasks: [], commits: window.__commits }
      observer.observe({ type: 'longtask', buffered: false })
      document.addEventListener('keydown', onKey, true)
      window.__finishNativeFrames = () => {
        observer.disconnect()
        document.removeEventListener('keydown', onKey, true)
        window.__nativeFrames.final = window.__productionNavigation.read()
        window.__nativeFrames.commits = window.__commits - window.__nativeFrames.commits
        performance.mark('curator.native.end')
      }
      performance.mark('curator.native.begin')
    }, { key, count })
    const issued = []
    const jobs = []
    const began = performance.now()
    let failure
    for (let index = 0; index < count && !failure; index++) {
      const wait = began + index * 1000 / hz - performance.now()
      if (wait > 0) await new Promise(resolve => setTimeout(resolve, wait))
      issued.push(performance.now() - began)
      // Generate repeat input outside the renderer. A busy page must not silently
      // reduce the number of keys as it would with an in-page setInterval.
      jobs.push(page.cdp('Input.dispatchKeyEvent', {
        type: 'keyDown', key, code: key, windowsVirtualKeyCode: code, nativeVirtualKeyCode: code,
        autoRepeat: true, timestamp: Date.now() / 1000
      }).catch(error => { failure = error }))
    }
    await Promise.all(jobs)
    if (failure) throw failure
    await page.cdp('Input.dispatchKeyEvent', {
      type: 'keyUp', key, code: key, windowsVirtualKeyCode: code, nativeVirtualKeyCode: code
    })
    await page.waitForFunction(() => {
      const result = window.__nativeFrames
      return result.received.length > 0 && !document.querySelector('[data-keyboard-scroll="true"]')
    })
    await page.evaluate(() => window.__finishNativeFrames())
    const input = await page.evaluate(() => window.__nativeFrames)
    const events = await readFrameTrace(page)
    tracing = false
    const frames = analyzePopupFrameTrace(events)
    const { ownEvents, ...metrics } = frames
    const report = { label, pane, direction, durationMs, hz, capture, control, ...metrics, issued, input }
    await writeFile(`${directory}/${label}-trace.json`, JSON.stringify({ traceEvents: ownEvents }))
    await writeFile(`${directory}/${label}.json`, JSON.stringify(report, null, 2))
    assert.equal(input.received.length, count, 'Every scheduled native repeat must reach the page')
    assert.ok(input.received.every(event => event.trusted), 'The test must use browser input, not synthesized DOM key events')
    assert.equal(input.final.index, input.initial.index + count * direction, 'Activation must retain every accepted key')
    return report
  } finally {
    if (tracing) await page.cdp('Tracing.end').catch(() => {})
    await page.cdp('Page.stopScreencast')
  }
}

export async function runPopupFrameBudgetChecks(page, origin, directory, {
  durationMs = 10000, capture = false, requireZero = false
} = {}) {
  const control = await measurePopupNativeFrames(page, origin, directory, {
    label: 'control', control: true, durationMs: Math.min(durationMs, 5000), capture
  })
  const summaries = []
  for (const surface of ['popup', 'sidepanel']) {
    for (const pane of ['bookmarks', 'folders']) {
      const result = await measurePopupNativeFrames(page, origin, directory, {
        label: `${surface}-${pane}`, surface, pane, durationMs, capture,
        direction: surface === 'popup' ? 1 : -1,
        width: surface === 'popup' ? 800 : 390, height: surface === 'popup' ? 600 : 844
      })
      const { input, issued, ...summary } = result
      summaries.push({ ...summary, received: input.received.length, commits: input.commits, longTasks: input.longTasks })
      console.log(summaries.at(-1))
    }
  }
  const result = {
    control: { active: control.presentationActive, droppedFrames: control.droppedFrames },
    capture,
    certifiedZeroDroppedFrames: !capture && control.zeroDroppedFrames && summaries.every(item => item.zeroDroppedFrames),
    scenarios: summaries
  }
  await writeFile(`${directory}/frame-budget-report.json`, JSON.stringify(result, null, 2))
  console.log({ certifiedZeroDroppedFrames: result.certifiedZeroDroppedFrames, control: result.control, capture })
  if (requireZero) assert.ok(result.certifiedZeroDroppedFrames,
    'Zero-drop acceptance requires a visible foreground surface, a clean control run, and zero dropped/partial app frames; screenshot mode is diagnostic only')
  return result
}
