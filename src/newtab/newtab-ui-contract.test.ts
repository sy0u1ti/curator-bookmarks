import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const newtabCss = readFileSync('src/newtab/newtab.css', 'utf8')
const bookmarkContent = readFileSync('src/newtab/components/NewtabBookmarkContent.tsx', 'utf8')
const searchWidget = readFileSync('src/newtab/components/NewtabSearchWidget.tsx', 'utf8')
const speedDial = readFileSync('src/newtab/components/NewtabSpeedDialPanel.tsx', 'utf8')
const bookmarkIconShell = readFileSync('src/newtab/components/BookmarkIconShell.tsx', 'utf8')
const bookmarkPreboot = readFileSync('src/newtab/newtab-bookmark-preboot.ts', 'utf8')
const newtabApp = readFileSync('src/newtab/NewtabApp.tsx', 'utf8')
const newtabMain = readFileSync('src/newtab/main.tsx', 'utf8')
const controller = readFileSync('src/newtab/newtab-controller.ts', 'utf8')
const settingsDrawer = readFileSync('src/newtab/components/SettingsDrawer.tsx', 'utf8')
const wallpaperFilter = readFileSync('src/newtab/components/NewtabWallpaperFilterLayer.tsx', 'utf8')
const paperShaderFilter = readFileSync('src/newtab/components/NewtabPaperShaderLayer.tsx', 'utf8')
const backgroundMaskSettings = readFileSync('src/newtab/background-mask-settings.ts', 'utf8')
const viteConfig = readFileSync('vite.config.ts', 'utf8')
const selectSource = readFileSync('src/ui/base/Select.tsx', 'utf8')
const instantWallpaperBoot = readFileSync('src/newtab/instant-wallpaper-boot.ts', 'utf8')
const instantWallpaper = readFileSync('src/newtab/instant-wallpaper.ts', 'utf8')
const newtabHtml = readFileSync('src/newtab/newtab.html', 'utf8')
const bookmarkTileClasses = readFileSync('src/newtab/components/bookmarkTileClasses.ts', 'utf8')
const speedDialClasses = readFileSync('src/newtab/components/speedDialClasses.ts', 'utf8')

assert.ok(
  newtabCss.includes('--newtab-glass-bg-hero') &&
    newtabCss.includes('[data-background-media="true"]'),
  'Newtab glass surfaces should strengthen over image and video backgrounds.'
)

assert.ok(
  instantWallpaper.includes('maskEnabled: boolean') &&
    instantWallpaper.includes('maskStyle: BackgroundMaskStyle') &&
    instantWallpaper.includes('maskOverlay: number') &&
    instantWallpaper.includes('maskBlur: number') &&
    instantWallpaperBoot.includes('applyStartupMask(targetRecord, maskSnapshot)') &&
    instantWallpaperBoot.includes('Targets written before mask snapshots existed should fail dark') &&
    newtabHtml.includes('id="newtab-startup-background-mask-style"') &&
    instantWallpaperBoot.includes("--instant-wallpaper-mask-image") &&
    newtabHtml.includes('id="newtab-startup-background-mask"') &&
    newtabHtml.includes('background-color: var(--instant-wallpaper-mask-color, transparent)') &&
    newtabHtml.includes('background-image: var(--instant-wallpaper-mask-image, none)') &&
    newtabHtml.includes('backdrop-filter: var(--instant-wallpaper-mask-filter, none)') &&
    controller.includes('let backgroundSettingsHydrated = false') &&
    controller.includes('ready: backgroundSettingsHydrated') &&
    controller.includes('const shouldSyncBackgroundUi = backgroundSettingsHydrated && !backgroundUiAlreadyApplied') &&
    newtabApp.includes('{backgroundSettings.ready ? (') &&
    newtabApp.includes('if (!backgroundSettings.ready) return') &&
    newtabApp.includes("getElementById('newtab-startup-background-mask-style')?.remove()") &&
    newtabApp.includes('removeStartupBackgroundMask()'),
  'The saved background mask should exist during synchronous wallpaper startup and hand off to React without a bright frame.'
)

assert.ok(
  instantWallpaper.includes('export function saveBackgroundMaskSnapshot') &&
    instantWallpaper.includes('export function readBackgroundMaskSnapshot') &&
    instantWallpaper.includes("BACKGROUND_MASK_SNAPSHOT_KEY = 'curatorNewTabBackgroundMaskSnapshot'") &&
    controller.includes('saveBackgroundMaskSnapshot({') &&
    instantWallpaperBoot.includes('readRecord<BackgroundMaskSnapshotRecord>(maskSnapshotKey)'),
  'A dedicated mask snapshot must be persisted for every background type so the boot script paints the mask on the first frame, even for solid colors that write no wallpaper target.'
)

assert.ok(
  newtabApp.includes("data-mask-initial=\"\"") &&
    newtabApp.includes("removeAttribute('data-mask-initial')") &&
    newtabApp.includes('requestAnimationFrame') &&
    /#newtab-background-mask\[data-mask-initial\][\s\S]*?transition:\s*none/.test(newtabCss),
  'The React mask must appear at its final state without a fade on first mount, and the startup mask must be removed only after it has painted.'
)

assert.ok(
  selectSource.includes("base-select-popup t-dropdown overflow-y-auto overscroll-contain") &&
    selectSource.includes('max-h-64 min-w-[var(--anchor-width)] overflow-y-auto overscroll-contain'),
  'Long select popups should keep their height constraint and expose a wheel-scrollable overflow container.'
)

assert.ok(
  settingsDrawer.includes('data-starting-style:[transform:translateX(100%)]') &&
    settingsDrawer.includes('data-ending-style:[transform:translateX(100%)]') &&
    settingsDrawer.includes('[transform:translateX(var(--drawer-swipe-movement-x))]') &&
    !controller.includes('primeSettingsDrawerOpenTransition') &&
    !controller.includes('panel.getBoundingClientRect()'),
  'The settings drawer should use Base UI starting and ending styles instead of measuring a hidden popup.'
)

assert.ok(
  [
    'dark', 'frosted', 'noise', 'light', 'grain', 'halftone', 'ascii',
    'paper-texture', 'fluted-glass', 'water', 'image-dithering', 'halftone-dots', 'halftone-cmyk'
  ].every((style) =>
    backgroundMaskSettings.includes(`'${style}'`)
  ) &&
    settingsDrawer.includes('颗粒滤镜') &&
    settingsDrawer.includes('网点滤镜') &&
    settingsDrawer.includes('ASCII 滤镜') &&
    settingsDrawer.includes('Paper · 纸张纹理') &&
    settingsDrawer.includes('Paper · 水面折射') &&
    settingsDrawer.includes('Paper · 半色调 CMYK') &&
    settingsDrawer.includes('遮罩效果') &&
    settingsDrawer.includes('悬停效果') &&
    settingsDrawer.includes("ticks={['透明', '默认', '覆盖']}"),
  'The background mask selector should retain the original styles and expose the Paper image filters.'
)

assert.ok(
  paperShaderFilter.includes("import('@paper-design/shaders-react')") &&
    paperShaderFilter.includes('<PaperTexture') &&
    paperShaderFilter.includes('<FlutedGlass') &&
    paperShaderFilter.includes('<Water') &&
    paperShaderFilter.includes('<ImageDithering') &&
    paperShaderFilter.includes('<HalftoneDots') &&
    paperShaderFilter.includes('<HalftoneCmyk') &&
    paperShaderFilter.includes("getContext('webgl2')") &&
    paperShaderFilter.includes('useShaderImageSource') &&
    paperShaderFilter.includes("media.kind === 'video'") &&
    paperShaderFilter.includes('originX:') &&
    newtabApp.indexOf('<NewtabPaperShaderLayer />') < newtabApp.indexOf('id="newtab-background-mask"'),
  'Paper image shaders should render in the wallpaper filter stack below the readability mask.'
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
  /getLocalStorage\(\[[\s\S]+?backgroundPreloadPromise\s*\n\s*\]\)/.test(controller) &&
    /useLayoutEffect\(\(\) => \{\s*hideNewtabBookmarkPreboot\(\)/.test(bookmarkContent) &&
    /useEffect\(\(\) => \{[\s\S]+?writeNewtabBookmarkPrebootSnapshotFromView/.test(bookmarkContent),
  'The final newtab surface should wait for the saved background and replace bookmark preboot before the first live paint.'
)

const autoCenteredLayoutReadyAssignments = [
  ...controller.matchAll(/layoutReady:\s*([^,\r\n]+)/g)
].map((match) => match[1]?.trim())
assert.ok(
  autoCenteredLayoutReadyAssignments.includes('!settings.autoVerticalCenter || cachedAutoOffsetY !== null') &&
    controller.includes('return `${AUTO_SEARCH_OFFSET_CACHE_KEY}:${window.innerWidth}x${window.innerHeight}`'),
  'Auto-centered search should trust a viewport-keyed cached offset for first paint instead of hiding behind the measurement gate.'
)
assert.ok(
  controller.includes('const AUTO_SEARCH_LAYOUT_STABLE_FRAME_COUNT = 0'),
  'Auto-centered search should reveal after the first current-layout measurement instead of waiting through extra frames.'
)
assert.ok(
  controller.includes("const AUTO_SEARCH_LAYOUT_PENDING_ATTRIBUTE = 'data-newtab-search-layout-pending'") &&
    controller.includes('getRevealedAutoSearchShell() === null && readCachedAutoSearchOffsetYValue() === null') &&
    controller.includes('scheduleAutoSearchLayoutReveal()') &&
    newtabCss.includes('html[data-newtab-search-layout-pending] .newtab-search-slot'),
  'The document should keep only uncached auto-centered search hidden until the measured shell state has reached the DOM.'
)
const autoCenterSlotTransition = newtabCss.match(
  /\.newtab-search-slot\[data-search-auto-vertical-center="true"\]\s*\{([^}]*)\}/
)?.[1] || ''
assert.ok(
  autoCenterSlotTransition.includes('opacity') &&
    !autoCenterSlotTransition.includes('margin'),
  'Auto-centered search must not animate its offset: transitioning margin makes measurements read mid-animation values and the slot visibly wander.'
)
assert.ok(
  controller.includes('nodes.slot === lastMeasuredSearchSlot') &&
    controller.includes('settledVerticalCenterContent !== primaryContent'),
  'Search layout must re-measure only for a new slot element and only after the vertically centered content block has painted once.'
)

const cssWallpaperFocusDuration = newtabCss.match(/--newtab-wallpaper-focus-duration:\s*(\d+)ms/)?.[1]
const bootWallpaperFocusDuration = newtabHtml.match(/transition:\s*opacity\s+(\d+)ms\s+cubic-bezier/)?.[1]
assert.ok(
  cssWallpaperFocusDuration && cssWallpaperFocusDuration === bootWallpaperFocusDuration,
  'The inline boot wallpaper reveal must run at the same speed as the app focus duration to avoid a two-speed color shift.'
)

assert.ok(
  bookmarkPreboot.includes('line-break: strict;') &&
    bookmarkPreboot.includes('text-spacing-trim: trim-start;') &&
    bookmarkPreboot.includes('text-autospace: normal;') &&
    bookmarkPreboot.includes('hanging-punctuation: allow-end;') &&
    bookmarkPreboot.includes('roundPrebootLength'),
  'The bookmark preboot snapshot must match live shell CJK typography and keep sub-pixel geometry so the handoff does not shift text.'
)

const cachedAutoOffsetWrites = [...controller.matchAll(/writeCachedAutoSearchOffsetY\(/g)].length
assert.ok(
  controller.includes('writeCachedAutoSearchOffsetY(view.shell.offsetY)') &&
    cachedAutoOffsetWrites === 2,
  'The first-paint offset cache should only record DOM-confirmed positions (single write in the reveal path plus its definition).'
)

assert.ok(
  newtabCss.includes('newtab-utility-module-enter') &&
    newtabCss.includes('.newtab-utility-stack > *'),
  'Utility modules (clock/search/onboarding) should fade in on hydration instead of popping into the layout.'
)

assert.ok(
  !bookmarkTileClasses.includes('backdrop-filter:blur') &&
    !speedDialClasses.includes('speed-dial-card-filter') &&
    newtabCss.includes('.bookmark-tile {') &&
    newtabCss.includes('-webkit-backdrop-filter: none;') &&
    newtabCss.includes('backdrop-filter: none;'),
  'Repeated small cards should avoid individual backdrop-filter layers during startup.'
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

assert.ok(
  bookmarkPreboot.includes('markNewtabFaviconReady(image.src)') &&
    bookmarkIconShell.includes('isNewtabFaviconReady(favicon.src)') &&
    bookmarkIconShell.includes('markNewtabFaviconReady(favicon.src)'),
  'The preboot snapshot should transfer favicon readiness to the live bookmark icon without showing the fallback again.'
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
    bookmarkHoverRule.includes('box-shadow: var(--newtab-bookmark-inset)') &&
    !bookmarkHoverRule.includes('filter:') &&
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
