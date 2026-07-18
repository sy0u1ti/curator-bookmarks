import assert from 'node:assert/strict'
import {
  dispatchNewtabBookmarkChanged,
  dispatchNewtabBookmarkCreated,
  dispatchNewtabBookmarkMoved,
  dispatchNewtabBookmarkRemoved,
  registerNewtabBookmarkEventActions
} from './newtab-bookmark-events-store.js'

const received: string[] = []

dispatchNewtabBookmarkChanged('before-change', { title: 'Updated' })
dispatchNewtabBookmarkCreated('before-create', {
  id: 'before-create',
  parentId: '1',
  syncing: false,
  title: 'Created',
  url: 'https://example.com'
})

const unregister = registerNewtabBookmarkEventActions({
  onChanged: (bookmarkId) => received.push(`changed:${bookmarkId}`),
  onCreated: (bookmarkId) => received.push(`created:${bookmarkId}`),
  onMoved: (bookmarkId) => received.push(`moved:${bookmarkId}`),
  onRemoved: (bookmarkId) => received.push(`removed:${bookmarkId}`)
})

assert.deepEqual(received, ['changed:before-change', 'created:before-create'])

dispatchNewtabBookmarkMoved('after-move', {
  index: 0,
  oldIndex: 1,
  oldParentId: '1',
  parentId: '2'
})
assert.equal(received.at(-1), 'moved:after-move')

unregister()
dispatchNewtabBookmarkRemoved('between-registers', {
  index: 0,
  node: {
    id: 'between-registers',
    parentId: '1',
    syncing: false,
    title: 'Removed',
    url: 'https://example.com'
  },
  parentId: '1'
})

registerNewtabBookmarkEventActions({
  onChanged: (bookmarkId) => received.push(`changed-2:${bookmarkId}`),
  onCreated: (bookmarkId) => received.push(`created-2:${bookmarkId}`),
  onMoved: (bookmarkId) => received.push(`moved-2:${bookmarkId}`),
  onRemoved: (bookmarkId) => received.push(`removed-2:${bookmarkId}`)
})

assert.equal(received.at(-1), 'removed-2:between-registers')

console.log('Newtab bookmark event queue tests passed.')
