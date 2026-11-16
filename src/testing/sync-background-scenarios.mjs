import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { extensionCommand } from './ego-extension-command.mjs'
import { runBackupInterfaceChecks } from './backup-interface-scenarios.mjs'

export async function runBackgroundChecks(task, config) {
  const page = (await task.pages())[0] ?? await task.newPage()
  const management = await task.newPage()
  await management.goto('chrome://extensions/')
  const checks = [], protocols = [], installed = []
  const report = { spaceId: task.spaceId, checks, protocols, installed }
  const note = text => { checks.push(text); console.log('PASS ' + text) }
  const remember = () => writeFile(config.root + '/installed.json', JSON.stringify({ spaceId: task.spaceId, installed }, null, 2))
  const install = async kind => {
    const { id } = await extensionCommand(task, management, 'Extensions.loadUnpacked', { path: config.extensions[kind] })
    installed.push({ id, path: config.extensions[kind], kind })
    await remember()
    await page.goto(`chrome-extension://${id}/src/options/options.html#backup`)
    await page.waitForSelector('#settings-storage')
    return id
  }
  const api = async () => page.evaluate(async () => {
    window.__qaApi = await import(chrome.runtime.getURL('qa-api.js'))
  })
  const send = message => page.evaluate(async message => {
    const reply = await chrome.runtime.sendMessage(message)
    if (!reply?.ok) throw new Error(reply?.error || 'No background response')
    return reply.result
  }, message)
  const sync = async (id, mode = 'normal') => {
    const before = (await send({ type: 'sync:list' })).find(profile => profile.id === id)?.data.lastSync
    await send({ type: 'sync:run', id, mode })
    await page.waitForFunction(async ({ id, before }) => {
      const reply = await chrome.runtime.sendMessage({ type: 'sync:list' })
      const profile = reply?.result?.find(profile => profile.id === id)
      return profile && !profile.data.syncing && !profile.data.scheduled && (profile.data.error || profile.data.lastSync !== before)
    }, { id, before }, { timeout: 45000 })
    const result = (await send({ type: 'sync:list' })).find(profile => profile.id === id)
    assert.equal(result.data.error || null, null, `${result.data.type}: ${result.data.error}`)
    return result
  }
  const urls = id => page.evaluate(async id => {
    const collect = node => node.url ? [node.url] : (node.children || []).flatMap(collect)
    return collect((await chrome.bookmarks.getSubTree(id))[0]).sort()
  }, id)
  const folder = title => page.evaluate(title => chrome.bookmarks.create({ parentId: '1', title }), title)
  const add = (parentId, title, url) => page.evaluate(details => chrome.bookmarks.create(details), { parentId, title, url })

  try {
    await install('legacy')
    await page.waitForFunction(() => ['#settings-sync', '#settings-storage'].every(selector =>
      document.querySelector(selector)?.textContent.includes('后台仍是旧版本')))
    await api()
    assert.equal(await page.evaluate(async () => {
      try {
        await window.__qaApi.requestBackupRestore('qa-legacy-restore', {}, 'safeFull')
        return 'unexpected mutation'
      } catch (error) { return error.code }
    }), 'background-outdated')
    const legacyRequests = await page.evaluate(() => chrome.runtime.sendMessage({ type: 'qa:requests' }))
    assert.ok(!legacyRequests.some(type => ['sync:list', 'storage:usage', 'backup:restore'].includes(type)), 'new operations must not reach an incompatible worker')
    await page.screenshot({ path: config.root + '/legacy-background.png' })
    note('Old background: sync, storage and restore stop before work and offer extension management')

    const currentId = await install('current')
    await api()
    const tree = await page.evaluate(() => chrome.bookmarks.getTree())
    assert.deepEqual(tree[0].children.map(node => [node.title, node.children.length]), [
      ['QA Bookmarks Bar', 0], ['QA Other Bookmarks', 0]
    ], 'abort before any mutation unless the bookmark API is isolated')
    const info = await send({ type: 'curator:background-info' })
    assert.equal(info.buildId, config.buildId)
    assert.deepEqual(await send({ type: 'sync:list' }), [])
    const oauth = await send({ type: 'sync:oauth-settings' })
    assert.equal(oauth.redirectUrl, `https://${currentId}.chromiumapp.org/`)
    const usage = await send({ type: 'storage:usage' })
    assert.equal(usage.icons.count, 0)
    assert.equal(usage.sync.profiles, 0)
    assert.equal(await page.evaluate(() => document.querySelector('#settings-storage [role="alert"]')?.textContent || ''), '')
    note('Current MV3: build handshake, empty sync list, OAuth redirect and storage inventory respond')

    for (const adapter of ['google-drive', 'dropbox']) {
      if (oauth.clients[adapter].source === 'none') {
        await assert.rejects(() => send({ type: 'sync:authorize', adapter }), /扩展发行方/)
      }
    }
    note('Unconfigured development logins report publisher setup instead of opening an invalid authorization flow')

    const seed = await page.evaluate(async () => {
      await chrome.storage.local.set({
        curatorBookmarkAiNamingSettings: { autoAnalyzeBookmarks: false },
        curatorBookmarkContentSnapshotSettings: { enabled: false }
      })
      const folder = await chrome.bookmarks.create({ parentId: '1', title: 'QA portable backup' })
      const bookmark = await chrome.bookmarks.create({ parentId: folder.id, title: 'QA preserved bookmark', url: 'https://curator-qa.invalid/backup' })
      await window.__qaApi.saveManualBookmarkTags(bookmark, ['qa-restored-tag'])
      return { folder: folder.id, bookmark: bookmark.id }
    })
    const downloaded = page.waitForEvent('download', { timeout: 30000 })
    await page.click('[aria-label="备份到文件"]')
    const download = await downloaded
    await download.saveAs(config.root + '/backup.json')
    const backup = JSON.parse(await readFile(config.root + '/backup.json', 'utf8'))
    assert.match(JSON.stringify(backup), /qa-restored-tag/)
    assert.match(JSON.stringify(backup), /curator-qa\.invalid\/backup/)
    await page.setInputFiles('input[aria-label="导入完整备份文件"]', [config.root + '/backup.json'])
    await page.waitForSelector('[aria-label="恢复预览"]')
    note('Production backup controls export JSON and import its preview with bookmarks and tags')
    await page.click('[aria-label="从备份预览恢复全部可安全恢复的数据"]')
    await page.waitForSelector('#confirm-modal-title')
    assert.match(await page.evaluate(() => document.querySelector('#confirm-modal-copy').textContent), /不会替换整个 Chrome 书签树/)
    await page.keyboard.press('Escape')
    await page.waitForSelector('#confirm-modal-title', { state: 'hidden' })
    await page.waitForFunction(() => document.querySelector('[aria-label="从备份预览恢复全部可安全恢复的数据"]') === document.activeElement, undefined, { timeout: 5000 })
    await page.click('[aria-label="关闭恢复预览"]')
    await page.waitForSelector('#backup-preview-title', { state: 'hidden' })
    note('Restore preview opens over the list; cancelling its confirmation retains the preview and keyboard focus')

    await page.evaluate(() => {
      window.__qaLockHeld = false
      void navigator.locks.request('curator:bookmark-sync-run', { mode: 'shared' }, () =>
        new Promise(resolve => {
          window.__qaReleaseLock = resolve
          window.__qaLockHeld = true
        }))
    })
    await page.waitForFunction(() => window.__qaLockHeld)
    try {
      await assert.rejects(() => page.evaluate(backup =>
        window.__qaApi.requestBackupRestore('qa-locked-restore', backup, 'safeFull'), backup), /同步正在进行/)
    } finally {
      await page.evaluate(() => window.__qaReleaseLock())
    }
    note('A real Web Lock held by sync prevents restore without altering the tree')
    await page.evaluate(id => chrome.bookmarks.remove(id), seed.bookmark)
    await add(seed.folder, 'Keep a later bookmark', 'https://curator-qa.invalid/later')
    const restored = await page.evaluate(backup => window.__qaApi.requestBackupRestore('qa-actual-restore', backup, 'safeFull'), backup)
    assert.equal(restored.restored.copiedBookmarks, 1)
    assert.deepEqual(await urls('0'), ['https://curator-qa.invalid/backup', 'https://curator-qa.invalid/later'])
    // Safe restore copies missing instances to its own recovery folder. The
    // existing source folder is deliberately left as the user last edited it.
    assert.deepEqual(await urls(seed.folder), ['https://curator-qa.invalid/later'])
    assert.match(await page.evaluate(async () => JSON.stringify(await window.__qaApi.loadBookmarkTagIndex())), /qa-restored-tag/)
    assert.ok((await page.evaluate(() => window.__qaApi.listAutoBackupPoints())).length > 0)
    await page.click('[aria-label="刷新用量"]')
    await page.waitForFunction(() => !document.querySelector('#settings-storage')?.hasAttribute('aria-busy'))
    await page.screenshot({ path: config.root + '/backup-restored.png' })
    note('The production worker restores missing bookmarks and tags, retains later bookmarks and creates a recovery point')
    report.backupInterface = await runBackupInterfaceChecks(page, config.root)

    const definitions = [
      { type: 'webdav', url: config.base + '/dav/', username: 'curator' },
      { type: 's3', url: config.base + '/s3/', region: 'us-east-1', bucket: 'bookmarks', pathStyle: true, username: 'fixture-access' },
      { type: 'git', url: config.base + '/git/sync.git', branch: 'main', username: 'curator' },
      { type: 'linkwarden', url: config.base + '/linkwarden', serverFolder: 'Curator' },
      { type: 'karakeep', url: config.base + '/karakeep', serverFolder: 'Curator' },
      { type: 'nextcloud-bookmarks', url: config.base + '/nextcloud', serverRoot: '', username: 'curator' }
    ]
    for (const type of ['webdav', 's3', 'git']) definitions.push({
      ...definitions.find(item => item.type === type), bookmark_file: 'bookmarks.html', bookmark_file_type: 'html'
    })
    for (const type of ['webdav', 's3']) definitions.push({
      ...definitions.find(item => item.type === type), bookmark_file: 'encrypted.xbel', passphrase: 'fixture-encryption'
    })
    for (const adapter of ['google-drive', 'dropbox']) {
      const result = await send({ type: 'sync:authorize', adapter, client: { clientId: 'fixture-client', clientSecret: 'fixture-secret' } })
      assert.equal(result.refreshToken, 'fixture-refresh')
      assert.match(result.username, /Fixture/)
      definitions.push({ type: adapter, refreshToken: result.refreshToken, username: result.username })
    }
    note('Google and Dropbox complete S256 exchange and account lookup against local OAuth fixtures')

    for (const definition of definitions) {
      const data = {
        password: 'fixture-token', bookmark_file: 'bookmarks.xbel', bookmark_file_type: 'xbel',
        enabled: false, syncIntervalEnabled: false, syncOnStartupEnabled: false, failsafe: false, ...definition
      }
      const a = await folder(definition.type + ' source'), b = await folder(definition.type + ' destination')
      const first = `https://curator-qa.invalid/${definition.type}/first`, second = `https://curator-qa.invalid/${definition.type}/second`
      await add(a.id, 'First', first)
      if (!['git', 'google-drive', 'dropbox'].includes(definition.type)) await send({ type: 'sync:test', data })
      const source = await send({ type: 'sync:create', data: { ...data, localRoot: a.id } })
      const destination = await send({ type: 'sync:create', data: { ...data, localRoot: b.id } })
      await sync(source); await sync(destination)
      assert.deepEqual(await urls(b.id), [first], definition.type + ' initial transfer')
      const added = await add(a.id, 'Second', second)
      await sync(source); await sync(destination)
      assert.deepEqual(await urls(b.id), [first, second], definition.type + ' incremental addition')
      await page.evaluate(id => chrome.bookmarks.remove(id), added.id)
      await sync(source); await sync(destination)
      assert.deepEqual(await urls(b.id), [first], definition.type + ' deletion')
      if (definition.type === 'webdav' && !definition.bookmark_file) {
        const before = (await page.evaluate(() => window.__qaApi.listAutoBackupPoints()))[0]?.backupId
        await add(b.id, 'Local only', 'https://curator-qa.invalid/local-only')
        await sync(destination, 'download')
        assert.deepEqual(await urls(b.id), [first])
        assert.notEqual((await page.evaluate(() => window.__qaApi.listAutoBackupPoints()))[0]?.backupId, before)
        note('Server-wins sync creates a recovery point before replacing local bookmarks')
      }
      await send({ type: 'sync:delete', id: source }); await send({ type: 'sync:delete', id: destination })
      const label = `${definition.type} / ${data.bookmark_file_type}${definition.passphrase ? ' / encrypted' : ''}`
      protocols.push(label)
      console.log('PASS protocol ' + label)
    }
    note('All eight adapters complete initial transfer, incremental addition and deletion')
    return report
  } catch (error) {
    await writeFile(config.root + '/partial-report.json', JSON.stringify({ ...report, error: error.message }, null, 2))
    await page.screenshot({ path: config.root + '/failure.png' }).catch(() => {})
    throw error
  } finally {
    await page.goto('chrome://extensions/')
    for (const { id, path } of installed) {
      assert.ok(path.startsWith(config.root + '/'))
      await extensionCommand(task, management, 'Extensions.uninstall', { id })
    }
    report.cleanedUp = true
    await management.close()
  }
}
