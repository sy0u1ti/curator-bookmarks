import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  buildBackupRestorePreview,
  createAutoBackupBeforeDangerousOperation,
  getBackupFileName,
  parseCuratorBackupFile,
  restoreCuratorBackup,
  type CuratorBackupFileV1
} from '../src/shared/backup.js'
import { STORAGE_KEYS } from '../src/shared/constants.js'

test('getBackupFileName uses curator backup date format', () => {
  assert.equal(
    getBackupFileName(Date.UTC(2026, 4, 1, 12, 0, 0)),
    'curator-backup-2026-05-01.json'
  )
})

test('parseCuratorBackupFile removes API key fields from AI settings', () => {
  const aiProviderSettings: Record<string, unknown> = {
    baseUrl: 'https://api.example.test/v1',
    model: 'gpt-5-mini'
  }
  aiProviderSettings.apiKey = 'fixture-secret'
  aiProviderSettings.api_key = 'fixture-secret-snake-case'

  const backup = parseCuratorBackupFile({
    app: 'curator-bookmarks',
    kind: 'full-backup',
    schemaVersion: 1,
    exportedAt: '2026-05-01T00:00:00.000Z',
    extensionVersion: '1.4.10',
    manifestVersion: 3,
    source: 'manual',
    chromeBookmarks: {
      exportedAt: '2026-05-01T00:00:00.000Z',
      tree: []
    },
    storage: {
      bookmarkTagIndex: { version: 1, updatedAt: 0, records: {} },
      recycleBin: [],
      ignoreRules: { bookmarks: [], domains: [], folders: [] },
      redirectCache: { savedAt: 0, results: [] },
      newTab: {},
      aiProviderSettings
    }
  })

  assert.equal(backup.storage.aiProviderSettings.apiKeyRedacted, true)
  assert.equal('apiKey' in backup.storage.aiProviderSettings, false)
  assert.equal('api_key' in backup.storage.aiProviderSettings, false)
  assert.equal(backup.storage.aiProviderSettings.model, 'gpt-5-mini')
})

test('backup redaction declares audit logs, full text and user media are omitted', () => {
  const backup = parseCuratorBackupFile({
    app: 'curator-bookmarks',
    kind: 'full-backup',
    schemaVersion: 1,
    exportedAt: '2026-05-01T00:00:00.000Z',
    extensionVersion: '1.4.10',
    manifestVersion: 3,
    source: 'manual',
    chromeBookmarks: {
      exportedAt: '2026-05-01T00:00:00.000Z',
      tree: []
    },
    storage: {
      bookmarkTagIndex: { version: 1, updatedAt: 0, records: {} },
      recycleBin: [],
      ignoreRules: { bookmarks: [], domains: [], folders: [] },
      redirectCache: { savedAt: 0, results: [] },
      newTab: {},
      aiProviderSettings: { apiKey: 'fixture-secret' }
    }
  })

  assert.deepEqual(backup.redaction.omittedFields, [
    'apiKey',
    'authorizationHeaders',
    'privacyAuditLog',
    'aiUsageLedger',
    'contentFullText',
    'contentSnapshotCache',
    'newTabBackgroundMedia',
    'userMediaCache'
  ])
  assert.doesNotMatch(JSON.stringify(backup), /fixture-secret|privacyAuditLog":\[|curatorBookmarkAiUsageLedger/)
})

test('dangerous operation backup kinds include tag import changes', () => {
  const backupSource = readFileSync('src/shared/backup.ts', 'utf8')

  assert.match(backupSource, /\| 'tag-import'/)
})

test('dangerous operation auto backup stops when backup storage fails by default', async () => {
  const store: Record<string, unknown> = {}
  ;(globalThis as any).chrome = createChromeMock({
    store,
    tree: [rootNode([])]
  })
  ;(globalThis as any).indexedDB = {
    open() {
      throw new Error('IndexedDB unavailable')
    }
  }

  try {
    await assert.rejects(
      createAutoBackupBeforeDangerousOperation({
        kind: 'batch-delete',
        source: 'options',
        reason: '测试失败中断',
        now: Date.UTC(2026, 4, 1)
      }),
      /自动备份失败，已停止执行高风险操作：IndexedDB unavailable/
    )
  } finally {
    delete (globalThis as any).chrome
    delete (globalThis as any).indexedDB
  }
})

test('dangerous operation auto backup can explicitly allow skipped backup', async () => {
  const store: Record<string, unknown> = {}
  ;(globalThis as any).chrome = createChromeMock({
    store,
    tree: [rootNode([])]
  })
  ;(globalThis as any).indexedDB = {
    open() {
      throw new Error('IndexedDB unavailable')
    }
  }

  try {
    const result = await createAutoBackupBeforeDangerousOperation({
      kind: 'batch-delete',
      source: 'options',
      reason: '测试显式跳过',
      now: Date.UTC(2026, 4, 1),
      allowSkipOnFailure: true
    })

    assert.equal(result.skipped, true)
    assert.match(result.reason || '', /IndexedDB unavailable/)
  } finally {
    delete (globalThis as any).chrome
    delete (globalThis as any).indexedDB
  }
})

test('safe full restore keeps local AI api key while restoring safe provider fields', async () => {
  const store: Record<string, unknown> = {
    [STORAGE_KEYS.aiProviderSettings]: {
      provider: 'openai',
      baseUrl: 'https://current.example.test/v1',
      model: 'gpt-5-mini',
      apiKey: 'current-secret'
    }
  }
  ;(globalThis as any).chrome = createChromeMock({
    store,
    tree: [rootNode([])]
  })

  try {
    await restoreCuratorBackup(createBackup({
      tree: [rootNode([])],
      aiProviderSettings: {
        provider: 'compatible',
        baseUrl: 'https://backup.example.test/v1',
        model: 'gpt-5.1-mini',
        apiKeyRedacted: true
      }
    }), 'safeFull')

    assert.deepEqual(store[STORAGE_KEYS.aiProviderSettings], {
      provider: 'compatible',
      baseUrl: 'https://backup.example.test/v1',
      model: 'gpt-5.1-mini',
      apiKey: 'current-secret'
    })
  } finally {
    delete (globalThis as any).chrome
  }
})

test('safe full restore preserves rejected AI suggestion preferences', async () => {
  const store: Record<string, unknown> = {}
  ;(globalThis as any).chrome = createChromeMock({
    store,
    tree: [rootNode([])]
  })

  try {
    await restoreCuratorBackup(createBackup({
      tree: [rootNode([])],
      aiRejectedSuggestions: [{
        key: 'example.com/docs|old title|better title',
        bookmarkId: 'bookmark-1',
        url: 'https://example.com/docs',
        currentTitle: 'Old Title',
        suggestedTitle: 'Better Title',
        rejectedAt: 1778208000000
      }]
    }), 'safeFull')

    assert.deepEqual(store[STORAGE_KEYS.aiRejectedSuggestions], [{
      key: 'example.com/docs|old title|better title',
      bookmarkId: 'bookmark-1',
      url: 'https://example.com/docs',
      currentTitle: 'Old Title',
      suggestedTitle: 'Better Title',
      rejectedAt: 1778208000000
    }])
  } finally {
    delete (globalThis as any).chrome
  }
})

test('safe full restore copies same URL when the missing instance is in another folder path', async () => {
  const store: Record<string, unknown> = {}
  const created: chrome.bookmarks.BookmarkCreateArg[] = []
  ;(globalThis as any).chrome = createChromeMock({
    store,
    created,
    tree: [rootNode([
      folderNode('10', 'Bookmarks Bar', [
        folderNode('11', 'Folder A', [
          bookmarkNode('12', 'React Docs', 'https://react.dev/learn', '11')
        ])
      ], '0')
    ])]
  })

  try {
    const result = await restoreCuratorBackup(createBackup({
      tree: [rootNode([
        folderNode('1', 'Bookmarks Bar', [
          folderNode('2', 'Folder A', [
            bookmarkNode('3', 'React Docs A', 'https://react.dev/learn', '2')
          ], '1'),
          folderNode('4', 'Folder B', [
            bookmarkNode('5', 'React Docs B', 'https://react.dev/learn', '4')
          ], '1')
        ], '0')
      ])]
    }), 'safeFull')

    assert.equal(result.restored.copiedBookmarks, 1)
    assert.equal(result.skippedBookmarks, 1)
    assert.equal(created.some((item) => item.title === 'React Docs B' && item.url === 'https://react.dev/learn'), true)
    assert.equal(created.some((item) => item.title === 'React Docs A' && item.url === 'https://react.dev/learn'), false)
  } finally {
    delete (globalThis as any).chrome
  }
})

test('restore preview counts missing bookmark instances by URL and folder path', async () => {
  const store: Record<string, unknown> = {}
  ;(globalThis as any).chrome = createChromeMock({
    store,
    tree: [rootNode([
      folderNode('10', 'Bookmarks Bar', [
        folderNode('11', 'Folder A', [
          bookmarkNode('12', 'React Docs', 'https://react.dev/learn', '11')
        ])
      ], '0')
    ])]
  })

  try {
    const preview = await buildBackupRestorePreview(createBackup({
      tree: [rootNode([
        folderNode('1', 'Bookmarks Bar', [
          folderNode('2', 'Folder A', [
            bookmarkNode('3', 'React Docs A', 'https://react.dev/learn', '2')
          ], '1'),
          folderNode('4', 'Folder B', [
            bookmarkNode('5', 'React Docs B', 'https://react.dev/learn', '4')
          ], '1')
        ], '0')
      ])]
    }), 'fixture.json')

    assert.equal(preview.counts.bookmarkUrls, 2)
    assert.equal(preview.counts.missingBookmarkUrls, 1)
    assert.match(preview.warnings.join('\n'), /1 条备份书签实例当前不存在/)
  } finally {
    delete (globalThis as any).chrome
  }
})

test('safe full preview declares local collection overwrite semantics', async () => {
  const store: Record<string, unknown> = {}
  ;(globalThis as any).chrome = createChromeMock({
    store,
    tree: [rootNode([])]
  })

  try {
    const preview = await buildBackupRestorePreview(createBackup({
      tree: [rootNode([])]
    }))

    assert.match(
      preview.warnings.join('\n'),
      /完整恢复会覆盖回收站、忽略规则、重定向缓存和弹窗偏好等集合类本地数据/
    )
    assert.match(
      preview.modes.find((mode) => mode.mode === 'safeFull')?.description || '',
      /覆盖集合类本地记录/
    )
  } finally {
    delete (globalThis as any).chrome
  }
})

function createBackup({
  tree,
  aiProviderSettings = { apiKeyRedacted: true },
  aiRejectedSuggestions = []
}: {
  tree: chrome.bookmarks.BookmarkTreeNode[]
  aiProviderSettings?: Record<string, unknown>
  aiRejectedSuggestions?: unknown[]
}): CuratorBackupFileV1 {
  return parseCuratorBackupFile({
    app: 'curator-bookmarks',
    kind: 'full-backup',
    schemaVersion: 1,
    exportedAt: '2026-05-01T00:00:00.000Z',
    extensionVersion: '1.4.21',
    manifestVersion: 3,
    source: 'manual',
    chromeBookmarks: {
      exportedAt: '2026-05-01T00:00:00.000Z',
      tree
    },
    storage: {
      bookmarkTagIndex: { version: 1, updatedAt: 0, records: {} },
      recycleBin: [],
      ignoreRules: { bookmarks: [], domains: [], folders: [] },
      redirectCache: { savedAt: 0, results: [] },
      newTab: {},
      popupPreferences: null,
      aiRejectedSuggestions,
      aiProviderSettings
    }
  })
}

function createChromeMock({
  store,
  tree,
  created = []
}: {
  store: Record<string, unknown>
  tree: chrome.bookmarks.BookmarkTreeNode[]
  created?: chrome.bookmarks.BookmarkCreateArg[]
}) {
  let nextId = 1000
  return {
    bookmarks: {
      getTree(callback: (nodes: chrome.bookmarks.BookmarkTreeNode[]) => void) {
        setTimeout(() => callback(tree), 0)
      },
      create(payload: chrome.bookmarks.BookmarkCreateArg, callback: (node: chrome.bookmarks.BookmarkTreeNode) => void) {
        created.push({ ...payload })
        const node: chrome.bookmarks.BookmarkTreeNode = {
          id: String(nextId++),
          parentId: payload.parentId,
          title: payload.title || '',
          url: payload.url
        }
        setTimeout(() => callback(node), 0)
      }
    },
    storage: {
      local: {
        get(keys: string[], callback: (items: Record<string, unknown>) => void) {
          const snapshot: Record<string, unknown> = {}
          for (const key of keys) {
            snapshot[key] = store[key]
          }
          setTimeout(() => callback(snapshot), 0)
        },
        set(payload: Record<string, unknown>, callback: () => void) {
          setTimeout(() => {
            Object.assign(store, payload)
            callback()
          }, 0)
        }
      }
    },
    runtime: {}
  }
}

function rootNode(children: chrome.bookmarks.BookmarkTreeNode[]): chrome.bookmarks.BookmarkTreeNode {
  return {
    id: '0',
    title: '',
    children
  }
}

function folderNode(
  id: string,
  title: string,
  children: chrome.bookmarks.BookmarkTreeNode[],
  parentId = '0'
): chrome.bookmarks.BookmarkTreeNode {
  return {
    id,
    parentId,
    title,
    children
  }
}

function bookmarkNode(
  id: string,
  title: string,
  url: string,
  parentId: string
): chrome.bookmarks.BookmarkTreeNode {
  return {
    id,
    parentId,
    title,
    url
  }
}
