import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'

export async function runAvailabilityWorkflowScenarios(page, url, output) {
  const checks = []
  const screenshots = []
  let generation = 0
  const settleVisuals = async () => {
    await page.evaluate(async () => {
      await document.fonts.ready
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    })
    await page.waitForFunction(() => document.getAnimations().every(animation =>
      animation.effect?.getTiming().iterations === Infinity || animation.playState !== 'running'), undefined, { timeout: 5000 })
  }
  const getState = () => page.evaluate(() => window.__availabilityQA.state())
  const io = () => page.evaluate(() => window.__fixtureIO.snapshot())
  const fresh = async (seed = true) => {
    const target = new URL(url)
    target.searchParams.set('round', String(++generation))
    await page.goto(target.href)
    await page.waitForFunction(() => window.__availabilityQA?.ready(), undefined, { timeout: 15000 })
    if (seed) {
      await page.evaluate(() => window.__availabilityQA.seed())
      await page.waitForSelector('[data-availability-result="review"]')
    }
    await settleVisuals()
  }
  const click = async name => {
    try { return await page.click(`loc=role:button[name="${name}"]`) }
    catch (error) { throw new Error(`Button "${name}": ${error.message}`, { cause: error }) }
  }
  const settled = () => page.waitForFunction(() => !window.__availabilityQA.state().deleting && !window.__availabilityQA.state().running)
  const removed = snapshot => snapshot.trace.filter(event => event.type === 'remove').map(event => event.id)
  const shot = async name => {
    const file = `${output}/${name}.png`
    await settleVisuals()
    await page.screenshot({ path: file, fullPage: true })
    screenshots.push(file)
  }
  try {
    await page.cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false })
    await fresh(false)
    console.log(await page.snapshot())
    await page.evaluate(() => { window.__fixtureIO.allowPermission = true })
    await click('开始检测全部书签')
    await page.waitForSelector('[data-availability-result="failed"]')
    await settled()
    assert.equal((await getState()).failed.length, 2, 'first full scan must surface actual main-document failures immediately')
    assert.equal((await getState()).review.length, 1, 'an access restriction is pending, not dead')
    checks.push('actual controller full scan: first-run 404/410, pending restriction, verified authorized redirect')
    const fullScan = await getState()
    assert.equal(fullScan.availableCount, 4, 'HTTP 401, login, session refresh and an unlogged normal page count as available')
    assert.deepEqual(fullScan.redirected, ['permission'], 'login targets never become bookmark migration suggestions')
    for (const id of ['login-401', 'login-redirect', 'login-page', 'login-session']) {
      assert.ok(fullScan.healthy.includes(id))
      assert.ok(!fullScan.review.includes(id) && !fullScan.failed.includes(id) && !fullScan.abnormalHistory.includes(id))
      assert.equal(await page.evaluate(id => Boolean(document.querySelector(`[data-availability-result="${id}"]`)), id), false)
    }
    checks.push('normal login and unlogged pages are excluded from pending, failed, redirect, abnormal-history and deletion candidates')

    await fresh()
    await page.evaluate(() => {
      window.__fixtureIO.allowPermission = true
      window.__fixtureIO.engineVersion = 1
    })
    const previous = await getState()
    await click('重新检测全部书签')
    await page.waitForFunction(() => window.__availabilityQA.state().error.includes('版本不一致') &&
      !window.__availabilityQA.state().running)
    const staleWorker = await getState()
    assert.deepEqual(staleWorker.review, previous.review)
    assert.deepEqual(staleWorker.failed, previous.failed)
    assert.equal((await io()).trace.some(event => event.type === 'message' && event.message.type === 'availability:navigate'), false)
    await shot('stale-worker-preserves-results')
    await click('全选待确认书签')
    await click('重新测试可用性检测已选书签')
    await page.waitForFunction(() => window.__availabilityQA.state().error.includes('版本不一致') &&
      !window.__availabilityQA.state().running)
    assert.deepEqual((await getState()).review, previous.review)
    assert.deepEqual((await getState()).selected.sort(), previous.review.sort())
    assert.equal((await io()).trace.some(event => event.type === 'message' && event.message.type === 'availability:navigate'), false)
    checks.push('stale or incompatible workers cannot start a full scan or retest, clear results, or invent failures')

    await fresh(false)
    await page.evaluate(() => {
      window.__fixtureIO.allowPermission = true
      window.__availabilityQA.seedLoginReviews()
    })
    await page.waitForSelector('[data-availability-result="login-401"]')
    await click('全选待确认书签')
    assert.equal((await getState()).selected.length, 4)
    await click('重新测试可用性检测已选书签')
    await page.waitForFunction(() => window.__availabilityQA.state().availableCount === 4 && !window.__availabilityQA.state().running)
    const retestedLogin = await getState()
    assert.deepEqual(retestedLogin.review, [])
    assert.deepEqual(retestedLogin.failed, [])
    assert.deepEqual(retestedLogin.redirected, [])
    assert.deepEqual(retestedLogin.selected, [])
    assert.deepEqual(retestedLogin.abnormalHistory, [])
    assert.deepEqual(removed(await io()), [])
    assert.equal((await io()).root.children[0].children.length, 8)
    await shot('login-retest-clean-results')
    checks.push('retesting legacy login false positives removes them from cleanup and selection while preserving all bookmarks')

    await fresh()
    console.log(await page.snapshot())
    const text = await page.evaluate(() => document.body.innerText)
    assert.ok(!/高置信|低置信|移入高|移回低/.test(text))
    await shot('desktop-results')
    await page.evaluate(() => window.__fixtureIO.changeUrl('review', 'https://changed.example.net/keep'))
    await click('删除书签：站点待验证')
    await page.waitForFunction(() => window.__availabilityQA.state().error.includes('跳过'))
    assert.deepEqual(removed(await io()), [], 'a URL edited after the result was produced must never be removed')
    checks.push('stale URL guard preserves changed bookmark')

    await fresh()
    await click('删除书签：站点待验证')
    await page.waitForFunction(() => !window.__availabilityQA.state().review.includes('review') && !window.__availabilityQA.state().deleting)
    assert.equal(await page.evaluate(() => Boolean(document.querySelector('#confirm-modal-title'))), false, 'recoverable deletion opens no confirmation')
    await page.waitForSelector('loc=role:button[name="撤销"]', { state: 'visible' })
    assert.match(await page.evaluate(() => document.querySelector('[data-toast-id]')?.textContent || ''), /1 条仍待确认/)
    await shot('undo-toast')
    await click('撤销')
    await page.waitForFunction(() => window.__availabilityQA.state().recycle.length === 0 && !window.__availabilityQA.state().deleting)
    assert.ok((await io()).trace.some(event => event.type === 'create' && event.url === 'https://verify.example.net/page'), 'undo restores the deleted bookmark')
    checks.push('pending row deletes directly with its warning and undo in the toast')

    await fresh()
    await click('删除书签：站点待验证')
    await page.waitForFunction(() => !window.__availabilityQA.state().review.includes('review') && !window.__availabilityQA.state().deleting)
    const deletion = await io()
    assert.deepEqual(removed(deletion), ['review'])
    assert.ok(deletion.trace.some(event => event.type === 'storage' && event.keys.some(key => /AutoBackupIndex/.test(key))), 'automatic backup is indexed before deletion')
    assert.equal((await getState()).recycle[0].bookmarkId, 'review')
    await page.click('loc=role:link[name="回收站"]')
    await page.waitForSelector('button[aria-label^="恢复书签：站点待验证"]')
    console.log(await page.snapshot())
    await page.click('button[aria-label^="恢复书签：站点待验证"]')
    await page.waitForFunction(() => window.__availabilityQA.state().recycle.length === 0 && !window.__availabilityQA.state().deleting)
    assert.ok((await io()).trace.some(event => event.type === 'create' && event.url === 'https://verify.example.net/page'))
    checks.push('single pending deletion keeps automatic backup and recycle restoration')

    await fresh()
    await click('全选待确认书签')
    assert.equal((await getState()).selected.length, 2)
    await click('无法访问 2')
    assert.equal((await getState()).selected.length, 0, 'switching filter must not leave invisible destructive selections')
    await click('新增 3')
    await click('全选无法访问的书签')
    assert.deepEqual((await getState()).selected, ['failed'])
    await click('删除本区无法访问的书签')
    await page.waitForFunction(() => !window.__availabilityQA.state().failed.includes('failed') && !window.__availabilityQA.state().deleting)
    assert.deepEqual(removed(await io()), ['failed'], 'filtered bulk deletion must not include the persistent failure')
    checks.push('filter-scoped selection and bulk deletion never include hidden results')

    await fresh()
    await click('全选待确认书签')
    await click('全选无法访问的书签')
    assert.equal((await getState()).selected.length, 4)
    await page.evaluate(() => { window.__fixtureIO.failRemoveId = 'failed' })
    await click('批量删除可用性检测已选书签')
    await page.waitForFunction(() => window.__availabilityQA.state().error.includes('删除过程中断') && !window.__availabilityQA.state().deleting)
    assert.deepEqual(removed(await io()), ['review', 'permission'])
    assert.deepEqual((await getState()).selected, ['failed', 'persistent'], 'failed and unprocessed items stay selected')
    assert.equal((await getState()).recycle.length, 2)
    checks.push('mixed-status bulk deletion, partial failure reconciliation and retained selection')

    await fresh()
    await click('授权并重测：迁移后的站点')
    await page.waitForFunction(() => window.__availabilityQA.state().error.includes('未授予'))
    const permission = (await io()).trace.find(event => event.type === 'permission')
    assert.ok(permission.origins.includes('https://canonical.example.org/*'))
    assert.ok((await getState()).review.includes('permission'), 'denied permission preserves the pending result')
    checks.push('explicit target permission is requested; denial does not create a false failure or success')

    await fresh()
    await click('重定向 0')
    await page.waitForFunction(() => document.body.innerText.includes('最近一次检测没有发现重定向结果'))
    assert.equal(await page.evaluate(() => document.body.innerText.includes('没有无法访问的书签')), false)
    checks.push('empty redirect filter describes its own results without a misleading failure verdict')

    for (const width of [768, 390]) {
      await page.cdp('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false })
      await fresh()
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'no horizontal page overflow at ' + width)
      await shot('results-' + width)
      if (width === 390) {
        await page.focus('button[aria-label="删除书签：站点待验证"]')
        assert.equal(await page.evaluate(() => {
          const rect = document.activeElement.getBoundingClientRect()
          return rect.top >= 0 && rect.bottom <= innerHeight
        }), true, 'keyboard focus reveals the row inside the nested scrolling layout')
        await page.keyboard.press('Enter')
      } else {
        await click('删除书签：站点待验证')
      }
      await page.waitForSelector('loc=role:button[name="撤销"]', { state: 'visible' })
      const toast = await page.evaluate(() => {
        const rect = document.querySelector('[data-toast-id]').getBoundingClientRect()
        return { left: rect.left, right: rect.right, bottom: rect.bottom }
      })
      assert.ok(toast.left >= 0 && toast.right <= width && toast.bottom <= 1000, 'undo toast stays inside the viewport at ' + width)
      await shot('undo-' + width)
      await click('撤销')
      await page.waitForFunction(() => window.__availabilityQA.state().recycle.length === 0 && !window.__availabilityQA.state().deleting)
      checks.push('responsive direct deletion and undo at ' + width)
    }
    assert.deepEqual(await page.evaluate(() => window.__fixtureErrors), [])
    return { checks, screenshots, realBookmarksMutated: false }
  } catch (error) {
    await shot('failure').catch(() => {})
    const state = await getState().catch(() => null)
    const errors = await page.evaluate(() => window.__fixtureErrors).catch(() => [])
    await writeFile(output + '/failure.json', JSON.stringify({ error: String(error), state, errors, checks }, null, 2))
    console.log(await page.snapshot().catch(() => 'Snapshot unavailable'))
    throw error
  }
}
