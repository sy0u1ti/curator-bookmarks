import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'

// The real service worker, bookmark events, storage and IndexedDB against a local
// WebDAV server. Two throwaway profiles stand for two devices; never a personal one.
const temporary = await mkdtemp(path.resolve('.tmp-test/sync-engine-'))
const extension = path.join(temporary, 'extension')
await mkdir(path.dirname(extension), { recursive: true })
await cp(path.resolve('dist'), extension, { recursive: true })
// A test cannot answer the permission prompt the options page shows for a server.
const manifestPath = path.join(extension, 'manifest.json')
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
manifest.host_permissions = ['http://127.0.0.1/*']
manifest.permissions = [...new Set([...manifest.permissions, 'tabs', 'tabGroups'])]
manifest.optional_permissions = manifest.optional_permissions.filter(permission => !manifest.permissions.includes(permission))
await writeFile(manifestPath, JSON.stringify(manifest))

const USER = 'curator'
const PASSWORD = 'correct horse'
const files = new Map()
const requests = []
const server = createServer(async (request, response) => {
  const chunks = []
  for await (const chunk of request) chunks.push(chunk)
  const body = Buffer.concat(chunks)
  const key = decodeURIComponent(new URL(request.url, 'http://local').pathname)
  requests.push(`${request.method} ${key}`)
  const reply = (status, headers = {}, content = '') => { response.writeHead(status, headers); response.end(content) }
  if (key.startsWith('/tabs/')) return reply(200, { 'content-type': 'text/html' }, `<title>${key.slice(6)}</title><p>Local sync fixture</p>`)
  if (request.headers.authorization !== 'Basic ' + Buffer.from(`${USER}:${PASSWORD}`).toString('base64')) return reply(401)
  const file = files.get(key)
  const properties = length => `<?xml version="1.0"?><d:multistatus xmlns:d="DAV:"><d:response><d:href>${key}</d:href><d:propstat><d:prop>${
    length === null ? '<d:resourcetype><d:collection/></d:resourcetype>' : `<d:getcontentlength>${length}</d:getcontentlength>`
  }</d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response></d:multistatus>`
  switch (request.method) {
    case 'PROPFIND':
      if (key === '/dav/') return reply(207, { 'content-type': 'application/xml' }, properties(null))
      return file ? reply(207, { 'content-type': 'application/xml' }, properties(file.content.length)) : reply(404)
    case 'HEAD':
    case 'GET':
      if (!file) return reply(404)
      return reply(200, { 'content-length': file.content.length, 'last-modified': new Date(file.modified).toUTCString() },
        request.method === 'GET' ? file.content : '')
    case 'PUT':
      files.set(key, { content: body, modified: Date.now() })
      return reply(file ? 204 : 201)
    case 'DELETE':
      return files.delete(key) ? reply(204) : reply(404)
    case 'MOVE': {
      if (!file) return reply(404)
      const destination = decodeURIComponent(new URL(request.headers.destination, 'http://local').pathname)
      files.set(destination, file)
      files.delete(key)
      return reply(201)
    }
    default:
      return reply(405)
  }
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const davUrl = `http://127.0.0.1:${server.address().port}/dav/`
const remoteFile = () => files.get('/dav/bookmarks.xbel')?.content.toString('utf8') || ''

async function launch(profile) {
  const context = await chromium.launchPersistentContext(path.join(temporary, profile), {
    channel: 'chromium', headless: true, viewport: { width: 1280, height: 900 },
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`]
  })
  context.setDefaultTimeout(30000)
  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker')
  const errors = []
  worker.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  const page = await context.newPage()
  // Sync messages are answered for the options page only.
  await page.goto(`chrome-extension://${new URL(worker.url()).host}/src/options/options.html#backup`)
  await page.evaluate(() => chrome.storage.local.set({ curatorBookmarkAiNamingSettings: { autoAnalyzeBookmarks: false } }))
  const send = message => page.evaluate(async message => {
    const response = await chrome.runtime.sendMessage(message)
    if (!response?.ok) throw new Error(response?.error || 'no response')
    return response.result
  }, message)
  const settled = async id => {
    for (let attempt = 0; attempt < 300; attempt++) {
      const profile = (await send({ type: 'sync:list' })).find(item => item.id === id)
      if (profile && !profile.data.syncing && !profile.data.scheduled) return profile
      await page.waitForTimeout(200)
    }
    throw new Error('The sync did not finish')
  }
  const sync = async (id, mode = 'normal') => {
    await send({ type: 'sync:run', id, mode })
    return settled(id)
  }
  const urls = folderId => page.evaluate(async folderId => {
    const collect = node => node.url ? [node.url] : (node.children || []).flatMap(collect)
    return collect((await chrome.bookmarks.getSubTree(folderId))[0]).sort()
  }, folderId)
  return { context, worker, page, send, settled, sync, urls, errors }
}

const profileSettings = (localRoot, extra = {}) => ({
  type: 'webdav', url: davUrl, username: USER, password: PASSWORD, bookmark_file: 'bookmarks.xbel',
  bookmark_file_type: 'xbel', localRoot, enabled: false, syncIntervalEnabled: false, ...extra
})

let first
let second
try {
  first = await launch('device-a')
  const folderA = await first.page.evaluate(async () => {
    const folder = await chrome.bookmarks.create({ parentId: '1', title: '同步资料' })
    for (let index = 0; index < 8; index++) {
      await chrome.bookmarks.create({ parentId: folder.id, title: `资料 ${index}`, url: `https://example.com/doc/${index}` })
    }
    const nested = await chrome.bookmarks.create({ parentId: folder.id, title: '子文件夹' })
    await chrome.bookmarks.create({ parentId: nested.id, title: '深层', url: 'https://example.com/nested' })
    return folder.id
  })

  // No profile, no engine work: the periodic check exists only while something can be due.
  assert.deepEqual(await first.send({ type: 'sync:list' }), [])
  assert.equal(await first.page.evaluate(() => chrome.alarms.get('curator-sync-check')), undefined)

  await assert.rejects(first.send({ type: 'sync:test', data: profileSettings(folderA, { password: 'wrong' }) }), /401/)
  await first.send({ type: 'sync:test', data: profileSettings(folderA) })
  await assert.rejects(first.send({ type: 'sync:create', data: profileSettings('999999') }), /本地文件夹/)
  await assert.rejects(first.send({ type: 'sync:create', data: profileSettings(folderA, { bookmark_file: '/x.xbel' }) }), /书签文件/)

  const idA = await first.send({ type: 'sync:create', data: profileSettings(folderA) })
  const [listed] = await first.send({ type: 'sync:list' })
  assert.deepEqual(listed.secrets, { password: true, passphrase: false, refreshToken: false })
  assert.ok(!('password' in listed.data), 'a listed profile must not carry its password')
  assert.equal(listed.folderPath.at(-1), '同步资料')
  assert.equal(listed.data.username, USER)

  let profileA = await first.sync(idA)
  assert.equal(profileA.data.error ?? null, null)
  assert.ok(profileA.data.lastSync > 0)
  // The page that sent these messages shows the profile without being reloaded.
  const row = first.page.locator('#settings-sync li').first()
  await row.waitFor()
  assert.match(await row.innerText(), /同步资料[\s\S]*WebDAV/)
  await first.page.screenshot({ path: path.resolve('.tmp', 'sync-engine-options.png'), fullPage: true })
  assert.match(remoteFile(), /https:\/\/example\.com\/doc\/7/)
  assert.match(remoteFile(), /https:\/\/example\.com\/nested/)
  assert.ok(!files.has('/dav/bookmarks.xbel.lock'), 'the lock is released after a sync')
  // Stored secrets stay out of every other storage entry and out of the page.
  assert.equal(await first.page.evaluate(async password => {
    const stored = await chrome.storage.local.get(null)
    return Object.entries(stored).filter(([key]) => !key.startsWith('curatorSync:')).some(([, value]) => JSON.stringify(value).includes(password))
  }, PASSWORD), false)

  second = await launch('device-b')
  const folderB = await second.page.evaluate(async () => {
    // Captures every new bookmark, so a synced one that reached the queue would show up.
    await chrome.storage.local.set({ curatorBookmarkContentSnapshotSettings: { enabled: true, autoCaptureOnBookmarkCreate: true } })
    return (await chrome.bookmarks.create({ parentId: '2', title: '来自服务器' })).id
  })
  const idB = await second.send({ type: 'sync:create', data: profileSettings(folderB) })
  const profileB = await second.sync(idB)
  assert.equal(profileB.data.error ?? null, null)
  assert.deepEqual(await second.urls(folderB), await first.urls(folderA))
  assert.equal(await second.page.evaluate(async () => {
    const stored = await chrome.storage.local.get(['curatorBookmarkAutoAnalyzeQueue', 'curatorBookmarkAutoAnalyzeStatus'])
    return JSON.stringify(stored).includes('example.com')
  }), false, 'bookmarks written by a sync are not queued for analysis')
  await second.page.evaluate(folderId => chrome.bookmarks.create({ parentId: folderId, title: '本机新增', url: 'https://example.com/added-on-b' }), folderB)
  await second.page.waitForFunction(async () => {
    const stored = await chrome.storage.local.get(['curatorBookmarkAutoAnalyzeQueue', 'curatorBookmarkAutoAnalyzeStatus'])
    return JSON.stringify(stored).includes('added-on-b')
  })

  // Changes travel both ways and removals follow.
  await second.sync(idB)
  await first.sync(idA)
  assert.ok((await first.urls(folderA)).includes('https://example.com/added-on-b'))
  await first.page.evaluate(async () => {
    const [bookmark] = await chrome.bookmarks.search({ url: 'https://example.com/doc/0' })
    await chrome.bookmarks.remove(bookmark.id)
  })
  await first.sync(idA)
  await second.sync(idB)
  assert.ok(!(await second.urls(folderB)).includes('https://example.com/doc/0'))

  // The failsafe refuses a sync that would delete a large share of the server's bookmarks.
  await first.page.evaluate(async () => {
    for (const index of [1, 2, 3, 4, 5]) {
      const [bookmark] = await chrome.bookmarks.search({ url: `https://example.com/doc/${index}` })
      await chrome.bookmarks.remove(bookmark.id)
    }
  })
  profileA = await first.sync(idA)
  assert.match(profileA.data.error, /E029/)
  await first.page.waitForFunction(async () => (await chrome.action.getBadgeText({})) === '!')
  await first.page.evaluate(() => chrome.storage.local.set({
    curatorBookmarkAutoAnalyzeStatus: { bookmarkId: 'badge-fixture', status: 'processing', badgeVisible: true, title: 'Fixture',
      createdAt: Date.now(), updatedAt: Date.now(), expiresAt: Date.now() + 60000 }
  }))
  await first.page.waitForFunction(async () => (await chrome.action.getBadgeText({})) === 'AI')
  await first.page.evaluate(async () => {
    const key = 'curatorBookmarkAutoAnalyzeStatus', value = (await chrome.storage.local.get(key))[key]
    await chrome.storage.local.set({ [key]: { ...value, badgeVisible: false } })
  })
  await first.page.waitForFunction(async () => (await chrome.action.getBadgeText({})) === '!')
  await first.page.evaluate(() => chrome.storage.local.remove('curatorBookmarkAutoAnalyzeStatus'))
  assert.match(remoteFile(), /https:\/\/example\.com\/doc\/3/, 'nothing was removed from the server')
  await first.send({ type: 'sync:update', id: idA, data: { failsafe: false } })
  profileA = await first.sync(idA)
  assert.equal(profileA.data.error ?? null, null)
  assert.doesNotMatch(remoteFile(), /https:\/\/example\.com\/doc\/3/)

  // The same guard protects this device from a server that lost most of its bookmarks.
  let profileBAfter = await second.sync(idB)
  assert.match(profileBAfter.data.error, /E050/)
  assert.ok((await second.urls(folderB)).includes('https://example.com/doc/3'), 'nothing was removed locally')
  await second.send({ type: 'sync:update', id: idB, data: { failsafe: false } })
  profileBAfter = await second.sync(idB)
  assert.equal(profileBAfter.data.error ?? null, null)
  assert.deepEqual(await second.urls(folderB), await first.urls(folderA))

  // "Server wins" first leaves a restore point, then makes this device match the server.
  await second.page.evaluate(folderId => chrome.bookmarks.create({ parentId: folderId, title: '只在本机', url: 'https://example.com/local-only' }), folderB)
  profileBAfter = await second.sync(idB, 'download')
  assert.equal(profileBAfter.data.error ?? null, null)
  assert.deepEqual(await second.urls(folderB), await first.urls(folderA))
  assert.equal(await second.page.evaluate(async () => {
    const { curatorBookmarkAutoBackupIndex: index = [] } = await chrome.storage.local.get('curatorBookmarkAutoBackupIndex')
    return index.filter(point => point.kind === 'sync-download').length
  }), 1)

  // The configured strategy uses the same recovery hook as the explicit menu action.
  await second.send({ type: 'sync:update', id: idB, data: { strategy: 'slave' } })
  await second.page.evaluate(folderId => chrome.bookmarks.create({ parentId: folderId, title: '配置方向检查', url: 'https://example.com/configured-only' }), folderB)
  await second.sync(idB)
  assert.deepEqual(await second.urls(folderB), await first.urls(folderA))
  assert.equal(await second.page.evaluate(async () => {
    const { curatorBookmarkAutoBackupIndex: index = [] } = await chrome.storage.local.get('curatorBookmarkAutoBackupIndex')
    return index.filter(point => point.kind === 'sync-download').length
  }), 2)
  await second.send({ type: 'sync:update', id: idB, data: { strategy: 'default' } })

  // A queued run cannot resume after cancellation, even after restore releases its lock.
  const lastSyncBeforeQueue = (await second.send({ type: 'sync:list' })).find(profile => profile.id === idB).data.lastSync
  await second.page.evaluate(() => {
    void navigator.locks.request('curator:bookmark-sync-run', { mode: 'exclusive' },
      () => new Promise(resolve => { window.__releaseSyncTestLock = resolve }))
  })
  await second.page.waitForFunction(() => typeof window.__releaseSyncTestLock === 'function')
  await second.send({ type: 'sync:run', id: idB, mode: 'normal' })
  await second.page.waitForFunction(async id => {
    let stored = (await chrome.storage.local.get('curatorSync:accounts'))['curatorSync:accounts']
    while (typeof stored === 'string') stored = JSON.parse(stored)
    return Boolean(stored[id].scheduled)
  }, idB)
  await second.send({ type: 'sync:cancel', id: idB })
  await second.page.evaluate(() => window.__releaseSyncTestLock())
  await second.page.waitForFunction(async () => !(await chrome.alarms.get('curator-sync-check')))
  assert.equal((await second.send({ type: 'sync:list' })).find(profile => profile.id === idB).data.lastSync, lastSyncBeforeQueue)

  // An encryption passphrase keeps the server from reading the bookmarks.
  await first.send({ type: 'sync:update', id: idA, data: { passphrase: 'between devices' } })
  await first.page.evaluate(folderId => chrome.bookmarks.create({ parentId: folderId, title: '加密后', url: 'https://example.com/encrypted' }), folderA)
  profileA = await first.sync(idA)
  assert.equal(profileA.data.error ?? null, null)
  assert.equal(profileA.secrets.passphrase, true)
  assert.match(remoteFile(), /^\{"ciphertext"/)
  assert.doesNotMatch(remoteFile(), /example\.com/)
  profileBAfter = await second.sync(idB)
  assert.match(profileBAfter.data.error, /E034|E030/, 'without the passphrase the file cannot be read')
  await second.send({ type: 'sync:update', id: idB, data: { passphrase: 'between devices' } })
  profileBAfter = await second.sync(idB)
  assert.equal(profileBAfter.data.error ?? null, null)
  assert.ok((await second.urls(folderB)).includes('https://example.com/encrypted'))

  // With "sync on change", a local edit reaches the server by itself.
  await first.send({ type: 'sync:update', id: idA, data: { enabled: true } })
  assert.ok(await first.page.evaluate(() => chrome.alarms.get('curator-sync-check')))
  const before = requests.filter(request => request === 'PUT /dav/bookmarks.xbel.tmp' || request.startsWith('MOVE')).length
  await first.page.evaluate(folderId => chrome.bookmarks.create({ parentId: folderId, title: '自动同步', url: 'https://example.com/automatic' }), folderA)
  await first.page.waitForFunction(() => true, undefined, { timeout: 1000 })
  for (let attempt = 0; attempt < 150; attempt++) {
    if (requests.filter(request => request.startsWith('MOVE')).length > before && !(await first.send({ type: 'sync:list' }))[0].data.syncing) break
    await first.page.waitForTimeout(200)
  }
  await second.sync(idB)
  assert.ok((await second.urls(folderB)).includes('https://example.com/automatic'), 'the change synced without being asked to')

  const htmlFolder = await second.page.evaluate(() => chrome.bookmarks.create({ parentId: '2', title: 'HTML round trip' }))
  const htmlSettings = localRoot => ({
    ...profileSettings(localRoot), bookmark_file: 'bookmarks.html', bookmark_file_type: 'html', nestedSync: true
  })
  const htmlSource = await first.send({ type: 'sync:create', data: htmlSettings(folderA) })
  const htmlDestination = await second.send({ type: 'sync:create', data: htmlSettings(htmlFolder.id) })
  assert.equal((await first.sync(htmlSource)).data.error || null, null)
  assert.match(files.get('/dav/bookmarks.html').content.toString('utf8'), /<DL|NETSCAPE-Bookmark/i)
  assert.equal((await second.sync(htmlDestination)).data.error || null, null)
  assert.deepEqual(await second.urls(htmlFolder.id), await first.urls(folderA))
  await first.send({ type: 'sync:delete', id: htmlSource })
  await second.send({ type: 'sync:delete', id: htmlDestination })

  // Profiles move between devices as a file; logs can be read back.
  const exported = await first.send({ type: 'sync:export', ids: [idA] })
  assert.equal(exported[0].url, davUrl)
  assert.ok(!('lastSync' in exported[0]) && !('syncing' in exported[0]))
  const imported = await second.send({ type: 'sync:import', profiles: exported })
  assert.equal(imported.ids.length, 1)
  const importedProfile = (await second.send({ type: 'sync:list' })).find(profile => profile.id === imported.ids[0])
  assert.equal(importedProfile.data.localRoot, null, 'device-local ids must not map to an unrelated existing folder')
  assert.equal(importedProfile.data.enabled, false)
  assert.equal(importedProfile.data.syncIntervalEnabled, false)
  assert.equal(imported.incomplete.reason, 'folder')
  const countBeforeInvalidImport = (await second.send({ type: 'sync:list' })).length
  await assert.rejects(second.send({ type: 'sync:import', profiles: [exported[0], { type: 'webdav', url: 'file:///not-a-server' }] }), /http/)
  assert.equal((await second.send({ type: 'sync:list' })).length, countBeforeInvalidImport, 'invalid batches import nothing')
  await assert.rejects(second.send({ type: 'sync:import', profiles: [{ type: 'unknown' }] }), /不支持/)
  const logs = await first.send({ type: 'sync:logs', anonymous: true })
  assert.ok(logs.length > 10)
  for (const secret of ['example.com', '资料', '同步资料', '127.0.0.1', USER + '@', PASSWORD, 'between devices']) {
    const leaked = logs.find(line => line.includes(secret))
    assert.equal(leaked, undefined, `redacted logs must not contain ${secret}: ${leaked?.slice(0, 300)}`)
  }
  assert.ok((await first.send({ type: 'sync:logs', anonymous: false })).some(line => line.includes('example.com')))

  // Match floccus's sync_tabs / sync_tabgroups scenarios using only fixture URLs.
  const tabBase = davUrl.replace('/dav/', '/tabs/')
  for (const name of ['one', 'two']) {
    const tab = await first.context.newPage()
    await tab.goto(tabBase + name)
  }
  await first.page.evaluate(async prefix => {
    const tabs = await chrome.tabs.query({ url: prefix + '*' })
    const groupId = await chrome.tabs.group({ tabIds: tabs.map(tab => tab.id) })
    await chrome.tabGroups.update(groupId, { title: '同步标签组', color: 'blue' })
  }, tabBase)
  const tabSettings = { ...profileSettings('tabs'), bookmark_file: 'tabs.xbel', failsafe: false }
  const tabsA = await first.send({ type: 'sync:create', data: tabSettings })
  const tabsB = await second.send({ type: 'sync:create', data: tabSettings })
  assert.equal((await first.sync(tabsA, 'upload')).data.error || null, null)
  assert.equal((await second.sync(tabsB)).data.error || null, null)
  const receivedTabs = await second.page.evaluate(async prefix => ({
    urls: (await chrome.tabs.query({ url: prefix + '*' })).map(tab => tab.url).sort(),
    groups: (await chrome.tabGroups.query({})).map(group => group.title)
  }), tabBase)
  assert.deepEqual(receivedTabs.urls, [tabBase + 'one', tabBase + 'two'])
  assert.ok(receivedTabs.groups.includes('同步标签组'))
  await first.send({ type: 'sync:delete', id: tabsA })
  await second.send({ type: 'sync:delete', id: tabsB })

  await first.send({ type: 'sync:clear-logs' })
  assert.equal((await first.send({ type: 'sync:logs', anonymous: true })).length, 0)
  await second.send({ type: 'sync:delete', id: imported.ids[0] })
  await first.send({ type: 'sync:delete', id: idA })
  await assert.rejects(first.send({ type: 'sync:run', id: idA, mode: 'normal' }), /不存在/)
  assert.deepEqual(await first.send({ type: 'sync:list' }), [])
  await first.page.waitForFunction(async () => !(await chrome.alarms.get('curator-sync-check')))
  assert.equal(await first.page.evaluate(async () =>
    Object.keys(await chrome.storage.local.get(null)).some(key => key.startsWith('curatorSync:bookmarks['))), false)

  // The engine reports a failed sync on the console; the only one provoked on this device is the failsafe.
  assert.deepEqual(first.errors.map(error => error.match(/^Syncing failed with E\d+/)?.[0] ?? error.slice(0, 300)), ['Syncing failed with E029'])
  console.log('Bookmark sync passed in a real service worker: two devices, removals, failsafe, recovery, encryption, automatic sync, safe imports, badge arbitration, tabs/groups and logs.', {
    requests: requests.length
  })
} finally {
  await first?.context.close()
  await second?.context.close()
  await new Promise(resolve => server.close(resolve))
  assert.ok(temporary.startsWith(path.resolve('.tmp-test') + path.sep))
  await rm(temporary, { recursive: true, force: true })
}
