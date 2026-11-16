import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'

/** Production controls and recovery records in the agent-owned QA extension. */
export async function runBackupInterfaceChecks(page, directory) {
  const checks = [], screenshots = []
  const record = text => { checks.push(text); console.log('PASS backup UI ' + text) }
  const shot = async name => {
    const filename = `${directory}/${name}.png`
    await page.screenshot({ path: filename })
    screenshots.push(filename)
  }
  const geometry = () => page.evaluate(() => {
    const card = document.querySelector('#settings-full-backup')
    const title = document.querySelector('#recovery-points-title')
    const first = card.querySelector('ol li button')
    const main = document.querySelector('.options-main-scroll')
    const rect = node => {
      const box = node.getBoundingClientRect()
      return [Math.round(box.x), Math.round(box.y + (main?.scrollTop || 0)), Math.round(box.width), Math.round(box.height)]
    }
    return {
      card: rect(card), title: rect(title), row: rect(first),
      titleWeight: getComputedStyle(title).fontWeight,
      rowWeight: getComputedStyle(first.querySelector('span span')).fontWeight,
      buttons: [...card.querySelectorAll(':scope > header button')].map(button => button.getAttribute('aria-label')),
      overflow: document.documentElement.scrollWidth > innerWidth
    }
  })
  await page.evaluate(async () => {
    const reasons = ['清理重复书签之前', '批量更新 23 条重定向 URL', '批量更新 5 条重定向 URL', '整理工作资料之前', '清理失效书签之前']
    for (const [index, reason] of reasons.entries()) {
      await window.__qaApi.createAutoBackupBeforeDangerousOperation({
        kind: 'restore', source: 'options', reason, now: Date.now() - index * 86400000
      })
    }
  })
  await page.waitForFunction(() => document.querySelectorAll('#settings-recovery-points ol li').length === 5)

  for (const width of [1440, 768, 390]) {
    await page.cdp('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false })
    // Centre the card so the options shell's sticky mobile header cannot cover
    // its controls; block:start would place the title behind that header.
    await page.evaluate(() => document.querySelector('#settings-full-backup').scrollIntoView({ block: 'center' }))
    await page.waitForFunction(() => document.getAnimations().every(animation => animation.playState !== 'running'), undefined, { timeout: 5000 })
    const before = await geometry()
    assert.ok(before.buttons.includes('备份到文件') && before.buttons.includes('从文件恢复'))
    assert.equal(before.buttons.filter(label => /导出|导入|清空/.test(label || '')).length, 0)
    assert.ok(Number(before.titleWeight) > Number(before.rowWeight), 'recovery title must outrank its records')
    assert.ok(before.row[0] > before.title[0] + 12, 'recovery rows belong inside their own indented group')
    assert.equal(before.overflow, false)
    await shot(`backup-${width}`)
    await page.click('[aria-label="查看备份范围"]')
    await page.waitForSelector('[role="dialog"]:has-text("备份范围")')
    assert.match(await page.evaluate(() => [...document.querySelectorAll('[role="dialog"]')].find(node => node.textContent.includes('备份范围'))?.textContent || ''), /不包含 API Key/)
    await page.keyboard.press('Escape')
    await page.focus('#settings-recovery-points ol li button >> nth=0')
    await page.keyboard.press('Enter')
    await page.waitForSelector('#backup-preview-title')
    await page.waitForFunction(() => document.querySelector('#backup-preview-source')?.textContent.includes('清理重复书签之前'))
    assert.deepEqual((await geometry()).row, before.row, 'opening the preview must preserve the recovery list position')
    const dialog = await page.evaluate(() => {
      const panel = document.querySelector('#backup-preview-title').closest('[role="dialog"]')
      const box = panel.getBoundingClientRect()
      return { left: box.left, right: box.right, bottom: box.bottom, width: innerWidth, height: innerHeight, overflow: panel.scrollWidth > panel.clientWidth }
    })
    assert.ok(dialog.left >= 0 && dialog.right <= dialog.width && dialog.bottom <= dialog.height && !dialog.overflow)
    await shot(`backup-${width}-preview`)
    await page.click('[aria-label="部分恢复"]')
    await page.waitForSelector('[role="menu"][aria-label="部分恢复"]')
    for (const label of ['书签与标签', '仅标签数据', '仅新标签页设置']) {
      assert.ok(await page.evaluate(label => [...document.querySelectorAll('[role="menuitem"]')].some(node => node.textContent.trim() === label), label))
    }
    await page.keyboard.press('Escape')
    await page.keyboard.press('Escape')
    await page.waitForSelector('#backup-preview-title', { state: 'hidden' })
    await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === '预览恢复点：清理重复书签之前', undefined, { timeout: 5000 })
    await page.click('[aria-label="其他备份操作"]')
    await page.waitForSelector('[role="menu"][aria-label="其他备份操作"]')
    await shot(`backup-${width}-more`)
    await page.keyboard.press('Escape')
    record(`${width}px: two main actions, indented history, scoped help, keyboard preview and partial recovery`)
  }

  const treeBeforeRestore = await page.evaluate(() => chrome.bookmarks.getTree())
  await page.click('#settings-recovery-points ol li button >> nth=0')
  await page.waitForSelector('#backup-preview-title')
  await page.click('[aria-label="部分恢复"]')
  await page.click('[role="menuitem"][aria-label="仅标签数据"]')
  await page.waitForSelector('#confirm-modal-title')
  await page.click('[role="dialog"][aria-labelledby="confirm-modal-title"] button:has-text("只恢复标签数据")')
  await page.waitForFunction(() => document.querySelector('#backup-preview-title')?.closest('[role="dialog"]')
    ?.querySelector('.curator-dialog-footer [role="status"]')?.textContent.includes('恢复完成'), undefined, { timeout: 30000 })
  assert.equal(await page.evaluate(() => Boolean(document.querySelector('[aria-label="从备份预览恢复全部可安全恢复的数据"]'))), false,
    'a completed preview must not offer the same restore a second time')
  assert.deepEqual(await page.evaluate(() => chrome.bookmarks.getTree()), treeBeforeRestore)
  await shot('backup-restored-success')
  await page.click('[role="dialog"][aria-labelledby="backup-preview-title"] button:has-text("完成")')
  await page.waitForSelector('#backup-preview-title', { state: 'hidden' })
  record('Confirmed partial restore shows its result, preserves bookmarks and finishes without a repeat-restore action')

  await page.click('[aria-label="其他备份操作"]')
  const htmlDownload = page.waitForEvent('download')
  await page.click('[role="menuitem"][aria-label="导出 HTML 书签"]')
  await (await htmlDownload).saveAs(`${directory}/bookmarks.html`)
  assert.match(await readFile(`${directory}/bookmarks.html`, 'utf8'), /NETSCAPE-Bookmark-file-1/)
  await page.waitForFunction(() => document.querySelector('#backup-action-status')?.textContent.includes('HTML 书签已导出'))
  await page.click('[aria-label="其他备份操作"]')
  const tagDownload = page.waitForEvent('download')
  await page.click('[role="menuitem"][aria-label="导出标签数据"]')
  await (await tagDownload).saveAs(`${directory}/tags.json`)
  assert.match(await readFile(`${directory}/tags.json`, 'utf8'), /qa-restored-tag/)
  await page.waitForFunction(() => document.querySelector('#backup-action-status')?.textContent.includes('条标签记录'))
  await page.click('[aria-label="其他备份操作"]')
  await page.click('[role="menuitem"][aria-label="清空标签数据"]')
  await page.waitForSelector('#confirm-modal-title')
  assert.match(await page.evaluate(() => document.querySelector('#confirm-modal-copy').textContent), /不会删除 Chrome 书签/)
  assert.equal(await page.evaluate(() => document.activeElement?.textContent.trim()), '取消')
  await page.keyboard.press('Escape')
  assert.match(await page.evaluate(async () => JSON.stringify(await window.__qaApi.loadBookmarkTagIndex())), /qa-restored-tag/)
  record('Secondary formats still export correctly; clearing tags retains confirmation and cancel safety')
  await writeFile(`${directory}/invalid-backup.json`, '{"app":"not-a-backup"}')
  await page.setInputFiles('[aria-label="导入完整备份文件"]', [`${directory}/invalid-backup.json`])
  await page.waitForSelector('#backup-action-status[role="alert"]')
  assert.equal(await page.evaluate(() => document.querySelectorAll('#settings-recovery-points ol li').length), 5)
  assert.equal(await page.evaluate(() => Boolean(document.querySelector('#backup-preview-title'))), false)
  record('Invalid files report an error without clearing or shifting the recovery list')
  return { checks, screenshots }
}
