import assert from 'node:assert/strict'
import { after, before, beforeEach, test } from 'node:test'
import { mkdtemp } from 'node:fs/promises'
import path from 'node:path'
import { build } from 'esbuild'
import { createSyncProtocolServer } from '../../../sync-protocol-fixtures.mjs'

const bundled = await build({
  stdin: {
    contents: `
      export { default as Adapter } from './src/vendor/floccus/src/lib/adapters/Linkwarden.ts'
      export { Bookmark, ItemLocation } from './src/vendor/floccus/src/lib/Tree.ts'
    `,
    resolveDir: process.cwd(),
  },
  bundle: true, platform: 'node', format: 'esm', write: false,
  define: { IS_BROWSER: 'true' },
  tsconfigRaw: { compilerOptions: { useDefineForClassFields: false } },
  plugins: [{
    name: 'linkwarden-test-host',
    setup(builder) {
      builder.onResolve({ filter: /^@capacitor\/core$/ }, () => ({
        path: path.resolve('src/vendor/floccus/curator/shims/capacitor.ts'),
      }))
      builder.onResolve({ filter: /^\.{1,2}\/(?:Logger|browser-api)$/ }, arguments_ => ({
        path: arguments_.path.endsWith('Logger') ? 'logger' : 'browser',
        namespace: 'linkwarden-test',
      }))
      builder.onLoad({ filter: /.*/, namespace: 'linkwarden-test' }, arguments_ => ({
        contents: arguments_.path === 'logger'
          ? 'export default { log() {} }'
          : 'export default { permissions: { async contains() { return true } }, storage: { local: { async get(defaults) { return defaults } } } }',
      }))
    },
  }],
})
const { Adapter, Bookmark, ItemLocation } = await import(
  `data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`
)
let server
const originalTimeout = globalThis.setTimeout
const requestTimeouts = new Set()
const collections = [
  { id: 10, name: 'Curator', parentId: null, ownerId: 1, createdAt: '2026-01-01T00:00:00Z' },
  { id: 20, name: 'First folder', parentId: 10, ownerId: 1, createdAt: '2026-01-02T00:00:00Z' },
  { id: 21, name: 'Second folder', parentId: 10, ownerId: 1, createdAt: '2026-01-03T00:00:00Z' },
]
const links = [101, 102, 103].map((id, index) => ({
  id, name: `Link ${id}`, url: `https://fixture.invalid/${id}`, collectionId: 10,
  collectionOrder: 3 - index, tags: [{ name: 'remote tag' }],
}))
const control = async (action, values = {}) => {
  const response = await fetch(`${server.base}/__qa/fixture`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${server.controlToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider: 'linkwarden', action, ...values }),
  })
  assert.equal(response.ok, true)
  return response.json()
}
const createAdapter = (settings = {}) => new Adapter({
  ...Adapter.getDefaultValues(), url: `${server.base}/linkwarden`,
  serverFolder: 'Curator', password: 'fixture-token', syncOrder: true, ...settings,
})
const ordering = ids => ids.map(id => ({ type: 'bookmark', id }))
const remoteOrder = async (collectionId = 10) => (await control('read')).links
  .filter(link => String(link.collectionId) === String(collectionId))
  .sort((first, second) => second.collectionOrder - first.collectionOrder)
  .map(link => Number(link.id))

before(async () => {
  globalThis.setTimeout = (callback, delay, ...arguments_) => {
    const timer = originalTimeout(callback, delay, ...arguments_)
    if (delay === 300000) requestTimeouts.add(timer)
    return timer
  }
  const directory = await mkdtemp(path.resolve('.tmp-test/linkwarden-order-'))
  server = await createSyncProtocolServer(directory, { controls: true })
})
beforeEach(async () => {
  await control('configure', {
    version: '2.17.0', collections, links,
    user: { id: 1, name: 'Fixture user', collectionOrder: [999, 20, 21, 888], theme: 'dark' },
  })
})
after(async () => {
  await server?.close()
  for (const timer of requestTimeouts) clearTimeout(timer)
  globalThis.setTimeout = originalTimeout
  assert.deepEqual(server?.unexpected, [])
})

test('Linkwarden reads collection and link order and writes only the necessary link moves', async () => {
  const adapter = createAdapter()
  await adapter.onSyncStart()
  const tree = await adapter.getBookmarksTree()
  assert.equal((await adapter.getCapabilities()).preserveOrder, true)
  assert.deepEqual(tree.children.map(item => Number(item.id)), [20, 21, 101, 102, 103])
  const before = server.requests.length
  await adapter.orderFolder(10, ordering([103, 101, 102]))
  assert.deepEqual(await remoteOrder(), [103, 101, 102])
  assert.equal(server.requests.slice(before).filter(request => request.route.endsWith('/order')).length, 1)
  const unchanged = server.requests.length
  await adapter.orderFolder(10, ordering([103, 101, 102]))
  assert.equal(server.requests.slice(unchanged).filter(request => request.route.endsWith('/order')).length, 0)
})

test('legacy and disabled Linkwarden profiles do not probe or rewrite order', async () => {
  for (const syncOrder of [undefined, false]) {
    const adapter = createAdapter({ syncOrder })
    const before = server.requests.length
    await adapter.onSyncStart()
    assert.equal((await adapter.getCapabilities()).preserveOrder, false)
    assert.equal('orderFolder' in adapter, false)
    assert.equal(server.requests.slice(before).filter(request => request.route.endsWith('/config')).length, 0)
  }
})

test('Linkwarden older than 2.17 disables order without failing synchronization', async () => {
  await control('configure', { version: '2.16.2' })
  const adapter = createAdapter()
  await adapter.onSyncStart()
  assert.equal((await adapter.getCapabilities()).preserveOrder, false)
  assert.equal('orderFolder' in adapter, false)
  assert.equal((await adapter.getBookmarksTree()).count(), 3)
})

test('unknown Linkwarden versions use link metadata and retain compatibility with older servers', async () => {
  await control('configure', { version: null })
  const modern = createAdapter()
  await modern.onSyncStart()
  assert.equal((await modern.getCapabilities()).preserveOrder, true)
  await control('configure', { version: 'unknown', links: links.map(({ collectionOrder, ...link }) => link) })
  const legacy = createAdapter()
  await legacy.onSyncStart()
  assert.equal((await legacy.getCapabilities()).preserveOrder, false)
})

test('an initially empty unknown server preserves the order of concurrently created links', async () => {
  await control('configure', { version: null, links: [] })
  const adapter = createAdapter()
  await adapter.onSyncStart()
  await adapter.getBookmarksTree()
  const ids = await Promise.all(['first', 'second', 'third'].map(title => adapter.createBookmark(new Bookmark({
    title, url: `https://fixture.invalid/${title}`, parentId: 10, location: ItemLocation.SERVER,
  }))))
  await adapter.orderFolder(10, ordering(ids))
  assert.deepEqual(await remoteOrder(), ids.map(Number))
})

test('concurrent collection reorders preserve unrelated collections and user settings', async () => {
  await control('configure', { user: { collectionOrder: [999, 20, 21, 888, 30, 31], theme: 'dark' } })
  const adapter = createAdapter()
  await adapter.onSyncStart()
  await Promise.all([
    adapter.orderFolder(10, [{ type: 'folder', id: 21 }, { type: 'folder', id: 20 }]),
    adapter.orderFolder(50, [{ type: 'folder', id: 31 }, { type: 'folder', id: 30 }]),
  ])
  const { user } = await control('read')
  assert.deepEqual(user.collectionOrder, [999, 21, 20, 888, 31, 30])
  assert.equal(user.theme, 'dark')
  assert.equal(user.name, 'Fixture user')
})

test('moving links preserves remote tags and orders them in the destination collection', async () => {
  const adapter = createAdapter()
  await adapter.onSyncStart()
  await adapter.getBookmarksTree()
  for (const id of [101, 102]) {
    await adapter.updateBookmark(new Bookmark({
      id, title: `Link ${id}`, url: `https://fixture.invalid/${id}`,
      parentId: 20, location: ItemLocation.SERVER,
    }))
  }
  await adapter.orderFolder(20, ordering([101, 102]))
  assert.deepEqual(await remoteOrder(20), [101, 102])
  const remote = (await control('read')).links.find(link => Number(link.id) === 101)
  assert.deepEqual(remote.tags, [{ name: 'remote tag' }])
})

test('a link already deleted remotely is removed from subsequent ordering requests', async () => {
  const adapter = createAdapter()
  await adapter.onSyncStart()
  const tree = await adapter.getBookmarksTree()
  await control('configure', { links: links.filter(link => link.id !== 103) })
  await adapter.removeBookmark(tree.findBookmark(103))
  const before = server.requests.length
  await adapter.orderFolder(10, ordering([103, 102, 101]))
  assert.deepEqual(await remoteOrder(), [102, 101])
  assert.ok(!server.requests.slice(before).some(request => request.route.endsWith('/links/103/order')))
})

test('disabling order after an ordered run removes the adapter capability', async () => {
  const adapter = createAdapter()
  await adapter.onSyncStart()
  assert.equal((await adapter.getCapabilities()).preserveOrder, true)
  adapter.setData({ ...adapter.getData(), syncOrder: false })
  await adapter.onSyncStart()
  assert.equal((await adapter.getCapabilities()).preserveOrder, false)
  assert.equal('orderFolder' in adapter, false)
})
