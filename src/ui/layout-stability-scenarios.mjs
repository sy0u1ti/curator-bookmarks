import assert from 'node:assert/strict'

const cases = {
  feedback: { selectors: ['#fixture-status', '#fixture-stable-button', '#fixture-tail'], phases: ['saving', 'long-error', 'success', 'idle'] },
  general: { selectors: ['#fixture-features', '#fixture-snapshot', '#fixture-shortcuts', '#fixture-tail'], phases: ['loading', 'idle', 'saving', 'error', 'long-error', 'success', 'idle'] },
  ai: { selectors: ['#ai > div:first-of-type', '#ai-title', '#fixture-tail'], phases: ['running', 'paused', 'error', 'long-error', 'success', 'idle', 'selected', 'idle'] },
  availability: { selectors: ['#availability > div:first-of-type', '#availability-title', '#fixture-tail'], phases: ['loading', 'pending', 'idle', 'running', 'paused', 'error', 'long-error', 'success', 'idle', 'selected', 'idle'] },
  duplicates: { selectors: ['[data-duplicate-group]', '[data-bookmark-id="copy"]', '#fixture-tail'], phases: ['selected', 'all-selected', 'idle'] },
  recycle: { selectors: ['#recycle', '#fixture-tail'], phases: ['selected', 'idle'] },
  redirects: { selectors: ['#redirects', '#fixture-tail'], phases: ['selected', 'idle'] },
  backup: { selectors: ['#backup', '[aria-label="导入书签标签数据"]', '[aria-label="导出书签标签数据"]', '#fixture-tail'], phases: ['saving', 'error', 'long-error', 'success', 'idle'] },
  popup: { selectors: ['#popup-app-shell', '#search-input', '.popup-main-pane'], phases: ['running', 'collapsed', 'success', 'error', 'long-error', 'idle'] },
  sidepanel: { selectors: ['#popup-app-shell', '#search-input', '.popup-main-pane'], phases: ['running', 'collapsed', 'success', 'error', 'long-error', 'idle'] },
  'popup-dialog': { selectors: ['#smart-folder-modal', '#smart-folder-title-input', '#smart-folder-list', '#save-smart-folder-button'], phases: ['saving', 'error', 'long-error', 'success', 'idle'] },
  'newtab-settings': { selectors: ['#newtab-settings-drawer', '#settings-background-title', '#settings-icon-title'], phases: ['saving', 'error', 'long-error', 'success', 'idle'] },
  'newtab-menu': { selectors: ['.bookmark-edit-menu', '.bookmark-edit-menu input[type="text"]', '.bookmark-edit-menu input[type="url"]'], phases: ['saving', 'error', 'long-error', 'success', 'idle'] },
  'newtab-add': { selectors: ['.bookmark-add-menu', '.bookmark-add-menu input[type="text"]', '.bookmark-add-menu input[type="url"]'], phases: ['saving', 'error', 'long-error', 'success', 'idle'] },
  archive: { selectors: ['main', '[aria-label="来源网页"]', '.archive-actions', '.archive-status'] }
}

export async function runLayoutStabilityChecks(page, origin, directory, options = {}) {
  const report = { checks: [], failures: [], screenshots: [], frames: 0, samples: 0 }
  const widths = options.widths || [1440, 768, 390]
  const surfaces = options.surfaces || Object.keys(cases)
  for (const surface of surfaces) assert.ok(cases[surface], `Unknown surface ${surface}`)
  const settle = async () => {
    await page.evaluate(async () => {
      await document.fonts.ready
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    })
    await page.waitForFunction(() => document.getAnimations().every(animation =>
      animation.effect?.getTiming().iterations === Infinity || animation.playState !== 'running'
    ), undefined, { timeout: 5000 })
  }
  const start = selectors => page.evaluate(selectors => {
    const nodes = selectors.map(selector => {
      const node = document.querySelector(selector)
      if (!node) throw new Error(`Missing layout anchor: ${selector}`)
      return node
    })
    // Compare document-space boxes, so deliberately scrolling to a button is not a reflow.
    const geometry = node => {
      let x = 0, y = 0
      for (let parent = node.parentElement; parent; parent = parent.parentElement) {
        x += parent.scrollLeft
        y += parent.scrollTop
      }
      const rect = node.getBoundingClientRect()
      return [rect.x + x, rect.y + y, rect.width, rect.height]
    }
    const initial = nodes.map(geometry)
    const probe = window.__layoutProbe = { active: true, frames: 0, samples: 0, maximum: 0, shifts: [], initial, timer: 0 }
    const sample = () => {
      if (!probe.active) return
      probe.samples++
      for (let i = 0; i < nodes.length; i++) {
        const current = geometry(nodes[i])
        const delta = Math.max(...current.map((value, index) => Math.abs(value - initial[i][index])))
        probe.maximum = Math.max(probe.maximum, delta)
        if (delta > 0.5 && !probe.shifts.some(shift => shift.selector === selectors[i])) {
          probe.shifts.push({ selector: selectors[i], delta, initial: initial[i], current })
        }
      }
    }
    const frame = () => {
      if (!probe.active) return
      probe.frames++
      sample()
      requestAnimationFrame(frame)
    }
    // Emulated/occluded surfaces may skip compositor frames. Also inspect layout
    // on timer ticks; report actual paint frames separately from geometry samples.
    probe.timer = setInterval(sample, 16)
    requestAnimationFrame(frame)
  }, selectors)
  const stop = async label => {
    await page.waitForFunction(() => window.__layoutProbe.samples >= 24, undefined, { timeout: 8000 })
    await settle()
    const sample = await page.evaluate(() => {
      window.__layoutProbe.active = false
      clearInterval(window.__layoutProbe.timer)
      return window.__layoutProbe
    })
    report.frames += sample.frames
    report.samples += sample.samples
    report.checks.push({ label, maximum: sample.maximum, frames: sample.frames, samples: sample.samples })
    if (sample.maximum > 0.5) report.failures.push({ label, shifts: sample.shifts })
  }
  const record = async (label, task) => {
    try { await task() } catch (error) { report.failures.push({ label, error: String(error) }) }
  }
  const screenshot = async name => {
    const file = `${directory}/${name}.png`
    await page.screenshot({ path: file })
    report.screenshots.push(file)
  }
  for (const width of widths) {
    for (const surface of surfaces) {
      const label = `${surface}/${width}`
      await record(label, async () => {
        const height = width === 390 ? 844 : 1000
        await page.cdp('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
        await page.goto(`${origin}/?surface=${surface}${surface === 'archive' ? '&tabId=123' : ''}`)
        // Frame sampling requires an active render surface, not an occluded tab.
        await page.cdp('Page.bringToFront')
        await page.cdp('Emulation.setFocusEmulationEnabled', { enabled: true })
        await page.waitForSelector(cases[surface].selectors[0], { state: 'visible' })
        await settle()
        console.log(`${label}: ${(await page.snapshot()).slice(0, 220)}`)
        const selectors = cases[surface].selectors
        if (surface === 'archive') {
          await page.waitForFunction(() => !document.querySelector('.archive-actions button').disabled)
          await start(selectors)
          await page.evaluate(() => { window.__archiveIO.denied = true })
          await page.click('loc=role:button[name="保存离线文件"]')
          await page.waitForFunction(() => document.querySelector('.archive-status').textContent.includes('未授予'))
          await stop(`${label}/permission-denial`)
          await start(selectors)
          await page.evaluate(() => { window.__archiveIO.denied = false; window.__archiveIO.hold = true })
          await page.click('loc=role:button[name="保存离线文件"]')
          await page.waitForFunction(() => typeof window.__archiveIO.release === 'function')
          await stop(`${label}/pending`)
          await start(selectors)
          await page.evaluate(() => window.__archiveIO.release())
          await page.waitForFunction(() => window.__archiveIO.downloads === 1)
          await stop(`${label}/success`)
          assert.match(await page.evaluate(() => document.querySelector('.archive-status').textContent), /已生成/)
        } else {
          for (const phase of cases[surface].phases) {
            await start(selectors)
            await page.evaluate(phase => window.__stability.phase(phase), phase)
            await stop(`${label}/${phase}`)
            if (surface === 'feedback' && phase === 'long-error') {
              const status = await page.evaluate(() => {
                const node = document.querySelector('#fixture-status')
                return { role: node.getAttribute('role'), tabIndex: node.tabIndex, overflowing: node.scrollHeight > node.clientHeight, text: node.textContent }
              })
              assert.equal(status.role, 'alert')
              assert.ok(status.overflowing && status.tabIndex === 0 && status.text.length > 100, 'Long errors must stay readable with keyboard scrolling')
            }
            if (phase === 'selected' || phase === 'all-selected') {
              const dock = await page.evaluate(() => {
                const node = document.querySelector('.options-selection-dock')
                const rect = node?.getBoundingClientRect()
                return rect ? { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom } : null
              })
              assert.ok(dock && dock.left >= 0 && dock.right <= width && dock.top >= 0 && dock.bottom <= height, 'Selection actions must remain inside the viewport')
            }
            if (phase === 'selected' || phase === 'long-error') await screenshot(`${surface}-${width}-${phase}`)
            if (surface === 'newtab-settings' && phase === 'long-error') {
              await start(selectors)
              await page.click('loc=role:button[name="查看保存失败详情"]')
              await page.waitForSelector('loc=role:dialog[name="设置保存失败"]', { state: 'visible' })
              await stop(`${label}/error-details-open`)
              await screenshot(`${surface}-${width}-error-details`)
              await page.keyboard.press('Escape')
              await page.waitForSelector('loc=role:dialog[name="设置保存失败"]', { state: 'hidden' })
              // Opacity can finish before geometry. Base UI restores focus when
              // the exit lifecycle completes, not when the popup first vanishes.
              await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === '查看保存失败详情', undefined, { timeout: 2000 })
            }
            if (surface === 'availability' && phase === 'selected') {
              await start(selectors)
              await page.click('loc=role:button[name="更多已选异常书签操作"]')
              await page.waitForSelector('loc=role:menuitem[name="忽略所选域名"]', { state: 'visible' })
              await stop(`${label}/secondary-actions-open`)
              await page.keyboard.press('Escape')
            }
          }
          if (surface === 'general') {
            await start(selectors)
            await page.focus('loc=role:switch[name="自动分析"]')
            await page.press('loc=role:switch[name="自动分析"]', 'Space')
            await page.waitForFunction(() => document.querySelector('[role="status"]')?.textContent?.includes('保存中'))
            await stop(`${label}/keyboard-save`)
          }
          if (surface === 'ai' || surface === 'availability') {
            if (surface === 'availability') {
              const checkbox = 'loc=role:checkbox[name="选择排版与交互参考"]'
              await page.focus(checkbox)
              await page.press(checkbox, 'Space')
              await page.waitForSelector('.options-selection-dock', { state: 'visible' })
              await page.click('loc=role:button[name="清空可用性检测已选书签"]')
              await page.waitForSelector('.options-selection-dock', { state: 'hidden' })
              assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), '选择排版与交互参考', 'Clearing the dock restores focus to the selection control')
            }
            const startLabel = surface === 'ai' ? '开始分析并生成建议' : '开始检测全部书签'
            await page.focus(`loc=role:button[name="${startLabel}"]`)
            await start(selectors)
            await page.press(`loc=role:button[name="${startLabel}"]`, 'Space')
            await page.waitForFunction(() => getComputedStyle(document.querySelector('.options-run-secondary-actions')).visibility === 'visible')
            await stop(`${label}/keyboard-start`)
            assert.equal(await page.evaluate(() => Boolean(document.activeElement?.closest('.options-run-secondary-actions'))), true, 'Focus follows the active run controls')
          }
        }
        await settle()
        const safety = await page.evaluate(() => ({
          errors: window.__fixtureErrors,
          overflow: document.documentElement.scrollWidth - innerWidth
        }))
        assert.deepEqual(safety.errors, [], 'No browser runtime errors')
        if (surface.startsWith('popup')) {
          // Chrome's popup autosize lays the document out at its minimum width
          // on every pass, so the shell must not size from the viewport. Below
          // the design size (browser zoom), the document scrolls instead.
          const shell = await page.evaluate(() => ({
            width: document.querySelector('#popup-root').getBoundingClientRect().width,
            overflowX: getComputedStyle(document.documentElement).overflowX
          }))
          assert.ok(Math.abs(shell.width - 800) <= 1, `Popup shell must keep its design width: ${shell.width}px`)
          // An open dialog's scroll lock owns document overflow meanwhile.
          if (width < 800 && surface === 'popup') assert.equal(shell.overflowX, 'auto', 'A clipped popup must stay reachable by scrolling')
        } else assert.ok(safety.overflow <= 1, `Page overflows horizontally by ${safety.overflow}px`)
        await screenshot(`${surface}-${width}`)
        console.log(`${label}: checked`)
      })
    }
  }
  return report
}
