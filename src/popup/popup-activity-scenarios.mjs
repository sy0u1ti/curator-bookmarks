import assert from 'node:assert/strict'

export async function runPopupActivityChecks(page, origin, directory, { cases } = {}) {
  const report = { checks: [], failures: [], screenshots: [] }
  const verify = (name, value, message = name) => {
    assert.ok(value, message)
    report.checks.push(name)
  }
  const shot = async name => {
    await page.waitForFunction(() => {
      const overlay = document.querySelector('.popup-activity-detail')
      return !overlay || (!overlay.hasAttribute('data-starting-style') && Number(getComputedStyle(overlay).opacity) > 0.999)
    })
    await page.evaluate(async () => {
      const overlay = document.querySelector('.popup-activity-detail')
      if (overlay) await Promise.all(overlay.getAnimations({ subtree: true })
        .filter(animation => animation.effect?.getTiming().iterations !== Infinity)
        .map(animation => animation.finished.catch(() => {})))
    })
    const filename = `${directory}/${name}.png`
    await page.screenshot({ path: filename })
    report.screenshots.push(filename)
  }
  const scenario = async (name, run) => {
    if (cases?.length && !cases.some(value => name.includes(value))) return
    try {
      await run()
      console.log(`PASS ${name}`)
    } catch (error) {
      report.failures.push({ name, error: error.message })
      console.log(`FAIL ${name}: ${error.message}`)
      await shot(`failure-${report.failures.length}`)
      console.log(await page.snapshot())
    }
  }
  const load = async (width = 800, surface = 'popup', reduce = false) => {
    await page.cdp('Emulation.setDeviceMetricsOverride', { width, height: 600, mobile: false, deviceScaleFactor: 1 })
    await page.cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: reduce ? 'reduce' : 'no-preference' }] })
    await page.goto(`${origin}/src/${surface}/${surface}.html`)
    await page.waitForFunction(() => document.querySelector('#popup-activity')?.textContent.includes('magpie') &&
      document.querySelector('.popup-workspace-reveal')?.classList.contains('is-revealed'))
    await page.snapshot()
  }
  const settled = () => page.waitForFunction(() => document.querySelector('.popup-activity-transition')?.dataset.phase === 'idle')
  const active = text => page.waitForFunction(text => document.querySelector('.popup-activity-card')?.textContent.includes(text), text)
  const geometry = () => page.evaluate(() => {
    const rect = selector => {
      const { x, y, width, height } = document.querySelector(selector).getBoundingClientRect()
      return { x, y, width, height }
    }
    return { card: rect('#popup-activity'), pane: rect('.popup-main-pane'), search: rect('#search-input') }
  })
  const remove = async title => {
    const sidepanel = await page.evaluate(() => document.documentElement.dataset.curatorSurface === 'sidepanel')
    if (sidepanel) {
      const id = await page.evaluate(title => window.__popupFixture.all().find(item => item.title === title).id, title)
      await page.click(`[data-bookmark-id="${id}"] .sidepanel-bookmark-menu`)
    } else {
      await page.click(`button[aria-label="打开 ${title} 的操作菜单"]`)
    }
    await page.click(`button[aria-label="删除书签：${title}"]`)
    await active(`已删除 ${title}`)
    await settled()
  }
  const exists = title => page.evaluate(title => window.__popupFixture.all().filter(item => item.url && item.title === title).length, title)
  const park = async () => {
    await page.click('button[aria-label="收起提示，显示当前网页"]')
    await page.waitForSelector('[data-current-page-action]', { state: 'visible' })
    await settled()
  }
  const startFrames = () => page.evaluate(() => {
    const frames = window.__activityFrames = []
    const until = performance.now() + 1500
    const tick = () => {
      const card = document.querySelector('#popup-activity')
      const pane = document.querySelector('.popup-main-pane')
      frames.push({
        height: card?.getBoundingClientRect().height, top: pane?.getBoundingClientRect().top,
        overlap: Boolean(card?.querySelector('.popup-page-content') && card?.querySelector('.popup-activity-card')),
        phase: document.querySelector('.popup-activity-transition')?.dataset.phase,
        opacity: document.querySelector('.popup-activity-transition') ? getComputedStyle(document.querySelector('.popup-activity-transition')).opacity : ''
      })
      if (performance.now() < until) requestAnimationFrame(tick)
      else window.__activityFramesDone = true
    }
    window.__activityFramesDone = false
    tick()
  })

  for (const [width, surface] of [[800, 'popup'], [1440, 'sidepanel'], [768, 'sidepanel'], [390, 'sidepanel']]) {
    await scenario(`${surface}-${width}: delete, pending, restore, layout`, async () => {
      await load(width, surface)
      const before = await geometry()
      await startFrames()
      await remove('Agent Router')
      const deleted = await geometry()
      verify(`${width}: layout stays fixed`, JSON.stringify(before) === JSON.stringify(deleted))
      verify(`${width}: deletion committed`, await exists('Agent Router') === 0)
      verify(`${width}: no bottom feedback`, await page.evaluate(() => !document.querySelector('#toast-root, .popup-feedback-layer')))
      await page.waitForFunction(() => window.__activityFramesDone)
      const frames = await page.evaluate(() => window.__activityFrames)
      verify(`${width}: no overlap in transition`, frames.every(frame => !frame.overlap))
      verify(`${width}: no frame shifts`, frames.every(frame => frame.height === before.card.height && frame.top === before.pane.y))
      await shot(`deleted-${surface}-${width}`)
      await page.evaluate(() => { window.__popupFixture.holdRestore = true })
      await page.click('#popup-activity-action')
      await page.waitForFunction(() => Boolean(window.__popupFixture.releaseRestore))
      await active('正在恢复')
      verify(`${width}: real pending state`, await page.evaluate(() =>
        document.querySelector('#popup-activity-action')?.getAttribute('aria-disabled') === 'true'))
      await page.evaluate(() => document.querySelector('#popup-activity-action').click())
      verify(`${width}: double undo deduplicated`, await page.evaluate(() => window.__popupFixture.restoreCalls === 1))
      await page.evaluate(() => window.__popupFixture.releaseRestore())
      await active('已恢复 Agent Router')
      verify(`${width}: restore committed once`, await exists('Agent Router') === 1)
      verify(`${width}: focus returned to search`, await page.evaluate(() => document.activeElement?.id === 'search-input'))
      await page.hover('#search-input')
      await page.waitForSelector('[data-current-page-action="save"]', { state: 'visible', timeout: 8000 })
      await settled()
      verify(`${width}: current page restored`, await page.evaluate(() => document.querySelector('#popup-activity')?.textContent.includes('magpie')))
      verify(`${width}: no runtime errors`, await page.evaluate(() => window.__popupFixture.errors.length === 0))
    })
  }

  await scenario('independent undo, recovery history, and failed retry', async () => {
    await load()
    await remove('Agent Router')
    await remove('Any Router')
    const oldId = await page.evaluate(() => window.__popupFixture.data.curatorBookmarkRecycleBin.find(item => item.title === 'Agent Router').recycleId)
    const newId = await page.evaluate(() => document.querySelector('.popup-activity-card')?.dataset.activityId)
    verify('both deletion records retained', await page.evaluate(id =>
      document.querySelectorAll('[data-activity-entry]').length === 1 && Boolean(document.querySelector(`[data-activity-entry="${id}"]`)), oldId))
    await shot('satellite')
    const before = await geometry()
    await page.click(`[data-activity-entry="${oldId}"]`)
    verify('swap morphs in place', await page.evaluate(() =>
      document.querySelector('#popup-activity').getAnimations({ subtree: true }).some(animation => animation.id === 'popup-activity-morph')))
    await active('已删除 Agent Router')
    verify('swapped message shrinks into a satellite', await page.evaluate(id => Boolean(document.querySelector(`[data-activity-entry="${id}"]`)), newId))
    await page.waitForFunction(() => !document.querySelector('.popup-activity-ghost') &&
      !document.querySelector('#popup-activity').getAnimations({ subtree: true }).some(animation => animation.id === 'popup-activity-morph'))
    assert.deepEqual(await geometry(), before)
    verify('swap keeps layout', true)
    await page.evaluate(() => { window.__popupFixture.failRestore = true })
    await page.click('#popup-activity-action')
    await active('恢复失败')
    verify('failure keeps the same operation', await page.evaluate(id => document.querySelector('.popup-activity-card')?.dataset.activityId === id, oldId))
    verify('failure keeps recovery action', await page.evaluate(() => document.querySelector('#popup-activity-action')?.textContent === '重试'))
    await shot('restore-failed')
    await page.click('#popup-activity-action')
    await active('已恢复 Agent Router')
    verify('older undo restores only its bookmark', await exists('Agent Router') === 1 && await exists('Any Router') === 0)
    await park()
    verify('newer undo remains accessible', await page.evaluate(() => [...document.querySelectorAll('[data-activity-entry]')].some(node => node.getAttribute('aria-label').includes('Any Router'))))
  })

  await scenario('hover pauses presentation; expiry preserves recovery', async () => {
    await load()
    await remove('Agent Router')
    await page.hover('#popup-activity')
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 5200)))
    verify('hover pauses auto-return', await page.evaluate(() => Boolean(document.querySelector('.popup-activity-card'))))
    await page.hover('#search-input')
    await page.waitForSelector('[data-current-page-action="save"]', { state: 'visible', timeout: 8000 })
    await page.click('[data-activity-entry]')
    await active('已删除 Agent Router')
    verify('expiry preserves undo', await page.evaluate(() => document.querySelector('#popup-activity-action')?.textContent === '撤销'))
  })

  await scenario('background analysis, fresh tab context, and smart workflow', async () => {
    await load(390, 'sidepanel')
    const before = await geometry()
    await page.evaluate(async () => {
      const now = Date.now()
      await chrome.storage.local.set({ curatorBookmarkAutoAnalyzeStatus: {
        status: 'processing', bookmarkId: '201', title: '另一篇参考文章', url: 'https://reference.example.test/other',
        createdAt: now, updatedAt: now, expiresAt: now + 60000, badgeVisible: false
      } })
    })
    await page.waitForSelector('[data-activity-entry][aria-label*="另一篇参考文章"]')
    verify('background task leaves page actions available', await page.evaluate(() => Boolean(document.querySelector('[data-current-page-action="save"]'))))
    verify('background task identifies its own page', true)
    await shot('background-analysis-390')
    await remove('Agent Router')
    await page.evaluate(async () => {
      const status = window.__popupFixture.data.curatorBookmarkAutoAnalyzeStatus
      await chrome.storage.local.set({ curatorBookmarkAutoAnalyzeStatus: { ...status, status: 'completed', updatedAt: Date.now() } })
      window.__popupFixture.switchTab('新的当前网页', 'https://fresh.example.test/')
    })
    verify('analysis completion does not displace undo', await page.evaluate(() => document.querySelector('.popup-activity-card')?.textContent.includes('Agent Router')))
    await park()
    await page.waitForFunction(() => document.querySelector('#popup-activity')?.textContent.includes('新的当前网页'))
    verify('restored page uses the latest tab', true)
    assert.deepEqual(await geometry(), before)
    verify('background and tab changes keep layout', true)
    await page.click('button[data-smart-action="classify"]')
    await page.waitForSelector('button[data-smart-action="exit"]', { state: 'visible' })
    await page.waitForSelector('button[data-smart-action="manual-folder"]', { state: 'visible' })
    verify('smart workflow retains full controls', await page.evaluate(() => !document.querySelector('#popup-activity') && Boolean(document.querySelector('[data-smart-action="manual-folder"]'))))
    await page.click('button[data-smart-action="exit"]')
    await page.waitForSelector('#popup-activity', { state: 'visible' })
    verify('returning from smart workflow keeps recovery', await page.evaluate(() => Boolean(document.querySelector('[data-activity-entry]'))))
    await remove('Any Router')
    verify('new feedback still works after leaving the workflow', true)
  })

  await scenario('long load errors remain readable and retry restores the page', async () => {
    await load(390, 'sidepanel')
    const before = await geometry()
    await page.evaluate(() => {
      window.__popupFixture.failRead = true
      chrome.bookmarks.onChanged.emit('101', { title: 'Agent Router' })
    })
    await active('读取失败')
    await settled()
    assert.deepEqual(await geometry(), before)
    verify('long error does not move the list', true)
    await page.click('button[aria-label="查看完整说明"]')
    verify('full error remains available', await page.evaluate(() => document.querySelector('.popup-activity-detail-text')?.textContent.length > 200))
    await shot('long-error-390')
    await page.keyboard.press('Escape')
    await page.evaluate(() => { window.__popupFixture.failRead = false })
    await page.click('#popup-activity-action')
    await active('已重新读取')
    verify('load retry succeeds', true)
    await page.hover('#search-input')
    await page.waitForSelector('[data-current-page-action="save"]', { state: 'visible', timeout: 8000 })
  })

  await scenario('form errors stay inside the modal and saving still works', async () => {
    await load()
    await page.click('button[aria-label="打开 Agent Router 的操作菜单"]')
    await page.click('button[aria-label="编辑书签：Agent Router"]')
    await page.waitForSelector('#edit-url-input', { state: 'visible' })
    const before = await page.evaluate(() => document.querySelector('#save-edit').getBoundingClientRect().toJSON())
    await page.fill('#edit-url-input', 'invalid-url')
    await page.click('#save-edit')
    await page.waitForFunction(() => document.querySelector('#popup-modal-error')?.textContent.includes('有效的网址'))
    const after = await page.evaluate(() => document.querySelector('#save-edit').getBoundingClientRect().toJSON())
    verify('form error stays in dialog', await page.evaluate(() => document.querySelector('#edit-modal')?.contains(document.querySelector('#popup-modal-error'))))
    verify('form error does not push buttons', before.y === after.y && before.height === after.height)
    await page.fill('#edit-url-input', 'https://reference.example.test/0')
    await page.fill('#edit-title-input', '已编辑的参考')
    await page.click('#save-edit')
    await active('已更新')
    verify('edit commits with activity feedback', await exists('已编辑的参考') === 1)
    await park()
    await page.click('[data-current-page-action="save"]')
    await page.waitForSelector('#save-smart-folder-button', { state: 'visible' })
    await page.click('#save-smart-folder-button')
    await page.waitForSelector('#smart-folder-modal', { state: 'hidden' })
    await page.waitForFunction(() => window.__popupFixture.all().some(node => node.title === 'magpie'))
    if (await page.evaluate(() => Boolean(document.querySelector('.popup-activity-card')))) await park()
    await page.waitForSelector('[data-current-page-action="pin-newtab"]', { state: 'visible' })
    verify('quick save returns the updated bookmarked card', true)
  })

  await scenario('reduced motion and keyboard access', async () => {
    await load(390, 'sidepanel', true)
    await remove('Agent Router')
    verify('reduced motion has no translation', await page.evaluate(() =>
      getComputedStyle(document.querySelector('.popup-activity-transition')).transform === 'none'))
    await page.focus('#popup-activity-action')
    await page.press('#popup-activity-action', 'Enter')
    await active('已恢复 Agent Router')
    verify('undo works from keyboard', await exists('Agent Router') === 1)
    await page.hover('#search-input')
    await page.waitForSelector('[data-current-page-action="save"]', { state: 'visible', timeout: 8000 })
    await shot('page-390')
  })
  if (!report.checks.length && !report.failures.length) throw new Error('No matching activity scenarios')
  return report
}
