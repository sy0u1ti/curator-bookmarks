import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'

export async function runSliderWeightChecks(page, origin, directory) {
  const report = { checks: [], failures: [], screenshots: [] }
  const record = (name, detail = {}) => report.checks.push({ name, pass: true, detail })
  const settleFrame = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  const press = async (selector, key) => {
    await page.press(selector, key)
    await settleFrame()
  }
  const value = id => page.evaluate(id => Number(document.querySelector(`#${id} input`).value), id)
  const geometry = id => page.evaluate(id => {
    const control = document.querySelector(`#${id} .base-slider-thumb`).parentElement
    const bounds = control.getBoundingClientRect()
    const thumb = document.querySelector(`#${id} .base-slider-thumb`).getBoundingClientRect()
    const input = control.querySelector('input')
    return { left: bounds.left, width: bounds.width, y: bounds.top + bounds.height / 2,
      thumbX: thumb.left + thumb.width / 2, min: Number(input.min), max: Number(input.max) }
  }, id)
  const dragTo = async (id, target, steps = 8) => {
    const track = await geometry(id)
    const destination = track.left + (target - track.min) / (track.max - track.min) * track.width
    await page.mouse.move(track.thumbX, track.y)
    await page.mouse.down()
    for (let step = 1; step <= steps; step++) {
      await page.mouse.move(track.thumbX + (destination - track.thumbX) * step / steps, track.y)
    }
    await settleFrame()
    const beforeRelease = await value(id)
    await page.mouse.up()
    await settleFrame()
    assert.equal(await value(id), beforeRelease, 'Releasing must commit the displayed value without jumping to the raw pointer.')
    return beforeRelease
  }
  const capture = async name => {
    const dimensions = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }))
    const result = await page.cdp('Page.captureScreenshot', {
      format: 'png', captureBeyondViewport: false, clip: { x: 0, y: 0, ...dimensions, scale: 1 }
    })
    const path = `${directory}/${name}.png`
    await writeFile(path, Buffer.from(result.data, 'base64'))
    report.screenshots.push(path)
  }
  try {
    await page.cdp('Emulation.setFocusEmulationEnabled', { enabled: true })
    for (const width of [1440, 768, 390]) {
      await page.cdp('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false })
      await page.goto(`${origin}/?surface=sliders`)
      await page.waitForSelector('#weighted-controlled input')
      console.log((await page.snapshot()).split('\n').filter(line => /调节|控件|设置|档位/.test(line)).join('\n'))
      const track = await geometry('weighted-controlled')
      await page.mouse.move(track.thumbX, track.y)
      await page.mouse.down()
      await page.mouse.move(track.thumbX + 1, track.y)
      assert.equal(await value('weighted-controlled'), 50, 'A one-pixel tremor must not escape the default detent.')
      await page.mouse.move(track.thumbX + 14, track.y)
      assert.ok(await value('weighted-controlled') > 50, 'The detent must release without sticking.')
      await page.mouse.up()
      const committed = await dragTo('weighted-controlled', 78)
      assert.ok(committed >= 76 && committed <= 78)
      const writes = await page.evaluate(() => ({
        changes: window.__sliderWeight.changes,
        commits: window.__sliderWeight.commits,
        target: window.__sliderWeight.targets.at(-1),
        output: Number(document.getElementById('weighted-value').textContent)
      }))
      assert.equal(writes.commits.at(-1), committed)
      assert.equal(writes.target, committed)
      assert.equal(writes.output, committed)
      await press('#weighted-controlled input', 'Home')
      assert.equal(await value('weighted-controlled'), 0)
      await press('#weighted-controlled input', 'End')
      assert.equal(await value('weighted-controlled'), 100)
      await press('#weighted-controlled input', 'ArrowLeft')
      assert.equal(await value('weighted-controlled'), 99)
      await page.evaluate(() => window.__sliderWeight.configure({ value: 50 }))
      await settleFrame()
      await press('#weighted-controlled input', 'ArrowRight')
      assert.equal(await value('weighted-controlled'), 51, 'Keyboard input must bypass pointer detents.')
      await press('#weighted-controlled input', 'ArrowLeft')
      const clickedTrack = await geometry('weighted-controlled')
      await page.mouse.click(clickedTrack.left + clickedTrack.width * 0.25, clickedTrack.y)
      await settleFrame()
      assert.ok(Math.abs(await value('weighted-controlled') - 25) <= 1, 'Track clicking must remain direct.')
      record(`${width}/mouse keyboard commit and detents`, writes)
      await dragTo('weighted-uncontrolled', 70)
      await dragTo('weighted-uncontrolled', 0)
      assert.equal(await value('weighted-uncontrolled'), 0)
      await dragTo('weighted-uncontrolled', 100)
      assert.equal(await value('weighted-uncontrolled'), 100)
      record(`${width}/uncontrolled endpoint reachability`)

      const bridge = await dragTo('weighted-bridge', 68)
      await page.waitForFunction(() => window.__sliderWeight.changeEvents.length > 0)
      const bridgeEvents = await page.evaluate(() => ({
        input: window.__sliderWeight.inputEvents.at(-1), change: window.__sliderWeight.changeEvents.at(-1)
      }))
      assert.equal(bridgeEvents.input, bridge)
      assert.equal(bridgeEvents.change, bridge)
      await page.evaluate(() => {
        Object.assign(document.querySelector('#weighted-bridge input'), {
          min: '10', max: '90', step: '5', value: '45'
        })
      })
      await page.waitForFunction(() => document.querySelector('#weighted-bridge input').getAttribute('aria-valuenow') === '45')
      await press('#weighted-bridge input', 'ArrowRight')
      assert.equal(await value('weighted-bridge'), 50)
      record(`${width}/legacy DOM bridge`)
      await capture(`sliders-${width}`)
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
      assert.ok(overflow <= 1)
    }

    await page.evaluate(() => window.__sliderWeight.configure({ disabled: true, value: 40 }))
    await settleFrame()
    const disabledTrack = await geometry('weighted-controlled')
    await page.mouse.click(disabledTrack.left + disabledTrack.width * 0.8, disabledTrack.y)
    assert.equal(await value('weighted-controlled'), 40)
    await page.evaluate(() => { window.__sliderWeight.configure({ disabled: false }); window.__sliderWeight.reject = true })
    await settleFrame()
    await dragTo('weighted-controlled', 80)
    assert.equal(await value('weighted-controlled'), 40, 'Canceling a consumer change must not publish a value.')
    await page.evaluate(() => { window.__sliderWeight.reject = false })
    record('disabled and consumer cancellation')
    await page.evaluate(() => window.__sliderWeight.configure({ min: -2.5, max: 2.5, step: 0.1, value: 0 }))
    await settleFrame()
    const fractional = await dragTo('weighted-controlled', 1.3)
    assert.ok(Math.abs(fractional * 10 - Math.round(fractional * 10)) < 0.000001)
    await press('#weighted-controlled input', 'ArrowRight')
    assert.ok(Math.abs(await value('weighted-controlled') - fractional - 0.1) < 0.000001)
    record('fractional steps and dynamic limits')
    await page.evaluate(() => window.__sliderWeight.configure({ min: 0, max: 100, step: 1, value: 20 }))
    await settleFrame()
    await page.cdp('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 })
    const touchTrack = await geometry('weighted-controlled')
    await page.cdp('Input.dispatchTouchEvent', {
      type: 'touchStart', touchPoints: [{ x: touchTrack.thumbX, y: touchTrack.y }]
    })
    await page.cdp('Input.dispatchTouchEvent', {
      type: 'touchMove', touchPoints: [{ x: touchTrack.left + touchTrack.width * 0.65, y: touchTrack.y }]
    })
    await settleFrame()
    const beforeCancel = await value('weighted-controlled')
    assert.ok(beforeCancel >= 63 && beforeCancel <= 65)
    await page.cdp('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] })
    await page.mouse.move(touchTrack.left + touchTrack.width * 0.9, touchTrack.y)
    await settleFrame()
    assert.equal(await value('weighted-controlled'), beforeCancel)
    await page.cdp('Emulation.setTouchEmulationEnabled', { enabled: false })
    record('touch movement and cancellation preserve the visible value')
    await page.cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
    await dragTo('weighted-controlled', 65)
    const motion = await page.evaluate(() => {
      const thumb = document.querySelector('#weighted-controlled .base-slider-thumb')
      return { scale: getComputedStyle(thumb).scale, transitions: getComputedStyle(thumb).transitionProperty }
    })
    assert.equal(motion.scale, '1')
    await press('#weighted-controlled input', 'Home')
    assert.equal(await value('weighted-controlled'), 0)
    record('reduced motion preserves precise value updates', motion)
    await page.cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] })

    await page.click('loc=role:button[name*="推理强度"]')
    await page.click('loc=role:button[name="高级设置"]')
    await page.waitForSelector('.reasoning-effort-slider', { state: 'visible' })
    await settleFrame()
    const reasoningTrack = await page.evaluate(() => {
      const rect = document.querySelector('.reasoning-effort-track').getBoundingClientRect()
      const knob = document.querySelector('.reasoning-effort-knob').getBoundingClientRect()
      return { left: rect.left, width: rect.width, y: rect.top + rect.height / 2, knobX: knob.left + knob.width / 2 }
    })
    await page.mouse.move(reasoningTrack.knobX, reasoningTrack.y)
    await page.mouse.down()
    await page.mouse.move(reasoningTrack.left + reasoningTrack.width * 0.76, reasoningTrack.y)
    const preview = await page.evaluate(() => document.querySelector('.reasoning-effort-slider').getAttribute('aria-valuenow'))
    await page.mouse.up()
    const settling = await page.evaluate(async () => {
      const positions = []
      const values = []
      const slider = document.querySelector('.reasoning-effort-slider')
      for (let frame = 0; frame < 22; frame++) {
        await new Promise(resolve => requestAnimationFrame(resolve))
        positions.push(Number(slider.style.getPropertyValue('--reasoning-progress')))
        values.push(slider.getAttribute('aria-valuenow'))
      }
      return { positions, values, committed: window.__sliderWeight.reasoning.at(-1) }
    })
    assert.ok(settling.values.every(value => value === preview), 'The committed tier must not change during the visual settle.')
    const target = Number(preview) / 3
    const initial = settling.positions[0]
    for (let index = 1; index < settling.positions.length; index++) {
      assert.ok(Math.abs(settling.positions[index] - target) <= Math.abs(settling.positions[index - 1] - target) + 0.00001)
      assert.ok(settling.positions[index] >= Math.min(initial, target) - 0.00001 &&
        settling.positions[index] <= Math.max(initial, target) + 0.00001, 'Tier settle must not overshoot.')
    }
    assert.ok(Math.abs(settling.positions.at(-1) - target) < 0.002)
    await press('.reasoning-effort-slider', 'Home')
    assert.equal(await page.evaluate(() => document.querySelector('.reasoning-effort-slider').getAttribute('aria-valuenow')), '0')
    await press('.reasoning-effort-slider', 'End')
    assert.equal(await page.evaluate(() => document.querySelector('.reasoning-effort-slider').getAttribute('aria-valuenow')), '3')
    const beforeReasoningCancel = await page.evaluate(() => window.__sliderWeight.reasoning.length)
    await page.mouse.move(reasoningTrack.left + reasoningTrack.width - 17, reasoningTrack.y)
    await page.mouse.down()
    await page.mouse.move(reasoningTrack.left + 17, reasoningTrack.y)
    await page.evaluate(() => {
      document.querySelector('.reasoning-effort-slider').dispatchEvent(new PointerEvent('pointercancel', { bubbles: true }))
    })
    await page.mouse.up()
    await settleFrame()
    assert.equal(await page.evaluate(() => window.__sliderWeight.reasoning.length), beforeReasoningCancel)
    assert.equal(await page.evaluate(() => document.querySelector('.reasoning-effort-slider').getAttribute('aria-valuenow')), '3')
    record('reasoning tier settles monotonically and commits immediately', settling)
    assert.deepEqual(await page.evaluate(() => window.__fixtureErrors), [])
  } catch (error) {
    report.failures.push({ name: 'slider regression', error: String(error) })
    await capture('slider-failure').catch(() => {})
  }
  return report
}
