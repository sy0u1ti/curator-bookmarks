import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { extensionCommand } from './ego-extension-command.mjs'

const manual = {
  enabled: false, syncOnStartupEnabled: false, syncIntervalEnabled: false,
  strategy: 'default', nestedSync: true, failsafe: false,
}

export function createSyncTestDevice(page) {
  const send = message => page.evaluate(async message => {
    if (!chrome.runtime.getManifest().name.startsWith('Curator QA ')) throw new Error('QA only')
    const response = await chrome.runtime.sendMessage(message)
    if (!response?.ok) throw new Error(response?.error || 'No response from the worker')
    return response.result
  }, message)
  const list = () => send({ type: 'sync:list' })
  const profile = async id => (await list()).find(profile => profile.id === id)
  const wait = async (id, before, expectError = false, attemptBefore = null) => {
    await page.waitForFunction(async ({ id, before, expectError, attemptBefore }) => {
      const result = await chrome.runtime.sendMessage({ type: 'sync:list' })
      const profile = result?.result?.find(profile => profile.id === id)
      return profile && !profile.data.syncing && !profile.data.scheduled &&
        (Number(profile.data.lastSync || 0) > before ||
          (profile.data.error && ((attemptBefore !== null && Number(profile.data.lastAttempt || 0) > attemptBefore) ||
            (expectError && attemptBefore === null))))
    }, { id, before, expectError, attemptBefore }, { timeout: 45000 })
    const result = await profile(id)
    if (expectError) assert.ok(result.data.error, 'Expected an error')
    else {
      assert.equal(result.data.error || null, null, result.data.error)
      assert.ok(result.data.lastSync > before, 'The success timestamp must advance only after the run completes')
    }
    return result
  }
  const sync = async (id, mode = 'normal', expectError = false) => {
    const current = await profile(id)
    const before = Number(current.data.lastSync || 0)
    await send({ type: 'sync:run', id, mode })
    return wait(id, before, expectError, Number(current.data.lastAttempt || 0))
  }
  const folder = title => page.evaluate(title => chrome.bookmarks.create({ parentId: '1', title }), title)
  const add = (parentId, title, url) => page.evaluate(details => chrome.bookmarks.create(details), { parentId, title, url })
  const remove = id => page.evaluate(id => chrome.bookmarks.remove(id), id)
  const update = (id, data) => send({ type: 'sync:update', id, data })
  const tree = id => page.evaluate(async id => {
    const read = node => node.url
      ? [{ title: node.title, url: node.url }]
      : (node.children || []).flatMap(read)
    return read((await chrome.bookmarks.getSubTree(id))[0]).sort((a, b) => a.url.localeCompare(b.url) || a.title.localeCompare(b.title))
  }, id)
  const recovery = () => page.evaluate(async () =>
    ((await chrome.storage.local.get('curatorBookmarkAutoBackupIndex')).curatorBookmarkAutoBackupIndex || [])
      .filter(point => point.kind === 'sync-download').map(point => point.backupId))
  const control = (action, data = {}) => send({ type: 'qa:sync-control', action, ...data })
  const alarm = async () => {
    const before = (await control('state')).alarms
    await page.evaluate(() => chrome.alarms.create('curator-sync-check', { when: Date.now() + 600 }))
    await page.waitForFunction(async before =>
      (await chrome.runtime.sendMessage({ type: 'qa:sync-control', action: 'state' })).result.alarms > before,
    before, { timeout: 15000 })
  }
  return { page, send, list, profile, wait, sync, folder, add, remove, update, tree, recovery, control, alarm }
}

export async function runDirectionalMatrix(a, b, definition, note) {
  const label = definition.name || definition.type
  const prefix = `https://curator-qa.invalid/${encodeURIComponent(label)}/`
  const folderA = await a.folder(`${label} A`), folderB = await b.folder(`${label} B`)
  const data = { ...manual, password: 'fixture-token', bookmark_file_type: 'xbel', ...definition }
  delete data.name
  const idA = await a.send({ type: 'sync:create', data: { ...data, localRoot: folderA.id } })
  const idB = await b.send({ type: 'sync:create', data: { ...data, localRoot: folderB.id } })
  const equal = async text => assert.deepEqual(await b.tree(folderB.id), await a.tree(folderA.id), `${label}: ${text}`)
  const checkRecovery = async (device, id, mode) => {
    const before = await device.recovery()
    await device.sync(id, mode)
    const after = await device.recovery()
    assert.ok(after.some(backupId => !before.includes(backupId)), `${label}: server-wins must create a recovery point`)
  }
  try {
    const originals = []
    for (let index = 0; index < 5; index++) originals.push(await a.add(folderA.id, `Original ${index}`, prefix + index))
    await b.add(folderB.id, 'From B before first sync', prefix + 'from-b')
    await a.sync(idA)
    await b.sync(idB)
    await a.sync(idA)
    await equal('initial two-way merge')
    assert.equal((await a.tree(folderA.id)).length, 6)
    await note(label, 'merge', 'Different initial local trees converge without discarding either side')

    await a.page.evaluate(id => chrome.bookmarks.update(id, { title: 'Renamed on A' }), originals[0].id)
    await a.remove(originals[1].id)
    await a.sync(idA); await b.sync(idB)
    await equal('incremental edit and deletion')
    assert.equal((await b.tree(folderB.id)).find(bookmark => bookmark.url === prefix + '0')?.title, 'Renamed on A')
    assert.ok(!(await b.tree(folderB.id)).some(bookmark => bookmark.url === prefix + '1'))
    await note(label, 'incremental', 'Rename and deletion propagate through the real adapter')

    await b.add(folderB.id, 'Remote-only change', prefix + 'remote-only')
    await b.sync(idB)
    await a.add(folderA.id, 'Local upload winner', prefix + 'upload-winner')
    const uploadWinner = await a.tree(folderA.id)
    await a.sync(idA, 'upload')
    assert.deepEqual(await a.tree(folderA.id), uploadWinner)
    await checkRecovery(b, idB, 'download')
    await equal('one-time upload replaces remote divergence')
    assert.ok(!(await b.tree(folderB.id)).some(bookmark => bookmark.url === prefix + 'remote-only'))
    assert.equal((await a.profile(idA)).data.strategy, 'default')
    await note(label, 'upload', 'Upload once replaces remote content while leaving the saved strategy unchanged')

    await b.add(folderB.id, 'Discard on download', prefix + 'discard-download')
    const sourceBeforeDownload = await a.tree(folderA.id)
    await checkRecovery(b, idB, 'download')
    await equal('one-time download')
    assert.deepEqual(await a.tree(folderA.id), sourceBeforeDownload)
    assert.equal((await b.profile(idB)).data.strategy, 'default')
    await note(label, 'download', 'Download once replaces local divergence and creates a recovery point')

    await b.add(folderB.id, 'Discard by configured overwrite', prefix + 'discard-overwrite')
    await b.sync(idB)
    await a.add(folderA.id, 'Configured local winner', prefix + 'configured-local')
    await a.update(idA, { strategy: 'overwrite' })
    const storedWinner = await a.tree(folderA.id)
    await a.sync(idA)
    await checkRecovery(b, idB, 'download')
    await equal('configured local-wins')
    assert.deepEqual(await a.tree(folderA.id), storedWinner)
    assert.equal((await a.profile(idA)).data.strategy, 'overwrite')
    await note(label, 'local-wins', 'Normal sync follows the saved local-wins strategy')

    await b.update(idB, { strategy: 'slave' })
    await b.add(folderB.id, 'Discard by configured download', prefix + 'discard-slave')
    await a.add(folderA.id, 'Configured remote winner', prefix + 'configured-remote')
    await a.sync(idA)
    await checkRecovery(b, idB, 'normal')
    await equal('configured server-wins')
    assert.equal((await b.profile(idB)).data.strategy, 'slave')
    await note(label, 'server-wins', 'Normal sync follows the saved server-wins strategy and creates recovery')

    await b.add(folderB.id, 'One-time upload from a download profile', prefix + 'override')
    const overrideWinner = await b.tree(folderB.id)
    await b.sync(idB, 'upload')
    await checkRecovery(a, idA, 'download')
    await equal('one-time direction overrides the configured direction')
    assert.deepEqual(await a.tree(folderA.id), overrideWinner)
    assert.equal((await a.profile(idA)).data.strategy, 'overwrite')
    assert.equal((await b.profile(idB)).data.strategy, 'slave')
    await note(label, 'direction-override', 'One-time actions override the direction for that run without rewriting settings')

    await a.add(folderA.id, 'Forced configured upload', prefix + 'force')
    await a.sync(idA, 'force')
    await checkRecovery(b, idB, 'normal')
    await equal('forced saved strategy')
    assert.ok((await b.tree(folderB.id)).some(bookmark => bookmark.url === prefix + 'force'))
    await note(label, 'force', 'Force runs the configured direction and commits the expected tree')
    return { label, definition: data, idA, idB, folderA: folderA.id, folderB: folderB.id, prefix }
  } catch (error) {
    error.message = `${label}: ${error.message}`
    throw error
  }
}

export async function runSyncModeChecks(task, config) {
  const management = (await task.pages())[0] ?? await task.newPage()
  await management.goto('chrome://extensions/')
  const pages = {}, installed = []
  const report = { buildId: config.buildId, spaceId: task.spaceId, checks: [], variants: [], boundary: 'Real MV3 workers and adapters; isolated bookmark trees and local service protocols' }
  const save = () => writeFile(`${config.root}/report.json`, JSON.stringify(report, null, 2))
  const note = async (adapter, mode, detail) => {
    report.checks.push({ adapter, mode, detail, passed: true })
    console.log(`PASS ${adapter}: ${mode}`)
    await save()
  }
  const devices = {}
  try {
    for (const device of ['a', 'b']) {
      const { id } = await extensionCommand(task, management, 'Extensions.loadUnpacked', { path: config.extensions[device] })
      installed.push({ id, path: config.extensions[device] })
      await writeFile(`${config.root}/installed.json`, JSON.stringify({ spaceId: task.spaceId, installed }, null, 2))
      pages[device] = await task.newPage()
      await pages[device].goto(`chrome-extension://${id}/src/options/options.html#backup`)
      devices[device] = createSyncTestDevice(pages[device])
      assert.equal((await devices[device].send({ type: 'curator:background-info' })).buildId, config.buildId)
      await pages[device].evaluate(async () => {
        const tree = await chrome.bookmarks.getTree()
        if (tree[0].children[0].title !== 'QA Bookmarks Bar' || tree[0].children.some(folder => folder.children.length)) throw new Error('Non-isolated bookmarks')
        await chrome.storage.local.set({
          curatorBookmarkOnboardingState: { completed: true, dismissed: true },
          curatorBookmarkAiNamingSettings: { autoAnalyzeBookmarks: false },
          curatorBookmarkContentSnapshotSettings: { enabled: false },
          curatorModelsDevSync: { autoUpdate: false },
        })
      })
    }
    const definitions = [
      { type: 'webdav', url: `${config.base}/dav/`, username: 'curator' },
      { type: 's3', url: `${config.base}/s3/`, region: 'us-east-1', bucket: 'bookmarks', pathStyle: true, username: 'fixture-access' },
      { type: 'git', url: `${config.base}/git/sync.git`, branch: 'main', username: 'curator' },
      { type: 'nextcloud-bookmarks', url: `${config.base}/nextcloud`, serverRoot: '', username: 'curator' },
      { type: 'linkwarden', url: `${config.base}/linkwarden`, serverFolder: 'Curator' },
      { type: 'karakeep', url: `${config.base}/karakeep`, serverFolder: 'Curator' },
    ]
    for (const adapter of ['google-drive', 'dropbox']) {
      for (const device of Object.values(devices)) {
        const authorization = await device.send({ type: 'sync:authorize', adapter, client: { clientId: 'fixture-client', clientSecret: 'fixture-secret' } })
        assert.equal(authorization.refreshToken, 'fixture-refresh')
      }
      definitions.push({ type: adapter, username: `Fixture ${adapter}`, password: '', refreshToken: 'fixture-refresh' })
    }
    const variants = definitions.map(definition => ({ ...definition, bookmark_file: `${definition.type}-modes.xbel` }))
    for (const type of ['webdav', 's3', 'git']) variants.push({
      ...definitions.find(definition => definition.type === type), name: `${type}-html`, bookmark_file: `${type}-modes.html`, bookmark_file_type: 'html',
    })
    for (const type of ['webdav', 's3', 'google-drive', 'dropbox']) variants.push({
      ...definitions.find(definition => definition.type === type), name: `${type}-encrypted`, bookmark_file: `${type}-encrypted.xbel`,
      ...(['google-drive', 'dropbox'].includes(type) ? { password: 'matrix-encryption-passphrase' } : { passphrase: 'matrix-encryption-passphrase' }),
    })
    const fixture = async (provider, file, action, values = {}) => {
      const response = await fetch(`${config.base}/__qa/fixture`, {
        method: 'POST', headers: { Authorization: `Bearer ${config.controlToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, file, action, ...values }),
      })
      const result = await response.json()
      assert.ok(response.ok, JSON.stringify(result))
      return result
    }
    for (const definition of variants.filter(definition => !config.adapters || config.adapters.includes(definition.name || definition.type))) {
      const run = await runDirectionalMatrix(devices.a, devices.b, definition, note)
      report.variants.push(run.label)
      if (run.label.endsWith('-encrypted')) {
        const stored = await fixture(definition.type, definition.bookmark_file, 'read')
        assert.ok(stored.exists)
        assert.match(stored.content, /^\s*\{"ciphertext"/)
        assert.doesNotMatch(stored.content, /curator-qa\.invalid|Original|Configured/)
        await note(run.label, 'encrypted-storage', 'Stored bytes contain ciphertext rather than bookmark titles or URLs')
        const field = ['google-drive', 'dropbox'].includes(definition.type) ? 'password' : 'passphrase'
        const before = await devices.b.tree(run.folderB)
        await devices.b.update(run.idB, { [field]: 'incorrect-qa-passphrase' })
        await devices.b.sync(run.idB, 'normal', true)
        assert.deepEqual(await devices.b.tree(run.folderB), before, 'A wrong encryption key must preserve the local bookmarks')
        await devices.b.update(run.idB, { [field]: definition[field] })
        await devices.b.sync(run.idB)
        assert.deepEqual(await devices.b.tree(run.folderB), await devices.a.tree(run.folderA))
        await note(run.label, 'decryption-recovery', 'A wrong key preserves bookmarks; correcting it resumes synchronization')
      }
      if (config.sections.includes('guards') &&
        ['webdav', 's3', 'google-drive', 'dropbox', 'nextcloud-bookmarks'].includes(run.label)) {
        await runExternalLockCheck(devices, run, fixture, note)
      }
      if (run.label === 'webdav' && config.sections.includes('guards')) await runGuardChecks(devices, run, fixture, note)
      if (run.label === 'linkwarden') await runLinkwardenOrderChecks(devices, run, fixture, note)
      if (!definition.name && config.sections.includes('triggers')) {
        await runTriggerChecks(devices, run, note)
      }
      await devices.a.send({ type: 'sync:delete', id: run.idA })
      await devices.b.send({ type: 'sync:delete', id: run.idB })
      await devices.a.control('clock', { offset: 0 })
    }
    if (config.sections.includes('tabs')) await runTabChecks(devices, config, note)
    for (const device of Object.values(devices)) {
      for (const profile of await device.list()) await device.send({ type: 'sync:delete', id: profile.id })
      assert.deepEqual(await device.list(), [])
      assert.deepEqual(await device.page.evaluate(() => window.__syncModeErrors), [])
    }
    report.passed = true
    await save()
    console.log(`PASS all sync mode checks: ${report.checks.length} checks, ${report.variants.length} variants`)
  } catch (error) {
    report.passed = false
    report.error = error.message
    await save()
    for (const [name, device] of Object.entries(devices)) {
      const logs = await device.send({ type: 'sync:logs', anonymous: false }).catch(() => [])
      await writeFile(`${config.root}/failure-${name}-logs.json`, JSON.stringify(logs, null, 2))
      const tabs = await device.page.evaluate(() => chrome.storage.local.get('curatorQa:tabs')).catch(() => ({}))
      await writeFile(`${config.root}/failure-${name}-tabs.json`, JSON.stringify(tabs, null, 2))
    }
    for (const [device, page] of Object.entries(pages)) await page.screenshot({ path: `${config.root}/failure-${device}.png` }).catch(() => {})
    throw error
  } finally {
    for (const device of Object.values(devices)) {
      await device.control('gate', { enabled: false }).catch(() => {})
      await device.control('completion-gate', { enabled: false }).catch(() => {})
      for (const profile of await device.list().catch(() => [])) await device.send({ type: 'sync:cancel', id: profile.id }).catch(() => {})
    }
    for (const page of Object.values(pages)) await page.close().catch(() => {})
    for (const installation of installed) {
      assert.ok(installation.path.startsWith(`${config.root}/`))
      await extensionCommand(task, management, 'Extensions.uninstall', { id: installation.id })
    }
    report.cleanedUp = true
    await save()
  }
}

async function runExternalLockCheck({ a, b }, run, fixture, note) {
  await a.update(run.idA, { strategy: 'default' })
  await b.update(run.idB, { strategy: 'default' })
  const before = Number((await a.profile(run.idA)).data.lastSync)
  await fixture(run.definition.type, run.definition.bookmark_file, 'lock')
  await a.add(run.folderA, 'Wait for the other client', run.prefix + 'lock-wait')
  await a.send({ type: 'sync:run', id: run.idA, mode: 'normal' })
  await a.page.waitForFunction(async ({ id, before }) => {
    const profile = (await chrome.runtime.sendMessage({ type: 'sync:list' })).result.find(profile => profile.id === id)
    return profile.data.scheduled && !profile.data.syncing && profile.data.lastSync === before
  }, { id: run.idA, before }, { timeout: 15000 })
  assert.equal((await a.profile(run.idA)).data.lastSync, before)
  await a.sync(run.idA, 'force')
  await b.sync(run.idB)
  assert.deepEqual(await a.tree(run.folderA), await b.tree(run.folderB))
  assert.ok((await b.tree(run.folderB)).some(bookmark => bookmark.url === run.prefix + 'lock-wait'))
  await fixture(run.definition.type, run.definition.bookmark_file, 'unlock')
  await note(run.label, 'locked-force', 'Normal synchronization waits on a live remote lock; force completes and releases it')
}

async function runGuardChecks({ a, b }, run, fixture, note) {
  await a.update(run.idA, { strategy: 'default', failsafe: true })
  await b.update(run.idB, { strategy: 'default', failsafe: false })
  const before = await fixture('webdav', run.definition.bookmark_file, 'read')
  const localBefore = await b.tree(run.folderB)
  await a.page.evaluate(async folder => {
    const children = await chrome.bookmarks.getChildren(folder)
    for (const bookmark of children.slice(2)) await chrome.bookmarks.remove(bookmark.id)
  }, run.folderA)
  const guarded = await a.sync(run.idA, 'normal', true)
  assert.match(guarded.data.error, /E029/)
  assert.equal((await fixture('webdav', run.definition.bookmark_file, 'read')).content, before.content)
  assert.deepEqual(await b.tree(run.folderB), localBefore)
  const forced = await a.sync(run.idA, 'force', true)
  assert.match(forced.data.error, /E029/, 'Force may override remote locking, not silently disable the deletion failsafe')
  await a.update(run.idA, { failsafe: false })
  await a.sync(run.idA)
  await b.update(run.idB, { failsafe: true })
  const clientGuard = await b.sync(run.idB, 'normal', true)
  assert.match(clientGuard.data.error, /E050/)
  assert.deepEqual(await b.tree(run.folderB), localBefore)
  await b.update(run.idB, { failsafe: false })
  await b.sync(run.idB)
  assert.deepEqual(await a.tree(run.folderA), await b.tree(run.folderB))
  await note('webdav', 'deletion-failsafe', 'Both directions preserve data on bulk deletion; force keeps the safeguard; explicit recovery succeeds')

  const beforeQueue = Number((await b.profile(run.idB)).data.lastSync)
  await b.page.evaluate(() => {
    window.__syncModeLockHeld = false
    void navigator.locks.request('curator:bookmark-sync-run', { mode: 'exclusive' }, () => new Promise(resolve => {
      window.__syncModeReleaseLock = resolve
      window.__syncModeLockHeld = true
    }))
  })
  await b.page.waitForFunction(() => window.__syncModeLockHeld)
  try {
    await b.send({ type: 'sync:run', id: run.idB, mode: 'upload' })
    await b.page.waitForFunction(async id => {
      const profile = (await chrome.runtime.sendMessage({ type: 'sync:list' })).result.find(profile => profile.id === id)
      return profile.data.scheduled === 'overwrite'
    }, run.idB)
    await b.send({ type: 'sync:cancel', id: run.idB })
  } finally {
    await b.page.evaluate(() => window.__syncModeReleaseLock())
  }
  await b.alarm()
  assert.equal((await b.profile(run.idB)).data.lastSync, beforeQueue)
  assert.equal(Boolean((await b.profile(run.idB)).data.scheduled), false)
  await note('webdav', 'cancel-queued', 'Cancelling an upload queued behind restore prevents an alarm from restarting it')

  const storedBeforeCancel = await fixture('webdav', run.definition.bookmark_file, 'read')
  const successBeforeCancel = Number((await a.profile(run.idA)).data.lastSync)
  await a.add(run.folderA, 'Cancelled before network commit', run.prefix + 'cancel-active')
  const heldBefore = (await a.control('state')).held
  await a.control('gate', { enabled: true })
  await a.send({ type: 'sync:run', id: run.idA, mode: 'normal' })
  await a.page.waitForFunction(async heldBefore =>
    (await chrome.runtime.sendMessage({ type: 'qa:sync-control', action: 'state' })).result.held > heldBefore,
  heldBefore, { timeout: 15000 })
  await assert.rejects(() => a.update(run.idA, { strategy: 'slave' }), /运行|取消|完成/)
  await assert.rejects(() => a.send({ type: 'sync:reset', id: run.idA }), /运行|取消|完成/)
  await a.send({ type: 'sync:cancel', id: run.idA })
  await a.control('gate', { enabled: false })
  await a.page.waitForFunction(async id => {
    const profile = (await chrome.runtime.sendMessage({ type: 'sync:list' })).result.find(profile => profile.id === id)
    return !profile.data.syncing && !profile.data.scheduled
  }, run.idA, { timeout: 15000 })
  assert.equal((await a.profile(run.idA)).data.lastSync, successBeforeCancel)
  assert.equal((await fixture('webdav', run.definition.bookmark_file, 'read')).content, storedBeforeCancel.content)
  await a.sync(run.idA); await b.sync(run.idB)
  assert.deepEqual(await a.tree(run.folderA), await b.tree(run.folderB))
  await note('webdav', 'cancel-running', 'Cancellation preserves the remote file and success timestamp; edits/reset refuse to race; retry completes')

  await a.send({ type: 'sync:reset', id: run.idA })
  await a.sync(run.idA); await b.sync(run.idB)
  assert.deepEqual(await a.tree(run.folderA), await b.tree(run.folderB))
  await note('webdav', 'reset-and-retry', 'Resetting mappings and continuation allows a fresh sync without duplication')

  const holdCompletion = async suffix => {
    const held = (await a.control('state')).completionsHeld
    await a.control('completion-gate', { enabled: true })
    await a.add(run.folderA, 'Complete before another request', run.prefix + suffix)
    const before = Number((await a.profile(run.idA)).data.lastSync)
    await a.send({ type: 'sync:run', id: run.idA, mode: 'normal' })
    await a.wait(run.idA, before)
    await a.page.waitForFunction(async held =>
      (await chrome.runtime.sendMessage({ type: 'qa:sync-control', action: 'state' })).result.completionsHeld > held,
    held, { timeout: 15000 })
    return Number((await a.profile(run.idA)).data.lastSync)
  }
  const firstCompleted = await holdCompletion('completed-before-followup')
  await a.add(run.folderA, 'Queued during completion', run.prefix + 'queued-followup')
  await a.send({ type: 'sync:run', id: run.idA, mode: 'normal' })
  await a.control('completion-gate', { enabled: false })
  await a.wait(run.idA, firstCompleted)
  await b.sync(run.idB)
  assert.ok((await b.tree(run.folderB)).some(bookmark => bookmark.url === run.prefix + 'queued-followup'))
  await note('webdav', 'completion-followup', 'A request accepted while the previous run finishes commits without another click')

  const beforeTailCancel = await holdCompletion('completed-before-queued-cancel')
  await a.add(run.folderA, 'Cancel this queued request', run.prefix + 'cancelled-followup')
  await a.send({ type: 'sync:run', id: run.idA, mode: 'upload' })
  await a.send({ type: 'sync:cancel', id: run.idA })
  await a.control('completion-gate', { enabled: false })
  await a.alarm()
  assert.equal((await a.profile(run.idA)).data.lastSync, beforeTailCancel)
  assert.ok(!(await fixture('webdav', run.definition.bookmark_file, 'read')).content.includes('cancelled-followup'))
  await a.sync(run.idA); await b.sync(run.idB)
  assert.deepEqual(await a.tree(run.folderA), await b.tree(run.folderB))
  await note('webdav', 'cancel-completion-followup', 'Cancel also removes a queued request during completion; a later explicit run still works')
}

async function runLinkwardenOrderChecks({ a, b }, run, fixture, note) {
  assert.equal((await a.profile(run.idA)).data.syncOrder, true)
  assert.equal((await b.profile(run.idB)).data.syncOrder, true)
  await a.update(run.idA, { ...manual, syncOrder: true })
  await b.update(run.idB, { ...manual, syncOrder: true })
  const orderedTree = device => device.page.evaluate(async root => {
    const serialize = node => node.url ? { title: node.title, url: node.url }
      : { title: node.title, children: (node.children || []).map(serialize) }
    return (await chrome.bookmarks.getSubTree(root))[0].children.map(serialize)
  }, device === a ? run.folderA : run.folderB)
  const local = await a.page.evaluate(async root => {
    const first = await chrome.bookmarks.create({ parentId: root, title: 'First ordered collection', index: 0 })
    const second = await chrome.bookmarks.create({ parentId: root, title: 'Second ordered collection', index: 0 })
    const children = []
    for (const name of ['first', 'second', 'third']) children.push(await chrome.bookmarks.create({
      parentId: first.id, title: name, url: `https://curator-qa.invalid/linkwarden-order/${name}`,
    }))
    await chrome.bookmarks.move(children[2].id, { parentId: first.id, index: 0 })
    return { first: first.id, second: second.id }
  }, run.folderA)
  const expected = await orderedTree(a)
  await a.sync(run.idA)
  await b.sync(run.idB)
  assert.deepEqual(await orderedTree(b), expected)
  const remote = await fixture('linkwarden', '', 'read')
  const firstRemote = remote.collections.find(collection => collection.name === 'First ordered collection')
  const secondRemote = remote.collections.find(collection => collection.name === 'Second ordered collection')
  assert.deepEqual(remote.user.collectionOrder.filter(id => [firstRemote.id, secondRemote.id].map(String).includes(String(id))).map(String),
    [secondRemote.id, firstRemote.id].map(String))
  assert.equal(remote.user.theme, 'dark')
  await note('linkwarden', 'link-and-collection-order', 'New profiles synchronize link and collection ordering without changing unrelated user settings')

  const reversed = remote.links.filter(link => String(link.collectionId) === String(firstRemote.id))
    .sort((first, second) => first.collectionOrder - second.collectionOrder).map(link => link.id)
  await fixture('linkwarden', '', 'order', { ids: reversed })
  await b.sync(run.idB); await a.sync(run.idA)
  assert.deepEqual(await orderedTree(a), await orderedTree(b))
  const serverFirst = (await orderedTree(b)).find(folder => folder.title === 'First ordered collection')
  assert.deepEqual(serverFirst.children.map(bookmark => bookmark.url), reversed.map(id => remote.links.find(link => link.id === id).url))
  await note('linkwarden', 'remote-order-download', 'Ordering changed on the server reaches both local bookmark trees')

  await a.page.evaluate(async parentId => {
    await Promise.all(['parallel-one', 'parallel-two', 'parallel-three'].map(title => chrome.bookmarks.create({
      parentId, title, url: `https://curator-qa.invalid/linkwarden-order/${title}`,
    })))
  }, local.first)
  const withNewLinks = await orderedTree(a)
  await a.sync(run.idA); await b.sync(run.idB)
  assert.deepEqual(await orderedTree(b), withNewLinks)
  await note('linkwarden', 'concurrent-link-order', 'Links added together retain their local ordering after upload and download')

  await a.update(run.idA, { syncOrder: false })
  const disabled = await a.send({ type: 'sync:export', ids: [run.idA] })
  assert.equal(disabled[0].syncOrder, false)
  const { syncOrder, ...legacy } = disabled[0]
  const imported = await a.send({ type: 'sync:import', profiles: [legacy] })
  assert.equal((await a.profile(imported.ids[0])).data.syncOrder, false)
  assert.equal((await a.profile(imported.ids[0])).data.enabled, false)
  await a.send({ type: 'sync:delete', id: imported.ids[0] })
  await a.update(run.idA, { syncOrder: true })
  await note('linkwarden', 'order-migration', 'Explicit settings export intact while older imported profiles keep ordering and automatic sync disabled')
}

async function runTriggerChecks({ a, b }, run, note) {
  await a.update(run.idA, { ...manual, enabled: true })
  await b.update(run.idB, manual)
  const beforeChange = Number((await a.profile(run.idA)).data.lastSync)
  await a.add(run.folderA, 'Automatic local change', run.prefix + 'auto-change')
  await a.wait(run.idA, beforeChange)
  await b.sync(run.idB)
  assert.ok((await b.tree(run.folderB)).some(bookmark => bookmark.url === run.prefix + 'auto-change'))
  await a.update(run.idA, { enabled: false })
  await note(run.label, 'on-bookmark-change', 'A production bookmark event synchronizes after the quiet period without a run request')

  await a.update(run.idA, { enabled: true })
  const beforeDisable = Number((await a.profile(run.idA)).data.lastSync)
  await a.add(run.folderA, 'Automatic sync disabled during debounce', run.prefix + 'disabled-debounce')
  await a.update(run.idA, { enabled: false })
  await a.page.waitForFunction(deadline => Date.now() >= deadline, Date.now() + 8500, { timeout: 12000 })
  assert.equal((await a.profile(run.idA)).data.lastSync, beforeDisable, 'Disabling automatic sync must cancel the already pending local-change run')
  await a.sync(run.idA); await b.sync(run.idB)
  await note(run.label, 'disable-pending-auto', 'Turning off automatic sync during the quiet period prevents the pending run')

  await a.update(run.idA, { enabled: true })
  const beforeModeChange = Number((await a.profile(run.idA)).data.lastSync)
  const remoteBeforeModeChange = await b.tree(run.folderB)
  await a.add(run.folderA, 'Change to notify-only during debounce', run.prefix + 'notify-debounce')
  await a.update(run.idA, { notifyOnly: true })
  await a.page.waitForFunction(async id => {
    const profile = (await chrome.runtime.sendMessage({ type: 'sync:list' })).result.find(profile => profile.id === id)
    return Boolean(profile.data.pendingChanges) && !profile.data.syncing
  }, run.idA, { timeout: 30000 })
  assert.equal((await a.profile(run.idA)).data.lastSync, beforeModeChange)
  await b.sync(run.idB)
  assert.deepEqual(await b.tree(run.folderB), remoteBeforeModeChange)
  await a.update(run.idA, { enabled: false, notifyOnly: false })
  await a.sync(run.idA); await b.sync(run.idB)
  await note(run.label, 'change-pending-auto-mode', 'Switching a pending auto-sync to notify-only checks without uploading')

  await a.update(run.idA, { syncOnStartupEnabled: true })
  await a.add(run.folderA, 'Browser startup change', run.prefix + 'startup')
  const beforeStartup = Number((await a.profile(run.idA)).data.lastSync)
  await a.control('startup')
  await a.wait(run.idA, beforeStartup)
  await b.sync(run.idB)
  assert.ok((await b.tree(run.folderB)).some(bookmark => bookmark.url === run.prefix + 'startup'))
  await a.update(run.idA, { syncOnStartupEnabled: false })
  await note(run.label, 'on-startup', 'The production startup listener schedules the configured account and commits its changes')

  await a.update(run.idA, { syncIntervalEnabled: true, syncInterval: 5 })
  await a.add(run.folderA, 'Timer change', run.prefix + 'interval')
  const beforeInterval = Number((await a.profile(run.idA)).data.lastSync)
  // Advance only this worker's clock; the actual browser alarm still dispatches
  // to the production listener. No five-minute wall-clock sleep is necessary.
  await a.control('clock', { offset: 6 * 60000 })
  await a.alarm()
  await a.wait(run.idA, beforeInterval)
  await b.sync(run.idB)
  assert.ok((await b.tree(run.folderB)).some(bookmark => bookmark.url === run.prefix + 'interval'))
  await a.update(run.idA, { syncIntervalEnabled: false })
  await note(run.label, 'on-interval', 'An actual Chrome alarm dispatches the due interval through the production scheduler')

  await a.update(run.idA, { enabled: true, notifyOnly: true })
  const beforeCheck = Number((await a.profile(run.idA)).data.lastSync)
  const destinationBefore = await b.tree(run.folderB)
  await a.add(run.folderA, 'Check only; no upload', run.prefix + 'notify-only')
  await a.page.waitForFunction(async id => {
    const profile = (await chrome.runtime.sendMessage({ type: 'sync:list' })).result.find(profile => profile.id === id)
    return Boolean(profile.data.pendingChanges) && !profile.data.syncing
  }, run.idA, { timeout: 30000 })
  assert.equal((await a.profile(run.idA)).data.lastSync, beforeCheck)
  await b.sync(run.idB)
  assert.deepEqual(await b.tree(run.folderB), destinationBefore)
  await a.update(run.idA, { enabled: false })
  await a.sync(run.idA); await b.sync(run.idB)
  assert.ok((await b.tree(run.folderB)).some(bookmark => bookmark.url === run.prefix + 'notify-only'))
  assert.equal((await a.profile(run.idA)).data.pendingChanges || null, null)
  await a.update(run.idA, { notifyOnly: false })
  await note(run.label, 'notify-only', 'Automatic checks report pending changes without writing; an explicit sync applies them')

  if (run.label !== 'webdav') return
  await a.update(run.idA, { enabled: false, syncOnStartupEnabled: true })
  await a.add(run.folderA, 'Retry after a temporary failure', run.prefix + 'network-retry')
  await a.control('fail-next', { count: 1 })
  const failed = await a.sync(run.idA, 'normal', true)
  assert.ok(failed.data.error)
  const attempts = await a.page.evaluate(async id => {
    let stored = (await chrome.storage.local.get('curatorSync:accounts'))['curatorSync:accounts']
    while (typeof stored === 'string') stored = JSON.parse(stored)
    if (!stored[id].isTransientError) throw new Error('Temporary transport failure must be retriable')
    return stored[id].lastAttempt
  }, run.idA)
  await a.control('online', { online: false })
  await a.alarm()
  const attemptWhileOffline = await a.page.evaluate(async id => {
    let stored = (await chrome.storage.local.get('curatorSync:accounts'))['curatorSync:accounts']
    while (typeof stored === 'string') stored = JSON.parse(stored)
    return stored[id].lastAttempt
  }, run.idA)
  assert.equal(attemptWhileOffline, attempts, 'An offline schedule check must not consume another attempt')
  const beforeRetry = Number(failed.data.lastSync)
  await a.control('online', { online: true })
  await a.wait(run.idA, beforeRetry)
  await b.sync(run.idB)
  assert.ok((await b.tree(run.folderB)).some(bookmark => bookmark.url === run.prefix + 'network-retry'))
  await a.update(run.idA, { enabled: false, syncOnStartupEnabled: false })
  await note('webdav', 'network-recovery', 'Temporary failures wait while offline and retry through the real online-event listener')

  const extraFolder = await a.folder('Sync all second profile')
  await a.add(extraFolder.id, 'Another file', run.prefix + 'sync-all-second')
  const extraId = await a.send({ type: 'sync:create', data: {
    ...run.definition, ...manual, localRoot: extraFolder.id, bookmark_file: 'sync-all-second.xbel',
  } })
  await a.add(run.folderA, 'Sync all existing profile', run.prefix + 'sync-all-first')
  const beforeAll = Number((await a.profile(run.idA)).data.lastSync)
  await a.send({ type: 'sync:run-all' })
  await a.wait(run.idA, beforeAll)
  await a.wait(extraId, 0)
  await b.sync(run.idB)
  assert.ok((await b.tree(run.folderB)).some(bookmark => bookmark.url === run.prefix + 'sync-all-first'))
  await a.send({ type: 'sync:delete', id: extraId })
  await note('webdav', 'sync-all', 'Sync all drains multiple manual profiles and persists a success for each')
}

async function runTabChecks({ a, b }, config, note) {
  const prefix = 'https://curator-qa.invalid/tabs/'
  const seed = await a.page.evaluate(async prefix => {
    const [existing] = await chrome.tabs.query({})
    await chrome.tabs.update(existing.id, { url: prefix + 'first-window' })
    const groupA = await chrome.tabs.create({ windowId: existing.windowId, url: prefix + 'group-a', active: false })
    const groupB = await chrome.tabs.create({ windowId: existing.windowId, url: prefix + 'group-b', active: false })
    const groupId = await chrome.tabs.group({ tabIds: [groupA.id, groupB.id] })
    await chrome.tabGroups.update(groupId, { title: 'Curator shared tab group' })
    const window = await chrome.windows.create({ url: prefix + 'second-window', focused: false })
    return { firstWindow: existing.windowId, secondWindow: window.id, groupId, groupA: groupA.id, groupB: groupB.id }
  }, prefix)
  const tabTree = device => device.page.evaluate(async prefix => {
    const tabs = (await chrome.tabs.query({ windowType: 'normal' })).filter(tab => tab.url.startsWith(prefix))
    const groups = await chrome.tabGroups.query({})
    return [...new Set(tabs.map(tab => tab.windowId))].map(windowId => ({
      ungrouped: tabs.filter(tab => tab.windowId === windowId && tab.groupId === -1).sort((a, b) => a.index - b.index).map(tab => tab.url),
      groups: groups.filter(group => group.windowId === windowId).map(group => ({
        title: group.title,
        urls: tabs.filter(tab => tab.groupId === group.id).sort((a, b) => a.index - b.index).map(tab => tab.url),
      })).filter(group => group.urls.length).sort((a, b) => a.title.localeCompare(b.title)),
    })).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
  }, prefix)
  const settings = {
    ...manual, type: 'webdav', url: config.base + '/dav/', username: 'curator', password: 'fixture-token',
    localRoot: 'tabs', bookmark_file: 'tab-modes.xbel', bookmark_file_type: 'xbel',
  }
  const source = await a.send({ type: 'sync:create', data: settings })
  const destination = await b.send({ type: 'sync:create', data: settings })
  const expected = await tabTree(a)
  await a.sync(source, 'upload')
  await b.sync(destination, 'download')
  assert.deepEqual(await tabTree(b), expected, 'Tab download must preserve multiple windows, group membership and order')
  await note('tabs', 'upload-download', 'Tab upload/download preserves windows, group names, membership and ordering')

  await a.page.evaluate(async ({ seed, prefix }) => {
    await chrome.tabGroups.update(seed.groupId, { title: 'Renamed shared group' })
    await chrome.tabs.move(seed.groupB, { index: 1 })
    await chrome.tabs.create({ windowId: seed.secondWindow, url: prefix + 'new-in-second-window', active: false })
  }, { seed, prefix })
  await a.sync(source); await b.sync(destination)
  assert.deepEqual(await tabTree(b), await tabTree(a), 'Incremental tab sync must preserve the target window')
  await note('tabs', 'incremental', 'Tab additions, group rename and ordering propagate without moving tabs into another window')

  await a.update(source, { strategy: 'overwrite' })
  await b.update(destination, { strategy: 'slave' })
  await a.page.evaluate(id => chrome.tabs.remove(id), seed.groupA)
  await a.sync(source)
  await b.sync(destination)
  assert.deepEqual(await tabTree(b), await tabTree(a))
  await note('tabs', 'saved-directions', 'Saved local-wins/server-wins directions propagate tab removal')
  await a.sync(source, 'force'); await b.sync(destination)
  assert.deepEqual(await tabTree(b), await tabTree(a))
  await note('tabs', 'force', 'Forced tab sync retains the configured direction and converges')
  await a.update(source, { enabled: true })
  const before = Number((await a.profile(source)).data.lastSync)
  await a.page.evaluate(async ({ windowId, prefix }) => {
    await chrome.tabs.create({ windowId, url: prefix + 'automatic', active: false })
  }, { windowId: seed.secondWindow, prefix })
  await a.wait(source, before)
  await b.sync(destination)
  assert.deepEqual(await tabTree(b), await tabTree(a))
  await note('tabs', 'automatic', 'Production tab-update events trigger automatic synchronization')
  await a.send({ type: 'sync:delete', id: source })
  await b.send({ type: 'sync:delete', id: destination })
}
