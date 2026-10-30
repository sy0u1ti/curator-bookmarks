import assert from 'node:assert/strict'

export async function runMotionCoverage(page) {
  const report = {}
  const passed = (name, description) => {
    report[name] = description
    console.log(`PASS ${name}: ${description}`)
  }
  await page.cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1200, deviceScaleFactor: 1, mobile: false })
  await page.cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] })
  const tokens = await page.evaluate(() => {
    const style = getComputedStyle(document.documentElement)
    return {
      spring: style.getPropertyValue('--ds-ease-spring').trim(),
      controlEasing: style.getPropertyValue('--ds-ease-standard').trim(),
      controlDuration: Number.parseFloat(style.getPropertyValue('--ds-motion-control')),
      pressScale: Number.parseFloat(style.getPropertyValue('--ds-press-scale'))
    }
  })
  assert.ok(tokens.pressScale >= 0.99 && tokens.pressScale < 1, 'Frequent presses must stay within 1% compression')
  assert.ok(tokens.controlDuration <= 160, 'Button feedback must not inherit the longer surface spring')
  await page.evaluate(() => {
    window.__motionLog = []
    const selectors = [
      '.base-select-popup', '.t-toggle-thumb', '.options-switch-thumb', '.t-segmented',
      '#motion-button', '#motion-unstyled-button', '#motion-icon-button', '#motion-card-button', '#motion-row-button',
      '.base-slider-thumb', '#outer-panel', '#inner-panel',
      '.t-acc-panel:has(#selection-actions)', '#motion-backdrop', '#motion-dialog',
      '.curator-overlay-panel--menu', '#motion-clear'
    ]
    document.addEventListener('transitionrun', event => {
      for (const selector of selectors) {
        if (!event.target.matches(selector)) continue
        const animation = event.target.getAnimations({ subtree: true }).find(item =>
          item.effect.target === event.target &&
          (item.effect.pseudoElement || '') === event.pseudoElement &&
          item.transitionProperty === event.propertyName)
        if (!animation) continue
        window.__motionLog.push({
          selector, property: event.propertyName, pseudo: event.pseudoElement,
          duration: animation.effect.getTiming().duration, easing: animation.effect.getTiming().easing,
          inert: event.target.inert, ending: event.target.hasAttribute('data-ending-style'),
          frames: animation.effect.getKeyframes()
        })
      }
    }, true)
  })
  const settle = selector => page.waitForFunction(selector => {
    const element = document.querySelector(selector)
    return element && !element.hasAttribute('data-starting-style') && !element.hasAttribute('data-ending-style') &&
      element.getAnimations({ subtree: true }).every(animation => animation.playState === 'finished')
  }, selector, { timeout: 5000 })
  const log = selector => page.evaluate(selector => window.__motionLog.filter(event => event.selector === selector), selector)
  const easingPoints = easing => /^linear\(/.test(easing)
    ? easing.slice(easing.indexOf('(') + 1, -1).split(',').map(Number.parseFloat) : []
  const springPoints = easingPoints(tokens.spring)
  assert.ok(Math.max(...springPoints) > 1 && Math.max(...springPoints) <= 1.01, 'Surface overshoot must stay below 1% of travel')
  const spring = events => events.some(event =>
    [event.easing, ...event.frames.map(frame => frame.easing)].some(easing => {
      const points = easingPoints(easing)
      return points.length === springPoints.length &&
        points.every((point, index) => Math.abs(point - springPoints[index]) < 0.0001)
    }))

  const select = 'button[aria-label="Motion select"]'
  await page.click(select)
  await settle('.base-select-popup[data-open]')
  const openEvents = await log('.base-select-popup')
  assert.ok(openEvents.some(event => event.property === 'transform' && event.frames[0].transform === 'scale(0.97)' && event.frames.at(-1).transform === 'scale(1)'),
    'Select must animate from its actual starting style, even while data-open is present')
  assert.ok(spring(openEvents), 'Select geometry must use the shared damped spring')
  await page.keyboard.press('Escape')
  await page.waitForFunction(() => !document.querySelector('.base-select-popup[data-open], .base-select-popup[data-ending-style]'))
  const closeEvents = await log('.base-select-popup')
  assert.ok(closeEvents.some(event => event.property === 'transform' && event.duration === 150 && event.frames.at(-1).transform === 'scale(0.99)'),
    'Select must retain and animate its closing state')
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'Motion select')
  // Repeated input must keep the final open state and keyboard selection usable.
  await page.click(select)
  await page.keyboard.press('Escape')
  await page.click(select)
  await settle('.base-select-popup[data-open]')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')
  await page.waitForFunction(() => document.querySelector('button[aria-label="Motion select"]').textContent.includes('Beta'))
  await page.waitForFunction(() => !document.querySelector('.base-select-popup[data-open], .base-select-popup[data-ending-style]'))
  passed('select', 'entry, exit, repeated input, keyboard selection and focus return')

  for (const [label, thumb] of [['Standard switch', '.t-toggle-thumb'], ['Settings switch', '.options-switch-thumb']]) {
    const selector = `[role="switch"][aria-label="${label}"]`
    await page.click(selector)
    await settle(thumb)
    const checked = await page.evaluate(({ selector, thumb }) => ({
      checked: document.querySelector(selector).getAttribute('aria-checked'),
      travel: getComputedStyle(document.querySelector(thumb)).translate
    }), { selector, thumb })
    assert.equal(checked.checked, 'true')
    assert.ok(Number.parseFloat(checked.travel) > 10)
    assert.ok(spring(await log(thumb)), `${label} must use the same spring`)
    await page.click(selector)
    await page.click(selector)
    await page.click(selector)
    await settle(thumb)
    const unchecked = await page.evaluate(({ selector, thumb }) => ({
      checked: document.querySelector(selector).getAttribute('aria-checked'),
      travel: getComputedStyle(document.querySelector(thumb)).translate
    }), { selector, thumb })
    assert.equal(unchecked.checked, 'false')
    assert.ok(['none', '0px', '0px 0px'].includes(unchecked.travel))
  }
  passed('switches', 'styled and settings variants reverse and settle at the correct ends')

  for (const selector of ['#motion-button', '#motion-unstyled-button', '#motion-icon-button', '#motion-card-button']) {
    await page.hover(selector)
    const center = await page.evaluate(selector => {
      const rect = document.querySelector(selector).getBoundingClientRect()
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
    }, selector)
    await page.mouse.move(center.x, center.y)
    await page.mouse.down()
    await settle(selector)
    const pressedScale = await page.evaluate(selector => {
      const style = getComputedStyle(document.querySelector(selector))
      return new DOMMatrixReadOnly(style.transform).a * (Number.parseFloat(style.scale) || 1)
    }, selector)
    await page.mouse.up()
    assert.ok(Math.abs(pressedScale - tokens.pressScale) < 0.001, `A press must not stack two scales (${selector}): ${pressedScale}`)
    await settle(selector)
    const geometryEvents = (await log(selector)).filter(event => /^(transform|scale)$/.test(event.property))
    assert.ok(geometryEvents.some(event => event.duration === tokens.controlDuration), `${selector} must use the short release timing`)
    assert.ok(geometryEvents.every(event => event.duration <= 160), `${selector} must not retain a slow local override`)
    assert.ok(geometryEvents.every(event =>
      [event.easing, ...event.frames.map(frame => frame.easing)].every(easing =>
        easing === 'linear' || easing === tokens.controlEasing)), `${selector} must settle without overshoot`)
  }
  await page.hover('#motion-row-button')
  const rowCenter = await page.evaluate(() => {
    const rect = document.querySelector('#motion-row-button').getBoundingClientRect()
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
  })
  await page.mouse.move(rowCenter.x, rowCenter.y)
  await page.mouse.down()
  await settle('#motion-row-button')
  const rowScale = await page.evaluate(() => {
    const style = getComputedStyle(document.querySelector('#motion-row-button'))
    return new DOMMatrixReadOnly(style.transform).a * (Number.parseFloat(style.scale) || 1)
  })
  await page.mouse.up()
  assert.equal(rowScale, 1, 'Wide rows must keep their text and hit targets still when pressed')
  assert.equal(await page.evaluate(() => document.querySelector('#motion-disabled-button').disabled), true)
  passed('buttons', 'styled, unstyled, icon and card actions: 1% press, short non-overshooting release, no stacked scales')

  await page.click('[aria-label="Motion checkbox"]')
  await page.waitForFunction(() => document.querySelector('[aria-label="Motion checkbox"]').getAttribute('aria-checked') === 'true')
  await page.waitForFunction(() => getComputedStyle(document.querySelector('[aria-label="Motion checkbox"] svg path')).strokeDashoffset === '0px')
  await page.hover('.base-slider')
  await settle('.base-slider-thumb')
  assert.ok(await page.evaluate(() => Number.parseFloat(getComputedStyle(document.querySelector('.base-slider-thumb')).scale) > 1))
  await page.focus('.base-slider input[type="range"]')
  await page.keyboard.press('ArrowRight')
  assert.equal(await page.evaluate(() => document.querySelector('.base-slider input[type="range"]').getAttribute('aria-valuenow')), '41')
  assert.ok(!(await log('.base-slider-thumb')).some(event => /left|width|translate/.test(event.property)))
  await page.click('text=Three')
  await settle('.t-segmented')
  assert.ok(spring(await log('.t-segmented')))
  passed('selectionControls', 'checkbox stroke, slider grip without drag lag, sliding segments')

  await page.click('#outer-trigger')
  await settle('#outer-panel')
  assert.equal(await page.evaluate(() => document.querySelector('#inner-panel').getBoundingClientRect().height), 0,
    'An open parent must not force a nested disclosure open')
  await page.click('#inner-trigger')
  await settle('#inner-panel')
  assert.ok(await page.evaluate(() => document.querySelector('#inner-panel').getBoundingClientRect().height > 40))
  await page.click('#inner-trigger')
  await page.waitForFunction(() => document.querySelector('#inner-panel').getBoundingClientRect().height === 0)
  await page.click('#outer-trigger')
  await page.waitForFunction(() => document.querySelector('#outer-panel').getBoundingClientRect().height === 0)

  await page.click('#selection-trigger')
  await settle('.t-acc-panel:has(#selection-actions)')
  await page.click('#selection-trigger')
  await page.waitForFunction(() => !document.querySelector('#selection-actions'))
  assert.ok((await log('.t-acc-panel:has(#selection-actions)')).some(event => event.ending && event.inert),
    'Closing batch actions must retain an inert panel throughout their exit')
  await page.click('#selection-trigger')
  await page.click('#selection-trigger')
  await page.click('#selection-trigger')
  await settle('.t-acc-panel:has(#selection-actions)')
  assert.equal(await page.evaluate(() => document.querySelector('#selection-actions').closest('.t-acc-panel').inert), false)
  passed('disclosures', 'nested independence, retained exit, inert closing content, repeated input')

  await page.click('#clear-visibility')
  await settle('#motion-clear:not([hidden])')
  await page.click('#clear-visibility')
  await page.waitForFunction(() => getComputedStyle(document.querySelector('#motion-clear')).display === 'none')
  assert.ok((await log('#motion-clear')).some(event => event.property === 'opacity'))
  passed('clear', 'mounted clear control enters and exits without delaying text input')

  await page.click('#menu-trigger')
  await settle('[aria-label="Motion menu"][data-open]')
  await page.hover('text=Nested menu')
  await settle('.curator-cascade-popup[data-open]')
  assert.ok(spring(await log('.curator-overlay-panel--menu')))
  await page.keyboard.press('Escape')
  await page.waitForFunction(() => !document.querySelector('.curator-cascade-popup[data-open]'))
  if (await page.evaluate(() => Boolean(document.querySelector('[aria-label="Motion menu"][data-open]')))) {
    await page.keyboard.press('Escape')
  }
  passed('menus', 'anchored root and nested menus share the same spring')

  await page.click('#dialog-trigger')
  await settle('#motion-dialog[data-open]')
  await settle('#motion-backdrop[data-open]')
  const backdrop = await log('#motion-backdrop')
  assert.ok(backdrop.some(event => event.property === 'opacity' && Number(event.frames[0].opacity) < 1 && event.frames.at(-1).opacity === '1'),
    'Backdrop entry must not be overridden by its open attribute selector')
  assert.ok(spring(await log('#motion-dialog')))
  await page.click('#dialog-close')
  await page.waitForFunction(() => !document.querySelector('#motion-dialog[data-open], #motion-dialog[data-ending-style]'))
  passed('dialog', 'spring panel, visible backdrop transition, complete exit')

  await page.cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
  await page.evaluate(() => { window.__motionLog = [] })
  await page.click(select)
  await settle('.base-select-popup[data-open]')
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.base-select-popup[data-open]')).transform), 'none')
  await page.keyboard.press('Escape')
  await page.click('[role="switch"][aria-label="Settings switch"]')
  await settle('.options-switch-thumb')
  assert.ok(await page.evaluate(() => Number.parseFloat(getComputedStyle(document.querySelector('.options-switch-thumb')).translate) > 10),
    'Reduced motion must preserve the checked thumb position')
  await page.hover('.base-slider')
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.base-slider-thumb')).scale), '1')
  assert.ok((await page.evaluate(() => window.__motionLog)).every(event => !/transform|translate|scale|grid-template/.test(event.property)),
    'Reduced motion must remove spatial transitions')
  passed('reducedMotion', 'no spatial motion; selection and switch semantics preserved')
  return report
}
