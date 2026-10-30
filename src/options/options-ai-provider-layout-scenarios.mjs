import assert from 'node:assert/strict'

const fetchButton = '.ai-provider-model-group button[data-feedback-state]'
const revealButton = '#ai-api-key-reveal'

export async function runAiProviderLayoutChecks(page, origin, directory) {
  const report = { checks: [], screenshots: [] }
  const phase = status => page.waitForFunction(({ selector, status }) =>
    document.querySelector(selector)?.dataset.feedbackState === status,
  { selector: fetchButton, status }, { timeout: 5000 })
  const settle = () => page.waitForFunction(() => document.getAnimations().every(animation =>
    animation.effect?.getTiming().iterations === Infinity || animation.playState !== 'running'
  ), undefined, { timeout: 5000 })
  const shot = async name => {
    const filename = `${directory}/${name}.png`
    await page.screenshot({ path: filename })
    report.screenshots.push(filename)
  }
  const layout = () => page.evaluate(() => {
    const card = document.querySelector('#ai-provider-settings').getBoundingClientRect()
    const relative = selector => {
      const rect = document.querySelector(selector).getBoundingClientRect()
      return { x: rect.x - card.x, y: rect.y - card.y, width: rect.width, height: rect.height }
    }
    return {
      width: card.width,
      height: card.height,
      input: relative('#ai-api-key'),
      models: relative('.ai-provider-model-row'),
      advanced: relative('#ai-advanced-settings'),
      paragraphs: [...document.querySelectorAll('#ai-provider-settings p')].map(node => node.textContent)
    }
  })
  const assertRevealCentered = async name => {
    const samples = await page.evaluate(async () => {
      const samples = []
      const deadline = performance.now() + 650
      do {
        const field = document.querySelector('#ai-api-key').getBoundingClientRect()
        const toggle = document.querySelector('#ai-api-key-reveal').getBoundingClientRect()
        samples.push({
          centerOffset: toggle.y + toggle.height / 2 - field.y - field.height / 2,
          contained: toggle.top >= field.top && toggle.bottom <= field.bottom &&
            toggle.left >= field.left && toggle.right <= field.right
        })
        await new Promise(requestAnimationFrame)
      } while (performance.now() < deadline)
      return samples
    })
    assert.ok(samples.every(sample => Math.abs(sample.centerOffset) < 0.5 && sample.contained),
      `${name}: reveal button must stay centered inside the input throughout the press`)
  }

  for (const width of [1440, 768, 390]) {
    await page.cdp('Emulation.setDeviceMetricsOverride', {
      width, height: 1100, deviceScaleFactor: 1, mobile: false
    })
    await page.cdp('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }]
    })
    await page.goto(`${origin}/?surface=options`)
    await page.waitForSelector(revealButton)
    await settle()
    assert.equal(await page.evaluate(() => innerWidth), width, 'test the requested viewport, not the host window')
    const initial = await layout()

    for (const reduced of [false, true]) {
      await page.cdp('Emulation.setEmulatedMedia', {
        features: [{ name: 'prefers-reduced-motion', value: reduced ? 'reduce' : 'no-preference' }]
      })
      await page.hover(revealButton)
      const center = await page.evaluate(selector => {
        const rect = document.querySelector(selector).getBoundingClientRect()
        return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
      }, revealButton)
      await page.mouse.move(center.x, center.y)
      await page.mouse.down()
      try {
        assert.equal(await page.evaluate(selector => document.querySelector(selector).matches(':active'), revealButton), true)
        await assertRevealCentered(`${width}px pointer hold, reduced=${reduced}`)
        await shot(`ai-provider-${width}-held${reduced ? '-reduced' : ''}`)
      } finally {
        await page.mouse.up()
      }
      assert.equal(await page.evaluate(() => document.querySelector('#ai-api-key').type), 'text')
      await page.keyboard.down('Space')
      try {
        await assertRevealCentered(`${width}px keyboard hold, reduced=${reduced}`)
      } finally {
        await page.keyboard.up('Space')
      }
      assert.equal(await page.evaluate(() => document.querySelector('#ai-api-key').type), 'password')
      await page.click(revealButton)
      await page.keyboard.press('Escape')
      assert.equal(await page.evaluate(() => document.querySelector('#ai-api-key').type), 'password')
      assert.deepEqual(await layout(), initial, 'revealing a key must not move its form')
    }
    await page.cdp('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }]
    })

    for (const success of [true, false]) {
      await page.click(fetchButton)
      await phase('pending')
      assert.deepEqual(await layout(), initial, 'fetching must not insert text or move fields')
      assert.equal(await page.evaluate(() => document.querySelector('#ai-api-key').disabled), true)
      const calls = await page.evaluate(() => window.__actionFixture.calls)
      await page.keyboard.press('Enter')
      assert.equal(await page.evaluate(() => window.__actionFixture.calls), calls, 'pending fetches stay deduplicated')
      await shot(`ai-provider-${width}-pending${success ? '' : '-retry'}`)
      await page.evaluate(success => window.__actionFixture.complete(success), success)
      await phase(success ? 'success' : 'error')
      await settle()
      assert.deepEqual(await layout(), initial, 'fetch results must not resize the form')
      assert.equal(await page.evaluate(() => document.querySelector('#ai-api-key').disabled), false)
      assert.ok(await page.evaluate(selector => Boolean(document.querySelector(selector).title), fetchButton),
        'the detailed fetch result remains available on the button')

      if (!success) {
        const toast = '[data-toast-id^="ai-models-fetch-"]'
        await page.waitForSelector(toast)
        const details = await page.evaluate(({ selector, toast }) => {
          const notification = document.querySelector(toast)
          const rect = notification.getBoundingClientRect()
          return {
            outsideForm: !document.querySelector('#ai-provider-settings').contains(notification),
            containsDetail: notification.textContent.includes(document.querySelector(selector).title),
            inViewport: rect.left >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight
          }
        }, { selector: fetchButton, toast })
        assert.deepEqual(details, { outsideForm: true, containsDetail: true, inViewport: true })
        await shot(`ai-provider-${width}-error`)
        await phase('idle')
        assert.deepEqual(await layout(), initial, 'expiring button feedback must not move the form')
        await page.click('[data-dismiss-toast^="ai-models-fetch-"]')
        await page.waitForSelector(toast, { state: 'detached' })
        await page.fill('#ai-api-key', 'sk-layout-fixture-edited')
        assert.equal(await page.evaluate(selector => document.querySelectorAll(selector).length, toast), 0,
          'dismissed errors must not reappear after an unrelated field update')
      } else {
        await shot(`ai-provider-${width}-success`)
      }
    }
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    assert.deepEqual(await page.evaluate(() => window.__actionFixture.errors), [])
    report.checks.push(`AI provider ${width}px: stable fetch states, contained pointer/keyboard holds, reduced motion and dismissible errors`)
  }
  for (const check of report.checks) console.log(`PASS ${check}`)
  return report
}
