import { createRoot } from 'react-dom/client'
import '../styles/globals.css'
import { SyncCard } from './components/SyncCard'

// The production sync card over an in-page sync service; no server or bookmark is touched.
const now = Date.now()
const profile = (id: string, data: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
  id, label: 'curator@dav.example.org', folderPath: ['书签栏', '工作资料'], localFolderExists: true, needsAuthorization: false,
  secrets: { password: true, passphrase: false, refreshToken: false },
  data: { type: 'webdav', localRoot: '5', url: 'https://dav.example.org/remote/', username: 'curator', bookmark_file: 'bookmarks.xbel', bookmark_file_type: 'xbel', enabled: true, syncIntervalEnabled: true, syncInterval: 15, strategy: 'default', failsafe: true, nestedSync: true, lastSync: now - 3600000, ...data },
  ...extra
})
const LONG_ERROR = 'E029：安全保护：本次同步会删除服务器上 56% 的书签，已停止。确认无误后可在该同步的设置中关闭安全保护；如果不是你的操作造成的，可用“以服务器为准”恢复本机。'
const scenes: Record<string, ReturnType<typeof profile>[]> = {
  empty: [],
  idle: [profile('a', {})],
  download: [profile('a', { strategy: 'slave' })],
  upload: [profile('a', { strategy: 'overwrite' })],
  syncing: [profile('a', { syncing: 0.42 })],
  scheduled: [profile('a', { scheduled: true })],
  error: [profile('a', { error: LONG_ERROR })],
  pending: [profile('a', { notifyOnly: true, pendingChanges: { local: 3, server: 12 } })],
  linkwarden: [profile('lw', { type: 'linkwarden', url: 'https://linkwarden.example', serverFolder: 'Curator' })],
  many: [
    profile('a', {}),
    profile('b', { type: 'nextcloud-bookmarks', enabled: false, syncIntervalEnabled: false, failsafe: false, lastSync: 0 }, { label: 'me@cloud.example.com', folderPath: ['其他书签', '一个名字特别长特别长特别长特别长特别长特别长的文件夹用来检查换行'] }),
    profile('c', { type: 'google-drive', localRoot: 'tabs' }, { label: 'Google Drive: bookmarks.xbel', folderPath: [], needsAuthorization: true })
  ]
}

const listeners = new Set<(changes: Record<string, unknown>, area: string) => void>()
const sync = { profiles: scenes.empty, calls: [] as unknown[], failNext: '' }
const bookmarkTree = [{ id: '0', title: '', children: [
  { id: '1', parentId: '0', title: '书签栏', children: [{ id: '5', parentId: '1', title: '工作资料', children: [] as Record<string, unknown>[] }] },
  { id: '2', parentId: '0', title: '其他书签', children: [] as Record<string, unknown>[] }
] }]
const findFolder = (id: string, nodes: any[] = bookmarkTree): any =>
  nodes.find(node => node.id === id) || nodes.flatMap(node => node.children || []).map(node => findFolder(id, [node])).find(Boolean)
const event = () => ({ addListener() {}, removeListener() {} })
Object.assign(window, {
  __sync: {
    calls: sync.calls,
    scene(name: string) {
      sync.profiles = scenes[name]
      listeners.forEach(listener => listener({ 'curatorSync:accounts': {} }, 'local'))
    },
    fail(message: string) { sync.failNext = message }
  },
  chrome: {
    runtime: {
      id: 'curator-sync-fixture', getURL: (value: string) => '/' + value, onMessage: event(),
      async sendMessage(message: { type: string; ids?: string[]; id?: string; data?: Record<string, unknown> }) {
        sync.calls.push(message)
        if (sync.failNext) {
          const error = sync.failNext
          sync.failNext = ''
          return { ok: false, error }
        }
        if (message.type === 'sync:list') return { ok: true, result: sync.profiles }
        if (message.type === 'sync:update') {
          sync.profiles = sync.profiles.map(profile => profile.id === message.id
            ? { ...profile, data: { ...profile.data, ...message.data } } : profile)
          return { ok: true }
        }
        if (message.type === 'sync:export') return {
          ok: true, result: sync.profiles.filter(profile => message.ids?.includes(profile.id)).map(profile => ({ ...profile.data, password: 'fixture-only-secret' }))
        }
        if (message.type === 'sync:oauth-settings') {
          return { ok: true, result: { redirectUrl: 'https://abcdefghijklmnopabcdefghijklmnop.chromiumapp.org/', clients: {
            'google-drive': { clientId: 'publisher-google', hasSecret: true, available: true, source: 'bundled' },
            dropbox: { clientId: 'publisher-dropbox', hasSecret: false, available: true, source: 'bundled' }
          } } }
        }
        if (message.type === 'sync:authorize') return { ok: true, result: { refreshToken: 'fixture-refresh', username: 'Fixture Account' } }
        return { ok: true, result: message.type === 'sync:logs' ? [] : undefined }
      }
    },
    storage: {
      onChanged: { addListener: (listener: never) => listeners.add(listener), removeListener: (listener: never) => listeners.delete(listener) },
      local: { get: async () => ({ 'curatorSync:accounts': JSON.stringify(Object.fromEntries(sync.profiles.map((item, index) => [index, item]))) }) }
    },
    permissions: { request: async () => true },
    bookmarks: {
      getTree: async () => structuredClone(bookmarkTree),
      getSubTree: async (id: string) => [structuredClone(findFolder(id))],
      create: async (details: { parentId: string; title: string }) => {
        const folder = { id: String(100 + sync.calls.length), ...details, children: [] }
        findFolder(details.parentId).children.push(folder)
        sync.calls.push({ type: 'bookmarks:create', ...details })
        return folder
      }
    }
  }
})

createRoot(document.getElementById('root')!).render(
  <main className="options-main-scroll mx-auto w-[min(100%,1120px)] px-6 pb-12 pt-6 max-[760px]:px-4">
    <section id="backup"><SyncCard /></section>
  </main>
)
