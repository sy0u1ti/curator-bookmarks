import { readFileSync } from 'node:fs'
import { POPUP_SELECTION_EASING, POPUP_SELECTION_MOVE_MS } from './popup-scroll-follow.js'

const css = readFileSync('src/popup/popup.css', 'utf8')
const sharedCss = readFileSync('src/styles/globals.css', 'utf8')
const tokens = readFileSync('src/styles/tokens.css', 'utf8')
const contentSource = readFileSync('src/popup/components/PopupContent.tsx', 'utf8')
const contentHostSource = readFileSync('src/popup/components/PopupContentHost.tsx', 'utf8')

assert(
  !css.includes('#popup-app-shell[data-keyboard-nav="true"] .popup-active-result-indicator[data-visible="true"]'),
  'Active result indicator visibility must not depend on keyboard navigation timing.'
)

const indicatorVisibleRule = getCssRule('.popup-active-result-indicator[data-visible="true"]')
assert(
  /opacity:\s*1\s*;/.test(indicatorVisibleRule),
  'Visible active result indicator should remain opaque while an active row exists.'
)

const indicatorRule = getCssRule('.popup-active-result-indicator')
assert(
  !/transition:\s*[\s\S]*\bwidth\b/.test(indicatorRule) &&
    !/transition:\s*[\s\S]*\bheight\b/.test(indicatorRule) &&
    !/will-change:\s*[^;]*\bwidth\b/.test(indicatorRule) &&
    !/will-change:\s*[^;]*\bheight\b/.test(indicatorRule) &&
    /transform\s+var\(--popup-selection-move-dur\)\s+var\(--ease-smooth-out\)/.test(indicatorRule),
  'Active result indicator size should follow active-row resize directly instead of double-easing width or height.'
)

assert(
  /--popup-selection-move-dur:\s*100ms\s*;/.test(indicatorRule) &&
    /opacity\s+var\(--duration-micro\)\s+var\(--ease-smooth-out\)/.test(indicatorRule) &&
    /--duration-micro:\s*80ms\s*;/.test(tokens) &&
    /--ease-smooth-out:\s*cubic-bezier\(0\.22,\s*1,\s*0\.36,\s*1\)/.test(tokens),
  'Keep the user-tuned 100ms translation and 80ms fade, independent of shared Magpie motion roles.'
)
assert(
  POPUP_SELECTION_MOVE_MS === 100 && POPUP_SELECTION_EASING === 'cubic-bezier(0.22, 1, 0.36, 1)' &&
    !/\.popup-active-result-indicator\[data-scroll-edge\]\s*\{[^}]*transition-property:\s*opacity/.test(css),
  'Entering and reversing a hold must retain the same 100ms journey instead of disabling transform transitions.'
)
assert(
  /\.popup-main-list,\s*\.popup-folder-tree\s*\{\s*overflow-anchor:\s*none;/.test(css),
  'Virtual scroll ownership applies to taps and wheel changes too, not only the held-key state.'
)

const hiddenIndicatorRule = getCssRule('.popup-active-result-indicator:not([data-visible="true"])')
assert(
  !/\btransform\b/.test(hiddenIndicatorRule),
  'A hidden indicator should snap to its measured destination before fading in.'
)

const activeButtonRule = getCssRule('.popup-list-button[data-active="true"]')
assert(
  /background:\s*transparent\s*;/.test(activeButtonRule) && /box-shadow:\s*none\s*;/.test(activeButtonRule),
  'Active row background should come from the moving indicator layer, not the row button.'
)

assert(
  !css.includes('#popup-app-shell[data-keyboard-nav="true"] .popup-active-result-indicator'),
  'Keyboard navigation should reuse the same short, interruptible indicator translation as pointer input.'
)

const indicatorMarkup = contentSource.match(/<div\s+className=\{activeResultIndicatorClass\}[^>]*>/)?.[0] || ''
assert(
  indicatorMarkup.includes('data-motion-keyboard="preserve"') &&
    sharedCss.includes(':root[data-motion-input="keyboard"] *:not([data-motion-keyboard="preserve"])') &&
    !/:root\[data-motion-input="keyboard"\]\s+\*(?:\s*[,{}]|::)/.test(sharedCss),
  'The global keyboard policy must exempt the explicitly retained indicator, not suppress its translation.'
)

assert(
  /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.popup-active-result-indicator,\s*\.popup-folder-picker-card::after\s*\{\s*transition:\s*none\s*!important;/.test(css),
  'The keyboard exception must still honor reduced motion by snapping the selection indicator.'
)

assert(
  contentHostSource.includes('new ResizeObserver') &&
    contentHostSource.includes('observer.observe(observedTarget)') &&
    contentHostSource.includes('observer.disconnect()'),
  'Active result indicator should remeasure when the active row target resizes.'
)

function getCssRule(selector: string): string {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = css.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`, 'm'))
  if (!match) {
    throw new Error(`Missing CSS rule for ${selector}`)
  }

  return match[1]
}

function assert(value: unknown, message: string): void {
  if (!value) {
    throw new Error(message)
  }
}

console.log('Popup active result indicator style tests passed.')
