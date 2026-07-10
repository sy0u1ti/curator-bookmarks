import assert from 'node:assert/strict'
import {
  BACKGROUND_MASK_STYLES,
  doesBackgroundMaskFilterSupportGeometry,
  isLegacyBackgroundMaskStyle,
  isWallpaperFilterMaskStyle,
  normalizeBackgroundMaskPercentage,
  normalizeBackgroundMaskStyle
} from './background-mask-settings.js'
import { createNewtabBackgroundSettingsView } from './newtab-background-settings-store.js'

assert.deepEqual(
  BACKGROUND_MASK_STYLES,
  ['dark', 'frosted', 'noise', 'light', 'grain', 'halftone', 'ascii'],
  'Existing mask styles should remain available before the three wallpaper filters.'
)
assert.equal(normalizeBackgroundMaskStyle('ascii'), 'ascii')
assert.equal(normalizeBackgroundMaskStyle('unknown'), 'dark')
assert.equal(normalizeBackgroundMaskPercentage(-20), 0)
assert.equal(normalizeBackgroundMaskPercentage(140), 100)
assert.equal(normalizeBackgroundMaskPercentage(undefined, 50), 50)
assert.equal(isLegacyBackgroundMaskStyle('noise'), true)
assert.equal(isWallpaperFilterMaskStyle('grain'), true)
assert.equal(doesBackgroundMaskFilterSupportGeometry('grain'), false)
assert.equal(doesBackgroundMaskFilterSupportGeometry('halftone'), true)

const baseSettings = {
  color: '#101013',
  featuredId: '',
  imageName: '',
  maskEnabled: true,
  maskBlur: 12,
  maskFilterSize: 50,
  maskFilterSpacing: 50,
  maskFilterStrength: 50,
  maskStyle: 'halftone' as const,
  type: 'image',
  url: '',
  videoName: ''
}
const preferences = { displaySize: 100, positionX: 50, positionY: 50 }
const limits = {
  displaySize: { min: 100, max: 180 },
  positionX: { min: 0, max: 100 },
  positionY: { min: 0, max: 100 }
}
const filterView = createNewtabBackgroundSettingsView(baseSettings, preferences, limits)
assert.equal(filterView.maskBlurHidden, true)
assert.equal(filterView.maskFilterStrengthHidden, false)
assert.equal(filterView.maskFilterSizeHidden, false)
assert.equal(filterView.maskFilterSpacingHidden, false)

const legacyView = createNewtabBackgroundSettingsView(
  { ...baseSettings, maskStyle: 'frosted' },
  preferences,
  limits
)
assert.equal(legacyView.maskBlurHidden, false)
assert.equal(legacyView.maskFilterStrengthHidden, true)

console.log('background mask settings tests passed')
