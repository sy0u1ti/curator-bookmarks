import assert from 'node:assert/strict'
import { createUiViewStoreSlice } from './ui-view-store.js'

const newtabCounter = createUiViewStoreSlice('newtab', 'test-counter', { count: 0 })
const popupCounter = createUiViewStoreSlice('popup', 'test-counter', { count: 10 })
const newtabLabel = createUiViewStoreSlice('newtab', 'test-label', 'idle')

assert.deepEqual(newtabCounter.getState(), { count: 0 })
assert.deepEqual(popupCounter.getState(), { count: 10 })
assert.equal(newtabLabel.getState(), 'idle')

let counterNotifications = 0
let labelNotifications = 0
const unsubscribeCounter = newtabCounter.subscribe(() => {
  counterNotifications += 1
})
const unsubscribeLabel = newtabLabel.subscribe(() => {
  labelNotifications += 1
})

newtabCounter.setState((state) => ({ count: state.count + 1 }))
assert.deepEqual(newtabCounter.getState(), { count: 1 })
assert.deepEqual(popupCounter.getState(), { count: 10 })
assert.equal(counterNotifications, 1)
assert.equal(labelNotifications, 0)

newtabCounter.setState(newtabCounter.getState())
assert.equal(counterNotifications, 1)

newtabLabel.setState('ready')
assert.equal(newtabLabel.getState(), 'ready')
assert.equal(counterNotifications, 1)
assert.equal(labelNotifications, 1)

unsubscribeCounter()
unsubscribeLabel()
newtabCounter.setState({ count: 2 })
newtabLabel.setState('done')
assert.equal(counterNotifications, 1)
assert.equal(labelNotifications, 1)

console.log('UI view store tests passed.')
