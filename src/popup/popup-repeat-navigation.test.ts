import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createPopupScrollFollow } from './popup-scroll-follow.js'
import { getPopupVirtualRange, getPopupHeldRange, includePopupVirtualSelection } from './popup-virtual-window.js'
import { getActiveResultTrackingGeometry, getPopupEdgeReveal, createPopupRowLayout, getPopupRowOffset } from './popup-active-result-scroll.js'
import { createPopupNavigationViewStore, getPopupRowNavigationFlags } from './popup-navigation-view-store.js'
import type { PopupContentViewModel } from './components/PopupViewModels.js'
import { createPopupNavigationBatch } from './popup-keyboard-navigation.js'

function clock(rebaseDistance = 0) {
  let top = 0
  let time = 0
  const writes: number[] = []
  const visuals: number[] = []
  const animations: { start: number; duration: number; phase: string; cancelled: boolean }[] = []
  const follow = createPopupScrollFollow({
    read: () => top,
    write: value => { top = Math.max(0, value); writes.push(top) },
    place: () => {},
    rebaseDistance,
    now: () => time,
    animate: (_offset, duration, start, phase) => {
      const motion = { start, duration, phase, cancelled: false }
      animations.push(motion)
      return { cancel: () => { motion.cancelled = true } }
    }
  })
  return {
    follow, writes, visuals,
    get time() { return time },
    read: () => follow.visualPosition,
    nativeScroll: (value: number) => { top = value; follow.observe(value) },
    tick(ms = 1000 / 60) {
      time += ms
      visuals.push(follow.visualPosition)
      const running = animations.filter(motion => !motion.cancelled && time < motion.start + motion.duration)
      assert.equal(new Set(running.map(motion => motion.phase)).size, running.length,
        'Docking and cadence each have one compositor owner; repeats never stack animations')
    }
  }
}

for (const hz of [60, 120, 165]) {
  const test = clock(200)
  const jitter = Array.from({ length: 37 }, (_, index) => index === 18 ? 16 : 0)
  const positions: number[] = []
  let nextInput = 0
  let input = 0
  for (let frame = 1; frame <= hz * 4; frame++) {
    const at = frame * 1000 / hz
    while (nextInput <= at) {
      test.tick(nextInput - test.time)
      input++
      test.follow.moveTo(input * 60, true)
      nextInput = input * 1000 / 30 + jitter[input % jitter.length]
    }
    test.tick(at - test.time)
    if (at >= 500) positions.push(test.read())
  }
  assert.ok(positions.slice(1).every((value, index) => value - positions[index] > 0.01),
    `OS repeat jitter must not create stationary animation frames at ${hz}Hz`)
  test.tick(100)
  assert.ok(Math.abs(test.read() - input * 60) < 1e-6, 'The overlap must not create an unbounded settling tail')
}

{
  const test = clock(200)
  for (let index = 1; index <= 120; index++) {
    const before = test.read()
    test.follow.moveTo(index * 60, true)
    assert.ok(Math.abs(test.read() - before) < 1e-6, 'Native rebasing must not change the visible position')
    test.tick(1000 / 30)
  }
  assert.ok(test.writes.length <= 30, 'Large lists batch native writes without dropping visual steps')
  test.tick(100)
  assert.ok(Math.abs(test.read() - 7200) < 1e-6)
  test.follow.moveTo(7260, true)
  test.tick(10)
  const beforeCancel = test.read()
  test.follow.cancel()
  assert.ok(Math.abs(test.read() - beforeCancel) <= 0.5, 'Cancellation flushes the visual position, not the lagging native one')
  assert.ok(Math.abs(test.follow.position - beforeCancel) <= 0.5)
  test.follow.moveTo(7000, true, true)
  test.tick(30)
  const beforeReverse = test.read()
  test.follow.moveTo(7480, true, true)
  assert.ok(Math.abs(test.read() - beforeReverse) < 1e-6, 'Docking also preserves batched offsets across a reversal')
  test.nativeScroll(6800)
  assert.equal(test.read(), 6800, 'External scrolling discards every compositor offset')
}

{
  const test = clock()
  test.follow.moveTo(600, false)
  test.follow.moveTo(360, true, true)
  assert.equal(test.read(), 600, 'Entering a hold starts at the current visible position, never the edge')
  test.tick(20)
  assert.ok(test.read() < 600 && test.read() > 360, 'Docking has a visible intermediate position')
  const beforeRepeat = test.read()
  test.follow.moveTo(420, true)
  assert.equal(test.read(), beforeRepeat, 'An incoming row does not restart or jump the docking transition')
  test.tick(20)
  const beforeReverse = test.read()
  test.follow.moveTo(780, true, true)
  assert.equal(test.read(), beforeReverse, 'Reversal preserves the current presentation, including both offsets')
  test.tick(20)
  assert.ok(test.read() > beforeReverse && test.read() < 780)
  test.tick(80)
  assert.equal(test.read(), 780, 'Docking settles in the same 100ms as the retained highlight')
  test.follow.moveTo(720, true, true)
  test.tick(25)
  const beforeCancel = test.read()
  test.follow.cancel()
  assert.ok(Math.abs(test.read() - beforeCancel) <= 0.5, 'Wheel takeover preserves the visible subpixel position')
  test.tick(200)
  assert.ok(Math.abs(test.read() - beforeCancel) <= 0.5, 'Cancelled docking has no late scroll writes')
}

for (const hz of [60, 120, 144]) {
  const test = clock()
  let goal = 0
  for (let frame = 0; frame < hz * 2; frame++) {
    const next = Math.floor(frame * 30 / hz)
    if (next !== goal) { goal = next; test.follow.moveTo(next * 60, true) }
    test.tick(1000 / hz)
  }
  const differences = test.visuals.slice(1).map((top, index) => top - test.visuals[index])
  assert.ok(differences.every(value => value >= 0), 'Downward repeats never reverse the scroll')
  assert.ok(Math.max(...differences) < 45, `Held navigation must not jump whole 60px rows at ${hz}Hz`)
  for (let frame = 0; frame < hz / 2; frame++) test.tick(1000 / hz)
  assert.equal(test.read(), goal * 60, 'Release settles at the last requested row')
  assert.equal(test.follow.active, false, 'No idle frame loop survives settling')
  assert.ok(test.writes.length <= 60, 'Native scrolling is written per input, never per display frame')
}

{
  const test = clock()
  test.follow.moveTo(180, false)
  assert.equal(test.read(), 180)
  assert.equal(test.follow.active, false)
  test.follow.moveTo(400, true)
  test.tick()
  test.tick()
  const beforeReverse = test.read()
  test.follow.moveTo(0, true)
  test.tick()
  assert.ok(test.read() < beforeReverse, 'Reversing input must not keep scrolling the old way')
  test.nativeScroll(250)
  test.tick()
  assert.equal(test.read(), 250, 'An external/native scroll takes ownership')
  assert.equal(test.follow.active, false)
  test.follow.moveTo(500, true)
  test.follow.cancel()
  test.tick()
  assert.equal(test.read(), 250, 'Pointer/blur cancellation leaves no delayed write')
  test.follow.moveTo(500, true)
  test.tick()
  test.tick(250)
  assert.equal(test.read(), 500, 'A suspended frame cannot build up a scrolling backlog')
  assert.equal(test.follow.active, false)
}

for (const pitch of [34, 60, 68]) {
  let range = { start: 0, count: 24 }
  let updates = 0
  for (let top = 0; top < pitch * 60; top++) {
    const next = getPopupVirtualRange({
      previous: range, rowCount: 10000, pitch, viewportHeight: 400, scrollTop: top, paddingTop: 8
    })
    if (next.start !== range.start || next.count !== range.count) updates++
    range = next
    const first = Math.max(0, Math.floor((top - 8) / pitch))
    const last = Math.ceil((top - 8 + 400) / pitch)
    assert.ok(range.start <= first && range.start + range.count >= last)
    const visible = Math.ceil(400 / pitch)
    assert.ok(range.count <= visible + Math.max(8, visible) * 2, 'Virtualization stays bounded to viewport-sized buffers')
  }
  assert.ok(updates < 20, 'Buffer hysteresis must avoid replacing rows every row pitch')
  const far = includePopupVirtualSelection(range, 9999, 10000)
  assert.equal(far.start + far.count, 10000)
  assert.equal(far.count, range.count, 'Distant targets do not mount intermediate rows')
  const shrink = getPopupVirtualRange({
    previous: far, rowCount: 30, pitch, viewportHeight: 400, scrollTop: 0
  })
  assert.equal(shrink.start, 0)

  let held = { start: 0, count: 0 }
  let heldUpdates = 0
  for (let index = 100; index < 160; index++) {
    const next = getPopupHeldRange({
      activeIndex: index, direction: 1, rowCount: 10000, pitch, viewportHeight: 400, paddingTop: 8, previous: held
    })
    if (next.start !== held.start) heldUpdates++
    assert.ok(next.start <= index && next.start + next.count > index)
    held = next
  }
  assert.ok(heldUpdates < 20, 'Held scrolling also advances the buffer in groups, not every key')
  const reversed = getPopupHeldRange({
    activeIndex: 158, direction: -1, rowCount: 10000, pitch, viewportHeight: 400, paddingTop: 8, previous: held
  })
  assert.ok(reversed.start <= 158 - Math.ceil(400 / pitch),
    'The old viewport stays mounted throughout a bottom-to-top reversal')
}

{
  const workspace = { left: 0, top: 0, right: 800, bottom: 600 }
  const viewport = { left: 240, top: 50, right: 800, bottom: 600 }
  const row = { left: 248, top: 250, right: 788, bottom: 298 }
  const before = getActiveResultTrackingGeometry(workspace, row, viewport, 0)
  const scrolled = getActiveResultTrackingGeometry(workspace, { ...row, top: 210, bottom: 258 }, viewport, 40)
  assert.deepEqual(scrolled, before, 'Scrolling must not retarget the selection transform')
  const selected = getActiveResultTrackingGeometry(workspace, { ...row, top: 270, bottom: 318 }, viewport, 40)
  assert.equal(selected!.top - before!.top, 60, 'Only selection changes retain the 100ms transform')
  const clipped = getActiveResultTrackingGeometry(workspace, { ...row, top: 30, bottom: 78 }, viewport, 220)
  assert.equal(clipped?.clipPath, 'inset(20px 0px 0px 0px)')
  assert.equal(getActiveResultTrackingGeometry(workspace, { ...row, top: -50, bottom: -2 }, viewport, 300), null)
  assert.deepEqual(getPopupEdgeReveal({
    top: 800, height: 48, maxScrollTop: 1000, viewportTop: 300, viewportHeight: 400, direction: 1
  }), { top: 456, pinned: true }, 'Downward holds dock at the bottom, with no lookahead gap')
  assert.deepEqual(getPopupEdgeReveal({
    top: 800, height: 48, maxScrollTop: 1000, viewportTop: 900, viewportHeight: 400, direction: -1
  }), { top: 792, pinned: true }, 'Upward holds dock at the top')
  assert.equal(getPopupEdgeReveal({
    top: 8, height: 48, maxScrollTop: 1000, viewportTop: 0, viewportHeight: 400, direction: 1
  }).pinned, false, 'A list boundary never creates artificial empty space')
  assert.equal(getPopupEdgeReveal({
    top: 120, height: 48, maxScrollTop: 1000, viewportTop: 0, viewportHeight: 400, direction: 1
  }).pinned, false, 'A hold that starts near the top glides through visible rows instead of jumping to the bottom')
  assert.equal(getPopupEdgeReveal({
    top: 280, height: 48, maxScrollTop: 1000, viewportTop: 0, viewportHeight: 400, direction: -1
  }).pinned, false, 'A hold that starts near the bottom glides upward instead of jumping to the top')
  assert.equal(getPopupEdgeReveal({
    top: 352, height: 48, maxScrollTop: 1000, viewportTop: 0, viewportHeight: 400, direction: 1
  }).pinned, true, 'Scrolling takes over once the highlight reaches the edge it is travelling toward')
  assert.equal(getPopupRowOffset(createPopupRowLayout(3, 60, [60, 68, 60]), 2), 128)
}

const content = readFileSync('src/popup/components/PopupContent.tsx', 'utf8')
const host = readFileSync('src/popup/components/PopupContentHost.tsx', 'utf8')
const controller = readFileSync('src/popup/popup-controller.ts', 'utf8')
const virtualHook = content.slice(content.indexOf('function useFixedRowWindow'), content.indexOf('function PopupContentSkeleton'))
const paint = host.slice(host.indexOf('const paintIndicatorScroll'), host.indexOf('const getPaneMetrics'))
assert.ok(!/\.scrollTop\s*=|\.scrollTo\(/.test(virtualHook), 'Virtualization must not compete with the scroll owner')
assert.ok(!/getBoundingClientRect|getComputedStyle|clientHeight/.test(paint), 'Scroll frames only consume cached geometry')
assert.ok(content.includes('onKeyboardNavigate?.(event.key, event.repeat)'))
assert.ok(controller.includes("navigation: repeat ? 'repeat' : undefined"))
assert.ok(host.includes("detail.navigation === 'repeat'") && host.includes('!prefersReducedMotion()'))
assert.ok(host.includes("document.addEventListener('wheel', interrupt") && host.includes("window.addEventListener('blur', interrupt)"))
assert.ok(controller.includes('function renderSelection(') && controller.includes('selectionOnly: true'),
  'Production navigation must bypass catalog reconstruction')
for (const pane of ['Result', 'Folder']) {
  const queue = controller.slice(controller.indexOf(`function queueActive${pane}Delta`),
    controller.indexOf(`function flushQueuedActive${pane}Index`))
  const scheduler = pane === 'Result' ? 'resultNavigationBatch' : 'folderNavigationBatch'
  assert.ok(queue.includes(`${scheduler}.flush()`) && queue.includes(`${scheduler}.schedule()`) && !queue.includes('requestAnimationFrame'),
    'Neither taps nor repeats should wait for a display frame before committing selection')
}
const tapReveal = host.slice(host.indexOf('const nextScrollTop = getActiveResultRevealScrollTop'),
  host.indexOf('remeasureRef.current = remeasureIndicator'))
assert.ok(!tapReveal.includes('viewport.scrollTop'), 'A tap must not force layout by reading scrollTop after row styles change')
assert.ok(host.includes('if (!shouldRevealActiveResultRef.current) remeasureIndicator()'),
  'A virtual window must not hide the cursor before the same commit reveals its target')
assert.ok(!content.includes('bookmark-slot:') && !content.includes('folder-slot:'),
  'Rows retain bookmark identity for focus, open menus and drag capture')
assert.ok(content.includes('currentIndex >= 0 && collapsed) setCollapsed(false)'),
  'An already-open folder tree must not enqueue redundant state updates on each repeat')
const handoff = host.slice(host.indexOf('return subscribePopupContentChange'), host.indexOf('navigationStore.publish('))
assert.ok(handoff.indexOf('follow.cancel()') < handoff.indexOf('pendingScrollTopRef.current ='),
  'Preserve the flushed visual position after cancellation, never the older native checkpoint')
const release = host.slice(host.indexOf('const releasePinnedEdge'), host.indexOf('const commitActiveResultIndicator'))
assert.ok(release.includes('indicatorMeasurementRef.current = null') && paint.includes('if (!measurement) return'),
  'Scroll events during handoff must not paint a stale pre-hold row or flash the highlight off')
{
  const jobs: Array<() => void> = []
  let commits = 0
  const batch = createPopupNavigationBatch(() => { commits++ }, job => { jobs.push(job) })
  batch.schedule()
  batch.schedule()
  assert.equal(jobs.length, 1, 'A synchronous burst has one pending commit')
  batch.cancel()
  batch.schedule()
  jobs.shift()!()
  assert.equal(commits, 0, 'Cancelled work cannot overwrite a newer navigation')
  assert.equal(batch.pending, true)
  jobs.shift()!()
  assert.equal(commits, 1)
  batch.schedule()
  batch.flush()
  assert.equal(commits, 2, 'A tap flushes the latest accepted selection immediately')
  jobs.shift()!()
  assert.equal(commits, 2, 'The old queued callback cannot replay the flushed tap')
}
{
  const model: PopupContentViewModel = {
    rows: [], mainRows: [], sidebarRows: [], title: 'Bookmarks',
    keyboardPane: 'bookmarks', activeResultIndex: 3, activeFolderIndex: -1
  }
  const store = createPopupNavigationViewStore({ state: model, preserveScroll: false })
  const before = store.getSnapshot()
  store.publish({ state: { ...model, activeResultIndex: 4 }, preserveScroll: false, selectionOnly: true, navigation: 'repeat', direction: 1 })
  const after = store.getSnapshot()
  assert.equal(after.presentation, before.presentation, 'A key repeat must retain the entire catalog/header presentation')
  const changed = Array.from({ length: 100 }, (_, index) =>
    getPopupRowNavigationFlags(before, 'bookmarks', index, false) !== getPopupRowNavigationFlags(after, 'bookmarks', index, false)
  ).filter(Boolean)
  assert.equal(changed.length, 2, 'Only the old and new selected row receive a changed snapshot')
  assert.equal(getPopupRowNavigationFlags(after, 'bookmarks', 4, false), 3, 'Held selection defers quick actions')
  store.publish({ state: after.state, preserveScroll: true, selectionOnly: true })
  assert.equal(getPopupRowNavigationFlags(store.getSnapshot(), 'bookmarks', 4, false), 1, 'Release restores the selected row actions')
  const folders = { ...model, keyboardPane: 'folders' as const, activeResultIndex: -1, activeFolderIndex: 7 }
  store.publish({ state: folders, preserveScroll: false, selectionOnly: true })
  assert.equal(store.getSnapshot().presentation, folders, 'Changing pane publishes its structural presentation')
  assert.equal(getPopupRowNavigationFlags(store.getSnapshot(), 'folders', 7, false), 1)
  const data = { ...folders, title: 'Updated' }
  store.publish({ state: data, preserveScroll: true })
  assert.equal(store.getSnapshot().presentation, data, 'Data/status changes are never held back for animation')
}
console.log('Popup repeated navigation, scroll ownership and virtual window tests passed.')
