// Synthetic, page-local Chrome APIs. This fixture cannot reach the installed extension.
const event = () => {
  const listeners = new Set()
  return { addListener: fn => listeners.add(fn), removeListener: fn => listeners.delete(fn),
    emit: (...args) => { for (const fn of listeners) fn(...args) } }
}
const clone = value => value === undefined ? undefined : structuredClone(value)
const done = (value, callback) => {
  if (callback) queueMicrotask(() => callback(clone(value)))
  return Promise.resolve(clone(value))
}
const records = [
  ['review', '站点待验证', 'https://verify.example.net/page'],
  ['failed', '已移除的文档', 'https://missing.example.net/page'],
  ['persistent', '持续无法访问', 'https://old.example.net/page'],
  ['permission', '迁移后的站点', 'https://moved.example.net/page'],
  ['login-401', '需要登录的站点', 'https://private.example.net/page'],
  ['login-redirect', '跳转登录的站点', 'https://members.example.net/page'],
  ['login-page', '未登录的正常网页', 'https://welcome.example.net/'],
  ['login-session', '会话续期的正常网页', 'https://workspace.example.net/keys']
].map(([id, title, url], index) => ({ id, title, url, index, parentId: '1', dateAdded: 1000 + index }))
const root = { id: '0', title: '', children: [
  { id: '1', title: '书签栏', parentId: '0', children: records },
  { id: '2', title: '其他书签', parentId: '0', children: [] }
] }
const nodes = () => [root, ...root.children, ...root.children.flatMap(folder => folder.children)]
const getNode = id => nodes().find(node => node.id === String(id))
const values = {}
const trace = []
window.__fixtureErrors = []
addEventListener('error', event => window.__fixtureErrors.push(event.message))
addEventListener('unhandledrejection', event => window.__fixtureErrors.push(String(event.reason)))
window.__fixtureIO = {
  root, values, trace, failRemoveId: '', allowPermission: false, engineVersion: 2,
  changeUrl(id, url) { getNode(id).url = url },
  snapshot: () => clone({ root, values, trace })
}
const storage = {
  get(keys, callback) {
    const result = keys === null ? values : Array.isArray(keys) || typeof keys === 'string'
      ? Object.fromEntries((Array.isArray(keys) ? keys : [keys]).map(key => [key, values[key]]))
      : Object.fromEntries(Object.entries(keys || {}).map(([key, fallback]) => [key, values[key] ?? fallback]))
    return done(result, callback)
  },
  set(data, callback) { Object.assign(values, clone(data)); trace.push({ type: 'storage', keys: Object.keys(data) }); return done(undefined, callback) },
  remove(keys, callback) { for (const key of Array.isArray(keys) ? keys : [keys]) delete values[key]; return done(undefined, callback) },
  getBytesInUse: (_, callback) => done(0, callback)
}
window.chrome = {
  runtime: {
    id: 'curator-isolated-availability-workflow', lastError: undefined,
    getManifest: () => ({ version: '1.5.3', name: 'Curator isolated fixture' }),
    getURL: value => '/' + value, onMessage: event(),
    sendMessage(message, callback) {
      trace.push({ type: 'message', message })
      if (message.type === 'availability:engine') return done({ ok: true, result: { version: window.__fixtureIO.engineVersion } }, callback)
      if (message.type === 'availability:navigate') {
        const restricted = message.url.includes('verify.')
        const redirected = message.url.includes('moved.')
        const loginRedirect = message.url.includes('members.')
        const sessionRedirect = message.url.includes('workspace.')
        const statusCode = message.url.includes('private.') ? 401 : loginRedirect ? 302 : sessionRedirect ? 307 :
          message.url.includes('missing.') ? 404 : message.url.includes('old.') ? 410 : restricted ? 403 : 200
        return done({ ok: true, result: {
          status: statusCode >= 400 || redirected ? 'failed' : 'available',
          finalUrl: redirected ? 'https://canonical.example.org/page' : message.url,
          detail: 'HTTP ' + statusCode,
          errorCode: loginRedirect ? 'login-required' : sessionRedirect ? 'sensitive-redirect' : redirected ? 'ungranted-redirect' : statusCode >= 400 ? 'http-' + statusCode : '',
          networkEvidence: { requestSent: true, requestedUrl: message.url, method: 'GET',
            statusCode, finalResponseObserved: !loginRedirect && !sessionRedirect,
            redirects: loginRedirect ? [{ url: message.url, redirectUrl: 'https://identity.example.net/sign-in', statusCode: 302 }] :
              sessionRedirect ? [{ url: message.url, redirectUrl: 'https://session.example.org/v1/client/handshake?redirect_url=https%3A%2F%2Fworkspace.example.net%2Fkeys&__clerk_api_version=2026-05-12&__session=fixture', statusCode: 307 }] : [],
            timing: {} }
        } }, callback)
      }
      if (message.type === 'availability:cancel') return done({ ok: true }, callback)
      throw Error('Unexpected fixture message: ' + message.type)
    }
  },
  storage: { onChanged: event(), local: storage, session: storage, sync: storage },
  permissions: {
    contains: (request, callback) => done(!request.origins?.some(origin => origin.includes('canonical.example.org')) || window.__fixtureIO.allowPermission, callback),
    request: (request, callback) => {
      trace.push({ type: 'permission', origins: request.origins })
      return done(window.__fixtureIO.allowPermission, callback)
    },
    getAll: callback => done({ permissions: [], origins: [] }, callback),
    onAdded: event(), onRemoved: event()
  },
  commands: { getAll: callback => done([], callback) },
  bookmarks: {
    getTree: callback => done([root], callback),
    get: (ids, callback) => done((Array.isArray(ids) ? ids : [ids]).map(getNode).filter(Boolean), callback),
    getChildren: (id, callback) => done(getNode(id)?.children || [], callback),
    search: (query, callback) => done(nodes().filter(node => node.url && (typeof query !== 'object' || !query.url || node.url === query.url)), callback),
    remove(id, callback) {
      if (id === window.__fixtureIO.failRemoveId) {
        queueMicrotask(() => {
          chrome.runtime.lastError = { message: 'Fixture deletion failure' }
          callback()
          chrome.runtime.lastError = undefined
        })
        return
      }
      const node = getNode(id)
      const parent = getNode(node?.parentId)
      if (!node || !parent) throw Error('Fixture bookmark missing: ' + id)
      parent.children = parent.children.filter(child => child.id !== id)
      trace.push({ type: 'remove', id })
      return done(undefined, callback)
    },
    create(details, callback) {
      const node = { ...details, id: 'restored-' + trace.length, parentId: details.parentId || '1', dateAdded: Date.now() }
      getNode(node.parentId).children.push(node)
      trace.push({ type: 'create', id: node.id, url: node.url })
      return done(node, callback)
    },
    onCreated: event(), onRemoved: event(), onChanged: event(), onMoved: event(), onChildrenReordered: event(), onImportEnded: event()
  },
  tabs: { query: (_, callback) => done([], callback), getCurrent: callback => done({ id: 101, windowId: 1 }, callback), onActivated: event(), onUpdated: event() },
  windows: { getCurrent: callback => done({ id: 1 }, callback), onFocusChanged: event() }
}
