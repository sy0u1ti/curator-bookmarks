import assert from 'node:assert/strict'
import {
  canUseNewtabSearchFocus,
  getNewtabBlankPointerAction,
  getNewtabSearchFocusIntent,
  getNextNewtabSearchValue
} from './newtab-search-focus.js'

const baseEvent = {
  altKey: false,
  ctrlKey: false,
  defaultPrevented: false,
  isComposing: false,
  key: '',
  metaKey: false,
  shiftKey: false
}

assert.deepEqual(
  getNewtabSearchFocusIntent({ ...baseEvent, key: 'g' }),
  { type: 'append', text: 'g' },
  'Typing a printable character should move focus into search and preserve the character.'
)

assert.deepEqual(
  getNewtabSearchFocusIntent({ ...baseEvent, key: '/' }),
  { type: 'select' },
  'Slash should keep the existing explicit focus shortcut.'
)

assert.deepEqual(
  getNewtabSearchFocusIntent({ ...baseEvent, key: 'Backspace' }),
  { type: 'backspace' },
  'Backspace should edit a retained search query after focus moved away.'
)

assert.deepEqual(
  getNewtabSearchFocusIntent({ ...baseEvent, isComposing: true, key: 'Process' }),
  { type: 'focus' },
  'IME composition should focus the input without synthesizing text.'
)

assert.equal(
  getNewtabSearchFocusIntent({ ...baseEvent, key: 'ArrowDown' }),
  null,
  'Navigation keys should not steal focus.'
)

assert.equal(
  getNewtabSearchFocusIntent({ ...baseEvent, ctrlKey: true, key: 'k' }),
  null,
  'Modified shortcuts should remain available to the browser and extension.'
)

assert.equal(
  getNewtabSearchFocusIntent({ ...baseEvent, key: ' ' }),
  null,
  'Space should keep its native activation and scrolling behavior.'
)

const availableContext = {
  dashboardOpen: false,
  draggingBookmark: false,
  draggingFolder: false,
  draggingSpeedDial: false,
  editableTarget: false,
  enabled: true,
  featuredPickerOpen: false,
  menuOpen: false,
  settingsOpen: false
}

assert.equal(canUseNewtabSearchFocus(availableContext), true)
for (const blockedKey of [
  'dashboardOpen',
  'draggingBookmark',
  'draggingFolder',
  'draggingSpeedDial',
  'editableTarget',
  'featuredPickerOpen',
  'menuOpen',
  'settingsOpen'
] as const) {
  assert.equal(
    canUseNewtabSearchFocus({ ...availableContext, [blockedKey]: true }),
    false,
    `${blockedKey} should keep global typing from stealing focus.`
  )
}
assert.equal(canUseNewtabSearchFocus({ ...availableContext, enabled: false }), false)

assert.equal(
  getNextNewtabSearchValue('gi', { type: 'append', text: 't' }),
  'git'
)
assert.equal(
  getNextNewtabSearchValue('git', { type: 'backspace' }),
  'gi'
)
assert.equal(
  getNextNewtabSearchValue('git', { type: 'focus' }),
  'git'
)

assert.equal(
  getNewtabBlankPointerAction(false),
  'focus',
  'The first blank click should focus search.'
)
assert.equal(
  getNewtabBlankPointerAction(true),
  'blur',
  'A second blank click should release search focus.'
)

console.log('newtab search focus tests passed')
