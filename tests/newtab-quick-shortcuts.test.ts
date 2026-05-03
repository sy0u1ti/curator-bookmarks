import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  DEFAULT_BROWSER_QUICK_SHORTCUTS,
  getBrowserQuickShortcuts,
  normalizeBrowserQuickShortcutsVisible
} from '../src/newtab/quick-shortcuts.js'

test('browser quick shortcuts default to visible and use Chrome built-in pages only', () => {
  assert.equal(normalizeBrowserQuickShortcutsVisible(undefined), true)
  assert.equal(normalizeBrowserQuickShortcutsVisible({}), true)
  assert.equal(normalizeBrowserQuickShortcutsVisible(false), false)

  const shortcuts = getBrowserQuickShortcuts(true)
  assert.deepEqual(
    shortcuts.map((shortcut) => shortcut.url),
    [
      'chrome://history',
      'chrome://downloads',
      'chrome://extensions',
      'chrome://settings/passwords',
      'chrome://settings'
    ]
  )
  assert.ok(shortcuts.every((shortcut) => shortcut.url.startsWith('chrome://')))
  assert.ok(DEFAULT_BROWSER_QUICK_SHORTCUTS.length >= 4)
})

test('browser quick shortcuts filter unsafe custom definitions and return copies', () => {
  const source = [
    {
      id: 'history',
      label: '历史记录',
      detail: 'chrome://history',
      url: 'chrome://history',
      badge: '历'
    },
    {
      id: 'web',
      label: 'External',
      detail: 'https://example.com',
      url: 'https://example.com',
      badge: '外'
    },
    {
      id: '',
      label: 'Empty',
      detail: 'chrome://downloads',
      url: 'chrome://downloads',
      badge: '空'
    }
  ]

  const shortcuts = getBrowserQuickShortcuts(true, source)
  assert.deepEqual(shortcuts.map((shortcut) => shortcut.id), ['history'])

  shortcuts[0].label = 'changed'
  assert.equal(source[0].label, '历史记录')
})

test('browser quick shortcuts can be hidden by settings normalization', () => {
  assert.deepEqual(getBrowserQuickShortcuts(false), [])
})
