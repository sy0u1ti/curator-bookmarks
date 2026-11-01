import { useEffect, useLayoutEffect, useRef, useState, type RefCallback } from 'react'
import { shouldSkipMotion } from '../../shared/motion'
import { reconcileListExit, type ListExitEntry } from './list-exit-state'

export type { ListExitEntry } from './list-exit-state'

export type MountedListEntry<T> = ListExitEntry<T> & { ref: RefCallback<HTMLDivElement> }
type ExitWork<T> = { entry: ListExitEntry<T>; cancel: () => void }

/** Data changes immediately; the same inert DOM row finishes its current exit. */
export function useListExit<T>(
  items: readonly T[],
  getKey: (item: T) => string,
  scope?: string
): Array<MountedListEntry<T>> {
  const current = items.map(item => ({ item, key: getKey(item), exiting: false }))
  const [state, setState] = useState(() => ({ input: current, entries: current, scope }))
  const nodes = useRef(new Map<string, HTMLDivElement>())
  const callbacks = useRef(new Map<string, RefCallback<HTMLDivElement>>())
  const work = useRef(new Map<string, ExitWork<T>>())
  const retain = !shouldSkipMotion()
  const changed = state.input.length !== current.length ||
    state.input.some((entry, index) => entry.key !== current[index].key || entry.item !== current[index].item)

  if (changed || state.scope !== scope || (!retain && state.entries.some(entry => entry.exiting))) {
    setState({ input: current, entries: reconcileListExit(state.entries, current, retain && state.scope === scope), scope })
  }

  useLayoutEffect(() => {
    const keys = new Set(state.entries.map(entry => entry.key))
    const exits = new Set(state.entries.filter(entry => entry.exiting))
    for (const [key, task] of work.current) {
      if (exits.has(task.entry)) continue
      task.cancel()
      work.current.delete(key)
    }
    for (const key of callbacks.current.keys()) {
      if (!keys.has(key)) callbacks.current.delete(key)
    }
    for (const entry of exits) {
      if (work.current.has(entry.key)) continue
      let canceled = false
      let frame = 0
      const finish = () => {
        if (canceled) return
        work.current.delete(entry.key)
        setState(state => state.entries.includes(entry)
          ? { ...state, entries: state.entries.filter(item => item !== entry) }
          : state)
      }
      work.current.set(entry.key, { entry, cancel: () => { canceled = true; cancelAnimationFrame(frame) } })
      const node = nodes.current.get(entry.key)
      const wait = () => {
        if (canceled) return
        const animations = node?.getAnimations().filter(animation =>
          animation.effect?.getTiming().iterations !== Infinity && animation.playState !== 'finished'
        ) ?? []
        if (!animations.length || shouldSkipMotion()) { finish(); return }
        Promise.all(animations.map(animation => animation.finished)).then(finish, () => {
          // Preference changes and retargets can cancel a transition. Recheck
          // its replacement instead of running a stale completion timer.
          if (!canceled) frame = requestAnimationFrame(wait)
        })
      }
      wait()
    }
  }, [state.entries])

  useEffect(() => () => {
    for (const task of work.current.values()) task.cancel()
    work.current.clear()
  }, [])

  return state.entries.map(entry => {
    let ref = callbacks.current.get(entry.key)
    if (!ref) {
      ref = node => {
        if (node) nodes.current.set(entry.key, node)
        else nodes.current.delete(entry.key)
      }
      callbacks.current.set(entry.key, ref)
    }
    return { ...entry, ref }
  })
}
