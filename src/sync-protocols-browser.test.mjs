import assert from 'node:assert/strict'
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'
import { createSyncProtocolServer } from './sync-protocol-fixtures.mjs'

// Ego workspaces share bookmark/extension storage with the current profile.
// This destructive protocol test uses only a copied extension and a throwaway
// Chromium profile; the UI tests stay in the agent-owned Ego workspace.
const testRoot = path.resolve('.tmp-test')
await mkdir(testRoot, { recursive: true })
const directory = await mkdtemp(path.join(testRoot,'sync-protocols-'))
const extension = path.join(directory,'extension')
await cp(path.resolve('dist'),extension,{ recursive: true })
const manifestPath = path.join(extension,'manifest.json')
const manifest = JSON.parse(await readFile(manifestPath,'utf8'))
manifest.permissions = [...new Set([...manifest.permissions,'tabs','tabGroups','identity','history'])]
manifest.optional_permissions = manifest.optional_permissions.filter(permission => !manifest.permissions.includes(permission))
manifest.host_permissions = ['http://127.0.0.1/*','https://*.googleapis.com/*','https://*.dropbox.com/*','https://*.dropboxapi.com/*']
await writeFile(manifestPath,JSON.stringify(manifest))
const server = await createSyncProtocolServer(directory)
let context
const results = []
try {
  context = await chromium.launchPersistentContext(path.join(directory,'profile'), {
    channel: 'chromium', headless: true, args: [`--load-extension=${extension}`,`--disable-extensions-except=${extension}`]
  })
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker')
  await worker.evaluate(base => {
    const originalFetch = globalThis.fetch.bind(globalThis)
    globalThis.fetch = (input, init) => {
      const url = new URL(typeof input === 'string' ? input : input.url || String(input))
      if (/(googleapis|dropbox|dropboxapi)\.com$/.test(url.hostname)) return originalFetch(base + '/oauth/' + url.hostname + url.pathname + url.search, init)
      return originalFetch(input,init)
    }
    chrome.identity.launchWebAuthFlow = async ({ url }) => {
      const auth = new URL(url)
      if (auth.searchParams.get('code_challenge_method') !== 'S256') throw new Error('Missing OAuth PKCE')
      if (globalThis.__oauthFailure === 'cancel') throw new Error('User cancelled fixture authorization')
      if (globalThis.__oauthFailure === 'state') return chrome.identity.getRedirectURL() + '?code=fixture-code&state=wrong'
      return chrome.identity.getRedirectURL() + '?code=fixture-code&state=' + encodeURIComponent(auth.searchParams.get('state'))
    }
  },server.base)
  const page = await context.newPage()
  await page.goto(`chrome-extension://${new URL(worker.url()).host}/src/options/options.html#backup`)
  await page.evaluate(() => chrome.storage.local.set({ curatorBookmarkAiNamingSettings: { autoAnalyzeBookmarks: false } }))
  const send = message => page.evaluate(async message => {
    const reply = await chrome.runtime.sendMessage(message)
    if (!reply?.ok) throw new Error(reply?.error || 'No response')
    return reply.result
  },message)
  const sync = async id => {
    const previous = (await send({ type: 'sync:list' })).find(item => item.id === id)?.data.lastSync
    await send({ type: 'sync:run', id, mode: 'normal' })
    for (let count=0;count<200;count++) {
      const profile = (await send({ type: 'sync:list' })).find(item => item.id === id)
      if (!profile.data.syncing && !profile.data.scheduled && (profile.data.lastSync !== previous || profile.data.error)) {
        assert.equal(profile.data.error || null,null, `${profile.data.type}: ${profile.data.error}`)
        return profile
      }
      await page.waitForTimeout(100)
    }
    throw new Error('Sync did not settle: '+id)
  }
  const folder = title => page.evaluate(title => chrome.bookmarks.create({ parentId: '1', title }),title)
  const add = (parentId,title,url) => page.evaluate(details => chrome.bookmarks.create(details),{parentId,title,url})
  const urls = root => page.evaluate(async root => {
    const collect = node => node.url ? [node.url] : (node.children||[]).flatMap(collect)
    return collect((await chrome.bookmarks.getSubTree(root))[0]).sort()
  },root)
  const definitions = [
    { type: 's3', url: server.base+'/s3/', region: 'us-east-1', bucket: 'bookmarks', pathStyle: true, username: 'fixture-access' },
    { type: 'git', url: server.base+'/git/sync.git', branch: 'main', username: 'curator' },
    { type: 'linkwarden', url: server.base+'/linkwarden', serverFolder: 'Curator' },
    { type: 'karakeep', url: server.base+'/karakeep', serverFolder: 'Curator' },
    { type: 'nextcloud-bookmarks', url: server.base+'/nextcloud', serverRoot: '', username: 'curator' }
  ]
  for (const type of ['s3', 'git']) {
    definitions.push({ ...definitions.find(item => item.type === type), bookmark_file: 'bookmarks.html', bookmark_file_type: 'html' })
  }
  definitions.push({ ...definitions.find(item => item.type === 's3'), bookmark_file: 'encrypted.xbel', passphrase: 'fixture-encryption' })
  for (const adapter of ['google-drive','dropbox']) {
    const result = await send({ type:'sync:authorize',adapter,client:{clientId:'fixture-client',clientSecret:'fixture-secret'} })
    assert.equal(result.refreshToken,'fixture-refresh')
    assert.match(result.username,/Fixture/)
    const savedClient = (await send({type:'sync:oauth-settings'})).clients[adapter]
    for (const failure of ['cancel','state']) {
      await worker.evaluate(failure => { globalThis.__oauthFailure=failure },failure)
      await assert.rejects(send({type:'sync:authorize',adapter,client:{clientId:'wrong-client',clientSecret:'wrong-secret'}}))
      assert.deepEqual((await send({type:'sync:oauth-settings'})).clients[adapter],savedClient,'failed authorization must preserve the working client')
    }
    await worker.evaluate(() => { globalThis.__oauthFailure=null })
    definitions.push({type:adapter,refreshToken:result.refreshToken,username:result.username})
    results.push(`${adapter}: PKCE authorization, token exchange and account lookup (mocked)`)
    console.log('PASS '+results.at(-1))
  }
  const selected = process.argv.find(arg => arg.startsWith('--adapters='))?.slice(11).split(',')
  for (const definition of definitions.filter(item=>!selected || selected.includes(item.type))) {
    const data = {
      password: 'fixture-token', bookmark_file: 'bookmarks.xbel', bookmark_file_type: 'xbel',
      enabled: false, syncIntervalEnabled: false, syncOnStartupEnabled: false, failsafe: false, ...definition
    }
    const a = await folder(definition.type+' source'), b = await folder(definition.type+' destination')
    const firstUrl = `https://example.com/${definition.type}/first`, secondUrl = `https://example.com/${definition.type}/second`
    await add(a.id,'First bookmark',firstUrl)
    if (!['git','google-drive','dropbox'].includes(definition.type)) await send({type:'sync:test',data})
    const source = await send({type:'sync:create',data:{...data,localRoot:a.id}})
    const destination = await send({type:'sync:create',data:{...data,localRoot:b.id}})
    await sync(source)
    await sync(destination)
    assert.deepEqual(await urls(b.id),[firstUrl], definition.type+' initial round trip')
    const added = await add(a.id,'Second bookmark',secondUrl)
    await sync(source); await sync(destination)
    assert.deepEqual(await urls(b.id),[firstUrl,secondUrl], definition.type+' incremental addition')
    await page.evaluate(id => chrome.bookmarks.remove(id),added.id)
    await sync(source); await sync(destination)
    assert.deepEqual(await urls(b.id),[firstUrl], definition.type+' incremental deletion')
    await send({type:'sync:delete',id:source}); await send({type:'sync:delete',id:destination})
    results.push(`${definition.type} (${definition.bookmark_file_type || 'xbel'}${definition.passphrase ? ', encrypted' : ''}): initial download, incremental upload and deletion`)
    console.log('PASS '+results.at(-1))
  }
  assert.deepEqual(server.unexpected,[])
  await mkdir(path.resolve('output/sync'),{recursive:true})
  await writeFile(path.resolve('output/sync/protocols.json'),JSON.stringify({ results,requests:server.requests.map(({method,route})=>({method,route})), boundary:'Local protocol fixtures. No real provider account was contacted.' },null,2))
} catch (error) {
  console.error({ results,unexpected:server.unexpected,requests:server.requests.slice(-12) })
  throw error
} finally {
  await context?.close()
  await server.close()
  assert.ok(directory.startsWith(testRoot+path.sep))
  await rm(directory,{recursive:true,force:true})
}
