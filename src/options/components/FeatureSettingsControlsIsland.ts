import { createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { ThemeProvider } from '../../ui/theme/ThemeProvider.js'
import { FeatureSettingsControls } from './FeatureSettingsControls.js'
import type { FeatureSettingsControlsState } from './feature-settings-types.js'

const roots = new WeakMap<Element, Root>()

export function renderFeatureSettingsControlsIsland(
  container: Element,
  state: FeatureSettingsControlsState
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
      createElement(FeatureSettingsControls, { state })
    )
  )
}
