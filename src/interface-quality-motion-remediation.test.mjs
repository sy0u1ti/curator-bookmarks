import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

const read = (path) => readFileSync(path, 'utf8')

const globals = read('src/styles/globals.css')
const tokens = read('src/styles/tokens.css')
const motionPanel = read('src/ui/motion/MotionPanel.tsx')
const inlineMenu = read('src/ui/base/InlineMenu.tsx')
const numberPop = read('src/ui/motion/NumberPop.tsx')
const textSwap = read('src/ui/motion/TextSwap.tsx')
const newtabApp = read('src/newtab/NewtabApp.tsx')
const settingsDrawer = read('src/newtab/components/SettingsDrawer.tsx')
const settingsDrawerMode = read('src/newtab/settings-drawer-mode.ts')
const bookmarkClasses = read('src/newtab/components/bookmarkTileClasses.ts')
const folderClasses = read('src/newtab/components/folderSectionClasses.ts')
const speedDialClasses = read('src/newtab/components/speedDialClasses.ts')
const bookmarkContent = read('src/newtab/components/NewtabBookmarkContent.tsx')
const speedDial = read('src/newtab/components/NewtabSpeedDialPanel.tsx')
const newtabController = read('src/newtab/newtab-controller.ts')
const dashboardController = read('src/options/sections/dashboard-controller.ts')
const popupChips = read('src/popup/components/PopupSearchChips.tsx')
const popupStatus = read('src/popup/components/PopupAutoAnalyzeStatus.tsx')
const optionsChrome = read('src/options/components/options-chrome-classes.ts')

assert.ok(
  motionPanel.includes('curator-overlay-panel') &&
    !motionPanel.includes('motion/react') &&
    inlineMenu.includes('keepMounted') &&
    !existsSync('src/ui/motion/useTimedPresence.ts'),
  'Shared overlays must use Base UI presence without a second timer-driven lifecycle.'
)

assert.ok(
  numberPop.includes('animate = false') &&
    textSwap.includes('animate = false') &&
    !numberPop.includes('requestAnimationFrame') &&
    !numberPop.includes('setTimeout') &&
    !textSwap.includes('setTimeout'),
  'Live numbers and replacement text must expose the latest value immediately.'
)

assert.ok(
  globals.includes('@media (prefers-reduced-transparency: reduce)') &&
    globals.includes('@media (prefers-contrast: more)') &&
    ['top', 'bottom', 'left', 'right'].every((side) => globals.includes(`[data-side="${side}"]`)) &&
    globals.includes('transition-property: opacity !important') &&
    tokens.includes('--ds-motion-fast: 130ms') &&
    tokens.includes('--drag-settle-dur: 160ms'),
  'Central motion and accessibility preferences must provide bounded feedback and material fallbacks.'
)

assert.ok(
  settingsDrawerMode.includes("'(max-width: 600px)'") &&
    settingsDrawer.includes("modal={modal ? 'trap-focus' : false}") &&
    newtabApp.includes('settingsDrawer.open && settingsDrawerModal') &&
    newtabApp.includes('id="newtab-settings-backdrop"') &&
    newtabApp.includes('aria-hidden="true"') &&
    newtabApp.includes('tabIndex={-1}'),
  'The settings drawer must be non-modal on desktop and full-screen modal only at narrow widths.'
)

assert.ok(
  bookmarkClasses.includes('touch-pan-y') &&
    bookmarkClasses.includes('h-10 w-10') &&
    speedDialClasses.includes('touch-pan-y') &&
    speedDialClasses.includes('h-10 w-10') &&
    folderClasses.includes('curator-compact-hit-target') &&
    bookmarkContent.includes('data-bookmark-drag-handle') &&
    speedDial.includes('data-speed-dial-drag-handle'),
  'Coarse pointers need dedicated 40px drag affordances while card bodies retain vertical panning.'
)

assert.ok(
  newtabController.includes('event.clientX - rect.left') &&
    newtabController.includes('event.clientY - rect.top') &&
    newtabController.includes('setPointerCapture') &&
    newtabController.includes("getMotionDurationMs('--drag-settle-dur'") &&
    dashboardController.includes('event.clientX - cardRect.left') &&
    dashboardController.includes('event.clientY - cardRect.top') &&
    dashboardController.includes("getMotionDurationMs('--drag-settle-dur'"),
  'Bookmark and Dashboard drag previews must preserve grab offset and settle with the shared token.'
)

assert.ok(
  bookmarkContent.includes('aria-keyshortcuts') &&
    bookmarkContent.includes('aria-live="polite"') &&
    speedDial.includes('aria-keyshortcuts') &&
    newtabController.includes('reorderBookmarkByKeyboard') &&
    newtabController.includes('reorderSpeedDialByKeyboard') &&
    newtabController.includes('reorderFolderByKeyboard'),
  'Every New Tab reorder path must have keyboard commands, focus follow-through, and announcements.'
)

assert.ok(
  !popupChips.includes('purple') &&
    !popupChips.includes('amber') &&
    !popupChips.includes('green') &&
    popupStatus.includes('bg-ds-surface') &&
    !optionsChrome.includes('before:content-["-"]'),
  'Routine filters, statuses, and navigation must avoid arbitrary semantic color and terminal decoration.'
)

const layoutMotionSources = [
  globals,
  read('src/newtab/newtab.css'),
  read('src/options/components/AvailabilityDecisionPanel.tsx')
].join('\n')
assert.ok(
  !/transition(?:-property|\s*:|-)\s*[^;\n]*(?:width|min-height|height|margin|left|top)/i.test(layoutMotionSources),
  'Shared and high-frequency motion must not transition layout properties.'
)

console.log('Interface quality and motion remediation contract tests passed.')
