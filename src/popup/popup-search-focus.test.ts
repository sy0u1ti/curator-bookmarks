import { getPopupSearchFocusPlan } from './popup-search-focus.js'

function run(): void {
  testCommandIntentFocusDoesNotSelect()
  testInPageShortcutFocusSelects()
}

function testCommandIntentFocusDoesNotSelect(): void {
  const plan = getPopupSearchFocusPlan('command-intent')

  assert(
    plan.select === false,
    'opening the popup from an extension command should not select text typed during startup'
  )
}

function testInPageShortcutFocusSelects(): void {
  const plan = getPopupSearchFocusPlan('in-page-shortcut')

  assert(
    plan.select === true,
    'in-page search shortcuts should keep selecting the existing query for quick replacement'
  )
}

function assert(value: unknown, message: string): void {
  if (!value) {
    throw new Error(message)
  }
}

run()
console.log('Popup search focus tests passed.')
