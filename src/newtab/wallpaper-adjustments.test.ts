import assert from 'node:assert/strict'
import {
  DEFAULT_WALLPAPER_ADJUSTMENTS,
  getEffectiveWallpaperAdjustments,
  getWallpaperAdjustmentStyles,
  haveSameWallpaperSource,
  NO_WALLPAPER_ADJUSTMENTS,
  readWallpaperAdjustments,
  resolveStartupWallpaperAdjustments,
  toWallpaperAdjustmentFields,
  WALLPAPER_MASK_PRESETS,
  WALLPAPER_MASK_STYLES,
  type WallpaperAdjustments
} from './wallpaper-adjustments.js'
import { createNewtabBackgroundSettingsView } from './newtab-background-settings-store.js'
import { saveWallpaperAdjustmentsSnapshot } from './instant-wallpaper.js'

assert.deepEqual(WALLPAPER_MASK_STYLES.map(style => WALLPAPER_MASK_PRESETS[style].label), [
  '均匀暗化', '柔和渐暗', '轻磨砂'
])

for (const invalid of [null, undefined, {}, [], 7, 'nope']) {
  assert.deepEqual(readWallpaperAdjustments(invalid), DEFAULT_WALLPAPER_ADJUSTMENTS)
}

const selected: WallpaperAdjustments = { enabled: true, style: 'gradient', dim: 35, blur: 8 }
const fields = toWallpaperAdjustmentFields(selected)
assert.deepEqual(readWallpaperAdjustments(fields), selected)
for (const invalid of ['false', 'true', null, 1, {}, []]) {
  assert.equal(readWallpaperAdjustments({ ...fields, wallpaperEnabled: invalid }).enabled, false)
}
assert.deepEqual(readWallpaperAdjustments({ ...fields, maskEnabled: false, maskStyle: 'noise' }), selected)
assert.deepEqual(
  readWallpaperAdjustments({ ...fields, wallpaperDim: 400, wallpaperBlur: -5, wallpaperGrain: 'x' }),
  { ...selected, dim: 100, blur: 0 }
)
for (const invalid of [true, false, null, '', ' ', [], [10], {}, Number.NaN, Number.POSITIVE_INFINITY]) {
  const normalized = readWallpaperAdjustments({
    ...fields, wallpaperDim: invalid, wallpaperBlur: invalid, wallpaperGrain: invalid
  })
  assert.equal(normalized.dim, 30)
  assert.equal(normalized.blur, 0)
}

for (const style of WALLPAPER_MASK_STYLES) {
  const legacy = { maskEnabled: true, maskStyle: style, maskOverlay: 29, maskBlur: 6, maskFilterStrength: 45 }
  const migrated = readWallpaperAdjustments(legacy)
  assert.equal(migrated.style, style)
  assert.equal(migrated.enabled, true)
  assert.equal(migrated.dim, 29)
  assert.equal(migrated.blur, 6)
  assert.deepEqual(readWallpaperAdjustments(toWallpaperAdjustmentFields(migrated)), migrated)

  const disabled = readWallpaperAdjustments({ ...legacy, maskEnabled: false })
  assert.deepEqual({ ...disabled, enabled: true }, migrated, 'Disabling must preserve settings for re-enabling.')
  const hidden = getWallpaperAdjustmentStyles(disabled)
  assert.equal(hidden['--wallpaper-filter'], 'none')
  assert.equal(hidden['--wallpaper-overscan'], '0px')
  assert.equal(hidden['--wallpaper-dim'], '0')
  assert.equal(hidden['--wallpaper-dim-image'], 'none')

  const transparent = getWallpaperAdjustmentStyles({ ...migrated, dim: 0, blur: 0 })
  assert.equal(transparent['--wallpaper-dim-image'], 'none')
  assert.equal(transparent['--wallpaper-filter'], 'none')

  const covered = getWallpaperAdjustmentStyles({ ...migrated, dim: 100 })
  const opacities = [...covered['--wallpaper-dim-image'].matchAll(/\/ ([\d.]+)%/g)].map(match => Number(match[1]))
  assert.ok(opacities.length >= 2 && opacities.every(value => value === 100), `${style}: full coverage must be opaque across the viewport.`)
}

for (const [previous, current] of [['dark', 'gradient'], ['light', 'gradient'], ['grain', 'dim'], ['noise', 'dim']]) {
  const migrated = readWallpaperAdjustments({ ...fields, wallpaperStyle: previous, wallpaperGrain: 70 })
  assert.equal(migrated.style, current)
  assert.equal(migrated.dim, 35)
  assert.equal(migrated.blur, 8)
  assert.equal('wallpaperGrain' in toWallpaperAdjustmentFields(migrated), false)
}
assert.equal(readWallpaperAdjustments({ maskEnabled: true, maskStyle: 'grain', maskBlur: 20 }).blur, 0)

for (const removed of ['halftone', 'ascii', 'paper-texture', 'fluted-glass', 'water', 'image-dithering', 'halftone-dots', 'halftone-cmyk']) {
  const migrated = readWallpaperAdjustments({ maskEnabled: true, maskStyle: removed, maskOverlay: 0, maskBlur: 0 })
  assert.equal(migrated.style, 'dim')
  assert.equal(migrated.dim, 0)
}

const projected = getWallpaperAdjustmentStyles(selected)
assert.equal(projected['--wallpaper-filter'], 'blur(8px)')
assert.equal(projected['--wallpaper-overscan'], '16px')
const uniform = getWallpaperAdjustmentStyles({ ...selected, style: 'dim', dim: 30 })
assert.equal(uniform['--wallpaper-dim-image'], 'linear-gradient(rgb(0 0 0 / 30%), rgb(0 0 0 / 30%))')

for (const type of ['image', 'video', 'urls', 'featured']) {
  assert.deepEqual(getEffectiveWallpaperAdjustments({ type, ...fields }), selected)
}
for (const type of ['color', 'texture', '', 'unknown']) {
  assert.deepEqual(getEffectiveWallpaperAdjustments({ type, ...fields }), { ...selected, enabled: false })
}

const legacySnapshot = { maskEnabled: true, maskStyle: 'noise', maskOverlay: 29, maskBlur: 6 }
const legacyTarget = { signature: 'fixture', ...legacySnapshot }
for (const malformed of [null, 0, false, '', 'broken', [], {}]) {
  assert.deepEqual(
    resolveStartupWallpaperAdjustments(malformed, legacySnapshot, legacyTarget),
    readWallpaperAdjustments(legacySnapshot),
    'An unusable new snapshot must fall back to legacy settings.'
  )
}
assert.deepEqual(resolveStartupWallpaperAdjustments(fields, legacySnapshot, legacyTarget), selected)
assert.deepEqual(resolveStartupWallpaperAdjustments(null, null, legacyTarget), readWallpaperAdjustments(legacyTarget))
assert.deepEqual(resolveStartupWallpaperAdjustments(null, legacySnapshot, null), NO_WALLPAPER_ADJUSTMENTS)
assert.deepEqual(resolveStartupWallpaperAdjustments(fields, legacySnapshot, legacyTarget, true), NO_WALLPAPER_ADJUSTMENTS)
assert.equal(resolveStartupWallpaperAdjustments(null, null, { signature: 'fixture' }).enabled, true)

const storage = new Map<string, string>()
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    setItem: (key: string, value: string) => { storage.set(key, value) },
    removeItem: (key: string) => { storage.delete(key) }
  }
})
try {
  storage.set('curatorNewTabBackgroundMaskSnapshot', JSON.stringify(legacySnapshot))
  saveWallpaperAdjustmentsSnapshot(selected)
  const snapshot = JSON.parse(storage.get('curatorNewTabWallpaperAdjustments')!)
  assert.deepEqual(resolveStartupWallpaperAdjustments(snapshot, null, legacyTarget), selected)
  assert.deepEqual(
    getWallpaperAdjustmentStyles(resolveStartupWallpaperAdjustments(snapshot, null, legacyTarget)),
    projected,
    'Startup and hydrated CSS must agree on every setting.'
  )
  assert.equal(storage.has('curatorNewTabBackgroundMaskSnapshot'), false)

  storage.set('curatorNewTabBackgroundMaskSnapshot', JSON.stringify(legacySnapshot))
  globalThis.localStorage.setItem = () => { throw new Error('Storage unavailable') }
  saveWallpaperAdjustmentsSnapshot({ ...selected, dim: 80 })
  assert.equal(storage.has('curatorNewTabBackgroundMaskSnapshot'), true, 'A failed snapshot write must keep the legacy fallback.')
} finally {
  if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage)
  else Reflect.deleteProperty(globalThis, 'localStorage')
}

const source = { type: 'image', color: '#101013', url: '', imageName: 'first.png', ...fields }
assert.equal(haveSameWallpaperSource(source, { ...source, wallpaperDim: 60, wallpaperBlur: 20 }), true)
assert.equal(haveSameWallpaperSource(source, { ...source, wallpaperEnabled: false, wallpaperStyle: 'noise' }), true)
for (const changed of [{ type: 'video' }, { url: 'https://example.com/wallpaper.jpg' }, { imageName: 'second.png' }, { color: '#202020' }]) {
  assert.equal(haveSameWallpaperSource(source, { ...source, ...changed }), false)
}

const baseSettings = { ...source, featuredId: '', videoName: '' }
const preferences = { displaySize: 100, positionX: 50, positionY: 50 }
const limits = {
  displaySize: { min: 100, max: 180 },
  positionX: { min: 0, max: 100 },
  positionY: { min: 0, max: 100 }
}
assert.equal(createNewtabBackgroundSettingsView(baseSettings, preferences, limits).ready, false)
const imageView = createNewtabBackgroundSettingsView(baseSettings, preferences, limits, { ready: true })
assert.equal(imageView.ready, true)
assert.equal(imageView.wallpaperAdjustmentsHidden, false)
assert.equal(imageView.wallpaperStyle, 'gradient')
const colorView = createNewtabBackgroundSettingsView({ ...baseSettings, type: 'color' }, preferences, limits)
assert.equal(colorView.wallpaperAdjustmentsHidden, true)
assert.equal(colorView.wallpaperDim, selected.dim, 'Switching background type must preserve saved amounts.')

console.log('wallpaper adjustments tests passed')
