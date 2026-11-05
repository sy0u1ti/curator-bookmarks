// Runs only in the isolated HTTP test origin, before the production entry.
// It never connects to extension storage or the user's bookmark tree.
(() => {
  const event = () => {
    const listeners = new Set()
    return { addListener: fn => listeners.add(fn), removeListener: fn => listeners.delete(fn), emit: (...args) => listeners.forEach(fn => fn(...args)) }
  }
  const respond = (value, callback) => {
    const copy = structuredClone(value)
    if (callback) queueMicrotask(() => callback(copy))
    return Promise.resolve(copy)
  }
  const bookmark = (id, title, url, parentId, index) => ({ id, title, url, parentId, index, dateAdded: 1780000000000 })
  const folder = (id, title, children) => ({ id, title, parentId: '1', children, dateAdded: 1780000000000, dateGroupModified: 1780000000000 })
  const tree = [{ id: '0', title: '', children: [
    { id: '1', title: '书签栏', parentId: '0', children: [
      folder('10', '工作', ['项目文档', '代码仓库', '设计规范', '任务看板'].map((title, index) => bookmark(String(101 + index), title, `https://work.example.test/${index}`, '10', index))),
      folder('20', '阅读', ['技术文章', '产品笔记', '网页收藏', '阅读清单'].map((title, index) => bookmark(String(201 + index), title, `https://read.example.test/${index}`, '20', index)))
    ] },
    { id: '2', title: '其他书签', parentId: '0', children: [] }
  ] }]
  const flatten = nodes => nodes.flatMap(node => [node, ...flatten(node.children || [])])
  const all = () => flatten(tree)
  const storageKey = 'curator-glass-fixture-storage'
  const defaults = {
    curatorBookmarkOnboardingState: { completed: true, dismissed: true },
    curatorBookmarkNewTabBackgroundSettings: { type: 'urls', color: '#101013', url: `${location.origin}/wallpaper.svg`, maskEnabled: false },
    curatorBookmarkNewTabTimeSettings: { enabled: true },
    curatorBookmarkNewTabSearchSettings: { enabled: true, height: 48, width: 48, autoVerticalCenter: false, webSearchEnabled: true, engine: 'google' },
    curatorBookmarkNewTabFolderSettings: { selectedFolderIds: ['10', '20'], hideFolderNames: false },
    curatorBookmarkNewTabModuleSettings: { version: 1, speedDial: true, order: ['speedDial'] },
    curatorBookmarkNewTabWorkspaceSettings: { activeWorkspaceId: 'default', workspaces: [{ id: 'default', name: '固定入口', pinnedIds: ['101', '201'] }] },
    curatorModelsDevSync: { autoUpdate: false }
  }
  let stored = {}
  try { stored = JSON.parse(localStorage.getItem(storageKey) || '{}') } catch {}
  const data = { ...defaults, ...stored }
  const fixture = window.__glassFixture = { data, tree, errors: [], calls: [], workers: [], failGlassSaves: false, frames: [] }
  addEventListener('error', error => fixture.errors.push(error.message))
  addEventListener('unhandledrejection', error => fixture.errors.push(String(error.reason)))
  const NativeWorker = Worker
  window.Worker = class extends NativeWorker {
    constructor(url, options) {
      fixture.workers.push(String(url))
      if (new URL(location.href).searchParams.has('worker-error')) throw new Error('Fixture: Workers unavailable')
      super(url, options)
    }
  }
  const changed = event()
  const storage = {
    get(keys, callback) {
      const names = typeof keys === 'string' ? [keys] : Array.isArray(keys) ? keys : keys ? Object.keys(keys) : Object.keys(data)
      return respond(Object.fromEntries(names.map(key => [key, data[key] ?? (keys && !Array.isArray(keys) && typeof keys === 'object' ? keys[key] : undefined)])), callback)
    },
    set(values, callback) {
      if (fixture.failGlassSaves && 'curatorBookmarkNewTabGlassSettings' in values) {
        queueMicrotask(() => {
          chrome.runtime.lastError = { message: 'Fixture: settings storage unavailable' }
          callback?.()
          delete chrome.runtime.lastError
        })
        return Promise.resolve()
      }
      const changes = Object.fromEntries(Object.entries(values).map(([key, newValue]) => [key, { oldValue: data[key], newValue }]))
      Object.assign(data, structuredClone(values))
      localStorage.setItem(storageKey, JSON.stringify(data))
      queueMicrotask(() => changed.emit(changes, 'local'))
      return respond(undefined, callback)
    },
    remove(keys, callback) {
      const changes = {}
      for (const key of typeof keys === 'string' ? [keys] : keys) {
        changes[key] = { oldValue: data[key] }
        delete data[key]
      }
      localStorage.setItem(storageKey, JSON.stringify(data))
      queueMicrotask(() => changed.emit(changes, 'local'))
      return respond(undefined, callback)
    },
    getBytesInUse: (_keys, callback) => respond(JSON.stringify(data).length, callback)
  }
  const bookmarks = {
    getTree: callback => respond(tree, callback),
    get: (ids, callback) => respond(all().filter(node => (Array.isArray(ids) ? ids : [ids]).includes(node.id)), callback),
    getChildren: (id, callback) => respond(all().find(node => node.id === id)?.children || [], callback),
    getSubTree: (id, callback) => respond(all().filter(node => node.id === id), callback),
    getRecent: (count, callback) => respond(all().filter(node => node.url).slice(0, count), callback),
    search: (query, callback) => respond(all().filter(node => typeof query === 'string' ? `${node.title} ${node.url || ''}`.includes(query) : Object.entries(query).every(([key, value]) => node[key] === value)), callback),
    update: (id, values, callback) => {
      const node = all().find(node => node.id === id)
      Object.assign(node, values)
      queueMicrotask(() => bookmarks.onChanged.emit(id, values))
      return respond(node, callback)
    }
  }
  for (const name of ['onCreated', 'onRemoved', 'onChanged', 'onMoved', 'onChildrenReordered', 'onImportBegan', 'onImportEnded']) bookmarks[name] = event()
  const activeTab = { id: 1, windowId: 1, title: '项目文档', url: 'https://work.example.test/0', active: true }
  window.chrome = {
    runtime: {
      id: 'curator-glass-fixture',
      getURL: resource => `${location.origin}/${resource.replace(/^\//, '')}`,
      getManifest: () => ({ name: 'Curator', version: '1.5.3' }),
      onMessage: event(),
      sendMessage: (message, callback) => { fixture.calls.push(message); return respond({ ok: false, error: 'Unavailable in the glass fixture' }, callback) },
      openOptionsPage: callback => respond(undefined, callback)
    },
    bookmarks,
    storage: { local: storage, session: storage, sync: storage, onChanged: changed },
    tabs: {
      query: (_query, callback) => respond([activeTab], callback),
      get: (_id, callback) => respond(activeTab, callback),
      create: (props, callback) => respond({ ...activeTab, ...props }, callback),
      update: (_id, props, callback) => respond({ ...activeTab, ...props }, callback),
      onActivated: event(), onUpdated: event(), onRemoved: event()
    },
    windows: { getCurrent: callback => respond({ id: 1 }, callback), onFocusChanged: event() },
    permissions: { contains: (_query, callback) => respond(true, callback), onAdded: event(), onRemoved: event() },
    commands: { getAll: callback => respond([], callback) },
    action: { setBadgeText: (_props, callback) => respond(undefined, callback) },
    sidePanel: { open: (_props, callback) => respond(undefined, callback) },
    i18n: { getUILanguage: () => 'zh-CN' }
  }
  const sample = () => {
    const element = document.querySelector('.newtab-search-surface')
    if (element) {
      const css = getComputedStyle(element)
      const next = { renderer: element.dataset.glassRenderer, material: css.backdropFilter, background: css.backgroundColor, radius: css.borderRadius }
      if (JSON.stringify(fixture.frames.at(-1)) !== JSON.stringify(next)) fixture.frames.push(next)
    }
    if (performance.now() < 2000) requestAnimationFrame(sample)
    else fixture.sampled = true
  }
  requestAnimationFrame(sample)
})()
