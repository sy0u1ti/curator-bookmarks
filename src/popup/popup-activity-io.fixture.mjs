// Installed before the production entry on an isolated localhost origin.
// All bookmarks, tabs and storage below belong to this fixture.
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
  const fail = (message, callback) => {
    queueMicrotask(() => {
      chrome.runtime.lastError = { message }
      callback?.()
      delete chrome.runtime.lastError
    })
    return Promise.resolve()
  }
  const titles = ['Agent Router', 'Any Router', 'Aileader', 'Krill AI', '产品设计', '动效参考', '开发文档', '阅读清单']
  const children = Array.from({ length: 24 }, (_, i) => ({
    id: String(101 + i), parentId: '10', index: i, title: titles[i] || `设计参考 ${i + 1}`,
    url: `https://reference.example.test/${i}`, dateAdded: 1780000000000
  }))
  const tree = [{ id: '0', title: '', children: [
    { id: '1', title: '书签栏', parentId: '0', children: [
      { id: '10', title: 'AI API', parentId: '1', children },
      { id: '20', title: '阅读', parentId: '1', children: [] }
    ] },
    { id: '2', title: '其他书签', parentId: '0', children: [] }
  ] }]
  const flatten = nodes => nodes.flatMap(node => [node, ...flatten(node.children || [])])
  const all = () => flatten(tree)
  const data = {
    curatorBookmarkOnboardingState: { completed: true, dismissed: true },
    curatorBookmarkAiNamingSettings: { autoAnalyzeBookmarks: false },
    curatorBookmarkContentSnapshotSettings: { enabled: false },
    curatorModelsDevSync: { autoUpdate: false }
  }
  let nextId = 1000
  const activeTab = { id: 77, windowId: 1, active: true, title: 'magpie', url: 'https://current.example.test/' }
  const fixture = window.__popupFixture = {
    tree, data, activeTab, errors: [], calls: [], restoreCalls: 0, closeCalls: 0,
    holdRestore: false, releaseRestore: null, failRestore: false, failRead: false, failDelete: false,
    failMove: false, failSave: false, all,
    switchTab(title, url) {
      Object.assign(activeTab, { id: activeTab.id + 1, title, url })
      chrome.tabs.onActivated.emit({ tabId: activeTab.id, windowId: 1 })
    }
  }
  window.close = () => { fixture.closeCalls++ }
  addEventListener('error', event => fixture.errors.push(event.message))
  addEventListener('unhandledrejection', event => fixture.errors.push(String(event.reason)))
  const changed = event()
  const storage = {
    get(keys, callback) {
      const names = typeof keys === 'string' ? [keys] : Array.isArray(keys) ? keys : keys ? Object.keys(keys) : Object.keys(data)
      return respond(Object.fromEntries(names.map(key => [key, data[key]])), callback)
    },
    set(values, callback) {
      const changes = Object.fromEntries(Object.entries(values).map(([key, newValue]) => [key, { oldValue: data[key], newValue }]))
      Object.assign(data, structuredClone(values))
      queueMicrotask(() => changed.emit(changes, 'local'))
      return respond(undefined, callback)
    },
    remove(keys, callback) {
      const changes = {}
      for (const key of typeof keys === 'string' ? [keys] : keys) {
        changes[key] = { oldValue: data[key] }
        delete data[key]
      }
      queueMicrotask(() => changed.emit(changes, 'local'))
      return respond(undefined, callback)
    },
    getBytesInUse: (_, callback) => respond(JSON.stringify(data).length, callback)
  }
  const bookmarks = {
    getTree: callback => fixture.failRead ? fail('测试读取失败：请重试。'.repeat(20), callback) : respond(tree, callback),
    get: (ids, callback) => respond(all().filter(node => (Array.isArray(ids) ? ids : [ids]).includes(node.id)), callback),
    getChildren: (id, callback) => respond(all().find(node => node.id === id)?.children || [], callback),
    getSubTree: (id, callback) => respond(all().filter(node => node.id === id), callback),
    getRecent: (count, callback) => respond(all().filter(node => node.url).slice(0, count), callback),
    search: (query, callback) => respond(all().filter(node => typeof query === 'string' ? `${node.title} ${node.url || ''}`.includes(query) : Object.entries(query).every(([key, value]) => node[key] === value)), callback),
    create(values, callback) {
      fixture.restoreCalls++
      if (fixture.failRestore) {
        fixture.failRestore = false
        return fail('测试恢复失败：记录仍可恢复。', callback)
      }
      const create = () => {
        const parent = all().find(node => node.id === (values.parentId || '1'))
        const item = { ...values, id: String(nextId++), parentId: parent.id, dateAdded: Date.now() }
        if (!item.url) item.children = []
        parent.children.splice(Math.min(values.index ?? parent.children.length, parent.children.length), 0, item)
        parent.children.forEach((node, index) => { node.index = index })
        queueMicrotask(() => bookmarks.onCreated.emit(item.id, item))
        return respond(item, callback)
      }
      if (fixture.holdRestore) return new Promise(resolve => {
        fixture.releaseRestore = () => { fixture.holdRestore = false; fixture.releaseRestore = null; create().then(resolve) }
      })
      return create()
    },
    remove(id, callback) {
      if (fixture.failDelete) return fail('测试删除失败，请重试。', callback)
      const item = all().find(node => node.id === id)
      if (!item) return fail('书签不存在', callback)
      const parent = all().find(node => node.id === item.parentId)
      parent.children.splice(parent.children.indexOf(item), 1)
      parent.children.forEach((node, index) => { node.index = index })
      queueMicrotask(() => bookmarks.onRemoved.emit(id, { parentId: parent.id, node: item }))
      return respond(undefined, callback)
    },
    update(id, values, callback) {
      const node = all().find(node => node.id === id)
      Object.assign(node, values)
      queueMicrotask(() => bookmarks.onChanged.emit(id, values))
      return respond(node, callback)
    },
    move(id, values, callback) {
      if (fixture.failMove) return fail('测试移动失败，请重试。', callback)
      const node = all().find(item => item.id === id)
      const old = all().find(item => item.id === node.parentId)
      const parent = all().find(item => item.id === values.parentId)
      old.children.splice(old.children.indexOf(node), 1)
      parent.children.splice(values.index ?? parent.children.length, 0, node)
      node.parentId = parent.id
      queueMicrotask(() => bookmarks.onMoved.emit(id, values))
      return respond(node, callback)
    }
  }
  for (const name of ['onCreated', 'onRemoved', 'onChanged', 'onMoved', 'onChildrenReordered', 'onImportBegan', 'onImportEnded']) bookmarks[name] = event()
  window.chrome = {
    runtime: {
      id: 'curator-popup-activity-fixture',
      getURL: resource => `${location.origin}/${resource.replace(/^\//, '')}`,
      getManifest: () => ({ name: 'Curator', version: '1.5.3' }), onMessage: event(),
      sendMessage(message, callback) {
        fixture.calls.push(message)
        if (message.type === 'bookmark:save') {
          if (fixture.failSave) return respond({ ok: false, error: '测试保存失败' }, callback)
          const parentId = message.parentId || '1'
          return bookmarks.create({ title: message.title, url: message.url, parentId }, node =>
            respond({ ok: true, result: { bookmarkId: node.id, parentId, url: node.url, title: node.title, created: true } }, callback))
        }
        return respond({ ok: false, error: '测试环境未配置 AI' }, callback)
      },
      openOptionsPage: callback => respond(undefined, callback)
    },
    bookmarks, storage: { local: storage, session: storage, sync: storage, onChanged: changed },
    tabs: {
      query: (_, callback) => respond([activeTab], callback),
      get: (_, callback) => respond(activeTab, callback),
      create: (props, callback) => respond({ ...activeTab, ...props }, callback),
      update: (_, props, callback) => respond({ ...activeTab, ...props }, callback),
      onActivated: event(), onUpdated: event(), onRemoved: event()
    },
    windows: { getCurrent: callback => respond({ id: 1 }, callback), onFocusChanged: event() },
    permissions: { contains: (_, callback) => respond(true, callback), onAdded: event(), onRemoved: event() },
    commands: { getAll: callback => respond([], callback) },
    i18n: { getUILanguage: () => 'zh-CN' }
  }
})()
