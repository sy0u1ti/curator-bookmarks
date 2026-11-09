import { createUiViewStoreSlice, useUiViewStoreSlice } from '../../shared/ui-view-store.js'

export interface OptionsUndoToastView {
  busy: boolean
  detail: string
  id: string
  title: string
  undoable: boolean
}

let sequence = 0
let undoHandler: (() => Promise<void> | void) | null = null
const undoToastStore = createUiViewStoreSlice<OptionsUndoToastView | null>('options', 'undo-toast', null)

export function showOptionsUndoToast({
  detail = '',
  onUndo,
  title
}: {
  detail?: string
  onUndo?: () => Promise<void> | void
  title: string
}): void {
  undoHandler = onUndo || null
  sequence += 1
  undoToastStore.setState({ busy: false, detail, id: `options-undo-${sequence}`, title, undoable: Boolean(onUndo) })
}

export function dismissOptionsUndoToast(): void {
  undoHandler = null
  undoToastStore.setState(null)
}

export async function dispatchOptionsUndo(): Promise<void> {
  const handler = undoHandler
  const view = undoToastStore.getState()
  if (!handler || !view || view.busy) return
  undoHandler = null
  undoToastStore.setState({ ...view, busy: true })
  try {
    await handler()
  } finally {
    const current = undoToastStore.getState()
    if (current?.id === view.id) undoToastStore.setState(null)
  }
}

export function useOptionsUndoToastView(): OptionsUndoToastView | null {
  return useUiViewStoreSlice(undoToastStore)
}
