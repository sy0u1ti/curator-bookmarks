import test from 'node:test'
import assert from 'node:assert/strict'

import {
  getBackupFileName,
  parseCuratorBackupFile
} from '../src/shared/backup.js'

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
