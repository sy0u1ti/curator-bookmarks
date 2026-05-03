import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

function readProjectFile(path) {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

test('newtab root is not a page-wide live region', () => {
  const newtabHtml = readProjectFile('src/newtab/newtab.html')
  const rootMatch = newtabHtml.match(/<div id="newtab-root"[^>]*>/)

  assert.ok(rootMatch)
  assert.doesNotMatch(rootMatch[0], /aria-live=/)
})

test('newtab keeps local polite status regions for short feedback', () => {
  const newtabHtml = readProjectFile('src/newtab/newtab.html')
  const newtabSource = readProjectFile('src/newtab/newtab.ts')

  assert.match(newtabHtml, /id="settings-save-status"[\s\S]*aria-live="polite"/)
  assert.match(newtabSource, /toast\.setAttribute\('role', 'status'\)/)
  assert.match(newtabSource, /toast\.setAttribute\('aria-live', 'polite'\)/)
})

test('newtab wallpaper startup motion respects reduced-motion preference', () => {
  const newtabCss = readProjectFile('src/newtab/newtab.css')

  assert.match(newtabCss, /@media \(prefers-reduced-motion: reduce\)/)
  assert.match(newtabCss, /transition: none !important/)
  assert.match(newtabCss, /html:not\(\.loading-wallpaper\) \.newtab-shell/)
  assert.match(newtabCss, /\.newtab-background-video/)
})
