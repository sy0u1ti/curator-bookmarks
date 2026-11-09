import { availabilityState } from './state.js'
export { formatDateTime } from '../../shared/format.js'

interface PathTitleComparable {
  path?: string
  title?: string
}

export function isInteractionLocked(): boolean {
  return (
    availabilityState.deleting ||
    availabilityState.retestingSelection ||
    availabilityState.stopRequested ||
    availabilityState.runSessionActive
  )
}

export function compareByPathTitle(left: PathTitleComparable, right: PathTitleComparable): number {
  return (
    String(left.path || '').localeCompare(String(right.path || ''), 'zh-CN') ||
    String(left.title || '').localeCompare(String(right.title || ''), 'zh-CN')
  )
}

export function syncSelectionSet(selectionSet: Set<unknown>, validIds: Set<string>): void {
  for (const selectedId of [...selectionSet]) {
    if (!validIds.has(String(selectedId))) {
      selectionSet.delete(selectedId)
    }
  }
}
