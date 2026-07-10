import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const newtabCss = readFileSync('src/newtab/newtab.css', 'utf8')
const searchWidget = readFileSync('src/newtab/components/NewtabSearchWidget.tsx', 'utf8')
const speedDial = readFileSync('src/newtab/components/NewtabSpeedDialPanel.tsx', 'utf8')
const controller = readFileSync('src/newtab/newtab-controller.ts', 'utf8')

assert.ok(
  newtabCss.includes('--newtab-glass-bg-hero') &&
    newtabCss.includes('[data-background-media="true"]'),
  'Newtab glass surfaces should strengthen over image and video backgrounds.'
)

assert.ok(
  newtabCss.includes('--newtab-focus-ring') &&
    newtabCss.includes('rgba(71, 168, 255'),
  'Interactive glass surfaces should use the DESIGN.md blue focus ring.'
)

assert.ok(
  searchWidget.includes('data-panel-open') &&
    newtabCss.includes('.newtab-search-shell[data-panel-open="true"]') &&
    newtabCss.includes('border-bottom-color: transparent') &&
    newtabCss.includes('border-top-color: transparent'),
  'Search suggestions should visually connect to the search hero surface.'
)

assert.ok(
  controller.includes('getNewtabSearchFocusIntent') &&
    controller.includes('shouldFocusSearchFromPointerDown'),
  'Typing and blank-surface pointer input should focus newtab search.'
)

assert.ok(
  speedDial.includes('固定入口') &&
    speedDial.includes('添加固定入口') &&
    speedDial.includes('data-content-type'),
  'The empty fixed-entry module should provide a compact, actionable state.'
)

assert.ok(
  newtabCss.includes('@media (max-height: 800px)') &&
    newtabCss.includes('@media (max-height: 680px)') &&
    newtabCss.includes('@media (max-width: 520px) and (max-height: 800px)'),
  'Newtab should adapt density for short desktop viewports.'
)

console.log('newtab UI contract tests passed')
