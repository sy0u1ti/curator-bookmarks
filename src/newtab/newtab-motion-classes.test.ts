import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const bookmarkTileClasses = readFileSync('src/newtab/components/bookmarkTileClasses.ts', 'utf8')
const bookmarkContent = readFileSync('src/newtab/components/NewtabBookmarkContent.tsx', 'utf8')
const bookmarkMenusHost = readFileSync('src/newtab/components/BookmarkMenusHost.tsx', 'utf8')
const folderSectionClasses = readFileSync('src/newtab/components/folderSectionClasses.ts', 'utf8')
const speedDialClasses = readFileSync('src/newtab/components/speedDialClasses.ts', 'utf8')

assert.ok(
  bookmarkTileClasses.includes('bookmark-tile') &&
    bookmarkTileClasses.includes('curator-motion-disabled') &&
    !bookmarkTileClasses.includes('curator-motion-card'),
  'Newtab bookmark tiles should keep drag staging support without the shared card lift motion.'
)
assert.ok(
  speedDialClasses.includes('newtab-speed-dial') &&
    !speedDialClasses.includes('curator-motion-surface') &&
    speedDialClasses.includes('curator-motion-card') &&
    speedDialClasses.includes('curator-motion-disabled'),
  'Newtab Speed Dial should keep interactive card motion without replaying surface entrance motion at startup.'
)
assert.ok(
  bookmarkContent.includes('newtab-portal') &&
    !bookmarkContent.includes('curator-motion-surface') &&
    bookmarkContent.includes('curator-motion-card') &&
    bookmarkContent.includes('curator-motion-chip'),
  'Newtab portal should mount steadily while quick access, source chips, and folder controls retain interaction motion.'
)
assert.ok(
  folderSectionClasses.includes('curator-motion-chip'),
  'Newtab folder section controls should use chip motion.'
)
assert.ok(
  bookmarkMenusHost.includes('curator-motion-popover'),
  'Newtab bookmark menus should use origin-aware popover motion.'
)

console.log('Newtab motion class tests passed.')
