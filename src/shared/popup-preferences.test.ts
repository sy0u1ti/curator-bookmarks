import assert from 'node:assert/strict'
import {
  DEFAULT_POPUP_PREFERENCES,
  normalizePopupPreferences
} from './popup-preferences.js'

function testDefaultsAndUnknownValues(): void {
  assert.deepEqual(normalizePopupPreferences(null), DEFAULT_POPUP_PREFERENCES)
  assert.deepEqual(normalizePopupPreferences([]), DEFAULT_POPUP_PREFERENCES)
  assert.deepEqual(normalizePopupPreferences('invalid'), DEFAULT_POPUP_PREFERENCES)
  assert.deepEqual(normalizePopupPreferences({}), DEFAULT_POPUP_PREFERENCES)
}

function testStoredValues(): void {
  assert.deepEqual(normalizePopupPreferences({
    animatedCaret: false,
    naturalSearchEnabled: true
  }), {
    animatedCaret: false,
    naturalSearchEnabled: true
  })

  assert.deepEqual(normalizePopupPreferences({
    animatedCaret: 'false',
    naturalSearchEnabled: 1
  }), DEFAULT_POPUP_PREFERENCES)

  assert.deepEqual(normalizePopupPreferences({
    animatedSearchCaret: false,
    naturalSearchEnabled: true
  }), {
    animatedCaret: false,
    naturalSearchEnabled: true
  })
}

testDefaultsAndUnknownValues()
testStoredValues()
console.log('Popup preferences tests passed.')
