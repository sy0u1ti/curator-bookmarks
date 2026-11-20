import assert from 'node:assert/strict'
import { test } from 'node:test'
import { build } from 'esbuild'

const { outputFiles } = await build({
  entryPoints: ['src/shared/anchor-origin.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false
})

const {
  computeCardAnchoredOrigin,
  computeDialogAnchorStyle,
  computeMenuAnchorOrigin,
  isPopupSurfaceDocument
} = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`)

test('computeMenuAnchorOrigin anchors top-left click cleanly downward-right', () => {
  const result = computeMenuAnchorOrigin(
    { x: 120, y: 160 },
    { left: 120, top: 160, width: 276, height: 220 }
  )
  assert.equal(result.origin, '0px 0px')
  assert.equal(result.enterX, -4)
  assert.equal(result.enterY, -4)
})

test('computeMenuAnchorOrigin flips origin and travel when clamped to bottom-right viewport edge', () => {
  const result = computeMenuAnchorOrigin(
    { x: 1380, y: 860 },
    { left: 1120, top: 640, width: 276, height: 220 }
  )
  assert.equal(result.origin, '260px 220px')
  assert.ok(result.enterX > 0)
  assert.equal(result.enterY, 4)
})

test('computeCardAnchoredOrigin points hover preview toward its source wallpaper card', () => {
  const rightOfCard = computeCardAnchoredOrigin(
    { left: 100, top: 200, width: 200, height: 125 },
    { left: 314, top: 339, width: 520, height: 325 }
  )
  assert.equal(rightOfCard.originX, 0)
  assert.equal(rightOfCard.originY, 0)
  assert.equal(rightOfCard.enterX, -6)
  assert.equal(rightOfCard.enterY, -6)

  const aboveCard = computeCardAnchoredOrigin(
    { left: 720, top: 620, width: 200, height: 125 },
    { left: 600, top: 281, width: 520, height: 325 }
  )
  assert.equal(aboveCard.originY, 325)
  assert.equal(aboveCard.enterY, 6)
})

test('computeDialogAnchorStyle biases origin toward trigger within text-safe bounds', () => {
  const topRightTrigger = computeDialogAnchorStyle(
    { left: 420, top: 220, width: 600, height: 420 },
    { left: 1280, top: 40, width: 96, height: 36 }
  )
  assert.equal(topRightTrigger.origin, '76% 20%')
  assert.equal(topRightTrigger.enterX, 20)
  assert.equal(topRightTrigger.enterY, -16)

  const fallbackCenter = computeDialogAnchorStyle(
    { left: 420, top: 220, width: 600, height: 420 },
    null,
    null
  )
  assert.equal(fallbackCenter.origin, '50% 50%')
  assert.equal(fallbackCenter.enterX, 0)
  assert.equal(fallbackCenter.enterY, 12)
})

test('isPopupSurfaceDocument detects popup and sidepanel documents without affecting options or newtab', () => {
  assert.equal(isPopupSurfaceDocument({ documentElement: { dataset: { curatorSurface: 'popup' } }, getElementById: () => null }), true)
  assert.equal(isPopupSurfaceDocument({ documentElement: { dataset: { curatorSurface: 'sidepanel' } }, getElementById: () => null }), true)
  assert.equal(isPopupSurfaceDocument({ documentElement: { dataset: { curatorSurface: 'newtab' } }, getElementById: () => null }), false)
  assert.equal(isPopupSurfaceDocument({ documentElement: { dataset: { curatorSurface: 'options' } }, getElementById: () => null }), false)
  assert.equal(isPopupSurfaceDocument({ documentElement: { dataset: {} }, getElementById: id => id === 'popup-app-shell' ? {} : null }), true)
})
