export const NEWTAB_BOOKMARK_PREBOOT_ROOT_ID = 'newtab-bookmark-preboot'
export const NEWTAB_BOOKMARK_PREBOOT_STORAGE_KEY = 'curatorNewTabBookmarkPreboot'

const NEWTAB_BOOKMARK_PREBOOT_STYLE_ID = 'newtab-bookmark-preboot-style'
const NEWTAB_BOOKMARK_PREBOOT_VERSION = 2
const NEWTAB_BOOKMARK_PREBOOT_MAX_AGE_MS = 10 * 60 * 1000
const NEWTAB_BOOKMARK_PREBOOT_MAX_SECTIONS = 8
const NEWTAB_BOOKMARK_PREBOOT_MAX_ITEMS = 72
const NEWTAB_BOOKMARK_PREBOOT_HIDE_DELAY_MS = 120
const NEWTAB_BOOKMARK_PREBOOT_VIEWPORT_TOLERANCE_PX = 1

export interface NewtabBookmarkPrebootItemView {
  customIcon: boolean
  fallbackLabel: string
  favicon: { src: string }
  id: string
  style?: unknown
  title: string
  url: string
}

export interface NewtabBookmarkPrebootView {
  content: {
    columnGap: number
    columns: number
    fixedGridWidth: number
    folderGap: number
    iconShellSize: number
    layoutMode: string
    pageWidth: number
    rowGap: number
    showTitles: boolean
    tileWidth: number
    titleLines: number
  }
  sections: Array<{
    folderId: string
    grid: { items: NewtabBookmarkPrebootItemView[] } | null
  }>
}

interface NewtabBookmarkPrebootContentStyle {
  columnGap: number
  columns: number
  fixedGridWidth: number
  folderGap: number
  iconShellSize: number
  layoutMode: 'fixed' | 'fluid'
  pageWidth: number
  rowGap: number
  showTitles: boolean
  tileWidth: number
  titleLines: number
}

interface NewtabBookmarkPrebootItem {
  fallbackLabel: string
  faviconSrc: string
  height: number
  id: string
  left: number
  rgb: string
  title: string
  top: number
  width: number
}

interface NewtabBookmarkPrebootSection {
  folderId: string
  items: NewtabBookmarkPrebootItem[]
}

interface NewtabBookmarkPrebootRect {
  height: number
  left: number
  top: number
  viewportHeight: number
  viewportWidth: number
  width: number
}

export interface NewtabBookmarkPrebootSnapshot {
  content: NewtabBookmarkPrebootContentStyle
  rect: NewtabBookmarkPrebootRect
  sections: NewtabBookmarkPrebootSection[]
  updatedAt: number
  version: number
}

export interface NewtabBookmarkPrebootSnapshotOptions {
  now?: number
  sectionsElement?: HTMLElement | null
  viewportHeight?: number
  viewportWidth?: number
}

type BookmarkPrebootStorage = Pick<Storage, 'getItem' | 'removeItem' | 'setItem'>
type BookmarkPrebootWindow = Pick<Window, 'innerHeight' | 'innerWidth'>

export function installNewtabBookmarkPreboot(
  documentRef: Document = document,
  windowRef: Window = window,
  storage: BookmarkPrebootStorage = window.localStorage
): void {
  const snapshot = readNewtabBookmarkPrebootSnapshot(storage)
  if (!snapshot || !isFreshNewtabBookmarkPrebootSnapshot(snapshot)) {
    return
  }
  if (!isRenderableNewtabBookmarkPrebootSnapshot(snapshot, windowRef)) {
    return
  }

  installNewtabBookmarkPrebootStyle(documentRef)
  renderNewtabBookmarkPrebootSnapshot(snapshot, documentRef)
}

export function writeNewtabBookmarkPrebootSnapshotFromView(
  view: NewtabBookmarkPrebootView,
  options: NewtabBookmarkPrebootSnapshotOptions = {},
  storage: BookmarkPrebootStorage = window.localStorage
): NewtabBookmarkPrebootSnapshot | null {
  const snapshot = createNewtabBookmarkPrebootSnapshot(view, options)
  if (!snapshot) {
    clearNewtabBookmarkPrebootSnapshot(storage)
    return null
  }

  try {
    storage.setItem(NEWTAB_BOOKMARK_PREBOOT_STORAGE_KEY, JSON.stringify(snapshot))
  } catch {
    clearNewtabBookmarkPrebootSnapshot(storage)
    return null
  }
  return snapshot
}

export function createNewtabBookmarkPrebootSnapshot(
  view: NewtabBookmarkPrebootView,
  options: NewtabBookmarkPrebootSnapshotOptions = {}
): NewtabBookmarkPrebootSnapshot | null {
  const rect = createNewtabBookmarkPrebootRect(options)
  if (!rect) {
    return null
  }
  const sections = createNewtabBookmarkPrebootSections(
    view,
    options.sectionsElement ?? null,
    rect
  )
  if (!sections.length) {
    return null
  }

  return {
    content: createNewtabBookmarkPrebootContentStyle(view.content),
    rect,
    sections,
    updatedAt: getFiniteNumber(options.now, Date.now()),
    version: NEWTAB_BOOKMARK_PREBOOT_VERSION
  }
}

export function clearNewtabBookmarkPrebootSnapshot(
  storage: BookmarkPrebootStorage = window.localStorage
): void {
  try {
    storage.removeItem(NEWTAB_BOOKMARK_PREBOOT_STORAGE_KEY)
  } catch {
    // Ignore cache cleanup failures.
  }
}

export function hideNewtabBookmarkPreboot({ clearSnapshot = false } = {}): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return
  }
  if (clearSnapshot) {
    clearNewtabBookmarkPrebootSnapshot()
  }

  const root = document.getElementById(NEWTAB_BOOKMARK_PREBOOT_ROOT_ID)
  if (!root || root.dataset.hiding === 'true') {
    return
  }
  root.dataset.hiding = 'true'
  window.setTimeout(() => {
    root.remove()
    document.getElementById(NEWTAB_BOOKMARK_PREBOOT_STYLE_ID)?.remove()
  }, NEWTAB_BOOKMARK_PREBOOT_HIDE_DELAY_MS)
}

export function isRenderableNewtabBookmarkPrebootSnapshot(
  snapshot: NewtabBookmarkPrebootSnapshot,
  windowRef: BookmarkPrebootWindow
): boolean {
  const viewportWidth = getFiniteNumber(windowRef.innerWidth, 0)
  const viewportHeight = getFiniteNumber(windowRef.innerHeight, 0)
  return Boolean(
    viewportWidth > 0 &&
    viewportHeight > 0 &&
    Math.abs(viewportWidth - snapshot.rect.viewportWidth) <= NEWTAB_BOOKMARK_PREBOOT_VIEWPORT_TOLERANCE_PX &&
    Math.abs(viewportHeight - snapshot.rect.viewportHeight) <= NEWTAB_BOOKMARK_PREBOOT_VIEWPORT_TOLERANCE_PX
  )
}

function readNewtabBookmarkPrebootSnapshot(
  storage: BookmarkPrebootStorage
): NewtabBookmarkPrebootSnapshot | null {
  try {
    const rawSnapshot = storage.getItem(NEWTAB_BOOKMARK_PREBOOT_STORAGE_KEY)
    return rawSnapshot ? normalizeNewtabBookmarkPrebootSnapshot(JSON.parse(rawSnapshot)) : null
  } catch {
    return null
  }
}

function isFreshNewtabBookmarkPrebootSnapshot(
  snapshot: NewtabBookmarkPrebootSnapshot,
  now = Date.now()
): boolean {
  const age = now - snapshot.updatedAt
  return Boolean(
    snapshot.version === NEWTAB_BOOKMARK_PREBOOT_VERSION &&
    snapshot.sections.some((section) => section.items.length > 0) &&
    age >= 0 &&
    age <= NEWTAB_BOOKMARK_PREBOOT_MAX_AGE_MS
  )
}

function renderNewtabBookmarkPrebootSnapshot(
  snapshot: NewtabBookmarkPrebootSnapshot,
  documentRef: Document
): void {
  const root = getOrCreateNewtabBookmarkPrebootRoot(documentRef)
  if (!root) {
    return
  }

  root.replaceChildren()
  root.style.setProperty('--preboot-content-left', `${Math.max(0, snapshot.rect.left)}px`)
  root.style.setProperty('--preboot-content-top', `${Math.max(0, snapshot.rect.top)}px`)
  root.style.setProperty('--preboot-content-width', `${Math.max(0, snapshot.rect.width)}px`)
  root.style.setProperty('--preboot-content-height', `${Math.max(0, snapshot.rect.height)}px`)
  root.dataset.showTitles = String(snapshot.content.showTitles)

  const content = documentRef.createElement('section')
  content.className = 'newtab-bookmark-preboot-content'
  content.dataset.layoutMode = snapshot.content.layoutMode
  applyNewtabBookmarkPrebootContentStyle(content, snapshot.content)

  const sections = documentRef.createElement('div')
  sections.className = 'newtab-bookmark-preboot-sections'
  for (const section of snapshot.sections) {
    sections.appendChild(createNewtabBookmarkPrebootSection(documentRef, section, snapshot.content))
  }
  content.appendChild(sections)
  root.appendChild(content)
}

function createNewtabBookmarkPrebootSection(
  documentRef: Document,
  section: NewtabBookmarkPrebootSection,
  content: NewtabBookmarkPrebootContentStyle
): HTMLElement {
  const sectionElement = documentRef.createElement('section')
  sectionElement.className = 'newtab-bookmark-preboot-section'
  sectionElement.dataset.folderId = section.folderId
  for (const item of section.items) {
    sectionElement.appendChild(createNewtabBookmarkPrebootTile(documentRef, item, content))
  }
  return sectionElement
}

function createNewtabBookmarkPrebootTile(
  documentRef: Document,
  item: NewtabBookmarkPrebootItem,
  content: NewtabBookmarkPrebootContentStyle
): HTMLElement {
  const tile = documentRef.createElement('span')
  tile.className = 'newtab-bookmark-preboot-tile'
  tile.dataset.bookmarkId = item.id
  tile.title = item.title
  tile.style.height = `${item.height}px`
  tile.style.left = `${item.left}px`
  tile.style.top = `${item.top}px`
  tile.style.width = `${item.width}px`
  if (!content.showTitles) {
    tile.dataset.iconOnly = 'true'
  }
  if (item.rgb) {
    tile.style.setProperty('--bookmark-card-rgb', item.rgb)
  }

  const iconShell = documentRef.createElement('span')
  iconShell.className = 'newtab-bookmark-preboot-icon-shell'
  const fallback = documentRef.createElement('span')
  fallback.className = 'newtab-bookmark-preboot-fallback'
  fallback.textContent = item.fallbackLabel
  iconShell.appendChild(fallback)

  if (item.faviconSrc) {
    const image = documentRef.createElement('img')
    image.className = 'newtab-bookmark-preboot-favicon'
    image.alt = ''
    image.decoding = 'async'
    image.draggable = false
    image.loading = 'eager'
    image.addEventListener('load', () => {
      image.dataset.ready = 'true'
      fallback.dataset.hidden = 'true'
    }, { once: true })
    image.addEventListener('error', () => {
      image.remove()
      delete fallback.dataset.hidden
    }, { once: true })
    image.src = item.faviconSrc
    iconShell.appendChild(image)
  }
  tile.appendChild(iconShell)

  if (content.showTitles) {
    const title = documentRef.createElement('span')
    title.className = 'newtab-bookmark-preboot-title'
    title.textContent = item.title
    tile.appendChild(title)
  }
  return tile
}

function createNewtabBookmarkPrebootSections(
  view: NewtabBookmarkPrebootView,
  sectionsElement: HTMLElement | null,
  sectionsRect: NewtabBookmarkPrebootRect
): NewtabBookmarkPrebootSection[] {
  const sections: NewtabBookmarkPrebootSection[] = []
  const tileRects = collectNewtabBookmarkPrebootTileRects(sectionsElement, sectionsRect)
  let remainingItems = NEWTAB_BOOKMARK_PREBOOT_MAX_ITEMS

  for (const section of view.sections) {
    if (sections.length >= NEWTAB_BOOKMARK_PREBOOT_MAX_SECTIONS || remainingItems <= 0) {
      break
    }
    const items = (section.grid?.items ?? [])
      .slice(0, remainingItems)
      .map((item) => createNewtabBookmarkPrebootItem(item, tileRects.get(String(item.id || ''))))
      .filter((item): item is NewtabBookmarkPrebootItem => Boolean(item))
    if (!items.length) {
      continue
    }
    remainingItems -= items.length
    sections.push({
      folderId: String(section.folderId || ''),
      items
    })
  }
  return sections
}

function collectNewtabBookmarkPrebootTileRects(
  sectionsElement: HTMLElement | null,
  sectionsRect: NewtabBookmarkPrebootRect
): Map<string, Pick<NewtabBookmarkPrebootItem, 'height' | 'left' | 'top' | 'width'>> {
  const tileRects = new Map<string, Pick<NewtabBookmarkPrebootItem, 'height' | 'left' | 'top' | 'width'>>()
  if (!sectionsElement) {
    return tileRects
  }

  for (const tileElement of sectionsElement.querySelectorAll<HTMLElement>('.bookmark-tile[data-bookmark-id]')) {
    const bookmarkId = String(tileElement.dataset.bookmarkId || '')
    const rect = tileElement.getBoundingClientRect()
    if (!bookmarkId || rect.width <= 0 || rect.height <= 0) {
      continue
    }
    tileRects.set(bookmarkId, {
      height: Math.round(rect.height),
      left: Math.round(rect.left - sectionsRect.left),
      top: Math.round(rect.top - sectionsRect.top),
      width: Math.round(rect.width)
    })
  }
  return tileRects
}

function createNewtabBookmarkPrebootItem(
  item: NewtabBookmarkPrebootItemView,
  rect: Pick<NewtabBookmarkPrebootItem, 'height' | 'left' | 'top' | 'width'> | undefined
): NewtabBookmarkPrebootItem | null {
  const title = String(item.title || item.url || '').trim().slice(0, 512)
  if (!title || !rect) {
    return null
  }

  return {
    fallbackLabel: String(item.fallbackLabel || Array.from(title)[0] || '*').slice(0, 2).toUpperCase(),
    faviconSrc: normalizeNewtabBookmarkPrebootFavicon(item),
    ...rect,
    id: String(item.id || item.url || title).slice(0, 512),
    rgb: getBookmarkTileRgb(item),
    title
  }
}

function normalizeNewtabBookmarkPrebootFavicon(item: NewtabBookmarkPrebootItemView): string {
  if (item.customIcon) {
    return ''
  }
  const source = String(item.favicon.src || '').trim().slice(0, 4096)
  return /^(?:chrome-extension|chrome|https?):/i.test(source) ? source : ''
}

function createNewtabBookmarkPrebootContentStyle(
  content: NewtabBookmarkPrebootView['content']
): NewtabBookmarkPrebootContentStyle {
  return {
    columnGap: clampInteger(content.columnGap, 0, 96, 24),
    columns: clampInteger(content.columns, 1, 12, 4),
    fixedGridWidth: clampInteger(content.fixedGridWidth, 120, 2400, 832),
    folderGap: clampInteger(content.folderGap, 0, 96, 20),
    iconShellSize: clampInteger(content.iconShellSize, 18, 80, 32),
    layoutMode: content.layoutMode === 'fixed' ? 'fixed' : 'fluid',
    pageWidth: clampInteger(content.pageWidth, 240, 2400, 1229),
    rowGap: clampInteger(content.rowGap, 0, 96, 12),
    showTitles: Boolean(content.showTitles),
    tileWidth: clampInteger(content.tileWidth, 80, 420, 184),
    titleLines: clampInteger(content.titleLines, 1, 3, 1)
  }
}

function createNewtabBookmarkPrebootRect(
  options: NewtabBookmarkPrebootSnapshotOptions
): NewtabBookmarkPrebootRect | null {
  const element = options.sectionsElement ?? null
  if (!element) {
    return null
  }
  const rect = element.getBoundingClientRect()
  const viewportWidth = getFiniteNumber(options.viewportWidth, getWindowDimension('innerWidth', 0))
  const viewportHeight = getFiniteNumber(options.viewportHeight, getWindowDimension('innerHeight', 0))
  if (rect.width <= 0 || rect.height <= 0 || viewportWidth <= 0 || viewportHeight <= 0) {
    return null
  }

  return {
    height: Math.round(rect.height),
    left: Math.round(rect.left),
    top: Math.round(rect.top),
    viewportHeight: Math.round(viewportHeight),
    viewportWidth: Math.round(viewportWidth),
    width: Math.round(rect.width)
  }
}

function normalizeNewtabBookmarkPrebootSnapshot(rawSnapshot: unknown): NewtabBookmarkPrebootSnapshot | null {
  if (!rawSnapshot || typeof rawSnapshot !== 'object' || Array.isArray(rawSnapshot)) {
    return null
  }
  const snapshot = rawSnapshot as Record<string, unknown>
  const content = normalizeNewtabBookmarkPrebootContent(snapshot.content)
  const rect = normalizeNewtabBookmarkPrebootRect(snapshot.rect)
  const sections = normalizeNewtabBookmarkPrebootSections(snapshot.sections)
  if (!content || !rect || !sections.length) {
    return null
  }

  return {
    content,
    rect,
    sections,
    updatedAt: getFiniteNumber(snapshot.updatedAt, 0),
    version: snapshot.version === NEWTAB_BOOKMARK_PREBOOT_VERSION
      ? NEWTAB_BOOKMARK_PREBOOT_VERSION
      : 0
  }
}

function normalizeNewtabBookmarkPrebootContent(rawContent: unknown): NewtabBookmarkPrebootContentStyle | null {
  if (!rawContent || typeof rawContent !== 'object' || Array.isArray(rawContent)) {
    return null
  }
  return createNewtabBookmarkPrebootContentStyle(rawContent as unknown as NewtabBookmarkPrebootView['content'])
}

function normalizeNewtabBookmarkPrebootSections(rawSections: unknown): NewtabBookmarkPrebootSection[] {
  if (!Array.isArray(rawSections)) {
    return []
  }
  const sections: NewtabBookmarkPrebootSection[] = []
  let remainingItems = NEWTAB_BOOKMARK_PREBOOT_MAX_ITEMS
  for (const rawSection of rawSections.slice(0, NEWTAB_BOOKMARK_PREBOOT_MAX_SECTIONS)) {
    if (remainingItems <= 0) {
      break
    }
    const section = normalizeNewtabBookmarkPrebootSection(rawSection, remainingItems)
    if (!section) {
      continue
    }
    remainingItems -= section.items.length
    sections.push(section)
  }
  return sections
}

function normalizeNewtabBookmarkPrebootSection(
  rawSection: unknown,
  itemLimit: number
): NewtabBookmarkPrebootSection | null {
  if (!rawSection || typeof rawSection !== 'object' || Array.isArray(rawSection)) {
    return null
  }
  const section = rawSection as Record<string, unknown>
  const items = Array.isArray(section.items)
    ? section.items
      .slice(0, itemLimit)
      .map((item) => normalizeNewtabBookmarkPrebootItem(item))
      .filter((item): item is NewtabBookmarkPrebootItem => Boolean(item))
    : []
  return items.length
    ? { folderId: String(section.folderId || ''), items }
    : null
}

function normalizeNewtabBookmarkPrebootItem(rawItem: unknown): NewtabBookmarkPrebootItem | null {
  if (!rawItem || typeof rawItem !== 'object' || Array.isArray(rawItem)) {
    return null
  }
  const item = rawItem as Record<string, unknown>
  const title = String(item.title || '').trim().slice(0, 512)
  if (!title) {
    return null
  }
  const height = clampInteger(item.height, 1, 600, 0)
  const width = clampInteger(item.width, 1, 2400, 0)
  if (!height || !width) {
    return null
  }
  return {
    fallbackLabel: String(item.fallbackLabel || Array.from(title)[0] || '*').slice(0, 2).toUpperCase(),
    faviconSrc: /^(?:chrome-extension|chrome|https?):/i.test(String(item.faviconSrc || ''))
      ? String(item.faviconSrc)
      : '',
    height,
    id: String(item.id || title).slice(0, 512),
    left: clampInteger(item.left, -2400, 2400, 0),
    rgb: normalizeRgbString(item.rgb),
    title,
    top: clampInteger(item.top, -2400, 5000, 0),
    width
  }
}

function normalizeNewtabBookmarkPrebootRect(rawRect: unknown): NewtabBookmarkPrebootRect | null {
  if (!rawRect || typeof rawRect !== 'object' || Array.isArray(rawRect)) {
    return null
  }
  const rect = rawRect as Record<string, unknown>
  const width = clampInteger(rect.width, 1, 2400, 0)
  const height = clampInteger(rect.height, 1, 2400, 0)
  const viewportWidth = clampInteger(rect.viewportWidth, 1, 5000, 0)
  const viewportHeight = clampInteger(rect.viewportHeight, 1, 5000, 0)
  if (!width || !height || !viewportWidth || !viewportHeight) {
    return null
  }
  return {
    height,
    left: clampInteger(rect.left, -5000, 5000, 0),
    top: clampInteger(rect.top, -5000, 5000, 0),
    viewportHeight,
    viewportWidth,
    width
  }
}

function applyNewtabBookmarkPrebootContentStyle(
  element: HTMLElement,
  content: NewtabBookmarkPrebootContentStyle
): void {
  element.style.setProperty('--icon-page-width', `${content.pageWidth}px`)
  element.style.setProperty('--icon-column-gap', `${content.columnGap}px`)
  element.style.setProperty('--icon-row-gap', `${content.rowGap}px`)
  element.style.setProperty('--icon-folder-gap', `${content.folderGap}px`)
  element.style.setProperty('--icon-tile-width', `${content.tileWidth}px`)
  element.style.setProperty('--icon-shell-size', `${content.iconShellSize}px`)
  element.style.setProperty('--icon-fixed-grid-width', `${content.fixedGridWidth}px`)
  element.style.setProperty('--icon-columns', String(content.columns))
  element.style.setProperty('--icon-title-lines', String(content.titleLines))
}

function getOrCreateNewtabBookmarkPrebootRoot(documentRef: Document): HTMLElement | null {
  const existingRoot = documentRef.getElementById(NEWTAB_BOOKMARK_PREBOOT_ROOT_ID)
  if (existingRoot instanceof HTMLElement) {
    return existingRoot
  }
  if (!documentRef.body) {
    return null
  }
  const root = documentRef.createElement('div')
  root.id = NEWTAB_BOOKMARK_PREBOOT_ROOT_ID
  root.setAttribute('aria-hidden', 'true')
  const reactRoot = documentRef.getElementById('newtab-react-root')
  documentRef.body.insertBefore(root, reactRoot || documentRef.body.firstChild)
  return root
}

function installNewtabBookmarkPrebootStyle(documentRef: Document): void {
  if (documentRef.getElementById(NEWTAB_BOOKMARK_PREBOOT_STYLE_ID)) {
    return
  }
  const style = documentRef.createElement('style')
  style.id = NEWTAB_BOOKMARK_PREBOOT_STYLE_ID
  style.textContent = NEWTAB_BOOKMARK_PREBOOT_CSS
  documentRef.head.appendChild(style)
}

function getBookmarkTileRgb(item: NewtabBookmarkPrebootItemView): string {
  const style = item.style as Record<string, unknown> | undefined
  return normalizeRgbString(style?.['--bookmark-card-rgb'])
}

function normalizeRgbString(value: unknown): string {
  const rgb = String(value || '').trim()
  return /^\d{1,3}\s+\d{1,3}\s+\d{1,3}$/.test(rgb) ? rgb : ''
}

function getWindowDimension(key: 'innerHeight' | 'innerWidth', fallback: number): number {
  return typeof window === 'undefined' ? fallback : window[key]
}

function getFiniteNumber(value: unknown, fallback: number): number {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : fallback
}

function clampInteger(value: unknown, min: number, max: number, fallback: number): number {
  const numeric = Math.round(Number(value))
  return Number.isFinite(numeric) ? Math.max(min, Math.min(max, numeric)) : fallback
}

const NEWTAB_BOOKMARK_PREBOOT_CSS = `
#${NEWTAB_BOOKMARK_PREBOOT_ROOT_ID} {
  --preboot-card-bg: rgba(18, 19, 21, 0.32);
  position: fixed;
  inset: 0;
  z-index: 2;
  overflow: hidden;
  contain: strict;
  color: rgba(245, 245, 247, 0.88);
  font-family: "Geist", "Geist Sans", "SF Pro Text", "PingFang SC", "Microsoft YaHei UI", "Microsoft YaHei", "Hiragino Sans GB", "Helvetica Neue", Arial, sans-serif;
  opacity: 1;
  pointer-events: none;
  transition: opacity 120ms cubic-bezier(0.22, 1, 0.36, 1);
}

html.instant-wallpaper-startup-preview #${NEWTAB_BOOKMARK_PREBOOT_ROOT_ID},
html[data-instant-wallpaper-signature] #${NEWTAB_BOOKMARK_PREBOOT_ROOT_ID} {
  --preboot-card-bg: rgba(16, 17, 19, 0.46);
}

#${NEWTAB_BOOKMARK_PREBOOT_ROOT_ID}[data-hiding="true"] {
  opacity: 0;
}

#${NEWTAB_BOOKMARK_PREBOOT_ROOT_ID} .newtab-bookmark-preboot-content {
  position: absolute;
  top: var(--preboot-content-top);
  left: var(--preboot-content-left);
  display: grid;
  width: min(var(--preboot-content-width), calc(100vw - 28px));
  height: var(--preboot-content-height);
  max-width: 100%;
  align-content: start;
  justify-items: stretch;
}

#${NEWTAB_BOOKMARK_PREBOOT_ROOT_ID} .newtab-bookmark-preboot-sections {
  position: relative;
  width: 100%;
  height: 100%;
}

#${NEWTAB_BOOKMARK_PREBOOT_ROOT_ID} .newtab-bookmark-preboot-section {
  position: absolute;
  inset: 0;
}

#${NEWTAB_BOOKMARK_PREBOOT_ROOT_ID} .newtab-bookmark-preboot-tile {
  box-sizing: border-box;
  position: absolute;
  display: grid;
  grid-template-columns: var(--icon-shell-size) minmax(0, 1fr);
  align-items: center;
  justify-self: stretch;
  gap: 10px;
  padding: 8px 10px;
  overflow: hidden;
  border: 1px solid rgba(245, 245, 247, 0.08);
  border-radius: 8px;
  background: var(--preboot-card-bg);
  box-shadow: 0 12px 34px rgba(0, 0, 0, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.052);
}

#${NEWTAB_BOOKMARK_PREBOOT_ROOT_ID} .newtab-bookmark-preboot-tile[data-icon-only="true"] {
  grid-template-columns: var(--icon-shell-size);
  justify-content: center;
  gap: 0;
  padding: 8px;
}

#${NEWTAB_BOOKMARK_PREBOOT_ROOT_ID} .newtab-bookmark-preboot-icon-shell {
  position: relative;
  display: grid;
  width: var(--icon-shell-size);
  height: var(--icon-shell-size);
  place-items: center;
  overflow: hidden;
  border: 1px solid rgba(var(--bookmark-card-rgb, 245 245 247) / 0.12);
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.34);
}

#${NEWTAB_BOOKMARK_PREBOOT_ROOT_ID} .newtab-bookmark-preboot-favicon {
  position: relative;
  z-index: 1;
  width: calc(var(--icon-shell-size) * 0.66);
  height: calc(var(--icon-shell-size) * 0.66);
  border-radius: 5px;
  object-fit: contain;
  opacity: 0;
  transition: opacity 90ms cubic-bezier(0.22, 1, 0.36, 1);
}

#${NEWTAB_BOOKMARK_PREBOOT_ROOT_ID} .newtab-bookmark-preboot-favicon[data-ready="true"] {
  opacity: 1;
}

#${NEWTAB_BOOKMARK_PREBOOT_ROOT_ID} .newtab-bookmark-preboot-fallback {
  position: absolute;
  display: grid;
  width: calc(var(--icon-shell-size) * 0.78);
  height: calc(var(--icon-shell-size) * 0.78);
  place-items: center;
  border-radius: 7px;
  background: rgba(245, 245, 247, 0.08);
  color: rgba(245, 245, 247, 0.86);
  font-size: 13px;
  font-weight: 800;
  line-height: 1;
  opacity: 1;
  transition: opacity 90ms cubic-bezier(0.22, 1, 0.36, 1);
}

#${NEWTAB_BOOKMARK_PREBOOT_ROOT_ID} .newtab-bookmark-preboot-fallback[data-hidden="true"] {
  opacity: 0;
}

#${NEWTAB_BOOKMARK_PREBOOT_ROOT_ID} .newtab-bookmark-preboot-title {
  display: -webkit-box;
  min-width: 0;
  overflow: hidden;
  color: rgba(245, 245, 247, 0.78);
  font-size: 12px;
  font-weight: 620;
  line-height: 1.25;
  overflow-wrap: anywhere;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: var(--icon-title-lines);
}

@media (prefers-reduced-motion: reduce) {
  #${NEWTAB_BOOKMARK_PREBOOT_ROOT_ID},
  #${NEWTAB_BOOKMARK_PREBOOT_ROOT_ID} .newtab-bookmark-preboot-favicon,
  #${NEWTAB_BOOKMARK_PREBOOT_ROOT_ID} .newtab-bookmark-preboot-fallback {
    transition: none;
  }
}
`
