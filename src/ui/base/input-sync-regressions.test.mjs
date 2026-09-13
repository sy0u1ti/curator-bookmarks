import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { chromium } from 'playwright'

const fixture = `
import React, { Suspense, startTransition, useLayoutEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { CheckboxControl } from './Checkbox';
import { SwitchControl } from './Switch';
import { Select } from './Select';
import { SliderControl } from './Slider';

const never = new Promise(() => {});
const inputs = {};
const callbacks = { checkbox: [], switch: [], select: [], slider: [] };
const retainedInputs = new Map();
const nativeEvents = Object.fromEntries(Object.keys(callbacks).map(key => [key, { input: 0, change: 0 }]));
const bridgedProperties = ['checked', 'disabled', 'value', 'min', 'max', 'step'];
const refs = Object.fromEntries(Object.keys(callbacks).map(key => [key, node => {
  inputs[key] = node;
  if (node && !retainedInputs.has(node)) {
    retainedInputs.set(node, Object.fromEntries(bridgedProperties.map(property => [property, Object.getOwnPropertyDescriptor(node, property)])));
    for (const type of ['input', 'change']) node.addEventListener(type, () => { nativeEvents[key][type] += 1; });
  }
}]));
let update;
let root;
function Suspend({ blocked }) {
  if (blocked) {
    window.suspensionAttempts += 1;
    throw never;
  }
  return null;
}
function App() {
  const [config, setConfig] = useState({ controlled: false, blocked: false, checked: false, value: 20, disabled: undefined, revision: 0 });
  update = setConfig;
  return <Suspense fallback={<p id="fallback">Loading</p>}>
    <p id="revision">{config.revision}</p>
    <section id="checkbox"><CheckboxControl syncInputState inputRef={refs.checkbox}
      checked={config.controlled ? config.checked : undefined} defaultChecked={false}
      disabled={config.disabled} onCheckedChange={value => callbacks.checkbox.push(value)} /></section>
    <section id="switch"><SwitchControl syncInputState inputRef={refs.switch}
      checked={config.controlled ? config.checked : undefined} defaultChecked={false}
      disabled={config.disabled} onCheckedChange={value => callbacks.switch.push(value)} /></section>
    <section id="select"><Select syncInputState inputRef={refs.select}
      value={config.controlled ? String(config.value) : undefined} defaultValue="20"
      disabled={config.disabled} options={[20, 40, 80].map(value => ({ value: String(value), label: 'Value ' + value }))}
      onValueChange={value => callbacks.select.push(value)} /></section>
    <section id="slider"><SliderControl syncInputState inputRef={refs.slider}
      value={config.controlled ? config.value : undefined} defaultValue={20}
      disabled={config.disabled} onValueChange={value => callbacks.slider.push(value)} /></section>
    <Suspend blocked={config.blocked} />
  </Suspense>;
}
window.suspensionAttempts = 0;
window.fixture = {
  pending: () => startTransition(() => update(current => ({ ...current, controlled: true, checked: true, value: 80, disabled: true, blocked: true, revision: 1 }))),
  discard: () => flushSync(() => update(current => ({ ...current, controlled: false, disabled: undefined, blocked: false, revision: 2 }))),
  controlled: (checked, value, disabled = false) => flushSync(() => update(current => ({ ...current, controlled: true, checked, value, disabled, blocked: false, revision: current.revision + 1 }))),
  uncontrolled: () => flushSync(() => update(current => ({ ...current, controlled: false, disabled: undefined, blocked: false, revision: current.revision + 1 }))),
  patch: (name, patch) => { Object.assign(inputs[name], patch); },
  snapshot: () => ({
    checkbox: { checked: document.querySelector('#checkbox [role="checkbox"]').getAttribute('aria-checked'), disabled: document.querySelector('#checkbox [role="checkbox"]').hasAttribute('data-disabled') },
    switch: { checked: document.querySelector('#switch [role="switch"]').getAttribute('aria-checked'), disabled: document.querySelector('#switch [role="switch"]').hasAttribute('data-disabled') },
    select: { value: document.querySelector('#select .base-select-value').textContent, disabled: document.querySelector('#select button').disabled },
    slider: { value: inputs.slider.value, ariaValue: inputs.slider.getAttribute('aria-valuenow'), disabled: inputs.slider.disabled, min: inputs.slider.min, max: inputs.slider.max, step: inputs.slider.step },
    callbacks: structuredClone(callbacks), nativeEvents: structuredClone(nativeEvents),
    revision: document.querySelector('#revision').textContent,
    fallback: Boolean(document.querySelector('#fallback'))
  }),
  unmount: () => {
    flushSync(() => root.unmount());
    return [...retainedInputs].every(([node, original]) => bridgedProperties.every(property => {
      const restored = Object.getOwnPropertyDescriptor(node, property);
      return restored?.get === original[property]?.get && restored?.set === original[property]?.set;
    }));
  }
};
root = createRoot(document.querySelector('#root'));
flushSync(() => root.render(<App />));
window.fixtureReady = true;
`

const compiled = await build({
  stdin: { contents: fixture, loader: 'tsx', resolveDir: fileURLToPath(new URL('.', import.meta.url)) },
  bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'silent'
})
const browser = await chromium.launch({ channel: 'chromium', headless: true })
try {
  const page = await browser.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  const reset = async () => {
    await page.goto('about:blank')
    await page.setContent('<style>section{margin:12px} [role="switch"]{display:inline-block;width:44px;height:24px}</style><div id="root"></div>')
    await page.addScriptTag({ content: compiled.outputFiles[0].text })
    await page.waitForFunction(() => window.fixtureReady)
  }
  await reset()
  await page.evaluate(() => window.fixture.pending())
  await page.waitForFunction(() => window.suspensionAttempts > 0)
  const suspended = await page.evaluate(() => window.fixture.snapshot())
  assert.equal(suspended.revision, '0', 'the transition must remain uncommitted')
  assert.equal(suspended.fallback, false, 'the committed controls should remain visible during the transition')
  await page.locator('#switch [role="switch"]').click()
  await page.evaluate(() => {
    window.fixture.patch('checkbox', { checked: true });
    window.fixture.patch('select', { value: '40' });
    window.fixture.patch('slider', { value: '40' });
  })
  await page.evaluate(() => new Promise(requestAnimationFrame))
  const afterWrites = await page.evaluate(() => window.fixture.snapshot())
  assert.deepEqual({
    switchChange: afterWrites.callbacks.switch.at(-1), checkbox: afterWrites.checkbox.checked,
    select: afterWrites.select.value, slider: afterWrites.slider.ariaValue
  }, { switchChange: true, checkbox: 'true', select: 'Value 40', slider: '40' },
  'uncommitted props must not disable live events or suppress the committed uncontrolled DOM bridges')
  await page.evaluate(() => window.fixture.discard())
  const discarded = await page.evaluate(() => window.fixture.snapshot())
  assert.deepEqual({ checkbox: discarded.checkbox.checked, switch: discarded.switch.checked, select: discarded.select.value, slider: discarded.slider.ariaValue },
    { checkbox: 'true', switch: 'true', select: 'Value 40', slider: '40' }, 'discarding the transition must preserve live user/legacy changes')
  await reset()
  await page.evaluate(() => window.fixture.controlled(true, 80))
  const controlled = await page.evaluate(() => window.fixture.snapshot())
  assert.deepEqual({ checkbox: controlled.checkbox.checked, switch: controlled.switch.checked, select: controlled.select.value, slider: controlled.slider.ariaValue },
    { checkbox: 'true', switch: 'true', select: 'Value 80', slider: '80' }, 'committed controlled values must reach the live controls')
  await page.evaluate(() => window.fixture.uncontrolled())
  const released = await page.evaluate(() => window.fixture.snapshot())
  assert.deepEqual({ checkbox: released.checkbox.checked, switch: released.switch.checked, select: released.select.value, slider: released.slider.ariaValue },
    { checkbox: 'false', switch: 'false', select: 'Value 20', slider: '20' },
    'React-owned DOM writes during control handoff must not overwrite the stored uncontrolled values')
  await page.evaluate(() => {
    for (const name of ['checkbox', 'switch', 'select', 'slider']) window.fixture.patch(name, { disabled: true });
  })
  await page.waitForFunction(() => {
    const state = window.fixture.snapshot();
    return state.checkbox.disabled && state.switch.disabled && state.select.disabled && state.slider.disabled;
  })
  await page.evaluate(() => {
    for (const name of ['checkbox', 'switch', 'select', 'slider']) window.fixture.patch(name, { disabled: false });
    window.fixture.patch('slider', { min: '10', max: '90', step: '5', value: '45' });
  })
  await page.waitForFunction(() => window.fixture.snapshot().slider.ariaValue === '45')
  const legacy = await page.evaluate(() => window.fixture.snapshot())
  assert.deepEqual(legacy.slider, { value: '45', ariaValue: '45', disabled: false, min: '10', max: '90', step: '5' },
    'legacy range limits, step, value and disabled writes must stay synchronized')
  assert.deepEqual([legacy.checkbox.disabled, legacy.switch.disabled, legacy.select.disabled], [false, false, false])
  await page.locator('#slider input[type="range"]').press('ArrowRight')
  await page.waitForFunction(() => window.fixture.snapshot().slider.ariaValue === '50')
  const keyboard = await page.evaluate(() => window.fixture.snapshot())
  assert.equal(keyboard.callbacks.slider.at(-1), 50, 'native keyboard input must still notify React consumers')
  assert.ok(keyboard.nativeEvents.slider.input >= 1, 'native input events must remain visible to legacy listeners')
  assert.ok(keyboard.nativeEvents.slider.change >= 1, 'committed keyboard changes must still notify legacy listeners')
  assert.equal(await page.evaluate(() => window.fixture.unmount()), true, 'unmount must restore the original input property descriptors')
  assert.deepEqual(errors, [], 'input synchronization should not report browser runtime errors')
  console.log('Input synchronization concurrent-render regressions passed.')
} finally {
  await browser.close()
}
