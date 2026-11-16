/*
 * Isolated tab/window/group model for destructive sync tests in Ego.
 * Nothing falls through to the profile's real tabs or windows.
 */
(() => {
  if (!chrome.runtime.getManifest().name.startsWith('Curator QA sync modes ')) throw new Error('QA only')
  const key = 'curatorQa:tabs'
  const eventKey = 'curatorQa:tabEvents'
  const initial = () => ({
    nextTab: 2, nextWindow: 2, nextGroup: 10,
    windows: [{ id: 1, type: 'normal', focused: true, incognito: false }],
    tabs: [{ id: 1, windowId: 1, groupId: -1, index: 0, active: true, incognito: false, pinned: false, status: 'complete', url: 'about:blank', title: 'about:blank' }],
    groups: [],
  })
  const read = async () => (await chrome.storage.local.get(key))[key] || initial()
  const event = () => {
    const listeners = new Set()
    return { addListener: listener => listeners.add(listener), removeListener: listener => listeners.delete(listener),
      hasListener: listener => listeners.has(listener), hasListeners: () => Boolean(listeners.size),
      fire: args => [...listeners].forEach(listener => listener(...args)) }
  }
  const events = {}
  for (const name of ['tabs.onCreated', 'tabs.onUpdated', 'tabs.onRemoved', 'tabs.onMoved', 'tabs.onDetached', 'tabs.onAttached',
    'tabs.onActivated', 'tabs.onHighlighted', 'tabs.onReplaced', 'tabs.onZoomChange',
    'windows.onCreated', 'windows.onRemoved', 'windows.onFocusChanged',
    'tabGroups.onCreated', 'tabGroups.onUpdated', 'tabGroups.onRemoved', 'tabGroups.onMoved']) events[name] = event()
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes[eventKey]?.newValue) {
      for (const item of changes[eventKey].newValue.items) events[item.name]?.fire(item.args)
    }
  })
  const get = (rows, id, kind) => {
    const row = rows.find(row => row.id === Number(id))
    if (!row) throw new Error(`No ${kind} with id: ${id}`)
    return row
  }
  const positions = state => {
    for (const window of state.windows) state.tabs.filter(tab => tab.windowId === window.id).forEach((tab, index) => { tab.index = index })
    state.groups = state.groups.filter(group => state.tabs.some(tab => tab.groupId === group.id))
  }
  const mutate = operation => navigator.locks.request('curator-qa:tabs', async () => {
    const state = await read(), items = []
    const emit = (name, ...args) => items.push({ name, args })
    const result = operation(state, emit)
    positions(state)
    await chrome.storage.local.set({ [key]: state, [eventKey]: { items, nonce: crypto.randomUUID() } })
    return structuredClone(result)
  })
  const createTab = (state, emit, details = {}) => {
    const windowId = details.windowId || state.windows.find(window => window.focused)?.id || state.windows[0]?.id
    get(state.windows, windowId, 'window')
    const tab = {
      id: state.nextTab++, windowId, groupId: -1, index: 0, active: details.active !== false,
      incognito: false, pinned: false, status: 'complete', url: details.url || 'about:blank',
      title: details.title || details.url || 'about:blank',
    }
    const peers = state.tabs.filter(item => item.windowId === windowId)
    if (tab.active) peers.forEach(item => { item.active = false })
    const index = details.index ?? peers.length
    const before = peers[Math.min(index, peers.length)]
    state.tabs.splice(before ? state.tabs.indexOf(before) : state.tabs.length, 0, tab)
    emit('tabs.onCreated', tab)
    emit('tabs.onUpdated', tab.id, { status: 'complete', url: tab.url }, tab)
    return tab
  }
  const removeTab = (state, emit, id) => {
    const tab = get(state.tabs, id, 'tab')
    state.tabs.splice(state.tabs.indexOf(tab), 1)
    emit('tabs.onRemoved', tab.id, { windowId: tab.windowId, isWindowClosing: false })
  }
  const moveTabs = (state, emit, ids, details) => {
    const tabs = (Array.isArray(ids) ? ids : [ids]).map(id => get(state.tabs, id, 'tab'))
    const windowId = details.windowId || tabs[0].windowId
    get(state.windows, windowId, 'window')
    for (const tab of tabs) {
      state.tabs.splice(state.tabs.indexOf(tab), 1)
      const oldWindow = tab.windowId
      tab.windowId = windowId
      if (oldWindow !== windowId) tab.groupId = -1
    }
    const peers = state.tabs.filter(tab => tab.windowId === windowId)
    const index = details.index === -1 ? peers.length : Math.min(details.index ?? peers.length, peers.length)
    const before = peers[index]
    state.tabs.splice(before ? state.tabs.indexOf(before) : state.tabs.length, 0, ...tabs)
    for (const tab of tabs) emit('tabs.onMoved', tab.id, { windowId, fromIndex: tab.index, toIndex: index })
    return Array.isArray(ids) ? tabs : tabs[0]
  }
  const matches = (object, query, skip = []) => Object.entries(query || {}).every(([key, value]) =>
    skip.includes(key) || value === undefined || object[key] === value)
  const methods = {
    tabs: {
      async query(query = {}) {
        const state = await read()
        return state.tabs.filter(tab => matches(tab, query, ['url', 'currentWindow', 'lastFocusedWindow', 'windowType']) &&
          (!query.windowType || state.windows.find(window => window.id === tab.windowId)?.type === query.windowType) &&
          (!query.currentWindow && !query.lastFocusedWindow || state.windows.find(window => window.id === tab.windowId)?.focused) &&
          (!query.url || (Array.isArray(query.url) ? query.url : [query.url]).some(pattern =>
            new RegExp('^' + pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replaceAll('*', '.*') + '$').test(tab.url))))
          .sort((a, b) => state.windows.findIndex(window => window.id === a.windowId) -
            state.windows.findIndex(window => window.id === b.windowId) || a.index - b.index)
      },
      async get(id) { return get((await read()).tabs, id, 'tab') },
      async getCurrent() { return (await read()).tabs[0] },
      create: details => mutate((state, emit) => createTab(state, emit, details)),
      update: (id, details) => mutate((state, emit) => {
        const tab = get(state.tabs, id, 'tab')
        Object.assign(tab, details)
        if (details.url) tab.title = details.title || details.url
        emit('tabs.onUpdated', tab.id, details, tab)
        return tab
      }),
      remove: ids => mutate((state, emit) => {
        for (const id of Array.isArray(ids) ? ids : [ids]) removeTab(state, emit, id)
      }),
      move: (ids, details) => mutate((state, emit) => moveTabs(state, emit, ids, details)),
      group: details => mutate((state, emit) => {
        const tabs = (Array.isArray(details.tabIds) ? details.tabIds : [details.tabIds]).map(id => get(state.tabs, id, 'tab'))
        let group
        if (details.groupId !== undefined) group = get(state.groups, details.groupId, 'tab group')
        else {
          group = { id: state.nextGroup++, windowId: details.createProperties?.windowId || tabs[0].windowId, title: '', color: 'grey', collapsed: false }
          state.groups.push(group)
          emit('tabGroups.onCreated', group)
        }
        for (const tab of tabs) {
          tab.groupId = group.id
          tab.windowId = group.windowId
          emit('tabs.onUpdated', tab.id, { groupId: group.id }, tab)
        }
        return group.id
      }),
      ungroup: ids => mutate((state, emit) => {
        for (const id of Array.isArray(ids) ? ids : [ids]) {
          const tab = get(state.tabs, id, 'tab')
          tab.groupId = -1
          emit('tabs.onUpdated', tab.id, { groupId: -1 }, tab)
        }
      }),
    },
    windows: {
      WINDOW_ID_CURRENT: -2, WINDOW_ID_NONE: -1,
      async getAll(query = {}) {
        const state = await read()
        return state.windows.map(window => ({ ...window, ...(query.populate ? { tabs: state.tabs.filter(tab => tab.windowId === window.id) } : {}) }))
      },
      async get(id) { return get((await read()).windows, id, 'window') },
      async getCurrent() { return (await read()).windows.find(window => window.focused) },
      async getLastFocused() { return (await read()).windows.find(window => window.focused) },
      create: details => mutate((state, emit) => {
        const window = { id: state.nextWindow++, type: 'normal', focused: details?.focused !== false, incognito: false }
        if (window.focused) state.windows.forEach(item => { item.focused = false })
        state.windows.push(window)
        const urls = Array.isArray(details?.url) ? details.url : [details?.url || 'about:blank']
        const tabs = urls.map(url => createTab(state, emit, { windowId: window.id, url }))
        emit('windows.onCreated', window)
        return { ...window, tabs }
      }),
      update: (id, details) => mutate(state => Object.assign(get(state.windows, id, 'window'), details)),
      remove: id => mutate((state, emit) => {
        const window = get(state.windows, id, 'window')
        for (const tab of [...state.tabs].filter(tab => tab.windowId === window.id)) removeTab(state, emit, tab.id)
        state.windows.splice(state.windows.indexOf(window), 1)
        emit('windows.onRemoved', window.id)
      }),
    },
    tabGroups: {
      TAB_GROUP_ID_NONE: -1,
      async query(query = {}) { return (await read()).groups.filter(group => matches(group, query)) },
      async get(id) { return get((await read()).groups, id, 'tab group') },
      update: (id, details) => mutate((state, emit) => {
        const group = get(state.groups, id, 'tab group')
        Object.assign(group, details)
        emit('tabGroups.onUpdated', group)
        return group
      }),
      move: (id, details) => mutate((state, emit) => {
        const group = get(state.groups, id, 'tab group')
        const members = state.tabs.filter(tab => tab.groupId === group.id)
        moveTabs(state, emit, members.map(tab => tab.id), { ...details, windowId: details.windowId || group.windowId })
        if (details.windowId) group.windowId = details.windowId
        members.forEach(tab => { tab.groupId = group.id })
        emit('tabGroups.onMoved', group)
        return group
      }),
    },
  }
  for (const [namespace, api] of Object.entries(methods)) {
    const wrapped = Object.fromEntries(Object.entries(api).map(([name, method]) => [name, typeof method !== 'function' ? method : (...args) => {
      const callback = typeof args.at(-1) === 'function' ? args.pop() : null
      const promise = Promise.resolve().then(() => method(...args)).then(value => structuredClone(value))
      if (!callback) return promise
      void promise.then(callback, () => callback(undefined))
    }]))
    for (const [name, value] of Object.entries(events)) {
      if (name.startsWith(namespace + '.')) wrapped[name.slice(namespace.length + 1)] = value
    }
    Object.defineProperty(chrome, namespace, { configurable: false, enumerable: true, value: wrapped, writable: false })
  }
})()
