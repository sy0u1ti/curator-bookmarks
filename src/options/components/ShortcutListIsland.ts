import { createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { ThemeProvider } from '../../ui/theme/ThemeProvider.js'
import { ShortcutControls } from './ShortcutControls.js'
import type { ShortcutControlsState } from './shortcut-types.js'

const roots = new WeakMap<Element, Root>()

export function renderShortcutControlsIsland(container: Element, state: ShortcutControlsState): void {
  let root = roots.get(container)
  if (!root) {
    root = createRoot(container)
    roots.set(container, root)
  }

  root.render(
    createElement(
      ThemeProvider,
      null,
      createElement(ShortcutControls, { state })
    )
  )
}
