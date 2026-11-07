export async function runSearchExpansionChecks(page, origin, directory) {
  const report = { checks: [], failures: [], measurements: [], recordings: [] }
  const check = (name, pass, detail) => {
    const result = { name, pass: Boolean(pass), detail }
    report.checks.push(result)
    if (!pass) report.failures.push(result)
  }
  const record = label => page.evaluate(label => {
    const rect = selector => {
      const node = document.querySelector(selector)
      if (!node) return null
      const { x, y, width, height } = node.getBoundingClientRect()
      return { x, y, width, height }
    }
    const state = window.__searchExpansion = { label, start: performance.now(), done: false, frames: [], changes: [] }
    const shell = document.querySelector('.newtab-search-shell')
    const observer = new MutationObserver(mutations => {
      if (mutations.some(mutation => mutation.attributeName === 'data-panel-open')) {
        state.changes.push({ at: performance.now() - state.start, open: shell.dataset.panelOpen })
      }
    })
    observer.observe(shell, { attributes: true, attributeFilter: ['data-panel-open'] })
    const sample = () => {
      const panel = document.getElementById('newtab-search-suggestions-panel')
      const css = panel && getComputedStyle(panel)
      const row = document.querySelector('.newtab-search-suggestion')
      state.frames.push({
        time: performance.now() - state.start,
        panel: rect('#newtab-search-suggestions-panel'),
        glass: rect('.newtab-search-surface'), form: rect('.newtab-search'),
        slot: rect('.newtab-search-slot'), bookmark: rect('.bookmark-tile'), row: rect('.newtab-search-suggestion'),
        opacity: css ? Number(css.opacity) : 0,
        transform: css?.transform,
        rowTransform: row && getComputedStyle(row).transform,
        rowTransition: row && getComputedStyle(row).transitionDuration,
        heightTransition: panel?.getAnimations().filter(animation => animation.transitionProperty === 'grid-template-rows')
          .map(animation => ({ duration: animation.effect.getTiming().duration, time: animation.currentTime, state: animation.playState })) || [],
        keyboard: document.documentElement.dataset.motionInput,
        open: shell.dataset.panelOpen,
        inert: panel?.inert,
        hidden: panel?.getAttribute('aria-hidden'),
        activeDescendant: document.querySelector('.newtab-search-input')?.getAttribute('aria-activedescendant')
      })
      if (performance.now() - state.start < 600) requestAnimationFrame(sample)
      else { state.done = true; observer.disconnect() }
    }
    requestAnimationFrame(sample)
  }, label)
  const finish = async () => {
    await page.waitForFunction(() => window.__searchExpansion.done, undefined, { timeout: 5000 })
    const value = await page.evaluate(() => window.__searchExpansion)
    report.recordings.push(value)
    return value
  }
  const reset = async () => {
    await page.fill('.newtab-search-input', '')
    await page.waitForFunction(() => !document.getElementById('newtab-search-suggestions-panel') ||
      document.getElementById('newtab-search-suggestions-panel').hidden)
  }
  const stationary = (name, frames) => {
    const first = frames[0]
    const delta = key => Math.max(0, ...frames.filter(frame => frame[key] && first[key]).flatMap(frame =>
      ['x', 'y', 'width', 'height'].map(axis => Math.abs(frame[key][axis] - first[key][axis]))
    ))
    check(`${name}/input-stays-put`, delta('form') < 0.1, delta('form'))
    check(`${name}/bookmarks-stay-put`, delta('bookmark') < 0.1, delta('bookmark'))
    check(`${name}/slot-stays-put`, delta('slot') < 0.1, delta('slot'))
    check(`${name}/no-text-stretch`, frames.every(frame =>
      (!frame.transform || frame.transform === 'none') && (!frame.rowTransform || frame.rowTransform === 'none')))
  }

  await page.cdp('Emulation.setFocusEmulationEnabled', { enabled: true })
  await page.cdp('Page.startScreencast', { format: 'jpeg', quality: 10, maxWidth: 160, maxHeight: 120, everyNthFrame: 1 })
  await page.cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] })
  for (const width of [1440, 768, 390]) {
    await page.cdp('Emulation.setDeviceMetricsOverride', { width, height: width === 390 ? 844 : 1000, deviceScaleFactor: 1, mobile: false })
    await page.goto(`${origin}/src/newtab/newtab.html`)
    await page.waitForSelector('.bookmark-tile')
    await page.waitForFunction(() => !document.getElementById('newtab-bookmark-preboot'))
    await page.focus('.newtab-search-input')
    await page.waitForFunction(() => {
      const css = getComputedStyle(document.querySelector('.newtab-search-shell'))
      return Math.abs(parseFloat(css.top) - parseFloat(css.getPropertyValue('--ds-hover-lift'))) < 0.01
    })
    if (width === 1440) console.log((await page.snapshot()).slice(0, 1700))
    await record(`open-${width}`)
    await page.keyboard.type('e')
    const opened = await finish()
    const visible = opened.frames.filter(frame => frame.panel && frame.panel.height > 0)
    const final = visible.at(-1)?.panel.height || 0
    const intermediate = visible.filter(frame => frame.panel.height > 1 && frame.panel.height < final - 1)
    const durations = [...new Set(visible.flatMap(frame => frame.heightTransition.map(transition => transition.duration)))]
    check(`${width}/keyboard-opens-with-accordion`, final > 40 && intermediate.length >= 3 &&
      durations.some(duration => duration > 0 && duration <= 300), { final, intermediate: intermediate.length, durations })
    check(`${width}/height-grows-monotonically`, visible.every((frame, index) =>
      index === 0 || frame.panel.height >= visible[index - 1].panel.height - 0.5))
    check(`${width}/glass-follows-results`, visible.every(frame =>
      Math.abs(frame.glass.height - frame.form.height - frame.panel.height) < 0.5))
    stationary(`${width}/open`, opened.frames)
    report.measurements.push({ width, height: final, intermediate: intermediate.length, durations })
    await page.screenshot({ path: `${directory}/open-${width}.png` })
    await record(`continue-${width}`)
    await page.keyboard.type('xample', { delay: 30 })
    const continued = await finish()
    check(`${width}/typing-does-not-replay-reveal`, continued.changes.length === 0 &&
      continued.frames.every(frame => frame.heightTransition.length === 0 && frame.open === 'true'))
    check(`${width}/rows-still-update-immediately`, continued.frames.every(frame =>
      !frame.rowTransition || frame.rowTransition.split(',').every(time => parseFloat(time) === 0)))
    await record(`close-${width}`)
    await page.press('.newtab-search-input', 'Escape')
    const closed = await finish()
    const closing = closed.frames.filter(frame => frame.panel && frame.panel.height > 0)
    check(`${width}/escape-collapses-with-accordion`, closing.filter(frame => frame.panel.height > 1 && frame.panel.height < final - 1).length >= 2)
    check(`${width}/outgoing-results-inert`, closed.frames.filter(frame => frame.open === 'false' && frame.panel).every(frame =>
      frame.inert && frame.hidden === 'true' && !frame.activeDescendant))
    check(`${width}/collapsed-panel-removed`, !closed.frames.at(-1).panel || closed.frames.at(-1).panel.height === 0)
    stationary(`${width}/close`, closed.frames)

    await reset()
    await record(`reverse-${width}`)
    await page.keyboard.type('e')
    await page.waitForFunction(() => {
      const panel = document.getElementById('newtab-search-suggestions-panel')
      return panel && panel.getAnimations().some(animation => animation.transitionProperty === 'grid-template-rows')
    }, undefined, { timeout: 1000 }).catch(() => {})
    await page.press('.newtab-search-input', 'Escape')
    await page.keyboard.type('x')
    const reversal = await finish()
    check(`${width}/interrupted-reveal-finishes-open`, reversal.frames.at(-1).open === 'true' &&
      reversal.frames.at(-1).panel.height > 40 && !reversal.frames.at(-1).inert)
    check(`${width}/interrupted-reveal-no-duplicate-panel`, await page.evaluate(() => document.querySelectorAll('#newtab-search-suggestions-panel').length === 1))
    check(`${width}/no-runtime-errors`, await page.evaluate(() => window.__glassFixture.errors.length === 0),
      await page.evaluate(() => window.__glassFixture.errors))
  }

  await reset()
  await page.cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
  await record('reduced-motion')
  await page.keyboard.type('e')
  const reduced = await finish()
  check('reduced-motion/no-height-transition', reduced.frames.every(frame => frame.heightTransition.length === 0))
  check('reduced-motion/results-visible', reduced.frames.at(-1).panel.height > 40 && reduced.frames.at(-1).opacity === 1)
  await page.cdp('Emulation.setEmulatedMedia', { features: [] })
  await page.cdp('Page.stopScreencast')
  return report
}
