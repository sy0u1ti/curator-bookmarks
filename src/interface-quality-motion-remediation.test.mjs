import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

const read = (path) => readFileSync(path, 'utf8')

const globals = read('src/styles/globals.css')
const newtabCss = read('src/newtab/newtab.css')
const tokens = read('src/styles/tokens.css')
const tailwind = read('src/styles/tailwind.css')
const motionPanel = read('src/ui/motion/MotionPanel.tsx')
const motionEntrance = read('src/ui/motion/useMotionEntrance.ts')
const modelSelector = read('src/ui/ai/ModelSelector.tsx')
const inlineMenu = read('src/ui/base/InlineMenu.tsx')
const checkbox = read('src/ui/base/Checkbox.tsx')
const switchControl = read('src/ui/base/Switch.tsx')
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
const popupChips = read('src/popup/components/PopupSearchChips.tsx')
const popupStatus = read('src/popup/components/PopupAutoAnalyzeStatus.tsx')
const popupToasts = read('src/popup/components/PopupToasts.tsx')
const popupModals = read('src/popup/components/PopupModalsHost.tsx')
const optionsChrome = read('src/options/components/options-chrome-classes.ts')
const optionsCss = read('src/options/options.css')
const aiProviderSettingsClasses = read('src/options/components/ai-provider-settings-classes.ts')
const optionsModalClasses = read('src/options/components/options-modal-classes.ts')

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
    globals.includes('font-variant-numeric: tabular-nums') &&
    !numberPop.includes('requestAnimationFrame') &&
    !numberPop.includes('setTimeout') &&
    !textSwap.includes('setTimeout'),
  'Live numbers and replacement text must expose the latest value immediately.'
)

assert.ok(
  tokens.includes('--duration-quick: 150ms') &&
    tokens.includes('--ease-smooth-out: cubic-bezier(0.22, 1, 0.36, 1)') &&
    tokens.includes('--check-draw: var(--duration-medium)') &&
    globals.includes('.t-check svg path') &&
    checkbox.includes("'t-check flex") &&
    checkbox.includes('keepMounted={!unstyled}'),
  'Shared motion tokens and checkbox stroke drawing must stay centralized and replayable.'
)

assert.ok(
  popupToasts.includes("'t-toast pointer-events-auto") &&
    !popupToasts.includes('will-change-transform') &&
    popupModals.includes('CollapsibleRoot') &&
    popupModals.includes('CollapsiblePanel') &&
    popupModals.includes('t-acc-chevron') &&
    !popupModals.includes('hidden={!view.folderPickerOpen}') &&
    !switchControl.includes('will-change-transform'),
  'Transient feedback and disclosures must reuse shared presence motion without persistent layer promotion.'
)

assert.ok(
  motionEntrance.includes('entered: active') &&
    globals.includes('.curator-motion-surface[data-motion-enter="true"]') &&
    !/@starting-style\s*{\s*\.curator-motion-surface\s*{/.test(globals),
  'Initial page content must paint settled; entrance motion is opt-in after the first commit.'
)

assert.ok(
  tokens.includes('"Segoe UI Variable Text"') &&
    tokens.includes('system-ui') &&
    tailwind.includes('"Segoe UI Variable Text"') &&
    tailwind.includes('system-ui') &&
    globals.includes('font-synthesis: none') &&
    /@layer base\s*\{[\s\S]*?button,[\s\S]*?font: inherit;[\s\S]*?\}/.test(globals),
  'The critical and utility font stacks must keep stable platform metrics when Geist is unavailable.'
)

assert.ok(
  (globals.includes('@media (prefers-reduced-transparency: reduce)') ||
    newtabCss.includes('@media (prefers-reduced-transparency: reduce)')) &&
    globals.includes('@media (prefers-contrast: more)') &&
    ['top', 'bottom', 'left', 'right'].every((side) => globals.includes(`[data-side="${side}"]`)) &&
    globals.includes('transition-property: opacity !important') &&
    tokens.includes('--ds-motion-fast: 130ms') &&
    tokens.includes('--drag-settle-dur: 160ms'),
  'Central motion and accessibility preferences must provide bounded feedback and material fallbacks.'
)

assert.ok(
  modelSelector.includes('model-selector-content') &&
    modelSelector.includes('touch-manipulation') &&
    globals.includes('.model-selector-content[data-starting-style]') &&
    globals.includes('translate: -50% -50% !important') &&
    globals.includes('scale: 1 !important'),
  'The shared model selector must keep direct press feedback and use a non-spatial reduced-motion modal.'
)

assert.ok(
  aiProviderSettingsClasses.includes('options-modal-backdrop ai-provider-dialog-backdrop') &&
    aiProviderSettingsClasses.includes('options-modal-panel ai-provider-dialog-panel') &&
    aiProviderSettingsClasses.includes('ai-provider-advanced-trigger') &&
    optionsModalClasses.includes('folder-picker-toggle-icon') &&
    optionsModalClasses.includes('folder-picker-card') &&
    optionsCss.includes('.ai-provider-dialog-panel[data-starting-style]') &&
    optionsCss.includes('scale: 1 !important') &&
    optionsCss.includes('.ai-provider-advanced-trigger::after') &&
    optionsCss.includes('.folder-picker-toggle:active') &&
    optionsCss.includes('@media (prefers-reduced-transparency: reduce)'),
  'The AI provider dialog must keep its centered geometry while honoring reduced motion and transparency.'
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
    newtabController.includes("getMotionDurationMs('--drag-settle-dur'"),
  'Bookmark drag previews must preserve grab offset and settle with the shared token.'
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
