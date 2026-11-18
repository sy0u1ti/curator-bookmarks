import assert from 'node:assert/strict'
import { searchWithBrowserDefault } from './browser-search.js'

const originalChrome = Object.getOwnPropertyDescriptor(globalThis, 'chrome')
const requests: chrome.search.QueryInfo[] = []
let failure: Error | null = null
Object.defineProperty(globalThis, 'chrome', {
  configurable: true,
  value: {
    search: {
      async query(request: chrome.search.QueryInfo) {
        requests.push(request)
        if (failure) throw failure
      }
    }
  }
})

try {
  await searchWithBrowserDefault('  中文书签 & React  ')
  await searchWithBrowserDefault('research', true)
  assert.deepEqual(requests, [
    { text: '中文书签 & React', disposition: 'CURRENT_TAB' },
    { text: 'research', disposition: 'NEW_TAB' }
  ], 'Chrome must receive the original query and decide the provider.')

  await searchWithBrowserDefault('')
  await searchWithBrowserDefault('   ', true)
  assert.equal(requests.length, 2, 'Blank input must not open a search.')

  failure = new Error('Default search provider is unavailable')
  await assert.rejects(searchWithBrowserDefault('retry'), failure)
  assert.equal(requests.length, 3, 'A failed browser search must not switch to another provider.')
} finally {
  if (originalChrome) Object.defineProperty(globalThis, 'chrome', originalChrome)
  else Reflect.deleteProperty(globalThis, 'chrome')
}

console.log('Browser default search: current/new tab, original query, empty input and failures passed.')
