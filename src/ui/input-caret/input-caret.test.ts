import assert from 'node:assert/strict'
import {
  clampInputCaretLeft,
  getInputCaretTrailGeometry,
  isFastInputCaretUpdate,
  isInputCaretNavigationKey,
  maskInputCaretPasswordText,
  shouldSnapInputCaret
} from './input-caret.js'

function testNavigationKeys(): void {
  for (const key of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'Backspace', 'Delete']) {
    assert.equal(isInputCaretNavigationKey(key), true, `${key} must refresh the custom caret`)
  }
  for (const key of ['a', 'Enter', 'Escape', 'Shift']) {
    assert.equal(isInputCaretNavigationKey(key), false, `${key} must retain input-driven caret motion`)
  }
}

function testCaretClamp(): void {
  assert.equal(clampInputCaretLeft(-4, 2, 20), 2)
  assert.equal(clampInputCaretLeft(12, 2, 20), 12)
  assert.equal(clampInputCaretLeft(28, 2, 20), 20)
  assert.equal(clampInputCaretLeft(Number.NaN, 2, 20), 2)
}

function testFastInputTiming(): void {
  assert.equal(isFastInputCaretUpdate(null, 0), false, 'the first edit keeps normal motion')
  assert.equal(isFastInputCaretUpdate(0, 0), true, 'edits within one timestamp still form a burst')
  assert.equal(isFastInputCaretUpdate(100, 132), true, 'held-key input must not restart a slow transition')
  assert.equal(isFastInputCaretUpdate(100, 219), true)
  assert.equal(isFastInputCaretUpdate(100, 220), false, 'normal motion resumes after the fast-input window')
  assert.equal(isFastInputCaretUpdate(100, 400), false)
  assert.equal(isFastInputCaretUpdate(100, 90), false, 'an invalid clock interval must not form a burst')
}

function testSnapRules(): void {
  assert.equal(shouldSnapInputCaret(null, { left: 10, top: 4 }), true)
  assert.equal(shouldSnapInputCaret({ left: 10, top: 4 }, { left: 18, top: 4 }), false)
  assert.equal(shouldSnapInputCaret({ left: 10, top: 4 }, { left: 18, top: 4 }, true), true)
  assert.equal(shouldSnapInputCaret({ left: 10, top: 4 }, { left: 18, top: 12 }), true)
}

function testTrailGeometry(): void {
  assert.deepEqual(getInputCaretTrailGeometry(
    { left: 10, top: 4 },
    { left: 42, top: 4 }
  ), {
    direction: 'right',
    left: 10,
    width: 32
  })
  assert.deepEqual(getInputCaretTrailGeometry(
    { left: 80, top: 4 },
    { left: 32, top: 4 }
  ), {
    direction: 'left',
    left: 32,
    width: 48
  })
  assert.equal(getInputCaretTrailGeometry(
    { left: 10, top: 4 },
    { left: 11, top: 4 }
  ), null)
  assert.equal(getInputCaretTrailGeometry(
    { left: 10, top: 4 },
    { left: 40, top: 12 }
  ), null)
  assert.equal(getInputCaretTrailGeometry(
    { left: 0, top: 4 },
    { left: 240, top: 4 }
  )?.width, 96)
}

function testPasswordMask(): void {
  assert.equal(maskInputCaretPasswordText('a😀b'), '•••')
}

testNavigationKeys()
testFastInputTiming()
testCaretClamp()
testSnapRules()
testTrailGeometry()
testPasswordMask()
console.log('Input caret tests passed.')
