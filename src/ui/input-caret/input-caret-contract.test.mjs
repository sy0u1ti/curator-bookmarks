import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(path, 'utf8')
const globalsCss = read('src/styles/globals.css')
const caretCss = read('src/styles/input-caret.css')
const controller = read('src/ui/input-caret/input-caret-controller.ts')
const settings = read('src/options/components/InputCaretSettings.tsx')
const preferences = read('src/shared/popup-preferences.ts')

assert(
  globalsCss.includes('@import "./input-caret.css";'),
  'every extension surface must load the shared input caret stylesheet'
)

assert(
  caretCss.includes('--curator-input-caret-color: #ffffff;') &&
    caretCss.includes('caret-color: var(--curator-input-caret-color);') &&
    caretCss.includes('background: var(--curator-input-caret-color);') &&
    caretCss.includes('input[data-curator-input-caret="true"]') &&
    caretCss.includes('textarea[data-curator-input-caret="true"]') &&
    caretCss.includes('.curator-input-caret-trail') &&
    caretCss.includes('transition: transform var(--ds-motion-feedback) var(--ease-smooth-out);'),
  'the global caret must be white, motion-token driven, win over surface caret colors, hide the native caret and retain its trail'
)

assert(
  controller.includes('HTMLTextAreaElement') &&
    controller.includes('HTMLInputElement') &&
    controller.includes('maskInputCaretPasswordText') &&
    controller.includes('dataset.motionKeyboard = \'preserve\'') &&
    controller.includes('INPUT_CARET_BIDI_PATTERN') &&
    controller.includes('selectionStart') &&
    controller.includes('scrollLeft'),
  'the document-level controller must cover text inputs, password masks, textareas, bidi text and scrolling'
)

assert(
  /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.curator-input-caret\s*\{[^}]*transition:\s*none\s*!important;/s.test(caretCss) &&
    /@media \(forced-colors: active\)[\s\S]*?input\[data-curator-input-caret="true"\]\s*,\s*textarea\[data-curator-input-caret="true"\]\s*\{[^}]*caret-color:\s*auto;/s.test(caretCss),
  'the global caret must fall back to static or native rendering for reduced motion and forced colours'
)

for (const path of [
  'src/popup/PopupApp.tsx',
  'src/options/OptionsApp.tsx',
  'src/newtab/NewtabApp.tsx',
  'src/archive/main.tsx'
]) {
  const source = read(path)
  assert(
    source.includes('InputCaretHost') && source.includes('<InputCaretHost'),
    `${path} must mount the shared input caret controller`
  )
}

assert(
  settings.includes('所有输入框') &&
    settings.includes('animatedCaret') &&
    preferences.includes('source.animatedSearchCaret'),
  'the settings switch must control every input and migrate the earlier popup-only preference'
)

console.log('Global input caret contracts passed.')
