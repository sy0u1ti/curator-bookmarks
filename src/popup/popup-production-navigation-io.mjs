// Runs only in the isolated HTTP fixture. Never installs an extension, accesses
// the browser's real Chrome APIs, or performs a real bookmark/tab mutation.
const params = new URL(document.baseURI).searchParams
const count = Math.min(50000, Math.max(100, Number(params.get('count')) || 10000))
const callbacks = new Map()
const event = () => {
  const listeners = new Set()
  return { addListener: listener => listeners.add(listener), removeListener: listener => listeners.delete(listener),
    emit: (...args) => listeners.forEach(listener => listener(...args)) }
}
const result = (value, callback) => {
  if (typeof callback === 'function') queueMicrotask(() => callback(value))
  return Promise.resolve(value)
}
const nodes = new Map()
const entries = Array.from({ length: count }, (_, i) => ({
  id: String(100 + i), parentId: '1', index: i, dateAdded: 1735689600000 + i * 1000,
  title: `Reference ${String(i + 1).padStart(5, '0')} - Typography and interaction design`,
  url: `https://example.test/reference/${i}`
}))
const folders = Array.from({ length: count }, (_, i) => ({
  id: String(100000 + i), parentId: '1', index: count + i, dateAdded: 1735689600000,
  title: `Folder ${String(i + 1).padStart(5, '0')}`, children: []
}))
const bar = { id: '1', parentId: '0', title: 'Bookmarks', folderType: 'bookmarks-bar', children: [...entries, ...folders] }
const tree = [{ id: '0', title: '', children: [bar, { id: '2', parentId: '0', title: 'Other bookmarks', children: [] }] }]
for (const node of [...entries, ...folders, bar, tree[0], tree[0].children[1]]) nodes.set(node.id, node)
const values = {
  curatorBookmarkContentSnapshotSettings: {
    version: 1, enabled: false, autoCaptureOnBookmarkCreate: false,
    saveFullText: false, fullTextSearchEnabled: false, localOnlyNoAiUpload: true
  }
}
const currentTab = { id: 99, active: true, windowId: 1, title: 'Current page', url: 'https://example.test/current' }
const changed = event()
const forbidden = name => () => { throw new Error(`Fixture blocked unexpected write: ${name}`) }
window.__io = { opens: [], closes: 0, callbacks }
window.close = () => { window.__io.closes++ }
window.chrome = {
  runtime: {
    id: 'curator-navigation-fixture',
    getURL: path => window.__curatorFixtureIcon && /(?:_favicon|assets\/icon\d+\.png)/.test(path)
      ? window.__curatorFixtureIcon : new URL(`/${path}`, document.baseURI).href,
    getManifest: () => ({ version: '1.5.3' }), onMessage: event(),
    sendMessage: (_, callback) => result({ ok: true }, callback)
  },
  bookmarks: {
    getTree: callback => result(tree, callback),
    get: (id, callback) => result([nodes.get(String(id))].filter(Boolean), callback),
    getSubTree: (id, callback) => result([nodes.get(String(id))].filter(Boolean), callback),
    create: forbidden('bookmarks.create'), remove: forbidden('bookmarks.remove'),
    removeTree: forbidden('bookmarks.removeTree'), update: forbidden('bookmarks.update'), move: forbidden('bookmarks.move'),
    onCreated: event(), onRemoved: event(), onChanged: event(), onMoved: event(),
    onChildrenReordered: event(), onImportEnded: event()
  },
  storage: {
    onChanged: changed,
    local: {
      get: (keys, callback) => result(keys === null ? { ...values }
        : Object.fromEntries((Array.isArray(keys) ? keys : typeof keys === 'object' ? Object.keys(keys) : [keys])
          .map(key => [key, values[key] ?? (typeof keys === 'object' && !Array.isArray(keys) ? keys[key] : undefined)])), callback),
      set: (data, callback) => { Object.assign(values, data); return result(undefined, callback) },
      remove: (keys, callback) => { for (const key of Array.isArray(keys) ? keys : [keys]) delete values[key]; return result(undefined, callback) },
      getBytesInUse: (_, callback) => result(0, callback)
    }
  },
  tabs: {
    query: (_, callback) => result([currentTab], callback), get: (_, callback) => result(currentTab, callback),
    create: (details, callback) => { window.__io.opens.push(details); return result({ id: 100, ...details }, callback) },
    update: (id, details, callback) => { window.__io.opens.push({ id, ...details }); return result({ id, ...details }, callback) },
    onActivated: event(), onUpdated: event()
  },
  permissions: { contains: (_, callback) => result(false, callback), request: (_, callback) => result(false, callback) },
  windows: { getCurrent: callback => result({ id: 1 }, callback), update: (_, __, callback) => result({}, callback), onFocusChanged: event() },
  action: { setBadgeText: (_, callback) => result(undefined, callback), setBadgeBackgroundColor: (_, callback) => result(undefined, callback) },
  commands: { getAll: callback => result([], callback) }
}
