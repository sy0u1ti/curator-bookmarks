import assert from 'node:assert/strict'

export async function runContinuityScenarios(page, origin, directory) {
  const report = { checks: [], failures: [], screenshots: [] }
  const check = async (name, run) => {
    try {
      const details = await run()
      assert.deepEqual(await page.evaluate(() => window.__fixtureErrors), [], 'No runtime errors')
      report.checks.push({ name, details })
      console.log(`PASS ${name}`)
    } catch (error) {
      report.failures.push({ name, error: String(error) })
      console.log(`FAIL ${name}: ${String(error)}`)
    }
  }
  const settle = () => page.waitForFunction(() => document.getAnimations().every(animation =>
    animation.effect?.getTiming().iterations === Infinity || animation.playState !== 'running'
  ), undefined, { timeout: 6000 })
  const open = async (surface, width, height = 900) => {
    await page.cdp('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
    await page.cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] })
    await page.goto(`${origin}/?surface=${surface}`)
    await page.cdp('Page.bringToFront')
    await page.cdp('Emulation.setFocusEmulationEnabled', { enabled: true })
    await page.waitForFunction(() => Boolean(window.__continuity))
    await settle()
    console.log((await page.snapshot()).slice(0, 300))
  }
  const rect = selector => page.evaluate(selector => {
    const box = document.querySelector(selector).getBoundingClientRect()
    return { x: box.x, y: box.y, width: box.width, height: box.height }
  }, selector)
  const unchanged = (before, after, name) => assert.ok(
    ['x', 'y', 'width', 'height'].every(key => Math.abs(before[key] - after[key]) <= 0.5),
    `${name}: ${JSON.stringify({ before, after })}`
  )
  const screenshot = async name => {
    const file = `${directory}/${name}.png`
    await page.screenshot({ path: file })
    report.screenshots.push(file)
  }

  for (const width of [1440, 768, 390]) {
    await check(`model-search/${width}`, async () => {
      await open('models', width)
      await page.click('[aria-label="选择 AI 模型"]')
      await page.waitForSelector('input[placeholder^="Search models"]')
      await settle()
      const input = 'input[placeholder^="Search models"]'
      const before = await rect(input)
      const background = await page.evaluate(() => ({ window: scrollY, main: document.querySelector('main').scrollTop }))
      await page.fill(input, 'not-in-catalog')
      await page.waitForSelector('text=没有匹配的模型。')
      await settle()
      const empty = await rect(input)
      await screenshot(`model-search-${width}-empty`)
      unchanged(before, empty, 'Typing must not move the search field')
      await page.fill(input, 'fixture-01')
      await page.waitForFunction(() => document.querySelectorAll('[data-ai-model-id]').length === 1)
      await settle()
      unchanged(before, await rect(input), 'A single result keeps the same search anchor')
      await page.fill(input, '')
      await page.waitForFunction(() => document.querySelectorAll('[data-ai-model-id]').length === 40)
      await settle()
      unchanged(before, await rect(input), 'Restoring the list keeps the same search anchor')
      assert.deepEqual(await page.evaluate(() => ({ window: scrollY, main: document.querySelector('main').scrollTop })), background)
      await page.keyboard.press('Escape')
      await page.waitForFunction(() => !document.querySelector('.model-selector-content[data-open]'))
      await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === '选择 AI 模型')
      return { before, empty }
    })

    for (const kind of ['scope', 'move']) {
      await check(`folder-search-${kind}/${width}`, async () => {
        await open('folders', width)
        await page.click(`#open-${kind}`)
        await page.waitForSelector(`#${kind}-search-input`)
        await settle()
        const input = `#${kind}-search-input`
        const before = await rect(input)
        const closeControl = kind === 'move' ? '[aria-label="取消批量移动书签"]' : '[aria-label="关闭筛选文件夹弹窗"]'
        const closeBefore = await rect(closeControl)
        const closeIcon = await rect(`${closeControl} svg`)
        assert.ok(closeBefore.width >= 36 && closeIcon.width >= 16, 'The icon-only close control must not squeeze its glyph with text-button padding')
        await page.fill(input, 'not-a-folder')
        await page.waitForFunction(kind => document.getElementById(`${kind}-folder-results`).textContent.includes('没有匹配'), kind)
        await settle()
        const empty = await rect(input)
        await screenshot(`folder-${kind}-${width}-empty`)
        unchanged(before, empty, 'Folder filtering must not recenter the dialog')
        unchanged(closeBefore, await rect(closeControl), 'Cancellation stays beside the title across filtering')
        await page.fill(input, '')
        await settle()
        unchanged(before, await rect(input), 'Folder results return below the stationary input')
        await page.press(input, 'ArrowDown')
        await page.waitForFunction(kind => document.activeElement?.closest(`#${kind}-folder-results`) !== null, kind)
        await page.keyboard.press('End')
        await page.waitForFunction(() => document.activeElement?.textContent?.includes('23'))
        const scroll = await page.evaluate(kind => {
          const tree = document.getElementById(`${kind}-folder-results`)
          const bounds = tree.getBoundingClientRect()
          const active = document.activeElement.getBoundingClientRect()
          return { scrollTop: tree.scrollTop, contained: active.bottom <= bounds.bottom + 1, page: scrollY }
        }, kind)
        assert.ok(scroll.scrollTop > 0 && scroll.contained && scroll.page === 0, JSON.stringify(scroll))
        unchanged(before, await rect(input), 'Keyboard navigation scrolls only the results')
        await page.keyboard.press('Escape')
        await page.waitForFunction(selector => document.activeElement === document.querySelector(selector), input)
        await page.keyboard.press('Escape')
        await page.waitForFunction(kind => !document.querySelector(`[aria-labelledby="${kind}-modal-title"][data-open]`), kind)
        await page.waitForFunction(kind => document.activeElement?.id === `open-${kind}`, kind)
        return { before, empty }
      })
    }

    await check(`draft-continuity/${width}`, async () => {
      await open('models', width)
      await page.click('[aria-label="打开自定义模型列表设置"]')
      await page.waitForSelector('#ai-custom-models-input')
      await settle()
      const draft = 'my-local-draft\nkeep-this-text'
      const beforeEditor = await rect('#ai-custom-models-input')
      const beforeSave = await rect('[aria-label="保存自定义模型列表"]')
      await page.fill('#ai-custom-models-input', draft)
      await page.evaluate(() => {
        const input = document.getElementById('ai-custom-models-input')
        input.setSelectionRange(3, 8)
        window.__draftInput = input
        window.__continuity.updateModels(['background-update'])
      })
      await page.waitForFunction(() => document.querySelector('.ai-provider-dialog-panel[data-open]'))
      await settle()
      const actual = await page.evaluate(() => {
        const input = document.getElementById('ai-custom-models-input')
        return { value: input.value, same: input === window.__draftInput, focused: document.activeElement === input, start: input.selectionStart, end: input.selectionEnd }
      })
      assert.deepEqual(actual, { value: draft, same: true, focused: true, start: 3, end: 8 })
      unchanged(beforeEditor, await rect('#ai-custom-models-input'), 'Catalog update keeps the editor geometry')
      unchanged(beforeSave, await rect('[aria-label="保存自定义模型列表"]'), 'Catalog update keeps the save control')
      await page.click('[aria-label="取消自定义模型设置"]')
      await page.waitForFunction(() => !document.querySelector('.ai-provider-dialog-panel'))
      await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === '打开自定义模型列表设置')
      await page.click('[aria-label="打开自定义模型列表设置"]')
      await page.waitForSelector('#ai-custom-models-input')
      assert.equal(await page.evaluate(() => document.getElementById('ai-custom-models-input').value), 'background-update')
      await page.fill('#ai-custom-models-input', draft)
      await page.click('[aria-label="保存自定义模型列表"]')
      assert.deepEqual(await page.evaluate(() => window.__continuity.savedModels), draft.split('\n'))
      return actual
    })
  }

  await check('list-retains-node-through-exit', async () => {
    await open('list', 1440)
    await page.hover('#remove-middle')
    const during = await page.evaluate(async () => {
      const row = document.querySelector('[data-list-key="two"]')
      const removed = []
      const observer = new MutationObserver(records => {
        for (const record of records) for (const node of record.removedNodes) {
          if (node === row) removed.push('original-row')
        }
      })
      observer.observe(document.getElementById('continuity-list'), { childList: true })
      document.getElementById('remove-middle').click()
      for (let index = 0; index < 2; index++) await new Promise(requestAnimationFrame)
      const current = document.querySelector('[data-list-key="two"]')
      observer.disconnect()
      return { same: row === current, connected: row.isConnected, inert: current?.inert, removed }
    })
    assert.deepEqual(during, { same: true, connected: true, inert: true, removed: [] })
    await page.waitForFunction(() => !document.querySelector('[data-list-key="two"]'))
    return during
  })

  await check('list-exit-can-reverse-without-remount', async () => {
    await open('list', 1440)
    await page.hover('#remove-middle')
    const actual = await page.evaluate(async () => {
      const row = document.querySelector('[data-list-key="two"]')
      const input = row.querySelector('input')
      input.value = 'unsaved-row-edit'
      document.getElementById('remove-middle').click()
      await new Promise(requestAnimationFrame)
      document.getElementById('restore-rows').click()
      await new Promise(requestAnimationFrame)
      return {
        same: row === document.querySelector('[data-list-key="two"]'),
        value: document.querySelector('[data-list-key="two"] input')?.value
      }
    })
    assert.deepEqual(actual, { same: true, value: 'unsaved-row-edit' })
    await settle()
    assert.equal(await page.evaluate(() => document.querySelector('[data-list-key="two"]').inert), false)
    return actual
  })

  await check('catalog-refresh-keeps-open-list-and-scroll', async () => {
    await open('models', 1440)
    await page.click('[aria-label="选择 AI 模型"]')
    await page.waitForSelector('.model-selector-list')
    await settle()
    const before = await rect('input[placeholder^="Search models"]')
    const result = await page.evaluate(async () => {
      const panel = document.querySelector('.model-selector-content')
      const list = panel.querySelector('.model-selector-list')
      list.scrollTop = 180
      const scroll = list.scrollTop
      window.__continuity.updateCatalog(Array.from({ length: 50 }, (_, index) => `gpt-fixture-${String(index).padStart(2, '0')}`))
      await new Promise(requestAnimationFrame)
      return {
        same: panel === document.querySelector('.model-selector-content'),
        beforeScroll: scroll, afterScroll: list.scrollTop,
        reentering: panel.hasAttribute('data-starting-style'),
        moving: panel.getAnimations().some(animation => animation.playState === 'running')
      }
    })
    assert.equal(result.same, true)
    assert.equal(result.reentering, false)
    assert.equal(result.moving, false)
    assert.equal(result.beforeScroll, result.afterScroll)
    unchanged(before, await rect('input[placeholder^="Search models"]'), 'Refresh leaves the search anchor intact')
    return result
  })

  await check('short-workspace-controls-remain-reachable', async () => {
    await open('folders', 390, 380)
    await page.click('#open-scope')
    await page.waitForSelector('#scope-search-input')
    await settle()
    const input = await rect('#scope-search-input')
    const control = await rect('[aria-label="关闭筛选文件夹弹窗"]')
    const region = await page.evaluate(() => {
      const node = document.getElementById('scope-folder-results')
      const panel = node.closest('[role="dialog"]')
      const rect = panel.getBoundingClientRect()
      return { top: rect.top, bottom: rect.bottom, height: innerHeight, listHeight: node.clientHeight, canScroll: node.scrollHeight > node.clientHeight }
    })
    assert.ok(control.y >= 0 && control.y + control.height <= region.height)
    assert.ok(input.y >= 0 && input.y + input.height <= region.height)
    assert.ok(region.top >= 0 && region.bottom <= region.height && region.listHeight > 20 && region.canScroll, JSON.stringify(region))
    await screenshot('folder-short-window')
    await page.fill('#scope-search-input', 'nothing')
    await settle()
    unchanged(input, await rect('#scope-search-input'), 'Short viewport filtering stays anchored')
    return region
  })

  await check('short-editor-keeps-draft-scroll-and-actions', async () => {
    await open('models', 390, 380)
    await page.click('[aria-label="打开自定义模型列表设置"]')
    await page.waitForSelector('#ai-custom-models-input')
    await settle()
    const save = await rect('[aria-label="保存自定义模型列表"]')
    assert.ok(save.y >= 0 && save.y + save.height <= 380)
    const text = Array.from({ length: 120 }, (_, index) => `local-model-${index}`).join('\n')
    await page.fill('#ai-custom-models-input', text)
    const retained = await page.evaluate(async () => {
      const input = document.getElementById('ai-custom-models-input')
      input.setSelectionRange(100, 120)
      input.scrollTop = 60
      const scroll = input.scrollTop
      window.__continuity.updateModels(['late-model'])
      await new Promise(requestAnimationFrame)
      return {
        same: document.getElementById('ai-custom-models-input') === input,
        selection: [input.selectionStart, input.selectionEnd],
        beforeScroll: scroll, afterScroll: input.scrollTop,
        value: input.value
      }
    })
    assert.equal(retained.same, true)
    assert.equal(retained.value, text)
    assert.deepEqual(retained.selection, [100, 120])
    assert.equal(retained.beforeScroll, retained.afterScroll)
    unchanged(save, await rect('[aria-label="保存自定义模型列表"]'), 'Short-editor actions do not move with its fields')
    await screenshot('editor-short')
    return { selectionRetained: true, scrollRetained: true, save }
  })

  await check('list-exit-uses-actual-transition-not-a-timeout', async () => {
    await open('list', 1440)
    await page.hover('#remove-middle')
    const pause = await page.evaluate(async () => {
      const row = document.querySelector('[data-list-key="two"]')
      window.__heldExitRow = row
      document.getElementById('remove-middle').click()
      await new Promise(requestAnimationFrame)
      const animations = row.getAnimations()
      animations.forEach(animation => animation.pause())
      window.__heldExitAnimations = animations
      return animations.length
    })
    assert.ok(pause > 0)
    // Longer than the CSS role's 220 ms: a paused exit must still own its DOM.
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 320)))
    assert.equal(await page.evaluate(() => window.__heldExitRow.isConnected), true)
    await page.evaluate(() => window.__heldExitAnimations.forEach(animation => animation.finish()))
    await page.waitForFunction(() => !document.querySelector('[data-list-key="two"]'))
    return { retainedUntilAnimationFinished: true }
  })

  for (const mode of ['keyboard', 'reduce', 'reduce-during-exit']) {
    await check(`list-immediate-policy/${mode}`, async () => {
      await open('list', 1440)
      if (mode === 'reduce') await page.cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
      if (mode === 'keyboard') {
        await page.focus('#remove-middle')
        await page.keyboard.press('Enter')
      } else {
        await page.click('#remove-middle')
        if (mode === 'reduce-during-exit') await page.cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
      }
      await page.waitForFunction(() => !document.querySelector('[data-list-key="two"]'))
      await page.evaluate(() => window.__continuity.setRows([]))
      await page.waitForFunction(() => document.querySelectorAll('[data-list-key]').length === 0)
      assert.equal(await page.evaluate(() => document.getAnimations().some(animation =>
        animation.effect?.target?.closest?.('#continuity-list') && animation.playState === 'running'
      )), false)
    })
  }

  await check('same-route-keeps-reader-position', async () => {
    await open('navigation', 1440, 500)
    await page.waitForSelector('#general')
    const position = await page.evaluate(() => {
      const main = document.getElementById('options-main')
      main.scrollTop = 220
      return main.scrollTop
    })
    assert.ok(position > 100)
    await page.click('.options-sidebar:not(.options-mobile-sidebar) a[href="#general"]')
    await settle()
    const after = await page.evaluate(() => document.getElementById('options-main').scrollTop)
    assert.equal(after, position, 'Re-selecting the current route must not reset the reader to the top')
    return { position, after }
  })

  await check('workspace-opening-reverses-without-replaying-content', async () => {
    await open('models', 1440)
    await page.click('[aria-label="选择 AI 模型"]')
    await page.waitForSelector('.model-selector-content[data-open]')
    await page.keyboard.press('Escape')
    await page.click('[aria-label="选择 AI 模型"]')
    await page.waitForSelector('.model-selector-content[data-open]')
    await settle()
    await page.fill('input[placeholder^="Search models"]', 'fixture-04')
    await page.waitForFunction(() => document.querySelectorAll('[data-ai-model-id]').length === 1)
    await page.keyboard.press('Enter')
    await page.waitForFunction(() => !document.querySelector('.model-selector-content[data-open]'))
    assert.match(await page.evaluate(() => document.querySelector('[aria-label="选择 AI 模型"]').textContent), /fixture-04/)
  })

  return report
}
