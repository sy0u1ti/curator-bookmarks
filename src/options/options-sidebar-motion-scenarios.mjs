import assert from 'node:assert/strict'

export async function runSidebarMotionScenarios(page, output) {
  const report = { checks: [], screenshots: [], traces: {} }
  const desktop = '.options-sidebar:not(.options-mobile-sidebar)'
  const indicator = `${desktop} > .options-nav-active-indicator`
  const link = (section, root = desktop) => `${root} .options-nav-link[href="#${section}"]`
  const trigger = `${desktop} .options-nav-trigger`
  const pass = name => { report.checks.push(name); console.log(`PASS ${name}`) }
  const viewport = (width, height = 1000) => page.cdp('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
  const media = value => page.cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value }] })
  const settled = (root = desktop) => page.waitForFunction(root => {
    const sidebar = document.querySelector(root)
    const mark = sidebar?.querySelector(':scope > .options-nav-active-indicator')
    const surface = sidebar?.closest('.curator-overlay-panel') ?? sidebar
    return mark?.dataset.ready === 'true' && !mark.dataset.moving &&
      !surface.hasAttribute('data-starting-style') && !surface.hasAttribute('data-ending-style') &&
      surface.getAnimations({ subtree: true }).every(animation => animation.playState !== 'running')
  }, root, { timeout: 5000 })
  const aligned = async (root = desktop) => {
    const result = await page.evaluate(root => {
      const sidebar = document.querySelector(root)
      const main = sidebar.querySelector(':scope > .options-nav-active-indicator')
      const parent = sidebar.querySelector('.options-nav-trigger[data-active]')
      const current = sidebar.querySelector('.options-nav-link[aria-current="page"]')
      const child = sidebar.querySelector('.options-nav-sub-indicator')
      const delta = (mark, row) => {
        const actual = mark.getBoundingClientRect()
        const expected = row.getBoundingClientRect()
        return Math.max(...['x', 'y', 'width', 'height'].map(key => Math.abs(actual[key] - expected[key])))
      }
      return {
        mainVisible: !main.hidden,
        mainDelta: delta(main, parent ?? current),
        subVisible: !child.hidden,
        subDelta: parent ? delta(child, current) : 0,
        groupActive: Boolean(parent),
        moving: Boolean(main.dataset.moving)
      }
    }, root)
    assert.equal(result.mainVisible, true)
    assert.ok(result.mainDelta < 1 && result.subDelta < 1, JSON.stringify(result))
    assert.equal(result.subVisible, result.groupActive, JSON.stringify(result))
    assert.equal(result.moving, false)
  }
  const groupState = (root = desktop) => page.evaluate(root => {
    const sidebar = document.querySelector(root)
    const group = sidebar.querySelector('.options-nav-trigger')
    const panel = sidebar.querySelector('.t-acc-panel')
    return {
      hash: location.hash,
      expanded: group.getAttribute('aria-expanded'),
      parentCurrent: group.getAttribute('aria-current'),
      activeChild: panel.querySelector('[aria-current="page"]')?.getAttribute('href') ?? null,
      inert: panel.inert,
      height: panel.getBoundingClientRect().height
    }
  }, root)
  const record = (selector = indicator) => page.evaluate(selector => {
    window.__navTrace = []
    window.__navRecording = true
    const start = performance.now()
    const tick = now => {
      if (!window.__navRecording || now - start > 10000) return
      const element = document.querySelector(selector)
      const rect = element.getBoundingClientRect()
      const style = getComputedStyle(element)
      window.__navTrace.push({
        time: now - start, y: rect.y, x: rect.x,
        opacity: style.opacity, moving: Boolean(element.dataset.moving),
        hidden: element.hidden, height: rect.height
      })
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, selector)
  const stopRecord = () => page.evaluate(() => { window.__navRecording = false; return window.__navTrace })
  const labels = () => page.evaluate(root => [...document.querySelector(root).querySelectorAll('.options-nav-label')].map(label => {
    const style = getComputedStyle(label)
    return {
      text: label.textContent, color: style.color,
      weight: style.fontWeight, size: style.fontSize,
      clip: style.backgroundClip, image: style.backgroundImage,
      filter: style.filter, shadow: style.textShadow,
      rowBackground: getComputedStyle(label.closest('a')).backgroundColor
    }
  }), desktop)
  const shot = async name => report.screenshots.push(await page.screenshot({ path: `${output}/${name}.png` }))

  await viewport(1440)
  await media('no-preference')
  assert.equal(await page.evaluate(() => innerWidth), 1440)
  await settled()
  await aligned()
  assert.equal(await page.evaluate(root => document.querySelector(root).querySelectorAll(':scope > .options-nav-active-indicator').length, desktop), 1)
  assert.equal((await groupState()).expanded, 'false')
  assert.equal((await groupState()).inert, true)
  pass('initial navigation is settled and inactive submenus stay closed')

  await page.hover(trigger)
  await settled()
  assert.equal((await groupState()).expanded, 'false')
  pass('hover never opens a navigation group')

  await page.hover('#options-main')
  await settled()
  const beforeHover = await labels()
  for (const section of ['backup', 'inbox', 'duplicates', 'ai-settings', 'backup']) {
    await page.hover(link(section))
    await settled()
    const hoveredText = await page.evaluate(selector => document.querySelector(selector).textContent.trim(), link(section))
    const after = await labels()
    let changed = 0
    for (let index = 0; index < after.length; index++) {
      if (after[index].text === hoveredText) {
        changed++
        assert.notEqual(after[index].color, beforeHover[index].color)
        assert.equal(after[index].rowBackground, 'rgba(0, 0, 0, 0)')
        assert.notEqual(after[index].clip, 'text')
        assert.equal(after[index].image, 'none')
        assert.equal(after[index].filter, 'none')
        assert.equal(after[index].shadow, 'none')
        assert.equal(after[index].weight, beforeHover[index].weight)
      } else {
        assert.deepEqual(after[index], beforeHover[index], `Hover leaked into ${after[index].text}`)
      }
    }
    assert.equal(changed, 1)
  }
  pass('rapid cross-row hover changes only the current native text, never adjacent labels or row backgrounds')

  const material = await page.evaluate(selector => {
    const mark = document.querySelector(selector)
    const style = getComputedStyle(mark)
    return {
      fill: style.backgroundColor, shadow: style.boxShadow,
      before: getComputedStyle(mark, '::before').content,
      after: getComputedStyle(mark, '::after').content,
      filter: style.filter, backdrop: style.backdropFilter
    }
  }, indicator)
  assert.ok(/rgba\(|color\(/.test(material.fill))
  assert.ok(material.shadow.includes('inset') && material.shadow.includes('0.5px'))
  assert.ok(['none', 'normal'].includes(material.before) && ['none', 'normal'].includes(material.after))
  assert.equal(material.filter, 'none')
  assert.equal(material.backdrop, 'none')
  pass('selection uses translucent relief without the leading bar or a blur filter')

  const from = await page.evaluate(selector => document.querySelector(selector).getBoundingClientRect().y, indicator)
  const to = await page.evaluate(selector => document.querySelector(selector).getBoundingClientRect().y, link('ai-settings'))
  await record()
  await page.click(link('ai-settings'))
  await settled()
  await aligned()
  const trace = await stopRecord()
  report.traces.selection = trace
  assert.ok(trace.some(frame => frame.y > from + 2 && frame.y < to - 2), 'Selection must travel rather than crossfade between parked copies')
  assert.ok(trace.every(frame => Number(frame.opacity) > 0.99), 'The shared shape must not blink during travel')
  pass('direct selection travels on the spring without blinking or moving settings content')

  await record()
  await page.evaluate(async ({ first, second }) => {
    document.querySelector(first).click()
    for (let index = 0; index < 5; index++) await new Promise(requestAnimationFrame)
    window.__retargetY = document.querySelector('.options-nav-active-indicator').getBoundingClientRect().y
    document.querySelector(second).click()
  }, { first: link('general'), second: link('recycle') })
  await settled()
  await aligned()
  const reversal = await stopRecord()
  report.traces.reversal = reversal
  assert.ok(reversal.filter(frame => frame.moving).length > 3)
  assert.ok(reversal.slice(1).every((frame, index) => Math.abs(frame.y - reversal[index].y) < 130), 'A retarget must not teleport to a new origin')
  assert.equal(await page.evaluate(() => location.hash), '#recycle')
  pass('rapid retarget preserves continuity and ends at the latest selection')

  await page.click(trigger)
  await settled()
  await aligned()
  const entered = await groupState()
  assert.equal(entered.hash, '#availability')
  assert.equal(entered.expanded, 'true')
  assert.equal(entered.parentCurrent, 'true')
  assert.equal(entered.activeChild, '#availability')
  assert.equal(entered.inert, false)
  pass('activating a parent opens its page and marks both parent and selected child')

  const stagger = await page.evaluate(root => [...document.querySelector(root).querySelectorAll('.options-nav-disclosure .options-nav-content')].map(element => Number.parseFloat(getComputedStyle(element).transitionDelay)), desktop)
  assert.equal(stagger.length, 4)
  assert.ok(stagger.every((delay, index) => Math.abs(delay - (0.06 + index * 0.028)) < 0.001))
  pass('child entry keeps the shared capped stagger')

  const parentY = await page.evaluate(selector => document.querySelector(selector).getBoundingClientRect().y, indicator)
  await record(`${desktop} .options-nav-sub-indicator`)
  await page.click(link('history'))
  await settled()
  await aligned()
  const crossLevel = await stopRecord()
  report.traces.childSelection = crossLevel
  assert.ok(new Set(crossLevel.map(frame => frame.y.toFixed(2))).size > 2, 'The child highlight must glide within its own list')
  assert.ok(crossLevel.every(frame => !frame.hidden && frame.height > 1))
  assert.equal(await page.evaluate(selector => document.querySelector(selector).getBoundingClientRect().y, indicator), parentY)
  pass('child selection glides independently while the parent highlight stays in place')

  await page.click(trigger)
  await settled()
  assert.equal((await groupState()).activeChild, '#history')
  assert.equal((await groupState()).expanded, 'true')
  await page.hover(link('redirects'))
  await settled()
  await aligned()
  assert.deepEqual(await page.evaluate(root => [...document.querySelector(root).querySelectorAll('.options-nav-selection')].map(mark => ({
    fill: getComputedStyle(mark).backgroundColor, shadow: getComputedStyle(mark).boxShadow
  })), desktop), [
    { fill: material.fill, shadow: material.shadow }, { fill: material.fill, shadow: material.shadow }
  ])
  pass('re-clicking or hovering inside the active group never removes either selection surface')
  await page.hover('#options-main')
  await shot('options-1440-parent-child')

  await page.click(link('backup'))
  await settled()
  await page.waitForFunction(() => {
    const panel = document.getElementById('availability-tools-nav')
    return panel.inert && panel.getBoundingClientRect().height === 0
  })
  await aligned()
  assert.equal((await groupState()).parentCurrent, null)
  assert.equal(await page.evaluate(root => {
    const link = document.querySelector(root).querySelector('.t-acc-panel a')
    link.focus()
    return document.activeElement === link
  }, desktop), false)
  await shot('options-1440-outside-group')
  pass('leaving a group closes its submenu and removes hidden children from focus')

  await page.evaluate(() => history.back())
  await page.waitForFunction(() => location.hash === '#history')
  await settled()
  await aligned()
  await page.evaluate(() => history.forward())
  await page.waitForFunction(() => location.hash === '#backup')
  await settled()
  assert.equal((await groupState()).expanded, 'false')
  await page.click(trigger)
  await settled()
  await aligned()
  assert.equal((await groupState()).activeChild, '#history')
  pass('back, forward and parent re-entry restore the correct child and group visibility')

  await record()
  await page.evaluate(async ({ outside, group }) => {
    document.querySelector(outside).click()
    for (let index = 0; index < 3; index++) await new Promise(requestAnimationFrame)
    document.querySelector(group).click()
    for (let index = 0; index < 3; index++) await new Promise(requestAnimationFrame)
    document.querySelector(outside).click()
  }, { outside: link('recycle'), group: trigger })
  await settled()
  await aligned()
  report.traces.groupReversal = await stopRecord()
  assert.equal((await groupState()).expanded, 'false')
  assert.equal((await groupState()).inert, true)
  pass('rapid group entry and exit reverses safely and follows the latest route')

  await page.click(link('general'))
  await settled()
  await page.focus(link('backup'))
  await page.keyboard.press('Enter')
  await aligned()
  assert.equal(await page.evaluate(() => document.documentElement.dataset.motionInput), 'keyboard')
  assert.ok(await page.evaluate(selector => getComputedStyle(document.querySelector(selector)).transitionDuration.split(',').every(value => Number.parseFloat(value) === 0), link('backup')))
  await page.focus(trigger)
  await page.keyboard.press('Enter')
  await settled()
  await aligned()
  assert.equal((await groupState()).expanded, 'true')
  assert.equal((await groupState()).activeChild, '#history')
  pass('keyboard navigation activates the group and both highlights without interpolation')

  await page.click(link('ai-settings'))
  await media('reduce')
  await settled()
  await aligned()
  assert.ok(await page.evaluate(root => document.querySelector(root).getAnimations({ subtree: true }).every(animation =>
    !/transform|translate|scale|grid-template/.test(animation.transitionProperty || '')
  ), desktop))
  await media('no-preference')
  pass('enabling reduced motion mid-flight cancels travel and preserves selection')

  await page.cdp('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 })
  const beforeTouchHover = await labels()
  await page.hover(link('backup'))
  await settled()
  assert.deepEqual(await labels(), beforeTouchHover)
  await page.cdp('Emulation.setTouchEmulationEnabled', { enabled: false })
  pass('touch input never inherits desktop text-hover effects')

  await page.click(trigger)
  await settled()
  await viewport(1440, 460)
  await settled()
  await page.hover(link('history'))
  await page.mouse.wheel(0, 280)
  await aligned()
  await viewport(1440)
  await settled()
  await aligned()
  pass('scroll and resize cannot strand the highlight')

  for (const width of [768, 390]) {
    await page.evaluate(() => { location.hash = '#backup' })
    await page.waitForFunction(() => location.hash === '#backup')
    await viewport(width, 900)
    await page.click('#options-mobile-nav-trigger')
    await page.waitForSelector('#options-mobile-navigation [role="dialog"]')
    await settled('.options-mobile-sidebar')
    await aligned('.options-mobile-sidebar')
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    assert.equal((await groupState('.options-mobile-sidebar')).expanded, 'false')
    await shot(`options-${width}-outside-group`)
    await page.click('.options-mobile-sidebar .options-nav-trigger')
    await settled('.options-mobile-sidebar')
    await aligned('.options-mobile-sidebar')
    assert.equal((await groupState('.options-mobile-sidebar')).activeChild, '#history')
    assert.equal(await page.evaluate(() => document.getElementById('options-mobile-navigation').getAttribute('aria-hidden')), 'false')
    await page.hover('#options-mobile-navigation-title')
    await shot(`options-${width}-parent-child`)
    await page.click(link('redirects', '.options-mobile-sidebar'))
    await page.waitForFunction(() => !document.querySelector('#options-mobile-navigation [role="dialog"][data-open]'))
    await page.waitForFunction(() => document.activeElement?.id === 'options-mobile-nav-trigger')
    await page.keyboard.press('Enter')
    await settled('.options-mobile-sidebar')
    await aligned('.options-mobile-sidebar')
    assert.equal((await groupState('.options-mobile-sidebar')).activeChild, '#redirects')
    await page.keyboard.press('Escape')
    await page.waitForFunction(() => !document.querySelector('#options-mobile-navigation [role="dialog"][data-open]'))
    pass(`${width}px parent activation retains the drawer; child navigation closes it with correct focus and selection`)
    // Both sidebar instances keep the same route-derived group state.
    await page.evaluate(() => { location.hash = '#history' })
    await page.waitForFunction(() => location.hash === '#history')
  }
  await viewport(1440)
  await media('no-preference')
  await page.reload()
  await settled()
  await aligned()
  const deepLink = await groupState()
  assert.equal(deepLink.expanded, 'true')
  assert.equal(deepLink.activeChild, '#history')
  pass('a direct child URL reload paints both selection levels without an entrance')

  await page.cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }] })
  const opaqueFill = await page.evaluate(selector => {
    const style = getComputedStyle(document.querySelector(selector))
    return { fill: style.backgroundColor, surface: getComputedStyle(document.documentElement).getPropertyValue('--ds-surface-2').trim() }
  }, indicator)
  assert.ok(!opaqueFill.fill.includes('rgba') && opaqueFill.fill !== material.fill, 'Reduced transparency must use the opaque selection surface')
  await page.cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-contrast', value: 'more' }] })
  assert.equal(await page.evaluate(selector => getComputedStyle(document.querySelector(selector)).outlineStyle, indicator), 'solid')
  await page.cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] })
  await settled()
  pass('contrast and reduced-transparency modes retain a clear selected surface')
  assert.deepEqual(await page.evaluate(() => window.__fixtureErrors), [])
  pass('no runtime errors')
  return report
}
