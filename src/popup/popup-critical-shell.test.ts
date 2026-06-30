import { readFileSync } from 'node:fs'

function run(): void {
  const html = readFileSync('src/popup/popup.html', 'utf8')
  const main = readFileSync('src/popup/main.tsx', 'utf8')

  assert(html.includes('background: transparent;'), 'critical shell must keep the provisional viewport transparent')
  assert(html.includes('#popup-root[data-popup-ready="true"]'), 'critical shell must gate popup visibility')
  assert(html.includes('visibility: hidden;'), 'critical shell must hide root before popup styles are ready')
  assert(html.includes('contain: size layout paint;'), 'critical shell must isolate the fixed 800x600 root')
  assert(main.includes("removeAttribute('data-popup-ready')"), 'popup must hide the last compositor surface before close')
  assert(main.includes("'pagehide'"), 'popup close guard must run before the action popup is discarded')
  assert(main.includes("'visibilitychange'"), 'popup close guard must run when Chrome hides the action popup')
}

function assert(value: unknown, message: string): void {
  if (!value) {
    throw new Error(message)
  }
}

run()
console.log('Popup critical shell tests passed.')
