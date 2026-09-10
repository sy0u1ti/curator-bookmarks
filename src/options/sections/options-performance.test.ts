import assert from 'node:assert/strict'
import test from 'node:test'
import { availabilityState, managerState } from '../shared-options/state.js'
import { applyDuplicateStrategy, deleteSelectedDuplicates } from './duplicates.js'
import { deleteSelectedRedirects, updateSelectedRedirects } from './redirects.js'

function duplicateFixture(groupCount: number) {
  let groupReads = 0
  let bookmarkReads = 0
  const groups = Array.from({ length: groupCount }, (_, index) => {
    const item = (offset: number) => ({
      get id() { bookmarkReads++; return `bookmark-${index * 2 + offset}` },
      url: `https://example.test/${index}`,
      dateAdded: offset,
      path: 'Bookmarks',
      title: `Bookmark ${index}`
    })
    return {
      get id() { groupReads++; return `group-${index}` },
      items: [item(1), item(0)],
      latestItemId: `bookmark-${index * 2 + 1}`,
      oldestItemId: `bookmark-${index * 2}`,
      recommendedKeepId: `bookmark-${index * 2 + 1}`
    }
  })
  managerState.duplicateGroups = groups
  managerState.selectedDuplicateIds = new Set()
  return {
    resetReads() { groupReads = 0; bookmarkReads = 0 },
    reads() { return { groups: groupReads, bookmarks: bookmarkReads } }
  }
}

test('applying a duplicate strategy visits the catalog linearly and keeps the selected version', () => {
  const count = 1000
  const fixture = duplicateFixture(count)
  let renders = 0
  applyDuplicateStrategy('newest', { renderAvailabilitySection() { renders++ } })
  assert.equal(renders, 1)
  assert.equal(managerState.selectedDuplicateIds.size, count)
  for (let index = 0; index < count; index++) {
    assert.ok(managerState.selectedDuplicateIds.has(`bookmark-${index * 2}`))
    assert.ok(!managerState.selectedDuplicateIds.has(`bookmark-${index * 2 + 1}`))
  }
  assert.ok(fixture.reads().groups <= count * 2, `Repeated group scans: ${JSON.stringify(fixture.reads())}`)
})

test('duplicate deletion preview visits each selected bookmark without rescanning every group', async () => {
  const count = 1000
  const fixture = duplicateFixture(count)
  managerState.selectedDuplicateIds = new Set(Array.from({ length: count }, (_, index) => `bookmark-${index * 2}`))
  let confirmation = ''
  await deleteSelectedDuplicates({
    confirm: async ({ title, copy }) => { confirmation = `${title} ${copy}`; return false },
    renderAvailabilitySection() {}
  })
  assert.match(confirmation, /1000 条重复书签/)
  assert.match(confirmation, /保留 1000 条/)
  assert.equal(managerState.selectedDuplicateIds.size, count, 'Cancelling preserves the current selection')
  assert.ok(fixture.reads().bookmarks <= count * 10, `Repeated bookmark scans: ${JSON.stringify(fixture.reads())}`)
})

test('duplicate deletion still blocks a selection that would empty a group', async () => {
  duplicateFixture(1)
  managerState.selectedDuplicateIds = new Set(['bookmark-0', 'bookmark-1'])
  let confirmed = false
  await deleteSelectedDuplicates({
    confirm: async () => { confirmed = true; return false },
    renderAvailabilitySection() {}
  })
  assert.equal(confirmed, false)
  assert.match(availabilityState.lastError, /每组至少需要保留 1 条/)
})

test('redirect previews retain selected current results and ignore stale selection ids', async () => {
  availabilityState.lastCompletedAt = 1
  availabilityState.redirectResults = Array.from({ length: 2000 }, (_, index) => ({
    id: `redirect-${index}`,
    title: `Redirect ${index}`,
    url: `https://example.test/${index}`,
    finalUrl: `https://example.test/${index}/updated`,
    status: 'redirected'
  }))
  managerState.selectedRedirectIds = new Set(['redirect-0', 'redirect-1999', 'stale-id'])
  const confirmations: string[] = []
  const callbacks = {
    getCurrentAvailabilityScopeMeta: () => ({ key: 'all', type: 'all' }),
    confirm: async ({ title }) => { confirmations.push(title); return false },
    renderAvailabilitySection() {}
  }
  await updateSelectedRedirects(callbacks)
  await deleteSelectedRedirects(callbacks)
  assert.deepEqual(confirmations, ['更新 2 条重定向书签 URL？', '删除 2 条重定向书签？'])
  assert.equal(managerState.selectedRedirectIds.size, 3)
})
