import assert from 'node:assert/strict'
import { buildMinimalBookmarkMoveOperations } from './interactions.js'

function permutations(values: string[]): string[][] {
  if (values.length < 2) return [values]
  return values.flatMap((value, index) => permutations(values.filter((_, cursor) => cursor !== index))
    .map((tail) => [value, ...tail]))
}

const original = ['a', 'b', 'c', 'd']
for (let mask = 0; mask < 32; mask += 1) {
  const children: string[] = []
  for (let index = 0; index <= original.length; index += 1) {
    if (mask & (1 << index)) children.push(`folder-${index}`)
    if (index < original.length) children.push(original[index])
  }
  for (const target of permutations(original)) {
    let nextIndex = 0
    const expected = children.map((id) => id.startsWith('folder-') ? id : target[nextIndex++])
    const operations = buildMinimalBookmarkMoveOperations(original, target, 'parent', children.map((id) => ({ id })))
    const actual = [...children]
    for (const operation of operations) {
      assert.ok(original.includes(operation.id), 'Reordering must never move a folder.')
      const from = actual.indexOf(operation.id)
      const to = operation.index > from ? operation.index - 1 : operation.index
      actual.splice(from, 1)
      actual.splice(to, 0, operation.id)
    }
    assert.deepEqual(actual, expected, `${JSON.stringify(children)} -> ${JSON.stringify(target)}`)
  }
}
assert.equal(buildMinimalBookmarkMoveOperations(original, ['d', 'a', 'b', 'c'], 'parent').length, 1,
  'Dragging one bookmark must retain the minimal single Chrome move.')
assert.deepEqual(buildMinimalBookmarkMoveOperations(['a'], ['missing'], 'parent'), [])
console.log('New Tab mixed-sibling bookmark ordering tests passed (768 permutations).')
