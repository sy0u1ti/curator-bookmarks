import assert from 'node:assert/strict'
import { test } from 'node:test'
import { build } from 'esbuild'

const { outputFiles } = await build({
  entryPoints: ['src/ui/base/menu-intent.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false
})
const { createMenuIntent, isHeadingToSubmenu, pointInMenuTriangle, MENU_INTENT_TIMING } =
  await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`)

const right = {
  parent: { left: 100, right: 340, top: 100, bottom: 420 },
  submenu: { left: 332, right: 572, top: 130, bottom: 460 },
  side: 'right'
}
const row = (id, depth = 0, submenu = true) => ({ id, depth, submenu })

function harness(geometry = () => right) {
  let now = 0
  let sequence = 0
  let closed = 0
  const timers = new Map()
  const changes = []
  const clock = {
    now: () => now,
    schedule(callback, delay) {
      const id = ++sequence
      timers.set(id, { callback, at: now + delay })
      return id
    },
    cancel: id => timers.delete(id)
  }
  const intent = createMenuIntent({ geometry, onChange: state => changes.push(state), onClose: () => closed++, clock })
  function tick(ms) {
    const end = now + ms
    while (true) {
      const next = [...timers.entries()].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at)[0]
      if (!next) break
      timers.delete(next[0])
      now = next[1].at
      next[1].callback()
    }
    now = end
  }
  return { intent, tick, changes, timers, closed: () => closed }
}

test('triangle includes its boundary in either winding, but rejects degenerate/non-finite input', () => {
  const a = { x: 0, y: 0 }, b = { x: 10, y: -10 }, c = { x: 10, y: 10 }
  for (const corners of [[a, b, c], [a, c, b]]) {
    assert.equal(pointInMenuTriangle({ x: 5, y: 0 }, ...corners), true)
    assert.equal(pointInMenuTriangle({ x: 5, y: 5 }, ...corners), true)
    assert.equal(pointInMenuTriangle({ x: -1, y: 0 }, ...corners), false)
  }
  assert.equal(pointInMenuTriangle(a, a, a, a), false)
  assert.equal(pointInMenuTriangle({ x: NaN, y: 1 }, a, b, c), false)
})

test('safe transit uses the old pointer, the near edge and the edge band', () => {
  assert.equal(isHeadingToSubmenu({ x: 220, y: 160 }, { x: 280, y: 200 }, right), true)
  assert.equal(isHeadingToSubmenu({ x: 150, y: 160 }, { x: 200, y: 190 }, right), false)
  assert.equal(isHeadingToSubmenu({ x: 280, y: 200 }, { x: 270, y: 200 }, right), false)
  assert.equal(isHeadingToSubmenu({ x: 280, y: 200 }, { x: 280, y: 220 }, right), false)
  assert.equal(isHeadingToSubmenu({ x: 280, y: 200 }, { x: 350, y: 220 }, right), false)
  assert.equal(isHeadingToSubmenu(null, { x: 280, y: 200 }, right), false)
})

test('left-flipped and scrolled menus use their actual bounds', () => {
  const left = { ...right, side: 'left', submenu: { left: -132, right: 108, top: 60, bottom: 390 } }
  assert.equal(isHeadingToSubmenu({ x: 230, y: 160 }, { x: 170, y: 200 }, left), true)
  assert.equal(isHeadingToSubmenu({ x: 230, y: 160 }, { x: 240, y: 200 }, left), false)
  assert.equal(isHeadingToSubmenu({ x: 230, y: 160 }, { x: 100, y: 200 }, left), false)
  assert.equal(isHeadingToSubmenu({ x: 230, y: 160 }, { x: 170, y: 450 }, left), false)
})

test('hover opens at 220ms, leaving cancels, and a plain row closes deeper levels after the same delay', () => {
  const { intent, tick } = harness()
  intent.hover(row('first'), { x: 150, y: 150 })
  tick(219)
  assert.deepEqual(intent.getSnapshot().openPath, [])
  tick(1)
  assert.deepEqual(intent.getSnapshot().openPath, ['first'])
  intent.hover(row('second'), { x: 150, y: 200 })
  tick(100)
  intent.leaveRow(row('second'))
  tick(300)
  assert.deepEqual(intent.getSnapshot().openPath, ['first'])
  intent.hover(row('plain', 0, false), { x: 150, y: 250 })
  tick(219)
  assert.deepEqual(intent.getSnapshot().openPath, ['first'])
  tick(1)
  assert.deepEqual(intent.getSnapshot().openPath, [])
})

test('diagonal transit neither switches nor highlights crossed rows, and entering the child cancels it', () => {
  const { intent, tick } = harness()
  intent.setOpen(0, 'first', true)
  intent.move({ x: 220, y: 160 })
  intent.hover(row('second'), { x: 280, y: 200 })
  tick(600)
  assert.deepEqual(intent.getSnapshot().openPath, ['first'])
  assert.equal(intent.getSnapshot().hovered, null)
  intent.enterLevel(1)
  tick(2000)
  assert.deepEqual(intent.getSnapshot().openPath, ['first'])
})

test('a parked pointer is protected for at most 1200ms, even with duplicate movement events', () => {
  const { intent, tick } = harness()
  intent.setOpen(0, 'first', true)
  intent.move({ x: 220, y: 160 })
  intent.hover(row('second'), { x: 280, y: 200 })
  intent.move({ x: 280, y: 200 })
  tick(1199)
  assert.deepEqual(intent.getSnapshot().openPath, ['first'])
  tick(1)
  assert.deepEqual(intent.getSnapshot().openPath, ['second'])
  assert.equal(intent.getSnapshot().hovered.id, 'second')
})

test('leaving the safe zone releases a pending row without starting a fresh open delay', () => {
  const { intent, tick } = harness()
  intent.setOpen(0, 'first', true)
  intent.move({ x: 220, y: 160 })
  intent.hover(row('second'), { x: 280, y: 200 })
  tick(400)
  intent.move({ x: 275, y: 200 })
  assert.deepEqual(intent.getSnapshot().openPath, ['second'])
})

test('leaving has a 360ms grace period and returning to any level cancels it', () => {
  const { intent, tick, closed } = harness(() => null)
  intent.setOpen(0, 'first', true)
  intent.leave()
  tick(359)
  assert.equal(closed(), 0)
  intent.enterLevel(1)
  tick(1000)
  assert.equal(closed(), 0)
  intent.leave()
  tick(360)
  assert.equal(closed(), 1)
  assert.deepEqual(intent.getSnapshot().openPath, [])
})

test('drag hover uses 420ms; explicit activation is immediate and keyboard cancels hover timers', () => {
  const { intent, tick } = harness()
  intent.hover(row('first'), { x: 150, y: 150 }, true)
  tick(419)
  assert.deepEqual(intent.getSnapshot().openPath, [])
  tick(1)
  assert.deepEqual(intent.getSnapshot().openPath, ['first'])
  intent.hover(row('second'), { x: 150, y: 200 })
  intent.keyboard()
  intent.setOpen(0, 'keyboard', true)
  tick(2000)
  assert.deepEqual(intent.getSnapshot().openPath, ['keyboard'])
  assert.equal(intent.getSnapshot().pointer, false)
  intent.setOpen(1, 'touch', true)
  assert.deepEqual(intent.getSnapshot().openPath, ['keyboard', 'touch'])
})

test('reset/dispose clears hover and close timers so a closed menu cannot reopen', () => {
  const { intent, tick, timers, closed } = harness()
  intent.hover(row('first'), { x: 150, y: 150 })
  intent.reset()
  tick(2000)
  assert.deepEqual(intent.getSnapshot().openPath, [])
  intent.hover(row('second'), { x: 150, y: 200 })
  intent.leave()
  intent.dispose()
  assert.equal(timers.size, 0)
  tick(MENU_INTENT_TIMING.safeWindow * 2)
  assert.equal(closed(), 0)
})
