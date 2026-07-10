import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const newtabCss = readFileSync('src/newtab/newtab.css', 'utf8')
const bookmarkContent = readFileSync('src/newtab/components/NewtabBookmarkContent.tsx', 'utf8')
const searchWidget = readFileSync('src/newtab/components/NewtabSearchWidget.tsx', 'utf8')
const speedDial = readFileSync('src/newtab/components/NewtabSpeedDialPanel.tsx', 'utf8')
const bookmarkIconShell = readFileSync('src/newtab/components/BookmarkIconShell.tsx', 'utf8')
const newtabApp = readFileSync('src/newtab/NewtabApp.tsx', 'utf8')
const newtabMain = readFileSync('src/newtab/main.tsx', 'utf8')
const controller = readFileSync('src/newtab/newtab-controller.ts', 'utf8')
const settingsDrawer = readFileSync('src/newtab/components/SettingsDrawer.tsx', 'utf8')
const wallpaperFilter = readFileSync('src/newtab/components/NewtabWallpaperFilterLayer.tsx', 'utf8')
const backgroundMaskSettings = readFileSync('src/newtab/background-mask-settings.ts', 'utf8')
const viteConfig = readFileSync('vite.config.ts', 'utf8')

assert.ok(
  newtabCss.includes('--newtab-glass-bg-hero') &&
    newtabCss.includes('[data-background-media="true"]'),
  'Newtab glass surfaces should strengthen over image and video backgrounds.'
)

assert.ok(
  ['dark', 'frosted', 'noise', 'light', 'grain', 'halftone', 'ascii'].every((style) =>
    backgroundMaskSettings.includes(`'${style}'`)
  ) &&
    settingsDrawer.includes('颗粒滤镜') &&
    settingsDrawer.includes('网点滤镜') &&
    settingsDrawer.includes('ASCII 滤镜') &&
    settingsDrawer.includes('遮罩效果') &&
    settingsDrawer.includes('悬停效果') &&
    settingsDrawer.includes("ticks={['透明', '默认', '覆盖']}"),
  'The background mask selector should retain all four original styles and add the three wallpaper filters.'
)

assert.ok(
  wallpaperFilter.includes("ASCII_CHARS = '  .,:;irsXA253hMHGS#9B&@'") &&
    wallpaperFilter.includes('drawGrain') &&
    wallpaperFilter.includes('drawHalftone') &&
  wallpaperFilter.includes('drawAscii') &&
    wallpaperFilter.includes("FILTER_BACKGROUND_COLOR = '#101013'") &&
    wallpaperFilter.includes('getHoverInfluence') &&
    wallpaperFilter.includes('hoverRenderFrame = window.requestAnimationFrame') &&
    wallpaperFilter.includes('asciiGlyphMetricsCache') &&
    newtabApp.indexOf('<NewtabWallpaperFilterLayer />') < newtabApp.indexOf('id="newtab-background-mask"'),
  'Wallpaper filters should use the sampled Canvas renderer below the existing mask layer.'
)

const focusRingDeclaration = newtabCss.match(/--newtab-focus-ring:[^;]+;/)?.[0] || ''
assert.ok(
  focusRingDeclaration.includes('rgba(245, 245, 247') &&
    !focusRingDeclaration.includes('71, 168, 255'),
  'Newtab focus feedback should stay inside the neutral gray-white palette.'
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
    controller.includes('shouldToggleSearchFocusFromPointerDown'),
  'Typing and blank-surface pointer input should focus newtab search.'
)

assert.ok(
  speedDial.includes('固定入口') &&
    speedDial.includes('添加固定入口') &&
    speedDial.includes('data-content-type'),
  'The empty fixed-entry module should provide a compact, actionable state.'
)

assert.ok(
  newtabMain.includes('startNewTabController()') &&
    newtabMain.includes('createRoot(root).render') &&
    newtabMain.indexOf('startNewTabController()') < newtabMain.indexOf('createRoot(root).render') &&
    controller.includes("from './speed-dial.js'") &&
    !controller.includes("import('./speed-dial.js')"),
  'Newtab data and fixed-entry state should begin hydrating before the first React render.'
)

assert.ok(
  viteConfig.includes('NEWTAB_BOOKMARK_PREBOOT_ROUTE') &&
    viteConfig.includes('NEWTAB_BOOKMARK_PREBOOT_ENTRY') &&
    viteConfig.includes('`<body>\\n    <script src="${NEWTAB_BOOKMARK_PREBOOT_ROUTE}"></script>`'),
  'Newtab should install its stable bookmark snapshot before the React root is parsed.'
)

assert.ok(
  bookmarkContent.includes('writeNewtabBookmarkPrebootSnapshotFromView') &&
    bookmarkContent.includes('hideNewtabBookmarkPreboot('),
  'Live bookmark content should hand off from the snapshot and keep an icon fallback until favicons load.'
)

assert.ok(
  bookmarkIconShell.includes('onLoad=') &&
    bookmarkIconShell.includes('data-favicon-ready') &&
    bookmarkIconShell.includes('data-[favicon-ready=true]:opacity-100') &&
    bookmarkIconShell.includes('data-[favicon-ready=true]:opacity-0') &&
    !bookmarkIconShell.includes('BOOKMARK_FALLBACK_HIDDEN_CLASS'),
  'A loaded favicon should hide its fallback through a state selector that wins the CSS cascade.'
)

const backgroundMaskTransition = newtabApp.match(/const BACKGROUND_MASK_BASE_CLASS = '([^']+)'/)?.[1] || ''
assert.ok(
  backgroundMaskTransition.includes('transition:opacity_') &&
    !backgroundMaskTransition.includes('backdrop-filter_var'),
  'The background mask should not animate backdrop-filter during startup.'
)

assert.ok(
  newtabCss.includes('@media (max-height: 800px)') &&
    newtabCss.includes('@media (max-height: 680px)') &&
    newtabCss.includes('@media (max-width: 520px) and (max-height: 800px)'),
  'Newtab should adapt density for short desktop viewports.'
)

const bookmarkHoverRule = newtabCss.match(/\.bookmark-tile:hover[^{]*\{([^}]*)\}/s)?.[1] || ''
const bookmarkFocusRule = newtabCss.match(/\.bookmark-tile:focus-visible[^{]*\{([^}]*)\}/s)?.[1] || ''
const bookmarkSectionVisibilityToggle = /\.bookmark-folder-section:(?:hover|focus-within)[^{]*\{[^}]*content-visibility\s*:/s

assert.ok(
  bookmarkContent.includes('[content-visibility:auto]') &&
    !bookmarkSectionVisibilityToggle.test(newtabCss),
  'Bookmark section paint containment should stay stable while a card is hovered or focused.'
)

assert.ok(
  bookmarkHoverRule.includes('transform: none') &&
    bookmarkHoverRule.includes('box-shadow: var(--newtab-bookmark-shadow)') &&
    newtabCss.includes('.bookmark-tile:hover::before'),
  'Bookmark hover should illuminate in place without moving or expanding its outer shadow.'
)

assert.ok(
  bookmarkFocusRule.includes('transform: none') &&
    newtabCss.includes('.bookmark-tile:focus-visible::before') &&
    newtabCss.includes('--newtab-bookmark-focus-inset'),
  'Bookmark keyboard focus should use an unclipped inset treatment without moving the card.'
)

console.log('newtab UI contract tests passed')
