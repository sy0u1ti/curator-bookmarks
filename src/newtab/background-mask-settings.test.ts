import assert from 'node:assert/strict'
import {
  BACKGROUND_MASK_STYLES,
  doesBackgroundMaskFilterSupportGeometry,
  doesBackgroundMaskFilterSupportHover,
  isBackgroundMaskFilterStyle,
  getBackgroundMaskOverlayStops,
  isLegacyBackgroundMaskStyle,
  isPaperShaderMaskStyle,
  isWallpaperFilterMaskStyle,
  normalizeBackgroundMaskPercentage,
  normalizeBackgroundMaskStyle,
  snapBackgroundMaskPercentage
} from './background-mask-settings.js'
import { createNewtabBackgroundSettingsView } from './newtab-background-settings-store.js'

assert.deepEqual(
  BACKGROUND_MASK_STYLES,
  [
    'dark', 'frosted', 'noise', 'light', 'grain', 'halftone', 'ascii',
    'paper-texture', 'fluted-glass', 'water', 'image-dithering', 'halftone-dots', 'halftone-cmyk'
  ],
  'Existing mask styles should remain available before the Paper shader filters.'
)
assert.equal(normalizeBackgroundMaskStyle('ascii'), 'ascii')
assert.equal(normalizeBackgroundMaskStyle('unknown'), 'dark')
assert.equal(normalizeBackgroundMaskPercentage(-20), 0)
assert.equal(normalizeBackgroundMaskPercentage(140), 100)
assert.equal(normalizeBackgroundMaskPercentage(undefined, 50), 50)
assert.equal(snapBackgroundMaskPercentage(3), 0)
assert.equal(snapBackgroundMaskPercentage(47), 50)
assert.equal(snapBackgroundMaskPercentage(96), 96)
assert.equal(isLegacyBackgroundMaskStyle('noise'), true)
assert.equal(isWallpaperFilterMaskStyle('grain'), true)
assert.equal(isPaperShaderMaskStyle('paper-texture'), true)
assert.equal(isBackgroundMaskFilterStyle('water'), true)
assert.equal(doesBackgroundMaskFilterSupportGeometry('grain'), false)
assert.equal(doesBackgroundMaskFilterSupportGeometry('halftone'), true)
assert.equal(doesBackgroundMaskFilterSupportGeometry('fluted-glass'), true)
assert.equal(doesBackgroundMaskFilterSupportHover('halftone'), true)
assert.equal(doesBackgroundMaskFilterSupportHover('fluted-glass'), false)
assert.deepEqual(getBackgroundMaskOverlayStops(50), { top: 44, mid: 20, bottom: 50 })
assert.deepEqual(getBackgroundMaskOverlayStops(0), { top: 0, mid: 0, bottom: 0 })
assert.deepEqual(getBackgroundMaskOverlayStops(100), { top: 100, mid: 100, bottom: 100 })

const baseSettings = {
  color: '#101013',
  featuredId: '',
  imageName: '',
  maskEnabled: true,
  maskBlur: 12,
  maskFilterHover: true,
  maskFilterSize: 50,
  maskFilterSpacing: 50,
  maskFilterStrength: 50,
  maskOverlay: 50,
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
assert.equal(filterView.maskFilterHoverHidden, false)
assert.equal(filterView.maskOverlay, 50)

const legacyView = createNewtabBackgroundSettingsView(
  { ...baseSettings, maskStyle: 'frosted' },
  preferences,
  limits
)
assert.equal(legacyView.maskBlurHidden, false)
assert.equal(legacyView.maskFilterStrengthHidden, true)

const paperShaderView = createNewtabBackgroundSettingsView(
  { ...baseSettings, maskStyle: 'image-dithering' },
  preferences,
  limits
)
assert.equal(paperShaderView.maskFilterStrengthHidden, false)
assert.equal(paperShaderView.maskFilterSizeHidden, false)
assert.equal(paperShaderView.maskFilterSpacingHidden, false)
assert.equal(paperShaderView.maskFilterHoverHidden, true)

console.log('background mask settings tests passed')
