import assert from 'node:assert/strict'

const isRound = shape => /^(?:round|superellipse\(1\))$/.test(shape.curve)

const settled = page => page.evaluate(async () => {
  await document.fonts.ready
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  await Promise.all(document.getAnimations().filter(animation => animation.effect?.getTiming().iterations !== Infinity)
    .map(animation => animation.finished.catch(() => {})))
})

export async function runCornerGeometryChecks(page, origin, directory) {
  const report = []
  for (const deviceScaleFactor of [1, 1.25, 2]) {
    await page.cdp('Emulation.setDeviceMetricsOverride', { width: 800, height: 1100, deviceScaleFactor, mobile: false })
    await page.goto(origin)
    await page.waitForSelector('#corner-card')
    await settled(page)
    const metrics = await page.evaluate(() => {
      const shape = selector => {
        const element = document.querySelector(selector)
        const style = getComputedStyle(element)
        return { radius: parseFloat(style.borderTopLeftRadius), curve: style.cornerShape, clip: style.clipPath }
      }
      const pair = (outer, inner) => {
        const outerElement = document.querySelector(outer)
        const innerElement = document.querySelector(inner)
        const a = outerElement.getBoundingClientRect()
        const b = innerElement.getBoundingClientRect()
        return { outer: shape(outer), inner: shape(inner), inset: b.left - a.left }
      }
      const segments = document.querySelector('#corner-segments')
      const button = segments.querySelector('button')
      const indicator = getComputedStyle(segments, '::before')
      const composed = document.getElementById('corner-composed-card')
      const composedStyle = getComputedStyle(composed)
      const composedRect = composed.getBoundingClientRect()
      return {
        native: CSS.supports('corner-shape', 'superellipse(1.25)'),
        scannerStarted: Boolean(window.__curatorSquircleEngine),
        pairs: [
          pair('#corner-card', '#corner-input'), pair('#corner-nested', '#corner-inner'),
          pair('#corner-inner', '#corner-inner-button'), pair('#corner-bookmark', '.bookmark-icon-shell'),
          pair('#corner-segments', '#corner-segments button')
        ],
        indicator: {
          radius: parseFloat(indicator.borderTopLeftRadius), curve: indicator.cornerShape,
          width: parseFloat(indicator.width), buttonWidth: button.getBoundingClientRect().width,
          inset: parseFloat(indicator.left) + parseFloat(getComputedStyle(segments).borderLeftWidth)
        },
        round: ['#corner-pill', '#corner-circle', '.t-toggle', '.t-toggle-thumb', '.base-progress-track', '.base-progress-indicator'].map(shape),
        checkbox: shape('.t-check'),
        icon: shape('.bookmark-favicon'),
        composed: {
          padding: composedStyle.padding, gap: composedStyle.gap,
          radius: parseFloat(composedStyle.borderRadius),
          headerInset: composed.querySelector('header > div').getBoundingClientRect().left - composedRect.left,
          inputInset: document.getElementById('corner-composed-input').getBoundingClientRect().left - composedRect.left
        }
      }
    })
    assert.equal(metrics.native, true, 'Run the native contour suite on a corner-shape capable browser')
    assert.equal(metrics.scannerStarted, false, 'Native curves need no legacy DOM scanner')
    for (const pair of metrics.pairs) {
      assert.equal(pair.outer.radius - pair.inset, pair.inner.radius, 'Nested radii must include the actual border-box inset')
      assert.match(pair.outer.curve, /superellipse\(1\.25\)/)
      assert.match(pair.inner.curve, /superellipse\(1\.25\)/)
      assert.equal(pair.outer.clip, 'none')
      assert.equal(pair.inner.clip, 'none')
    }
    assert.equal(metrics.indicator.radius, 8)
    assert.equal(metrics.indicator.inset, 4)
    assert.ok(Math.abs(metrics.indicator.width - metrics.indicator.buttonWidth) < 0.1)
    assert.match(metrics.indicator.curve, /superellipse\(1\.25\)/)
    assert.ok(metrics.round.every(isRound), 'Pills and circles retain circular-arc contours')
    assert.equal(metrics.checkbox.radius, 4)
    assert.equal(metrics.icon.radius, 4)
    assert.equal(metrics.icon.clip, 'none', 'Native icons must not keep a second clipped contour')
    assert.deepEqual(metrics.composed, { padding: '0px', gap: '0px', radius: 16, headerInset: 16, inputInset: 16 },
      'Composed cards must honor caller geometry and keep headings aligned with form content')
    report.push({ deviceScaleFactor, ...metrics })
  }

  await page.click('#corner-segments button >> nth=1')
  await page.waitForFunction(() => document.querySelectorAll('#corner-segments button')[1].getAttribute('aria-pressed') === 'true')
  await page.click('.base-select-trigger')
  await page.waitForSelector('.base-select-popup', { state: 'visible' })
  await settled(page)
  const select = await page.evaluate(() => {
    const popup = document.querySelector('.base-select-popup')
    const item = popup.querySelector('.base-select-option')
    return {
      outer: parseFloat(getComputedStyle(popup).borderRadius),
      inner: parseFloat(getComputedStyle(item).borderRadius),
      inset: item.getBoundingClientRect().left - popup.getBoundingClientRect().left,
      curve: getComputedStyle(popup).cornerShape,
      clip: getComputedStyle(popup).clipPath
    }
  })
  assert.equal(select.outer - select.inset, select.inner)
  assert.match(select.curve, /superellipse\(1\.25\)/)
  assert.equal(select.clip, 'none')
  await page.keyboard.press('End')
  await page.keyboard.press('Enter')
  await page.waitForFunction(() => document.querySelector('.base-select-trigger').textContent.includes('Other bookmarks'))

  await page.click('#corner-menu-trigger')
  await page.waitForSelector('[role=menu]', { state: 'visible' })
  await page.focus('[role=menuitem][aria-label="Move bookmark"]')
  await page.press('[role=menuitem][aria-label="Move bookmark"]', 'ArrowRight')
  await page.waitForSelector('[role=menu][aria-label="Move bookmark"]', { state: 'visible' })
  await settled(page)
  const submenu = await page.evaluate(() => {
    const popup = document.querySelector('[role=menu][aria-label="Move bookmark"]')
    const item = popup.querySelector('button')
    return {
      radius: parseFloat(getComputedStyle(popup).borderRadius),
      itemRadius: parseFloat(getComputedStyle(item).borderRadius),
      inset: item.getBoundingClientRect().left - popup.getBoundingClientRect().left,
      curve: getComputedStyle(popup).cornerShape, clip: getComputedStyle(popup).clipPath
    }
  })
  assert.equal(submenu.radius - submenu.inset, submenu.itemRadius)
  assert.equal(submenu.clip, 'none', 'Portaled submenus must not be clipped by their parent')
  assert.match(submenu.curve, /superellipse\(1\.25\)/)
  await page.keyboard.press('Escape')
  await page.keyboard.press('Escape')

  await page.click('#corner-dialog-trigger')
  await page.waitForSelector('#corner-dialog', { state: 'visible' })
  await page.focus('#corner-dialog-input')
  await settled(page)
  const focus = await page.evaluate(() => {
    const dialog = document.getElementById('corner-dialog')
    const input = document.getElementById('corner-dialog-input')
    const style = getComputedStyle(input)
    return {
      outer: parseFloat(getComputedStyle(dialog).borderRadius), inner: parseFloat(style.borderRadius),
      inset: input.getBoundingClientRect().left - dialog.getBoundingClientRect().left,
      clip: style.clipPath, outline: style.outlineWidth, shadow: style.boxShadow,
      active: document.activeElement === input
    }
  })
  assert.equal(focus.outer - focus.inset, focus.inner)
  assert.equal(focus.clip, 'none')
  assert.equal(focus.active, true)
  assert.notEqual(focus.shadow, 'none', 'Input focus rings still paint on native contours')
  await page.screenshot({ path: `${directory}/focused-dialog.png` })
  await page.click('#corner-dialog-close')
  await page.waitForFunction(() => document.activeElement?.id === 'corner-dialog-trigger')

  // Removing the opt-in has the same CSS cascade as a browser skipping the
  // @supports block. This tests the baseline; it is not a second browser engine.
  const fallback = await page.evaluate(() => {
    document.documentElement.removeAttribute('data-curator-surface')
    return ['#corner-card', '#corner-input', '#corner-inner', '#corner-segments'].map(selector => {
      const style = getComputedStyle(document.querySelector(selector))
      return { radius: parseFloat(style.borderRadius), curve: style.cornerShape, clip: style.clipPath }
    })
  })
  assert.deepEqual(fallback.map(shape => shape.radius), [24, 8, 16, 12])
  assert.ok(fallback.every(shape => isRound(shape) && shape.clip === 'none'))
  await page.evaluate(() => { document.documentElement.dataset.curatorSurface = 'geometry-fixture' })

  for (const width of [1440, 768, 390]) {
    await page.cdp('Emulation.setDeviceMetricsOverride', { width, height: 1100, deviceScaleFactor: 1, mobile: false })
    await settled(page)
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px has no horizontal overflow`)
    await page.screenshot({ path: `${directory}/controls-${width}.png` })
  }
  return { report, select, submenu, focus, fallback, passed: true }
}
