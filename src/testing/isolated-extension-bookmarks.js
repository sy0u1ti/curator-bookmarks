/*
 * Test-only bookmark I/O for an agent-owned extension installed in Ego.
 * Every tree and event stays in that extension's storage. The production
 * worker, message ports, IndexedDB and Web Locks remain real browser APIs.
 * Never fall through to the browser profile's actual bookmarks.
 */
(() => {
  if (!chrome.runtime.getManifest().name.startsWith('Curator QA ')) {
    throw new Error('The isolated bookmark fixture is only for Curator QA extensions')
  }
  const treeKey = 'curatorQa:bookmarkTree'
  const eventKey = 'curatorQa:bookmarkEvent'
  const initial = () => ({
    next: 3,
    tree: [{ id: '0', title: '', children: [
      { id: '1', parentId: '0', index: 0, title: 'QA Bookmarks Bar', folderType: 'bookmarks-bar', children: [] },
      { id: '2', parentId: '0', index: 1, title: 'QA Other Bookmarks', folderType: 'other', children: [] }
    ] }]
  })
  const read = async () => (await chrome.storage.local.get(treeKey))[treeKey] || initial()
  const all = nodes => nodes.flatMap(node => [node, ...all(node.children || [])])
  const find = (state, id) => {
    const node = all(state.tree).find(item => item.id === String(id))
    if (!node) throw new Error(`No QA bookmark ${id}`)
    return node
  }
  const positions = node => node.children?.forEach((child, index) => { child.index = index; child.parentId = node.id })
  const events = Object.fromEntries(['onCreated', 'onRemoved', 'onChanged', 'onMoved', 'onChildrenReordered', 'onImportBegan', 'onImportEnded'].map(name => {
    const listeners = new Set()
    return [name, {
      addListener: listener => listeners.add(listener),
      removeListener: listener => listeners.delete(listener),
      hasListener: listener => listeners.has(listener),
      hasListeners: () => listeners.size > 0,
      fire: args => listeners.forEach(listener => listener(...args))
    }]
  }))
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes[eventKey]?.newValue) return
    const event = changes[eventKey].newValue
    events[event.name]?.fire(event.args)
  })
  const mutate = task => navigator.locks.request('curator-qa:bookmark-tree', async () => {
    const state = await read()
    const { result, event } = task(state)
    await chrome.storage.local.set({
      [treeKey]: state,
      ...(event ? { [eventKey]: { ...event, nonce: crypto.randomUUID() } } : {})
    })
    return result
  })
  const api = {
    async getTree() { return (await read()).tree },
    async get(ids) {
      const state = await read()
      return (Array.isArray(ids) ? ids : [ids]).map(id => {
        const { children, ...node } = find(state, id)
        return node
      })
    },
    async getSubTree(id) { return [find(await read(), id)] },
    async getChildren(id) { return find(await read(), id).children || [] },
    async search(query) {
      const nodes = all((await read()).tree)
      return nodes.filter(node => typeof query === 'string'
        ? `${node.title} ${node.url || ''}`.toLowerCase().includes(query.toLowerCase())
        : (!query.url || node.url === query.url) && (!query.title || node.title === query.title))
    },
    create(details) {
      return mutate(state => {
        const parent = find(state, details.parentId || '2')
        if (!parent.children) throw new Error('A QA bookmark is not a folder')
        const index = Math.min(details.index ?? parent.children.length, parent.children.length)
        const node = {
          id: String(state.next++), parentId: parent.id, index, title: details.title || '', dateAdded: Date.now(),
          ...(details.url ? { url: details.url } : { children: [] })
        }
        parent.children.splice(index, 0, node)
        positions(parent)
        return { result: node, event: { name: 'onCreated', args: [node.id, node] } }
      })
    },
    update(id, changes) {
      return mutate(state => {
        const node = find(state, id)
        if (typeof changes.title === 'string') node.title = changes.title
        if (typeof changes.url === 'string') node.url = changes.url
        return { result: node, event: { name: 'onChanged', args: [node.id, changes] } }
      })
    },
    move(id, destination) {
      return mutate(state => {
        const node = find(state, id), from = find(state, node.parentId)
        const oldParentId = node.parentId, oldIndex = node.index
        const to = find(state, destination.parentId || node.parentId)
        const currentIndex = from.children.indexOf(node)
        let insertIndex = destination.index ?? to.children.length
        if (from === to && typeof destination.index === 'number') {
          const clamped = Math.max(0, Math.min(destination.index, from.children.length))
          insertIndex = clamped > currentIndex ? clamped - 1 : clamped
        }
        from.children.splice(currentIndex, 1)
        to.children.splice(Math.max(0, Math.min(insertIndex, to.children.length)), 0, node)
        positions(from); positions(to)
        return { result: node, event: { name: 'onMoved', args: [node.id, { oldParentId, oldIndex, parentId: node.parentId, index: node.index }] } }
      })
    },
    remove(id) { return remove(id, false) },
    removeTree(id) { return remove(id, true) }
  }
  function remove(id, recursive) {
    return mutate(state => {
      const node = find(state, id)
      if (['0', '1', '2'].includes(node.id)) throw new Error('Cannot remove a QA root')
      if (!recursive && node.children?.length) throw new Error('QA folder is not empty')
      const parent = find(state, node.parentId)
      parent.children.splice(parent.children.indexOf(node), 1)
      positions(parent)
      return { result: undefined, event: { name: 'onRemoved', args: [node.id, { parentId: parent.id, index: node.index, node }] } }
    })
  }
  const wrapped = Object.fromEntries(Object.entries(api).map(([name, method]) => [name, (...args) => {
    const callback = typeof args.at(-1) === 'function' ? args.pop() : null
    const promise = Promise.resolve().then(() => method(...args)).then(value => structuredClone(value))
    if (!callback) return promise
    void promise.then(callback, error => {
      // Match Chrome's callback error lifetime without changing its real port APIs.
      const descriptor = Object.getOwnPropertyDescriptor(chrome.runtime, 'lastError')
      Object.defineProperty(chrome.runtime, 'lastError', { configurable: true, value: { message: error.message } })
      try { callback(undefined) } finally {
        if (descriptor) Object.defineProperty(chrome.runtime, 'lastError', descriptor)
        else delete chrome.runtime.lastError
      }
    })
  }]))
  // Fail closed if a permission refresh tries to replace this test-only API.
  Object.defineProperty(chrome, 'bookmarks', {
    configurable: false, enumerable: true, value: { ...wrapped, ...events }, writable: false
  })
})()
