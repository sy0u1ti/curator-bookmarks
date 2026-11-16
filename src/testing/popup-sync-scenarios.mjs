import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { extensionCommand } from './ego-extension-command.mjs'

export async function runPopupSyncChecks(task, config) {
  const page = (await task.pages())[0]
  const management = await task.newPage()
  await management.goto('chrome://extensions/')
  const { id } = await extensionCommand(task, management, 'Extensions.loadUnpacked', { path: config.extension })
  const url = `chrome-extension://${id}`
  const checks = [], screenshots = []
  const note = name => { checks.push(name); console.log('PASS ' + name) }
  const send = message => page.evaluate(async message => {
    const response = await chrome.runtime.sendMessage(message)
    if (!response?.ok) throw new Error(response?.error || 'No background reply')
    return response.result
  }, message)
  const finishMotion = () => page.evaluate(() => document.querySelector('.popup-sync-stage')?.getAnimations({ subtree: true })
    .filter(animation => animation.effect?.getTiming().iterations !== Infinity).forEach(animation => animation.finish()))
  const shot = async name => {
    await finishMotion()
    const clip = await page.evaluate(() => {
      const box = document.getElementById('popup-app-shell').getBoundingClientRect()
      return { x: box.x + scrollX, y: box.y + scrollY, width: box.width, height: box.height }
    })
    const path = `${config.root}/${name}.png`
    await page.screenshot({ path, clip })
    screenshots.push(path)
  }
  const waitForRun = async profileId => {
    await page.waitForFunction(async id => {
      const response = await chrome.runtime.sendMessage({ type: 'sync:list' })
      const profile = response?.result?.find(item => item.id === id)
      return profile && !profile.data.syncing && !profile.data.scheduled && (profile.data.error || profile.data.lastSync)
    }, profileId, { timeout: 45000 })
    const profile = (await send({ type: 'sync:list' })).find(item => item.id === profileId)
    assert.equal(profile.data.error || null, null, profile.data.error)
    return profile
  }
  const profilePatch = (id, patch) => page.evaluate(async ({ id, patch }) => {
    const key = 'curatorSync:accounts'
    let accounts = (await chrome.storage.local.get(key))[key]
    while (typeof accounts === 'string') accounts = JSON.parse(accounts)
    Object.assign(accounts[id], patch)
    await chrome.storage.local.set({ [key]: JSON.stringify(accounts) })
  }, { id, patch })

  try {
    await page.goto(`${url}/src/popup/popup.html`)
    await page.waitForFunction(() => document.getElementById('popup-root')?.dataset.popupReady === 'true' &&
      window.__syncQa.requests.includes('sync:status'))
    assert.equal(await page.evaluate(() => Boolean(document.getElementById('popup-sync-toggle'))), false)
    assert.equal(await page.evaluate(() => performance.getEntriesByType('resource').some(entry => /PopupSyncWorkspace|sync-engine/.test(entry.name))), false)
    note('Cold popup reads only the lightweight summary and hides sync when unconfigured')
    const seeded = await page.evaluate(async base => {
      const tree = await chrome.bookmarks.getTree()
      if (tree[0].children[0].title !== 'QA Bookmarks Bar') throw new Error('Refusing to modify non-isolated bookmarks')
      await chrome.storage.local.set({
        curatorBookmarkOnboardingState: { completed: true, dismissed: true },
        curatorBookmarkAiNamingSettings: { autoAnalyzeBookmarks: false },
        curatorBookmarkContentSnapshotSettings: { enabled: false },
        curatorModelsDevSync: { autoUpdate: false }
      })
      const folder = await chrome.bookmarks.create({ parentId: '1', title: '同步测试' })
      const current = await chrome.bookmarks.create({ parentId: folder.id, title: 'Curator QA current page', url: 'https://curator-qa.invalid/current' })
      for (let index = 0; index < 15; index++) await chrome.bookmarks.create({ parentId: folder.id, title: `Reference ${index}`, url: `https://curator-qa.invalid/${index}` })
      const response = await chrome.runtime.sendMessage({ type: 'sync:create', data: {
        type: 'webdav', localRoot: folder.id, url: base + '/dav/', username: 'curator', password: 'fixture-token',
        bookmark_file: 'popup.xbel', enabled: false, syncIntervalEnabled: false, syncOnStartupEnabled: false, failsafe: true, strategy: 'default'
      } })
      if (!response?.ok) throw new Error(response?.error)
      return { folder: folder.id, profile: response.result, current: current.id }
    }, config.base)
    await page.waitForSelector('#popup-sync-toggle')
    await page.waitForFunction(() => document.querySelector('.popup-workspace-reveal')?.classList.contains('is-revealed'))
    await page.snapshot()
    await shot('popup-resting')
    await page.fill('#search-input', 'Reference')
    await page.waitForFunction(() => document.querySelectorAll('[data-bookmark-id]').length > 5)
    const original = await page.evaluate(() => {
      const viewport = document.querySelector('.popup-main-pane [role="list"]') || document.querySelector('.popup-main-pane [data-scroll-viewport]')
      if (viewport) viewport.scrollTop = 45
      window.__syncContentIdentity = document.getElementById('content')
      return { query: document.getElementById('search-input').value, viewportScroll: viewport?.scrollTop }
    })
    await page.click('#popup-sync-toggle')
    await page.waitForSelector('.popup-sync-profile')
    await finishMotion()
    assert.ok(await page.evaluate(() => document.querySelector('.popup-sync-bookmarks').inert &&
      getComputedStyle(document.querySelector('.popup-sync-bookmarks')).opacity === '0'))
    await page.click('button[aria-label="立即同步：同步测试"]')
    const first = await waitForRun(seeded.profile)
    assert.ok(first.data.lastSync)
    assert.ok(await page.evaluate(() => chrome.bookmarks.getTree().then(tree => tree[0].children[0].title === 'QA Bookmarks Bar')))
    assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('.popup-sync-direction')].map(button => [button.title, button.textContent.trim()])),
      [['下载一次', ''], ['上传一次', '']])
    note('Real popup sends WebDAV sync through MV3; icon-only one-shot actions keep their titles')
    await shot('popup-synced')
    await page.keyboard.press('Escape')
    await finishMotion()
    assert.deepEqual(await page.evaluate(() => ({
      sameContent: window.__syncContentIdentity === document.getElementById('content'),
      query: document.getElementById('search-input').value,
      focus: document.activeElement?.id
    })), { sameContent: true, query: original.query, focus: 'popup-sync-toggle' })
    note('Closing restores the same bookmark DOM, search input and sync-button focus')
    await page.click('#popup-sync-toggle')
    await page.click('button[aria-label="下载一次：同步测试"]')
    await page.waitForSelector('#popup-sync-confirm-title')
    assert.match(await page.evaluate(() => document.getElementById('popup-sync-confirm-title').textContent), /覆盖本机/)
    await page.keyboard.press('Escape')
    await page.waitForSelector('#popup-sync-confirm-title', { state: 'hidden' })
    assert.equal(await page.evaluate(() => document.querySelector('.popup-sync-stage').dataset.syncOpen), 'true')
    await page.click('button[aria-label="上传一次：同步测试"]')
    await page.waitForSelector('#popup-sync-confirm-title')
    assert.match(await page.evaluate(() => document.getElementById('popup-sync-confirm-title').textContent), /覆盖服务器/)
    await page.click('#popup-sync-confirm-cancel')
    note('One-shot overwrites explain the direction; dismissing confirmation keeps the sync page open')

    await page.click('button[aria-label="同步测试的同步选项"]')
    await page.waitForSelector('#sync-editor-title')
    await page.snapshot()
    assert.ok(await page.evaluate(() => document.querySelector('.popup-sync-editor input') && document.querySelector('.popup-sync-editor .curator-dialog-body').scrollHeight > 0))
    await shot('popup-editor')
    await page.keyboard.press('Escape')
    await page.waitForSelector('#sync-editor-title', { state: 'hidden' })
    await page.click('button[aria-label="更多同步操作"]')
    await page.waitForSelector('button[aria-label="导出配置"]')
    await page.click('button[aria-label="导出配置"]')
    await page.waitForSelector('.popup-sync-subview')
    const downloadPromise = page.waitForEvent('download', { timeout: 15000 })
    await page.click('.popup-sync-subview button:text-is("导出 1 项")')
    const download = await downloadPromise
    const exportedPath = `${config.root}/exported-profiles.json`
    await download.saveAs(exportedPath)
    assert.match(await readFile(exportedPath, 'utf8'), /webdav/)
    await page.click('button[aria-label="更多同步操作"]')
    await page.click('button[aria-label="导入配置"]')
    await page.waitForSelector('input[aria-label="同步配置文件"]')
    await page.setInputFiles('input[aria-label="同步配置文件"]', [exportedPath])
    await page.waitForFunction(() => document.querySelector('.popup-sync-subview')?.textContent.includes('将添加 1 项配置'))
    await page.click('.popup-sync-subview button:text-is("导入配置")')
    await page.waitForFunction(() => Boolean(document.getElementById('sync-editor-title')) || document.querySelectorAll('.popup-sync-profile').length === 2)
    const imported = await send({ type: 'sync:list' })
    assert.equal(imported.length, 2)
    note('Embedded editor and real export/import round trip remain usable inside the popup')
    if (await page.evaluate(() => Boolean(document.getElementById('sync-editor-title')))) await page.keyboard.press('Escape')
    const second = imported.find(profile => profile.id !== seeded.profile)
    await send({ type: 'sync:delete', id: second.id })

    await profilePatch(seeded.profile, { error: '网络连接失败。'.repeat(60), syncing: false, scheduled: false })
    await page.waitForFunction(() => document.querySelector('.popup-sync-profile-status')?.dataset.tone === 'error')
    const beforeErrorDetail = await page.evaluate(() => document.querySelector('.popup-sync-footer').getBoundingClientRect().top)
    await page.click('.popup-sync-error')
    assert.ok((await page.evaluate(() => document.querySelector('.popup-sync-detail').textContent)).length > 120)
    await page.keyboard.press('Escape')
    assert.equal(await page.evaluate(() => document.querySelector('.popup-sync-footer').getBoundingClientRect().top), beforeErrorDetail)
    await profilePatch(seeded.profile, { error: null, syncing: 1 })
    await page.waitForFunction(() => document.querySelector('.popup-sync-profile-status')?.textContent.includes('正在完成'))
    assert.equal((await send({ type: 'sync:status' })).state, 'running')
    await profilePatch(seeded.profile, { syncing: false })
    note('Long errors stay readable without displacing controls; 100% progress does not claim success')

    // Browser login leaves a transient popup. Transfer the real unsaved form
    // through storage.session and let the persistent options editor consume it.
    await page.click('.popup-sync-footer button:text-is("添加配置")')
    await page.waitForSelector('#sync-editor-title')
    await page.snapshot()
    await page.click('[aria-label="同步服务"]')
    await page.click('[role="option"]:has-text("Google Drive")')
    await page.click('[aria-label="要同步的本地文件夹"]')
    await page.click('[role="option"]:has-text("同步测试")')
    const passphraseField = await page.evaluate(() => {
      const label = [...document.querySelectorAll('.popup-sync-editor label')].find(label => label.textContent === '加密口令')
      return '[id="' + label.htmlFor + '"]'
    })
    await page.fill(passphraseField, 'qa-unsaved-passphrase')
    await page.waitForFunction(() => [...document.querySelectorAll('.popup-sync-editor button')].some(button =>
      button.textContent.includes('使用 Google 登录') && !button.disabled))
    await page.click('.popup-sync-editor button:has-text("使用 Google 登录")')
    await page.waitForFunction(() => window.__syncQa.createdTabs.length === 1 && window.__syncQa.closed)
    const continuation = await page.evaluate(() => window.__syncQa.createdTabs[0])
    assert.ok(!continuation.includes('qa-unsaved-passphrase'))
    await page.goto(continuation)
    await page.waitForSelector('#sync-editor-title')
    assert.ok(await page.evaluate(() => [...document.querySelectorAll('input')].some(input => input.value === 'qa-unsaved-passphrase')))
    assert.equal(await page.evaluate(() => location.search.includes('syncEditor=')), false)
    assert.equal(await page.evaluate(async () => Object.keys(await chrome.storage.session.get(null)).some(key => key.startsWith('curatorSync:editor-transfer:'))), false)
    note('OAuth continuation preserves unsaved input once, clears its session entry, and keeps credentials out of the URL')

    for (const width of [1440, 768, 390]) {
      await page.cdp('Emulation.setDeviceMetricsOverride', { width, height: 720, deviceScaleFactor: 1, mobile: false })
      await page.goto(`${url}/src/sidepanel/sidepanel.html`)
      await page.waitForSelector('#popup-sync-toggle')
      await page.click('#popup-sync-toggle')
      await page.waitForSelector('.popup-sync-profile')
      await finishMotion()
      assert.ok(await page.evaluate(() => {
        const root = document.getElementById('popup-app-shell')
        const stage = document.querySelector('.popup-sync-stage').getBoundingClientRect()
        const footer = document.querySelector('.popup-sync-footer').getBoundingClientRect()
        return root.scrollWidth <= root.clientWidth && Math.abs(footer.bottom - stage.bottom) < 2
      }))
      await shot(`sidepanel-${width}`)
      assert.deepEqual(await page.evaluate(() => window.__syncQa.errors), [])
    }
    await page.cdp('Emulation.clearDeviceMetricsOverride')
    note('The production side panel keeps sync controls inside its 1440/768/390px container')
    return { checks, screenshots, extensionId: id, spaceId: task.spaceId }
  } catch (error) {
    await shot('failure')
    await writeFile(`${config.root}/failure.json`, JSON.stringify({ checks, error: error.message }, null, 2))
    console.log(await page.snapshot())
    throw error
  } finally {
    await extensionCommand(task, management, 'Extensions.uninstall', { id }).catch(() => {})
  }
}
