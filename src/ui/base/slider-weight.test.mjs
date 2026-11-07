import assert from 'node:assert/strict'
import { test } from 'node:test'
import { build } from 'esbuild'

const { outputFiles } = await build({
  entryPoints: ['src/ui/base/slider-weight.ts'], bundle: true, write: false, format: 'esm', platform: 'node'
})
const { advanceSliderWeight, createSliderWeight } = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`)
const options = { min: 0, max: 100, step: 1, trackPixels: 180, detents: [50] }

test('small pointer tremors do not move the value; deliberate dragging remains close to the pointer', () => {
  let state = createSliderWeight(30)
  for (const raw of [30.3, 29.8, 30.5, 30.1]) {
    state = advanceSliderWeight(state, raw, options)
    assert.equal(state.value, 30)
  }
  state = advanceSliderWeight(state, 40, options)
  assert.equal(state.value, 39)
  assert.ok(Math.abs(state.value - 40) / 100 * options.trackPixels < 3)
  const stopped = state
  for (let index = 0; index < 20; index++) state = advanceSliderWeight(state, 40, options)
  assert.deepEqual(state, stopped, 'No delayed convergence or inertia after movement stops.')
})

test('a default detent has a short capture and release distance without trapping the pointer', () => {
  let state = advanceSliderWeight(createSliderWeight(46), 49, options)
  assert.equal(state.value, 50)
  assert.equal(state.detent, 50)
  for (const raw of [50, 51, 49]) {
    state = advanceSliderWeight(state, raw, options)
    assert.equal(state.value, 50)
  }
  state = advanceSliderWeight(state, 54, options)
  assert.equal(state.detent, null)
  assert.ok(state.value > 50)
  state = advanceSliderWeight(state, 46, options)
  assert.ok(state.value < 50)
})

test('normalized continuous sliders receive the same pixel resistance as percentage sliders', () => {
  const config = { min: 0, max: 1, step: 0.0001, trackPixels: 300 }
  const state = advanceSliderWeight(createSliderWeight(0.4), 0.8, config)
  const lagPixels = (0.8 - state.value) * config.trackPixels
  assert.ok(lagPixels >= 1.9 && lagPixels <= 2.1)
})

test('a continuous sweep is monotonic, bounded and reaches both endpoints', () => {
  for (const trackPixels of [96, 180, 340, 720]) {
    let state = createSliderWeight(0)
    for (let raw = 0; raw <= 100; raw++) {
      const next = advanceSliderWeight(state, raw, { ...options, trackPixels })
      assert.ok(next.value >= state.value && next.value <= 100)
      state = next
    }
    assert.equal(state.value, 100)
    for (let raw = 100; raw >= 0; raw--) {
      const next = advanceSliderWeight(state, raw, { ...options, trackPixels })
      assert.ok(next.value <= state.value && next.value >= 0)
      state = next
    }
    assert.equal(state.value, 0)
  }
})

test('fractional and nonzero-origin steps remain valid and invalid geometry is harmless', () => {
  const config = { min: -2.5, max: 2.5, step: 0.1, trackPixels: 200, detents: [0, 0.05, 20] }
  let state = createSliderWeight(-2.5)
  for (let index = 0; index <= 500; index++) {
    state = advanceSliderWeight(state, -2.5 + index / 100, config)
    const stepIndex = (state.value - config.min) / config.step
    assert.ok(Math.abs(stepIndex - Math.round(stepIndex)) < 0.000001)
  }
  assert.equal(state.value, 2.5)
  for (const patch of [{ step: 0 }, { trackPixels: 0 }, { max: -3 }, { step: NaN }]) {
    assert.deepEqual(advanceSliderWeight(state, 1, { ...config, ...patch }), state)
  }
  assert.deepEqual(advanceSliderWeight(state, NaN, config), state)
})
