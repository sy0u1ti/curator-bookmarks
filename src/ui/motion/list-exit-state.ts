export interface ListExitEntry<T> {
  exiting: boolean
  item: T
  key: string
}

/** Keep removed rows in the same keyed tree before React commits the update. */
export function reconcileListExit<T>(
  previous: readonly ListExitEntry<T>[],
  current: readonly ListExitEntry<T>[],
  retain: boolean
): ListExitEntry<T>[] {
  if (!retain) return [...current]
  const keys = new Set(current.map(entry => entry.key))
  const before = new Map<string | undefined, ListExitEntry<T>[]>()
  let following: string | undefined
  let tailAnchor: string | undefined
  for (let index = previous.length - 1; index >= 0; index--) {
    const entry = previous[index]
    if (keys.has(entry.key)) {
      tailAnchor ??= entry.key
      following = entry.key
      continue
    }
    const bucket = before.get(following) ?? []
    bucket.push(entry.exiting ? entry : { ...entry, exiting: true })
    before.set(following, bucket)
  }
  const next: ListExitEntry<T>[] = []
  const appendBefore = (key: string | undefined) => {
    const bucket = before.get(key) ?? []
    for (let index = bucket.length - 1; index >= 0; index--) next.push(bucket[index])
  }
  if (tailAnchor === undefined) appendBefore(undefined)
  for (const entry of current) {
    appendBefore(entry.key)
    next.push(entry)
    if (entry.key === tailAnchor) appendBefore(undefined)
  }
  return next
}
