import assert from 'node:assert/strict'
import { test } from 'node:test'
import { build } from 'esbuild'

const { outputFiles } = await build({
  entryPoints: ['src/newtab/bookmark-move-menu.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false
})
const { buildBookmarkMoveActions } =
  await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`)

test('destinations omit bookmarks, the virtual root, and managed subtrees', () => {
  const actions = buildBookmarkMoveActions([
    { id: '0', title: 'Root', children: [] },
    { id: 'link', title: 'A bookmark', url: 'https://example.com' },
    { id: 'policy', title: 'Managed', unmodifiable: 'managed', children: [{ id: 'managed-child', title: 'Child' }] },
    { id: 'writable', title: 'Inbox', children: [] }
  ], '', () => {})
  assert.deepEqual(actions.map(action => action.id), ['move:writable'])
})

test('a current folder remains navigable but selecting it is disabled', () => {
  const selected = []
  const [parent] = buildBookmarkMoveActions([
    { id: 'parent', title: 'Work', children: [{ id: 'child', title: 'Reading', children: [] }] }
  ], 'parent', id => selected.push(id))
  assert.equal(parent.disabled, false)
  const [here, child] = parent.children()
  assert.equal(here.disabled, true)
  assert.equal(child.disabled, false)
  child.onSelect()
  assert.deepEqual(selected, ['child'])
  assert.equal(child.children, undefined)
})

test('nested destinations are lazy and selecting a parent never moves implicitly', () => {
  const selected = []
  const [parent] = buildBookmarkMoveActions([
    { id: 'parent', title: 'Work', children: [{ id: 'child', title: '', children: [] }] }
  ], '', id => selected.push(id))
  parent.onSelect()
  assert.deepEqual(selected, [])
  assert.equal(typeof parent.children, 'function')
  const [here, child] = parent.children()
  here.onSelect()
  assert.deepEqual(selected, ['parent'])
  assert.ok(child.label)
  assert.equal(buildBookmarkMoveActions([], '', () => {}).length, 0)
})

test('blockedIds omit a folder and its entire descendant subtree to prevent circular moves', () => {
  const selected = []
  const actions = buildBookmarkMoveActions([
    {
      id: '1',
      title: '书签栏',
      children: [
        {
          id: 'self',
          title: '项目组',
          children: [{ id: 'grandchild', title: '子目录', children: [] }]
        },
        { id: 'sibling', title: '归档', children: [] }
      ]
    }
  ], '1', id => selected.push(id), new Set(['self', 'grandchild']))

  assert.equal(actions.length, 1)
  const [here, ...children] = actions[0].children()
  assert.equal(here.disabled, true)
  assert.deepEqual(children.map(item => item.id), ['move:sibling'])
  children[0].onSelect()
  assert.deepEqual(selected, ['sibling'])
})
