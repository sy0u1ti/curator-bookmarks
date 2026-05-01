import assert from 'node:assert/strict'
import { test } from 'node:test'

import { getVerticalCenterCollisionOffset } from '../src/newtab/content-state.js'

test('does not offset vertically centered icons when utility stack has enough clearance', () => {
  assert.equal(getVerticalCenterCollisionOffset({
    utilityBottom: 120,
    contentTop: 132
  }), 0)
})

test('offsets vertically centered icons only enough to clear the utility stack', () => {
  assert.equal(getVerticalCenterCollisionOffset({
    utilityBottom: 160,
    contentTop: 140
  }), 32)
})

test('supports custom minimum clearance for compact viewports', () => {
  assert.equal(getVerticalCenterCollisionOffset({
    utilityBottom: 160,
    contentTop: 140,
    minimumGap: 4
  }), 24)
})
