import { createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { ThemeProvider } from '../../ui/theme/ThemeProvider.js'
import { ContentSnapshotControls } from './ContentSnapshotControls.js'
import type { ContentSnapshotControlsState } from './content-snapshot-types.js'

const roots = new WeakMap<Element, Root>()

export function renderContentSnapshotControlsIsland(
  container: Element,
  state: ContentSnapshotControlsState
): void {
  let root = roots.get(container)
  if (!root) {
    root = createRoot(container)
    roots.set(container, root)
  }

  root.render(
    createElement(
      ThemeProvider,
      null,
      createElement(ContentSnapshotControls, { state })
    )
  )
}
