export async function runInputCaretChecks(page, origin, directory) {
  const report = { checks: [], failures: [], measurements: [], frames: [] }
  await page.cdp('Emulation.setFocusEmulationEnabled', { enabled: true })
  await page.cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] })
  // Keep an occluded, agent-owned Ego page drawing without focusing the user's
  // window. These are position checks, not compositor throughput benchmarks.
  await page.cdp('Page.startScreencast', { format: 'jpeg', quality: 10, maxWidth: 160, maxHeight: 120, everyNthFrame: 1 })
  const load = async surface => {
    const [html, css, script] = await Promise.all([
      fetch(`${origin}/?surface=${surface}`).then(response => response.text()),
      fetch(`${origin}/${surface}.css`).then(response => response.text()),
      fetch(`${origin}/caret.js`).then(response => response.text())
    ])
    const document = html.replace(/<link rel="stylesheet" href="\/[^"]+\.css">/,
      () => `<style>${css.replaceAll('</style', '<\\/style')}</style>`)
      .replace('<script type="module" src="/caret.js"></script>',
        () => `<script type="module">${script.replaceAll('</script', '<\\/script')}</script>`)
    // Extension pages do not receive ordinary web content scripts. An opaque
    // document keeps other installed extensions out of these position checks.
    await page.goto(`data:text/html,<title>Curator isolated caret ${surface} ${Date.now()}</title>`)
    const { frameTree } = await page.cdp('Page.getFrameTree')
    await page.cdp('Page.setDocumentContent', { frameId: frameTree.frame.id, html: document })
    await page.waitForFunction(() => window.__inputCaretReady)
  }
  const check = (name, passed, detail) => {
    const item = { name, passed, detail }
    report.checks.push(item)
    if (!passed) report.failures.push(item)
  }
  const installRecorder = () => page.evaluate(() => {
    window.__caretSamples = []
    window.__caretEvents = 0
    window.__caretLastInputAt = null
    window.__caretErrors = []
    addEventListener('error', event => window.__caretErrors.push(event.message))
    addEventListener('unhandledrejection', event => window.__caretErrors.push(String(event.reason)))
    // These callbacks are registered after the controller. Inspect the actual
    // interpolated transform in the first rendering opportunity after editing;
    // checking only the inline destination or the settled frame misses the bug.
    const record = (kind, event) => {
      const at = performance.now()
      const interval = kind === 'input' && window.__caretLastInputAt !== null ? at - window.__caretLastInputAt : null
      if (kind === 'input') window.__caretLastInputAt = at
      const sequence = ++window.__caretEvents
      requestAnimationFrame(() => {
        const caret = document.querySelector('.curator-input-caret')
        const target = document.activeElement
        if (!caret || !(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return
        const actual = new DOMMatrixReadOnly(getComputedStyle(caret).transform)
        const intended = new DOMMatrixReadOnly(caret.style.transform)
        window.__caretSamples.push({
          kind, key: event.key, repeat: event.repeat, inputType: event.inputType,
          composing: event.isComposing, interval, sequence, age: performance.now() - at,
          target: target.id, length: target.value.length, selection: target.selectionStart,
          lagX: Math.abs(actual.m41 - intended.m41), lagY: Math.abs(actual.m42 - intended.m42),
          left: actual.m41, top: actual.m42,
          visible: getComputedStyle(caret).visibility !== 'hidden',
          transition: getComputedStyle(caret).transitionDuration,
          trail: document.querySelector('.curator-input-caret-trail').getAnimations().length
        })
      })
    }
    document.addEventListener('input', event => record('input', event))
    document.addEventListener('keydown', event => {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'Backspace', 'Delete'].includes(event.key)) record('key', event)
    })
  })
  const resetSamples = () => page.evaluate(() => { window.__caretSamples = []; window.__caretLastInputAt = null })
  const frames = async label => {
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    const items = await page.evaluate(() => window.__caretSamples)
    report.frames.push({ label, items })
    return items
  }
  const exact = (label, items) => {
    const worst = Math.max(0, ...items.map(item => Math.max(item.lagX, item.lagY)))
    report.measurements.push({ label, samples: items.length, maxLagPx: worst })
    check(label, items.length > 0 && worst <= 0.05, { samples: items.length, maxLagPx: worst })
  }
  for (const [surface, width] of [['popup', 1440], ['sidepanel', 390], ['newtab', 768], ['options', 1440], ['archive', 390]]) {
    await page.cdp('Emulation.setDeviceMetricsOverride', { width, height: 760, deviceScaleFactor: 1, mobile: false })
    await load(surface)
    if (report.checks.length === 0) console.log(await page.snapshot())
    await installRecorder()
    await page.focus('#text')
    await page.keyboard.type('Wi'.repeat(12), { delay: 25 })
    let items = await frames(`${surface}/rapid-input`)
    const rapid = items.filter(item => item.kind === 'input' && item.interval !== null && item.interval < 120)
    exact(`${surface}/rapid-input`, rapid)
    check(`${surface}/rapid-input-no-stale-trail`, rapid.every(item => item.trail === 0))
    await resetSamples()
    for (const key of ['Home', 'End', 'ArrowLeft', 'Backspace', 'Delete']) {
      await page.press('#text', key)
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)))
    }
    exact(`${surface}/keyboard-navigation`, await frames(`${surface}/keyboard-navigation`))
    check(`${surface}/native-editing`, await page.evaluate(() => document.querySelector('#text').value.length === 22))
    check(`${surface}/errors`, (await page.evaluate(() => window.__caretErrors)).length === 0)
  }
  await page.cdp('Emulation.setDeviceMetricsOverride', { width: 768, height: 760, deviceScaleFactor: 1, mobile: false })
  await load('options')
  await installRecorder()
  await page.focus('#text')
  await page.keyboard.type('a')
  await page.waitForFunction(() => {
    const caret = document.querySelector('.curator-input-caret')
    return performance.now() - window.__caretLastInputAt >= 140 &&
      caret && !caret.getAnimations().some(animation => animation.transitionProperty === 'transform')
  })
  await resetSamples()
  await page.keyboard.type('W')
  let items = await frames('normal-input')
  check('normal-input-retains-motion', items.some(item => item.lagX > 0.05 && parseFloat(item.transition) > 0))
  check('normal-input-retains-trail', items.some(item => item.trail > 0))

  await page.focus('#textarea')
  await resetSamples()
  await page.keyboard.type('Wi'.repeat(45), { delay: 20 })
  items = await frames('textarea/rapid-and-wrap')
  exact('textarea/rapid-and-wrap', items.filter(item => item.kind === 'input' && item.interval !== null && item.interval < 120))
  check('textarea/crosses-line-boundary', new Set(items.map(item => item.top)).size > 1)
  await resetSamples()
  await page.press('#textarea', 'ArrowUp')
  await page.press('#textarea', 'ArrowDown')
  exact('textarea/vertical-navigation', await frames('textarea/vertical-navigation'))

  await page.focus('#password')
  await resetSamples()
  await page.keyboard.type('password-only-A7q', { delay: 25 })
  items = await frames('password/rapid-input')
  exact('password/rapid-input', items.filter(item => item.kind === 'input' && item.interval !== null && item.interval < 120))
  check('password/no-plaintext-mirror', await page.evaluate(() =>
    !document.querySelector('[data-curator-input-caret-mirror]')?.textContent.includes(document.querySelector('#password').value)
  ))

  await page.focus('#text')
  await resetSamples()
  // A native repeating key, including repeat=true, exercises held-key input
  // without needing to change any operating-system keyboard settings.
  for (let index = 0; index < 12; index++) {
    await page.cdp('Input.dispatchKeyEvent', {
      type: 'keyDown', key: 'a', code: 'KeyA', text: 'a', unmodifiedText: 'a',
      windowsVirtualKeyCode: 65, autoRepeat: index > 0
    })
    await new Promise(resolve => setTimeout(resolve, 25))
  }
  await page.cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'a', code: 'KeyA', windowsVirtualKeyCode: 65 })
  items = await frames('held-key')
  exact('held-key', items.filter(item => item.kind === 'input' && item.interval !== null && item.interval < 120))

  await resetSamples()
  // Synthetic IME events cover replacement as well as insertion. Actual OS IME
  // candidate-window rendering is outside this isolated regression harness.
  await page.evaluate(async () => {
    const target = document.querySelector('#text')
    target.value = ''
    target.setSelectionRange(0, 0)
    target.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }))
    for (const value of ['n', 'ni', '你', '你好', '你好😀']) {
      target.value = value
      target.setSelectionRange(value.length, value.length)
      target.dispatchEvent(new InputEvent('input', { bubbles: true, data: value, inputType: 'insertCompositionText', isComposing: true }))
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    }
    target.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: target.value }))
    target.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: target.value }))
  })
  exact('ime/replacement-and-emoji', await frames('ime/replacement-and-emoji'))
  await page.press('#text', 'ControlOrMeta+A')
  await page.waitForFunction(() => {
    const target = document.querySelector('#text')
    return target.selectionStart !== target.selectionEnd &&
      getComputedStyle(document.querySelector('.curator-input-caret')).visibility === 'hidden'
  }, undefined, { timeout: 2000 })
  check('selection/hides-caret', await page.evaluate(() =>
    getComputedStyle(document.querySelector('.curator-input-caret')).visibility === 'hidden'
  ))
  await page.press('#text', 'ArrowRight')
  await page.screenshot({ path: `${directory}/caret.png` })

  await page.cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
  await resetSamples()
  await page.keyboard.type('Wi', { delay: 25 })
  exact('reduced-motion', await frames('reduced-motion'))
  await page.cdp('Emulation.setEmulatedMedia', { features: [{ name: 'forced-colors', value: 'active' }] })
  check('forced-colors/native-caret', await page.evaluate(() => {
    const target = document.querySelector('#text')
    return getComputedStyle(target).caretColor !== 'rgba(0, 0, 0, 0)' &&
      getComputedStyle(document.querySelector('.curator-input-caret-layer')).display === 'none'
  }))
  await page.cdp('Emulation.setEmulatedMedia', { features: [] })
  await page.cdp('Page.stopScreencast')
  await page.evaluate(() => window.__stopInputCaret())
  check('cleanup/restores-native-caret', await page.evaluate(() =>
    document.querySelectorAll('[data-curator-input-caret], .curator-input-caret-layer').length === 0
  ))
  return report
}
