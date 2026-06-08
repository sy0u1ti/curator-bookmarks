import { createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { ThemeProvider } from '../../ui/theme/ThemeProvider.js'
import { AiModelTools } from './AiModelTools.js'
import type { AiModelToolsState } from './ai-model-tools-types.js'

const roots = new WeakMap<Element, Root>()

export function renderAiModelToolsIsland(container: Element, state: AiModelToolsState): void {
  let root = roots.get(container)
  if (!root) {
    root = createRoot(container)
    roots.set(container, root)
  }

  root.render(
    createElement(
      ThemeProvider,
      null,
      createElement(AiModelTools, { state })
    )
  )
}
