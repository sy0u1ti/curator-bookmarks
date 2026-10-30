import assert from 'node:assert/strict'

export async function runModelsDevBrowserChecks(page, origin, directory) {
  const report = { checks: [], screenshots: [] }
  const details = 'loc=role:button[name="查看模型资料"]'
  const refresh = 'loc=role:button[name="从 models.dev 更新模型资料"]'
  const toggle = 'loc=role:switch[name="每日从 models.dev 自动更新"]'
  const shot = async name => {
    await settle()
    const file = `${directory}/${name}.png`
    await page.screenshot({ path: file })
    report.screenshots.push(file)
  }
  const settle = () => page.waitForFunction(() => document.getAnimations().every(animation =>
    animation.effect?.getTiming().iterations === Infinity || animation.playState !== 'running'
  ), undefined, { timeout: 5000 })
  const geometry = () => page.evaluate(() => {
    const card = document.querySelector('#ai-provider-settings').getBoundingClientRect()
    return ['#ai-api-key', '.ai-provider-model-row', '#ai-advanced-settings'].map(selector => {
      const rect = document.querySelector(selector).getBoundingClientRect()
      return [rect.x - card.x, rect.y - card.y, rect.width, rect.height]
    }).concat([[card.width, card.height]])
  })
  const waitFeedback = status => page.waitForFunction(status =>
    document.querySelector('[aria-label="从 models.dev 更新模型资料"]')?.dataset.feedbackState === status,
  status, { timeout: 5000 })
  const assertPanelBounds = async label => {
    const bounds = await page.evaluate(() => ({
      viewport: [innerWidth, innerHeight],
      elements: ['#ai-model-details', '#ai-model-details h2', '[aria-label="从 models.dev 更新模型资料"]'].map(selector => {
        const rect = document.querySelector(selector).getBoundingClientRect()
        return { selector, left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, height: rect.height }
      })
    }))
    for (const rect of bounds.elements) {
      assert.ok(rect.height > 0 && rect.left >= 0 && rect.right <= bounds.viewport[0]
        && rect.top >= 0 && rect.bottom <= bounds.viewport[1], `${label}: clipped ${JSON.stringify(rect)}`)
    }
  }

  for (const width of [1440, 768, 390]) {
    const height = width === 390 ? 844 : 1000
    await page.cdp('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
    await page.goto(origin)
    await page.waitForSelector('#ai-provider-settings', { state: 'visible' })
    assert.deepEqual(await page.evaluate(() => [innerWidth, innerHeight]), [width, height])
    await settle()
    console.log((await page.snapshot()).slice(0, 1500))
    const initial = await geometry()
    assert.equal(await page.evaluate(() => window.__modelsDevFixture.catalogRequests.length), 0, 'opening settings must not contact models.dev')
    await page.click(details)
    await page.waitForSelector('#ai-model-details', { state: 'visible' })

    if (width === 1440) {
      await page.evaluate(() => { window.__modelsDevFixture.permissionAllowed = false })
      await page.click(refresh)
      await waitFeedback('error')
      assert.equal(await page.evaluate(() => window.__modelsDevFixture.catalogRequests.length), 0, 'denied consent must not download')
      assert.match(await page.evaluate(() => document.querySelector('#ai-model-details').textContent), /未授权/)
      report.checks.push('permission-denial')
    }

    await page.evaluate(() => { window.__modelsDevFixture.permissionAllowed = true; window.__modelsDevFixture.catalogMode = 'delayed' })
    await page.click(refresh)
    await waitFeedback('pending')
    assert.deepEqual(await geometry(), initial, `${width}: pending update must not move the form`)
    await page.evaluate(() => window.__modelsDevFixture.completeCatalog())
    await waitFeedback('success')
    await page.waitForFunction(() => document.querySelector('#ai-model-details')?.textContent.includes('1,048,576'))
    await settle()
    assert.deepEqual(await geometry(), initial, `${width}: successful update must not move the form`)
    const popup = await page.evaluate(() => ({
      text: document.querySelector('#ai-model-details').textContent,
      left: document.querySelector('#ai-model-details').getBoundingClientRect().left,
      right: document.querySelector('#ai-model-details').getBoundingClientRect().right,
      top: document.querySelector('#ai-model-details').getBoundingClientRect().top,
      bottom: document.querySelector('#ai-model-details').getBoundingClientRect().bottom,
      innerWidth, overflow: document.documentElement.scrollWidth > innerWidth
    }))
    assert.match(popup.text, /393,216/)
    assert.match(popup.text, /\$0\.15/)
    assert.ok(popup.left >= 0 && popup.right <= width && !popup.overflow, `${width}: popover must fit viewport`)
    assert.ok(popup.top >= 0 && popup.bottom <= height, `${width}: popup title and actions must stay inside vertical bounds`)
    await shot(`models-dev-${width}-matched`)

    await page.click(toggle)
    await page.waitForFunction(() => window.__modelsDevFixture.stored.curatorModelsDevSync?.autoUpdate === true)
    assert.deepEqual(await geometry(), initial)
    await page.click(toggle)
    await page.waitForFunction(() => window.__modelsDevFixture.stored.curatorModelsDevSync?.autoUpdate === false)
    await page.keyboard.press('Escape')
    await page.waitForSelector('#ai-model-details', { state: 'hidden' })
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), '查看模型资料')

    await page.press(details, 'Enter')
    await page.waitForSelector('#ai-model-details', { state: 'visible' })
    await page.evaluate(() => { window.__modelsDevFixture.catalogMode = 'error' })
    await page.click(refresh)
    await waitFeedback('error')
    assert.match(await page.evaluate(() => document.querySelector('#ai-model-details').textContent), /1,048,576/, 'a failed refresh retains last-good data')
    assert.deepEqual(await geometry(), initial, `${width}: error must stay outside the form flow`)
    await settle()
    await assertPanelBounds(`${width}px failed refresh`)
    if (width === 1440) await shot('models-dev-desktop-error')
    await page.keyboard.press('Escape')
    await page.waitForSelector('#ai-model-details', { state: 'hidden' })
    await page.click('loc=role:button[name="从自定义 AI 渠道获取模型列表"]')
    assert.deepEqual(await geometry(), initial, `${width}: channel fetch must not shift form`)
    await page.evaluate(() => window.__modelsDevFixture.completeModels(true))
    await settle()
    assert.deepEqual(await geometry(), initial, `${width}: channel fetch success must not shift form`)
    report.checks.push(`${width}px: empty, delayed, matched, automatic-toggle, escape-focus, failed-refresh, stable-channel-fetch`)
  }

  await page.evaluate(() => window.__modelsDevFixture.select('canonical'))
  await page.click(details)
  await page.waitForSelector('#ai-model-details', { state: 'visible' })
  const canonicalText = await page.evaluate(() => document.querySelector('#ai-model-details').textContent)
  assert.match(canonicalText, /仅模型，渠道未匹配/)
  assert.doesNotMatch(canonicalText, /\$0\.15|渠道参考价/)
  await shot('models-dev-mobile-canonical')
  await page.cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 600, deviceScaleFactor: 1, mobile: false })
  await settle()
  await assertPanelBounds('390x600 resize')
  await shot('models-dev-short-viewport')
  await page.evaluate(() => window.__modelsDevFixture.select('unknown'))
  assert.match(await page.evaluate(() => document.querySelector('#ai-model-details').textContent), /未找到可可靠匹配/)
  await page.evaluate(() => { window.__modelsDevFixture.select('provider'); window.__modelsDevFixture.catalogMode = 'budget' })
  await page.click(refresh)
  await waitFeedback('success')
  await page.waitForFunction(() => document.querySelector('#ai-model-details')?.textContent.includes('32,768 tokens 预算'))
  await page.keyboard.press('Escape')
  await page.waitForSelector('#ai-model-details', { state: 'hidden' })
  assert.equal(await page.evaluate(() => document.querySelector('[aria-label^="推理强度："]')?.disabled), true, 'budget-only metadata cannot become an effort slider')
  assert.deepEqual(await page.evaluate(() => window.__modelsDevFixture.errors), [])
  const requests = await page.evaluate(() => window.__modelsDevFixture.catalogRequests)
  assert.ok(requests.every(request => request.url === 'https://models.dev/catalog.json?type=chat' && request.credentials === 'omit' && request.body === undefined))
  report.checks.push('canonical-alias-without-provider-price', 'short-viewport-bounds', 'unmatched-model', 'budget-is-not-effort', 'anonymous-fixed-GET', 'no-console-errors')
  await page.cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
  try {
    assert.equal(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches), true)
    await page.click(details)
    await page.waitForSelector('#ai-model-details', { state: 'visible' })
    await settle()
    await assertPanelBounds('reduced motion')
    await shot('models-dev-reduced-motion')
    await page.keyboard.press('Escape')
    await page.waitForSelector('#ai-model-details', { state: 'hidden' })
    report.checks.push('reduced-motion')
  } finally {
    await page.cdp('Emulation.setEmulatedMedia', { features: [] })
  }
  return report
}
