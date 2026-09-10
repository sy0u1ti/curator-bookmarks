import { createPopupContentRowCache } from './popup-content-row-cache.js'

interface TestRow {
  id: string
  title: string
  active: boolean
  keyboardActive: boolean
  menu: { disabled: boolean }
}

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message)
}

const source = Array.from({ length: 10_000 }, (_, index) => ({
  id: String(index), title: `Bookmark ${index}`
}))
let builds = 0
let busy = false
const buildRows = (): TestRow[] => {
  builds += 1
  return source.map(row => ({ ...row, active: false, keyboardActive: false, menu: { disabled: busy } }))
}
const cache = createPopupContentRowCache<TestRow>('active')
const first = cache.getRows([source, busy], buildRows, 9998)
const second = cache.getRows([source, busy], buildRows, 9999)
assert(builds === 1, 'moving selection in 10,000 rows must not rebuild row data')
assert(first[9998].active && !first[9999].active, 'a delivered snapshot must remain immutable')
assert(!second[9998].active && second[9999].active, 'only the destination must be active')
assert(second[0] === first[0], 'unaffected rows must retain their identity')
assert(second[9999].menu === first[9999].menu, 'moving selection must preserve action menu data')
assert(cache.getRows([source, busy], buildRows, 9999) === second, 'an unchanged render must reuse its array')

const inactive = cache.getRows([source, busy], buildRows, -1)
assert(inactive.every(row => !row.active), 'switching panes must clear the old selection')
assert(cache.getRows([source, busy], buildRows, source.length) === inactive, 'out-of-range selection must stay inactive')

busy = true
const disabled = cache.getRows([source, busy], buildRows, 9999)
assert(disabled[9999].menu.disabled, 'action-state changes must rebuild disabled menu state')
assert(!second[9999].menu.disabled, 'menu invalidation must not mutate previous snapshots')
source[9999].title = 'Updated title'
cache.clear()
const updated = cache.getRows([source, busy], buildRows, 9999)
assert(updated[9999].title === 'Updated title', 'explicit invalidation must pick up in-place enrichment')

const replacement = source.slice(0, 2)
const replaced = cache.getRows([replacement, busy], () => buildRows().slice(0, 2), 9999)
assert(replaced.length === 2 && replaced.every(row => !row.active), 'replacing a source must discard out-of-range selection')

const folderCache = createPopupContentRowCache<TestRow>('keyboardActive')
const folders = folderCache.getRows([source], () => [{ ...updated[0], active: true }], 0)
assert(folders[0].active && folders[0].keyboardActive, 'folder keyboard focus must preserve the selected-folder state')
const unfocused = folderCache.getRows([source], buildRows, -1)
assert(unfocused[0].active && !unfocused[0].keyboardActive, 'leaving the folder pane must only clear keyboard focus')

console.log('Popup content row cache tests passed.')
