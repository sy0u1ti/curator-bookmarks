import assert from 'node:assert/strict'
import { test } from 'node:test'
import { analyzePopupFrameTrace } from './popup-frame-budget-scenarios.mjs'

function sample() {
  const events = [
    { name: 'curator.native.begin', ts: 0, pid: 1 },
    { name: 'curator.native.last-input', ts: 140000, pid: 1 },
    { name: 'curator.native.end', ts: 164000, pid: 1 }
  ]
  for (let index = 0; index <= 10; index++) {
    const args = { layerTreeId: 1, frameSeqId: index }
    events.push({ name: 'BeginFrame', ts: index * 16000, pid: 1, args })
    events.push({ name: 'DrawFrame', ts: index * 16000 + 1000, pid: 1, args })
  }
  return events
}

test('counts compositor events rather than treating rAF samples as presentation', () => {
  const result = analyzePopupFrameTrace(sample())
  assert.equal(result.zeroDroppedFrames, true)
  assert.equal(result.drawnFrames, 11)
  assert.equal(result.nominalFrameMs, 16)
})

test('a drawn fallback cannot conceal a partial or dropped update', () => {
  const events = sample()
  events.push({ name: 'DroppedFrame', ts: 32000, pid: 1, args: { layerTreeId: 1, frameSeqId: 2, hasPartialUpdate: true } })
  events.push({ name: 'DroppedFrame', ts: 48000, pid: 1, args: { layerTreeId: 1, frameSeqId: 3, hasPartialUpdate: false } })
  const result = analyzePopupFrameTrace(events)
  assert.equal(result.drawnFrames, 11)
  assert.equal(result.droppedFrames, 2)
  assert.equal(result.partialFrames, 1)
  assert.equal(result.fullyDroppedFrames, 1)
  assert.equal(result.zeroDroppedFrames, false)
})

test('does not certify an occluded 1Hz renderer or count another page', () => {
  const events = sample()
  events.push({ name: 'DroppedFrame', ts: 32000, pid: 2, args: { layerTreeId: 5, frameSeqId: 2 } })
  assert.equal(analyzePopupFrameTrace(events).droppedFrames, 0)
  const throttled = events.filter(event => !['BeginFrame', 'DrawFrame'].includes(event.name) || event.ts < 2000)
  assert.equal(analyzePopupFrameTrace(throttled).zeroDroppedFrames, false)
})

test('rejects incomplete traces instead of reporting a false zero', () => {
  assert.throws(() => analyzePopupFrameTrace([]), /complete owned input interval/)
})
