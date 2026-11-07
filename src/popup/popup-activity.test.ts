import assert from 'node:assert/strict'
import test from 'node:test'
import { PopupActivityQueue, type PopupActivity } from './popup-activity.js'

function setup() {
  let now = 0
  let serial = 0
  const timers = new Map<number, { at: number; callback: () => void }>()
  const frames: Array<string | null> = []
  const queue = new PopupActivityQueue(snapshot => frames.push(snapshot.activeId), {
    now: () => now,
    set: (callback, delay) => {
      const id = ++serial
      timers.set(id, { at: now + delay, callback })
      return id
    },
    clear: timer => { timers.delete(timer as number) }
  })
  const advance = (ms: number) => {
    const end = now + ms
    while (true) {
      const next = [...timers].sort((a, b) => a[1].at - b[1].at)[0]
      if (!next || next[1].at > end) break
      now = next[1].at
      timers.delete(next[0])
      next[1].callback()
    }
    now = end
  }
  return { queue, advance, frames, timers }
}

const deletion = (id: string): PopupActivity => ({
  id, type: 'success', message: `已删除 ${id}`, subject: id, action: 'undo-delete', actionLabel: '撤销', recycleId: id
})

test('returning to the page never removes a recoverable deletion', () => {
  const { queue, advance } = setup()
  queue.publish(deletion('a'))
  advance(4999)
  assert.equal(queue.snapshot().activeId, 'a')
  advance(1)
  assert.equal(queue.snapshot().activeId, null)
  assert.equal(queue.get('a')?.recycleId, 'a')
  queue.select('a')
  assert.equal(queue.snapshot().activeId, 'a')
})

test('repeated deletes keep every independent recovery without a carousel', () => {
  const { queue, advance } = setup()
  for (const id of ['a', 'b', 'c', 'd']) queue.publish(deletion(id))
  assert.equal(queue.snapshot().activeId, 'd')
  advance(5000)
  assert.equal(queue.snapshot().activeId, null)
  assert.equal(queue.snapshot().items.length, 4)
  queue.select('a')
  assert.equal(queue.get(queue.snapshot().activeId!)?.recycleId, 'a')
})

test('hover and focus pause the remaining visible time, including overlapping pauses', () => {
  const { queue, advance } = setup()
  queue.publish(deletion('a'))
  advance(4000)
  queue.pause('pointer', true)
  queue.pause('focus', true)
  advance(10000)
  queue.pause('pointer', false)
  advance(10000)
  assert.equal(queue.snapshot().activeId, 'a')
  queue.pause('focus', false)
  advance(999)
  assert.equal(queue.snapshot().activeId, 'a')
  advance(1)
  assert.equal(queue.snapshot().activeId, null)
})

test('an idle page being interacted with does not swap its buttons', () => {
  const { queue } = setup()
  queue.pause('focus', true)
  queue.publish(deletion('a'))
  assert.equal(queue.snapshot().activeId, null)
  queue.pause('focus', false)
  assert.equal(queue.snapshot().activeId, 'a')
})

test('pending → failed → retry → success updates one entry without a blank frame', () => {
  const { queue, advance, frames } = setup()
  queue.publish(deletion('a'))
  queue.publish({ ...deletion('a'), type: 'pending' })
  advance(30000)
  queue.publish({ ...deletion('a'), type: 'error', detail: '暂时无法恢复', actionLabel: '重试' })
  advance(30000)
  assert.equal(queue.get('a')?.actionLabel, '重试')
  queue.publish({ ...deletion('a'), type: 'pending' })
  queue.publish({ id: 'a', type: 'success', message: '已恢复 a', duration: 1500 })
  assert.ok(frames.every(id => id === 'a'))
  assert.equal(queue.snapshot().items.length, 1)
  advance(1500)
  assert.deepEqual(queue.snapshot(), { items: [], activeId: null })
})

test('background processing stays compact and a completion never steals undo', () => {
  const { queue, advance } = setup()
  queue.publish({ id: 'analysis', source: 'analysis', type: 'pending', message: '分析中' }, { present: false })
  assert.equal(queue.snapshot().activeId, null)
  queue.publish(deletion('a'))
  queue.publish({ id: 'analysis', source: 'analysis', type: 'success', message: '分析完成', action: 'history' })
  assert.equal(queue.snapshot().activeId, 'a')
  advance(5000)
  assert.equal(queue.snapshot().activeId, 'analysis')
})

test('explicitly returning to the page does not immediately bring another message forward', () => {
  const { queue, advance } = setup()
  queue.publish(deletion('a'))
  queue.pause('pointer', true)
  queue.publish(deletion('b'))
  queue.park()
  queue.pause('pointer', false)
  advance(20000)
  assert.equal(queue.snapshot().activeId, null)
  assert.equal(queue.snapshot().items.length, 2)
})

test('a long workflow defers recovery but discards an obsolete success', () => {
  const { queue, advance } = setup()
  queue.pause('workflow', true)
  queue.publish({ id: 'saved', type: 'success', message: '已保存' })
  queue.publish(deletion('a'))
  advance(60000)
  queue.pause('workflow', false)
  assert.equal(queue.snapshot().activeId, 'a')
  assert.equal(queue.get('saved'), undefined)
})

test('re-rendering the same operation does not restart its lifetime', () => {
  const { queue, advance } = setup()
  queue.publish(deletion('a'))
  advance(4000)
  queue.publish(deletion('a'))
  advance(1000)
  assert.equal(queue.snapshot().activeId, null)
})

test('a new message waits while the foreground operation is pending', () => {
  const { queue } = setup()
  queue.publish({ ...deletion('a'), type: 'pending' })
  queue.publish({ id: 'failed', type: 'error', message: '读取失败' })
  assert.equal(queue.snapshot().activeId, 'a')
  queue.publish({ id: 'a', type: 'success', message: '已恢复' })
  assert.equal(queue.snapshot().activeId, 'a')
})

test('removing an externally restored entry invalidates its action', () => {
  const { queue } = setup()
  queue.publish(deletion('a'))
  queue.remove('a')
  queue.select('a')
  assert.equal(queue.get('a'), undefined)
  assert.equal(queue.snapshot().activeId, null)
})

test('closing the popup disposes all presentation timers and pending selections', () => {
  const { queue, advance, timers } = setup()
  queue.publish(deletion('a'))
  queue.reset()
  advance(60000)
  assert.equal(timers.size, 0)
  assert.deepEqual(queue.snapshot(), { items: [], activeId: null })
})

test('a parked operation that succeeds leaves no stale recovery badge', () => {
  const { queue } = setup()
  queue.publish({ ...deletion('a'), type: 'pending' })
  queue.park()
  queue.publish({ id: 'a', type: 'success', message: '已恢复 a' })
  assert.deepEqual(queue.snapshot(), { items: [], activeId: null })
})

test('a subscriber releasing focus cannot start two presentation timers', () => {
  const timers = new Set()
  let next = 0
  let release = true
  const queue = new PopupActivityQueue(snapshot => {
    if (release && snapshot.activeId === 'a') {
      release = false
      queue.pause('focus', false)
    }
  }, {
    now: () => 0,
    set: () => { const id = ++next; timers.add(id); return id },
    clear: id => { timers.delete(id) }
  })
  queue.pause('focus', true)
  queue.publish(deletion('a'))
  queue.select('a')
  assert.equal(timers.size, 1)
  queue.reset()
  assert.equal(timers.size, 0)
})
