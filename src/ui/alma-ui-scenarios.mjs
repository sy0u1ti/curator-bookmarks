export async function runAlmaUiChecks(page, origin, directory) {
  const report = { checks: [], failures: [], screenshots: [] }
  const check = (name, pass, detail) => {
    const item = { name, pass: Boolean(pass), ...(detail === undefined ? {} : { detail }) }
    report.checks.push(item)
    if (!pass) report.failures.push(item)
  }
  const scenario = async (name, fn) => {
    try { await fn() } catch (error) { check(name, false, String(error.message || error)) }
  }
  const frame = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  const capture = async name => {
    const filename = `${directory}/${name}.png`
    await page.screenshot({ path: filename })
    report.screenshots.push(filename)
  }
  await page.cdp('Emulation.setFocusEmulationEnabled', { enabled: true })
  await page.cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] })
  await page.cdp('Page.startScreencast', { format: 'jpeg', quality: 10, maxWidth: 160, maxHeight: 120, everyNthFrame: 1 })

  for (const width of [1440, 768, 390]) {
    await scenario(`settings/${width}`, async () => {
      await page.cdp('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false })
      await page.goto(`${origin}/?surface=options#general`)
      await page.waitForSelector('#options-settings-search')
      await page.waitForSelector('#settings-input-caret')
      if (width === 1440) console.log(await page.snapshot())
      await capture(`settings-${width}`)
      const baseline = await page.evaluate(() => {
        const input = document.getElementById('options-settings-search').getBoundingClientRect()
        return { x: input.x, y: input.y, width: input.width, height: input.height }
      })
      await page.fill('#options-settings-search', '不存在的设置')
      await page.waitForSelector('text=没有匹配的设置')
      check(`${width}/empty-results-dont-move-input`, await page.evaluate(before => {
        const rect = document.getElementById('options-settings-search').getBoundingClientRect()
        return ['x', 'y', 'width', 'height'].every(key => Math.abs(rect[key] - before[key]) < 0.1)
      }, baseline))
      await page.fill('#options-settings-search', '光标')
      await page.waitForSelector('loc=role:option[name*="动态输入光标"]')
      await capture(`search-${width}`)
      await page.press('#options-settings-search', 'Enter')
      await page.waitForFunction(() => location.hash === '#general:input-caret' && document.activeElement?.id === 'settings-input-caret')
      check(`${width}/keyboard-select-focuses-control`, true)
      check(`${width}/search-only-navigates`, await page.evaluate(() => window.__almaUi.mutations === 0), await page.evaluate(() => window.__almaUi.actions))
      check(`${width}/target-visible`, await page.evaluate(() => {
        const rect = document.getElementById('settings-input-caret').getBoundingClientRect()
        const header = document.querySelector('.options-header').getBoundingClientRect()
        return rect.top >= (innerWidth <= 920 ? header.bottom : 0) && rect.bottom <= innerHeight
      }))
      await page.keyboard.press('ControlOrMeta+k')
      await page.waitForFunction(() => document.activeElement?.id === 'options-settings-search', undefined, { timeout: 2000 })
      check(`${width}/shortcut-focuses-search`, await page.evaluate(() => document.activeElement?.id === 'options-settings-search'))
      await page.fill('#options-settings-search', '完整备份')
      await page.waitForSelector('loc=role:option[name*="完整备份"]')
      await page.click('loc=role:option[name*="完整备份"]', { label: 'Open backup setting' })
      await page.waitForFunction(() => location.hash === '#backup:full-backup' && document.activeElement?.id === 'settings-full-backup', undefined, { timeout: 10000 })
      check(`${width}/lazy-panel-focus`, true)
      check(`${width}/no-horizontal-overflow`, await page.evaluate(() =>
        document.documentElement.scrollWidth <= innerWidth + 1 &&
        document.querySelector('.options-shell').scrollWidth <= document.querySelector('.options-shell').clientWidth + 1
      ))
      await page.keyboard.press('ControlOrMeta+k')
      await page.fill('#options-settings-search', '光标')
      await page.waitForSelector('loc=role:option[name*="动态输入光标"]')
      await page.evaluate(() => document.getElementById('options-settings-search').dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true })))
      await frame()
      await page.press('#options-settings-search', 'Enter')
      check(`${width}/ime-enter-does-not-navigate`, await page.evaluate(() => location.hash === '#backup:full-backup'))
      await page.evaluate(() => document.getElementById('options-settings-search').dispatchEvent(new CompositionEvent('compositionend', { bubbles: true })))
      await page.press('#options-settings-search', 'Escape')
      await frame()
      check(`${width}/escape-dismisses-results`, await page.evaluate(() => !document.querySelector('.options-settings-search-popup')?.checkVisibility()))
      check(`${width}/runtime-errors`, await page.evaluate(() => window.__fixtureErrors.length === 0), await page.evaluate(() => window.__fixtureErrors))
    })
  }

  await scenario('reading-position', async () => {
    await page.cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 700, deviceScaleFactor: 1, mobile: false })
    await page.goto(`${origin}/?surface=options#general`)
    await page.waitForSelector('#settings-shortcuts')
    const saved = await page.evaluate(async () => {
      const main = document.getElementById('options-main')
      main.scrollTop = 300
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      return main.scrollTop
    })
    check('reading-position/scrollable-fixture', saved > 100)
    await page.evaluate(() => window.__almaUi.navigate('#backup'))
    await page.waitForSelector('#backup')
    await page.evaluate(() => window.__almaUi.navigate('#general'))
    await page.waitForSelector('#settings-shortcuts')
    await frame()
    const restored = await page.evaluate(() => ({
      top: document.getElementById('options-main').scrollTop,
      marked: document.getElementById('options-main').hasAttribute('data-reading-restored'),
      transitions: document.getElementById('general').getAnimations().filter(animation => animation.playState === 'running').length
    }))
    check('reading-position/restored', Math.abs(restored.top - saved) < 1, { saved, ...restored })
    check('reading-position/no-replayed-entrance', restored.marked && restored.transitions === 0, restored)
  })

  await scenario('settings-target-inventory', async () => {
    // The same source index drives UI results. Visit every destination, including
    // lazy panels, to detect stale IDs and accidental destructive actions.
    const items = await page.evaluate(() => window.__almaUi.settings)
    for (const item of items) {
      await page.evaluate(id => window.__almaUi.navigate(`#${id}`), item.id)
      await page.waitForFunction(id => {
        const node = document.getElementById(id)
        return node && node.getClientRects().length > 0
      }, item.targetId, { timeout: 10000 })
      await frame()
      const target = await page.evaluate(id => {
        const node = document.getElementById(id)
        const focused = document.activeElement
        return { visible: node.checkVisibility(), focused: focused === node || focused?.contains(node), hash: location.hash }
      }, item.targetId)
      check(`target/${item.id}`, target.visible && target.focused, target)
    }
    check('settings-target-inventory/no-mutation', await page.evaluate(() => window.__almaUi.mutations === 0), await page.evaluate(() => window.__almaUi.actions))
  })

  await page.cdp('Emulation.setDeviceMetricsOverride', { width: 768, height: 900, deviceScaleFactor: 1, mobile: false })
  await page.goto(`${origin}/?surface=controls`)
  await page.waitForSelector('#icon-controls')
  await frame()

  await scenario('ambient-motion', async () => {
    const initial = await page.evaluate(() => document.querySelector('#shimmers .t-shimmer').getAnimations({ subtree: true }).map(animation => animation.startTime))
    // Offset mounting from the existing loop so an unsynchronized instance
    // cannot pass by sharing its first paint with the original.
    await page.waitForFunction(() => document.timeline.currentTime > 300)
    await page.evaluate(() => window.__almaUi.addShimmer())
    await page.waitForFunction(() => document.querySelectorAll('#shimmers .t-shimmer').length === 2)
    await frame()
    const animations = await page.evaluate(() => [...document.querySelectorAll('#shimmers .t-shimmer')].flatMap(node =>
      node.getAnimations({ subtree: true }).map(animation => ({ start: animation.startTime, time: animation.currentTime, state: animation.playState }))
    ))
    check('ambient-motion/late-mount-shares-phase', animations.length === 2 && animations.every(animation => animation.start === 0) &&
      Math.abs(animations[0].time - animations[1].time) < 1, { initial, animations })
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true })
      document.dispatchEvent(new Event('visibilitychange'))
      window.__almaUi.addShimmer()
    })
    await frame()
    const paused = await page.evaluate(() => [...document.querySelectorAll('#shimmers .t-shimmer')].flatMap(node => node.getAnimations({ subtree: true }).map(animation => animation.playState)))
    check('ambient-motion/hidden-stays-paused', paused.length === 3 && paused.every(state => state === 'paused'), paused)
    await page.evaluate(() => {
      delete document.hidden
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await frame()
    const resumed = await page.evaluate(() => [...document.querySelectorAll('#shimmers .t-shimmer')].flatMap(node => node.getAnimations({ subtree: true }).map(animation => ({ time: animation.currentTime, state: animation.playState }))))
    check('ambient-motion/resume-rejoins-phase', resumed.every(animation => animation.state === 'running') &&
      Math.max(...resumed.map(animation => animation.time)) - Math.min(...resumed.map(animation => animation.time)) < 1, resumed)
  })

  await scenario('icon-geometry', async () => {
    const sizes = await page.evaluate(() => [...document.querySelectorAll('#icon-controls button')].map(node => ({
      size: node.dataset.controlSize, width: node.offsetWidth, height: node.offsetHeight, padding: getComputedStyle(node).padding
    })))
    check('icon-geometry/square', sizes.length === 5 && sizes.every(size => size.width === size.height && size.padding === '0px'), sizes)
    check('icon-geometry/roles', sizes.map(size => size.width).join(',') === '28,32,36,40,36', sizes)
  })

  await scenario('restored-disclosure', async () => {
    const initial = await page.evaluate(() => ({
      marked: document.getElementById('disclosure-panel').hasAttribute('data-motion-initial'),
      height: document.getElementById('disclosure-panel').getBoundingClientRect().height
    }))
    await page.evaluate(() => window.__almaUi.remount())
    await frame()
    const restored = await page.evaluate(() => {
      const panel = document.getElementById('disclosure-panel')
      return { height: panel.getBoundingClientRect().height, animations: panel.getAnimations({ subtree: true }).length }
    })
    check('restored-disclosure/no-entrance', initial.marked && initial.height > 20 &&
      Math.abs(initial.height - restored.height) < 1 && restored.animations === 0, { initial, restored })
    await page.fill('input[aria-label="已保存的输入"]', '用户编辑的草稿')
    await page.click('#disclosure-trigger', { label: 'Collapse saved disclosure' })
    await frame()
    await page.click('#disclosure-trigger', { label: 'Reverse disclosure motion' })
    await frame()
    check('restored-disclosure/user-toggle-animates', await page.evaluate(() => {
      const panel = document.getElementById('disclosure-panel')
      return !panel.hasAttribute('data-motion-initial') && panel.getAnimations().some(animation => animation.transitionProperty === 'grid-template-rows')
    }))
    check('restored-disclosure/draft-retained', await page.evaluate(() => document.querySelector('input[aria-label="已保存的输入"]').value === '用户编辑的草稿'))
    // End the reversal test before targeting another control: its layout is
    // still moving while the disclosure finishes opening.
    await page.waitForFunction(() => document.getElementById('disclosure-panel').getAnimations().every(animation => animation.playState !== 'running'))
  })

  for (const requested of ['top', 'bottom', 'left', 'right']) {
    await scenario(`popover/${requested}`, async () => {
      await page.click(`#trigger-${requested}`, { label: 'Inspect anchored popover' })
      await page.waitForSelector(`#popover-${requested}`, { state: 'visible' })
      const geometry = await page.evaluate(id => {
        const popup = document.getElementById(`popover-${id}`)
        const css = getComputedStyle(popup)
        const rect = popup.getBoundingClientRect()
        const axis = css.transformOrigin.split(' ').map(parseFloat)
        return {
          side: popup.dataset.side, width: popup.offsetWidth, height: popup.offsetHeight, origin: axis,
          enterX: parseFloat(css.getPropertyValue('--curator-overlay-enter-x')),
          enterY: parseFloat(css.getPropertyValue('--curator-overlay-enter-y')),
          duration: css.transitionDuration,
          inside: rect.left >= -1 && rect.right <= innerWidth + 1 && rect.top >= -1 && rect.bottom <= innerHeight + 1
        }
      }, requested)
      // Base UI's origin is the trigger attachment, including sideOffset=8.
      // It can sit just outside the popup rather than on its painted border.
      const expectedOrigin = geometry.side === 'top' ? Math.abs(geometry.origin[1] - geometry.height - 8) < 1
        : geometry.side === 'bottom' ? Math.abs(geometry.origin[1] + 8) < 1
        : geometry.side === 'left' ? Math.abs(geometry.origin[0] - geometry.width - 8) < 1 : Math.abs(geometry.origin[0] + 8) < 1
      check(`popover/${requested}/origin-follows-side`, expectedOrigin && geometry.inside, geometry)
      check(`popover/${requested}/fast`, geometry.duration.split(',').every(value => parseFloat(value) <= 0.161), geometry.duration)
      await page.fill(`input[aria-label="${requested} 菜单内输入"]`, '当前草稿')
      await page.click(`text=子菜单 ${requested}`, { label: 'Keep parent menu open' })
      await page.waitForSelector(`text=子菜单操作 ${requested}`)
      check(`popover/${requested}/nested-stays-open`, await page.evaluate(id =>
        document.getElementById(`popover-${id}`).checkVisibility() &&
        document.querySelector(`input[aria-label="${id} 菜单内输入"]`).value === '当前草稿', requested))
      await page.keyboard.press('Escape')
      await frame()
      await page.keyboard.press('Escape')
      await page.waitForFunction(id => !document.getElementById(`popover-${id}`)?.hasAttribute('data-open'), requested)
    })
  }

  await scenario('direct-slider-and-stable-status', async () => {
    const track = await page.evaluate(() => {
      const rect = document.querySelector('.base-slider').getBoundingClientRect()
      return { x: rect.left, y: rect.top + rect.height / 2, width: rect.width }
    })
    await page.mouse.move(track.x + track.width * 0.3, track.y, { label: 'Locate slider thumb' })
    await page.mouse.down()
    await page.mouse.move(track.x + track.width * 0.75, track.y, { label: 'Drag slider directly' })
    const direct = await page.evaluate(() => ({
      value: Number(document.querySelector('.base-slider input').value),
      delayed: document.querySelector('.base-slider').getAnimations({ subtree: true }).some(animation =>
        ['left', 'right', 'translate', 'transform', 'width'].includes(animation.transitionProperty))
    }))
    await page.mouse.up()
    check('direct-slider/no-position-interpolation', direct.value >= 70 && !direct.delayed, direct)
    const before = await page.evaluate(() => document.getElementById('stable-action').getBoundingClientRect().top)
    for (const text of ['正在分析', '正在生成内容。'.repeat(25), '失败：连接中断，请重试。'.repeat(30), '已完成']) {
      await page.evaluate(value => window.__almaUi.updateStatus(value), text)
      await frame()
      check(`bounded-status/${text.slice(0, 5)}`, await page.evaluate(top =>
        Math.abs(document.getElementById('stable-action').getBoundingClientRect().top - top) < 0.1, before))
      if (text.startsWith('失败')) {
        check('bounded-status/long-error-readable', await page.evaluate(() => {
          const node = document.getElementById('bounded-status')
          return node.tabIndex === 0 && node.scrollHeight > node.clientHeight && node.textContent.length > 100
        }))
      }
    }
  })

  await scenario('interrupted-lazy-focus', async () => {
    await page.evaluate(() => window.__almaUi.queueFocus())
    await frame()
    await page.focus('#newer-interaction')
    await page.keyboard.type('继续当前操作')
    await page.evaluate(() => window.__almaUi.releaseFocus())
    await page.waitForSelector('#settings-full-backup')
    await frame()
    check('interrupted-lazy-focus/does-not-steal-input', await page.evaluate(() =>
      document.activeElement?.id === 'newer-interaction' &&
      document.getElementById('newer-interaction').value === '继续当前操作'
    ))
    await page.evaluate(() => window.__almaUi.queueFocus())
    await frame()
    await page.evaluate(() => window.__almaUi.releaseFocus())
    await page.waitForFunction(() => document.activeElement?.id === 'settings-full-backup')
    check('interrupted-lazy-focus/new-request-still-focuses', true)
  })

  await scenario('reduced-motion', async () => {
    await page.cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
    await page.click('#trigger-bottom', { label: 'Inspect reduced motion' })
    await page.waitForSelector('#popover-bottom', { state: 'visible' })
    check('reduced-motion/no-spatial-effect', await page.evaluate(() => {
      const popup = document.getElementById('popover-bottom')
      return getComputedStyle(popup).transform === 'none' &&
        document.querySelector('#shimmers .t-shimmer').getAnimations({ subtree: true }).length === 0
    }))
    await page.keyboard.press('Escape')
    await page.cdp('Emulation.setEmulatedMedia', { features: [] })
    check('controls/no-runtime-errors', await page.evaluate(() => window.__fixtureErrors.length === 0), await page.evaluate(() => window.__fixtureErrors))
    await capture('controls-verified')
  })
  await scenario('production-newtab-intent', async () => {
    await page.cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })
    await page.goto(`${origin}/src/newtab/newtab.html`)
    await page.waitForSelector('.bookmark-tile')
    await page.waitForFunction(() => !document.getElementById('newtab-bookmark-preboot'))
    console.log((await page.snapshot()).slice(0, 1500))
    await page.fill('.newtab-search-input', '项目')
    await page.waitForFunction(() => document.querySelector('.newtab-search-shell')?.dataset.panelOpen === 'true')
    await page.click('.newtab-search-engine', { label: 'Keep live search active' })
    await page.waitForSelector('.newtab-search-engine-menu', { state: 'visible' })
    // A lazy portal can temporarily put focus on the document body. Its open
    // state still owns the input session until dismissal actually happens.
    await page.evaluate(() => {
      const input = document.querySelector('.newtab-search-input')
      input.focus()
      input.blur()
    })
    await frame()
    check('production-newtab/portal-blur-keeps-session', await page.evaluate(() =>
      document.querySelector('.newtab-search-shell').dataset.panelOpen === 'true' &&
      document.querySelector('.newtab-search-shell').dataset.engineOpen === 'true' &&
      document.querySelector('.newtab-search-input').value === '项目'
    ))
    await page.click('.newtab-search-engine-item >> nth=0', { label: 'Select fixture engine' })
    await page.waitForFunction(() => !document.querySelector('.newtab-search-shell').dataset.engineOpen)
    await page.focus('.newtab-search-input')
    await page.evaluate(() => document.querySelector('.newtab-search-input').dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true })))
    await page.evaluate(() => document.querySelector('.newtab-search-input').blur())
    await frame()
    check('production-newtab/ime-transient-blur-keeps-session', await page.evaluate(() => document.querySelector('.newtab-search-shell').dataset.panelOpen === 'true'))
    await page.evaluate(() => document.querySelector('.newtab-search-input').dispatchEvent(new CompositionEvent('compositionend', { bubbles: true })))
    await page.waitForFunction(() => document.querySelector('.newtab-search-shell').dataset.panelOpen === 'false')
    check('production-newtab/ime-finished-outside-dismisses', true)
    check('production-newtab/draft-retained', await page.evaluate(() => document.querySelector('.newtab-search-input').value === '项目'))
    check('production-newtab/runtime-errors', await page.evaluate(() => window.__glassFixture.errors.length === 0), await page.evaluate(() => window.__glassFixture.errors))
  })
  await page.cdp('Page.stopScreencast')
  return report
}
