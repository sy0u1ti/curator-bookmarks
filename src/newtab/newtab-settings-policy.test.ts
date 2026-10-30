import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  applyIconLayoutPreset,
  DEFAULT_ICON_SETTINGS,
  ICON_LAYOUT_PRESETS,
  normalizeIconSettings,
  type IconLayoutPresetKey
} from './icon-settings.js'
import {
  DEFAULT_SEARCH_LAYOUT,
  getAdaptiveSearchWidthBounds,
  getSearchSizePreset,
  normalizeSearchHeight,
  resetSearchLayout,
  SEARCH_HEIGHT_MAX,
  SEARCH_HEIGHT_MIN,
  SEARCH_SIZE_PRESETS,
  SEARCH_WIDTH_MIN_PX,
  type SearchSizePreset
} from './search-layout.js'
import { createNewtabSearchSettingsView } from './newtab-search-settings-store.js'
import { createSearchWidgetActionState } from './newtab-search-widget-store.js'

assert.equal(normalizeSearchHeight(28), SEARCH_HEIGHT_MIN, 'Old 28px fields must be repaired on hydration.')
assert.equal(normalizeSearchHeight(-100), SEARCH_HEIGHT_MIN)
assert.equal(normalizeSearchHeight(1000), SEARCH_HEIGHT_MAX)
assert.equal(normalizeSearchHeight('44'), 44, 'Numeric values in old backups remain supported.')
assert.equal(normalizeSearchHeight(43.6), 44)
for (const value of [undefined, null, '', ' ', false, true, [], {}, NaN, Infinity, -Infinity, 'invalid']) {
  assert.equal(normalizeSearchHeight(value), DEFAULT_SEARCH_LAYOUT.height, `Invalid height: ${String(value)}`)
}
for (let height = SEARCH_HEIGHT_MIN; height <= SEARCH_HEIGHT_MAX; height++) {
  assert.equal(normalizeSearchHeight(height), height, 'Safe custom heights are not snapped to presets.')
  const controlSize = Math.min(36, Math.max(24, height - 10))
  assert.ok(controlSize >= 24)
  assert.ok((height - controlSize) / 2 >= 5, 'Buttons and focus rings must fit inside the field.')
}
for (const key of Object.keys(SEARCH_SIZE_PRESETS) as SearchSizePreset[]) {
  const height = SEARCH_SIZE_PRESETS[key]
  assert.equal(normalizeSearchHeight(height), height)
  assert.equal(getSearchSizePreset(height), key)
}
assert.equal(getSearchSizePreset(44), 'custom')
assert.equal(getSearchSizePreset(DEFAULT_SEARCH_LAYOUT.height), 'standard')

const customSearch = {
  ...DEFAULT_SEARCH_LAYOUT,
  height: 28,
  width: 62,
  offsetY: 92,
  autoVerticalCenter: true,
  background: 60,
  enabled: true,
  engine: 'bing',
  enabledEngines: ['bing', 'kagi'],
  webSearchEnabled: false,
  openInNewTab: true,
  placeholder: 'Find something',
  naturalSearchEnabled: true
}
const searchSnapshot = structuredClone(customSearch)
assert.equal(createNewtabSearchSettingsView(customSearch).height, SEARCH_HEIGHT_MIN)
const resetSearch = resetSearchLayout(customSearch)
for (const [key, value] of Object.entries(DEFAULT_SEARCH_LAYOUT)) {
  assert.equal(resetSearch[key as keyof typeof DEFAULT_SEARCH_LAYOUT], value)
}
for (const key of ['engine', 'enabledEngines', 'webSearchEnabled', 'openInNewTab', 'placeholder', 'naturalSearchEnabled'] as const) {
  assert.deepEqual(resetSearch[key], customSearch[key], 'A layout reset must not change search behavior.')
}
assert.deepEqual(customSearch, searchSnapshot, 'Resetting a layout must not mutate the original record.')

for (const [viewportWidth, containerWidth, expected] of [
  [1440, 1229, { min: 23, max: 72 }],
  [768, 691, { min: 42, max: 72 }],
  [3218, 1229, { min: 16, max: 38 }],
  [390, 350, { min: 72, max: 72 }],
  [320, 280, { min: 72, max: 72 }],
  [1440, 200, { min: 16, max: 16 }],
  [0, 0, { min: 16, max: 16 }],
  [NaN, NaN, { min: 16, max: 16 }]
] as const) {
  const bounds = getAdaptiveSearchWidthBounds({ viewportWidth, containerWidth })
  assert.deepEqual(bounds, expected)
  const view = createNewtabSearchSettingsView(customSearch, {
    width: bounds, offset: { min: -240, max: 240 }
  })
  assert.equal(view.widthDisabled, bounds.min === bounds.max, 'A width control is useful only when it can change the layout.')
  if (bounds.min !== bounds.max) {
    for (let width = bounds.min; width <= bounds.max; width++) {
      const pixels = width * viewportWidth / 100
      assert.ok(pixels >= SEARCH_WIDTH_MIN_PX && pixels <= containerWidth, 'Every offered width must escape both CSS clamps.')
    }
  }
}
assert.deepEqual(customSearch, searchSnapshot, 'Viewport constraints must not overwrite the saved desktop width.')
for (const viewportWidth of [390, 480, 520]) {
  const bounds = getAdaptiveSearchWidthBounds({
    viewportWidth, containerWidth: viewportWidth - 40, automaticWidth: true
  })
  assert.equal(bounds.min, bounds.max, 'A responsive CSS width must own the entire range, including breakpoint edges.')
}
assert.deepEqual(createSearchWidgetActionState(''), { canSubmit: false, hasInputValue: false })
assert.deepEqual(createSearchWidgetActionState('  '), { canSubmit: false, hasInputValue: true })
assert.deepEqual(createSearchWidgetActionState('GitHub'), { canSubmit: true, hasInputValue: true })

const customIcons = normalizeIconSettings({
  ...DEFAULT_ICON_SETTINGS,
  pageWidth: 63,
  layoutMode: 'fixed',
  columns: 7,
  showTitles: false,
  titleLines: 2,
  verticalCenter: true,
  tileWidth: 210,
  iconShellSize: 34,
  rowGap: 35
})
const iconSnapshot = structuredClone(customIcons)
assert.equal(customIcons.preset, 'custom', 'Existing fine adjustments are preserved until the user chooses a preset.')
for (const key of Object.keys(ICON_LAYOUT_PRESETS) as IconLayoutPresetKey[]) {
  const next = applyIconLayoutPreset(customIcons, key)
  assert.equal(next.preset, key)
  for (const field of ['tileWidth', 'iconShellSize', 'columnGap', 'rowGap', 'folderGap'] as const) {
    assert.equal(next[field], ICON_LAYOUT_PRESETS[key][field], 'One density choice applies a coherent set of dimensions.')
  }
  for (const field of ['pageWidth', 'layoutMode', 'columns', 'showTitles', 'titleLines', 'verticalCenter'] as const) {
    assert.equal(next[field], customIcons[field], 'Density must not reset independent layout preferences.')
  }
  assert.equal(normalizeIconSettings(next).preset, key, 'The selected density survives storage hydration.')
}
assert.deepEqual(customIcons, iconSnapshot)
assert.equal(normalizeIconSettings(DEFAULT_ICON_SETTINGS).preset, 'comfortable')

const drawer = readFileSync('src/newtab/components/SettingsDrawer.tsx', 'utf8')
const classes = readFileSync('src/newtab/components/searchWidgetClasses.ts', 'utf8')
const widget = readFileSync('src/newtab/components/NewtabSearchWidget.tsx', 'utf8')
const controller = readFileSync('src/newtab/newtab-controller.ts', 'utf8')
const css = readFileSync('src/newtab/newtab.css', 'utf8')
for (const id of ['search-height', 'search-offset-y', 'icon-tile-width', 'icon-shell-size', 'icon-column-gap', 'icon-row-gap', 'icon-folder-gap', 'time-clock-size']) {
  assert.ok(!drawer.includes(`id="${id}"`), `${id} is no longer an independent user decision.`)
}
assert.ok(drawer.includes('id="search-size-control"') && drawer.includes('SEARCH_SIZE_PRESETS[key]'))
assert.ok(drawer.includes('searchSettings.enabled ? <>') && drawer.includes('timeSettings.enabled ? <>'))
assert.ok(drawer.includes('searchSettings.webSearchEnabled ? <>'))
assert.ok(drawer.includes("iconPreview.layoutMode === 'fixed' ? (") && drawer.includes('iconPreview.showTitles ? ('))
assert.ok(classes.includes('h-[var(--search-control-size)]') && !classes.includes('inline-flex h-[30px]'))
assert.ok(classes.includes('calc(var(--search-height)_-_10px)'))
assert.ok(widget.includes('normalizeSearchHeight(shell.height)') && !widget.includes('formStyle'))
assert.ok(widget.includes('!view.buttons.engine.disabled ? <>'), 'Local-only search should not render inactive web actions.')
assert.ok(widget.includes('`${SEARCH_WIDTH_MIN_PX}px`') && classes.includes('var(--search-min-width)'), 'The widget and settings share the same minimum width.')
assert.ok(drawer.includes('!searchSettings.widthDisabled ? ('))
assert.ok(classes.includes('var(--search-auto-width,') && css.includes('--search-auto-width: calc(100vw - 40px)'))
assert.ok(controller.includes("getPropertyValue('--search-auto-width')"), 'Settings must use the responsive width declared by CSS, not a separate breakpoint.')
const sliderRow = drawer.slice(drawer.indexOf('function SliderRow('), drawer.indexOf('function SettingsSelect('))
assert.ok(sliderRow.includes('sliderValue: number') && !sliderRow.includes('syncInputState'), 'Controlled slider bounds must not be frozen by the legacy DOM bridge.')
assert.ok(controller.includes("action: createSearchWidgetActionState(getSearchInput()?.value || '')"), 'Reinitializing a view must derive actions from the retained query.')
console.log('New Tab settings: safe dimensions, coherent presets, legacy preferences and contextual controls passed.')
