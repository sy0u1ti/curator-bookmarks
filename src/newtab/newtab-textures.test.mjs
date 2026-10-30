import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile } from 'node:fs/promises'
import { build } from 'esbuild'

const { outputFiles } = await build({
  stdin: {
    contents: `
      export * from './src/newtab/texture-settings.ts';
      export * from './src/newtab/texture-background.ts';
      export * from './src/newtab/texture-interaction.ts';
      export { getTextureFrameTiming } from './src/vendor/textures/engine.ts';
      export { buildNewTabStoragePayload } from './src/shared/backup-newtab.ts';
      export { createNewtabBackgroundSettingsView } from './src/newtab/newtab-background-settings-store.ts';
    `,
    resolveDir: process.cwd(), loader: 'ts'
  },
  bundle: true, platform: 'node', format: 'esm', write: false
})
const api = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`)
const { normalizeTextureSettings, DEFAULT_TEXTURE_SETTINGS, TEXTURE_PRESETS } = api

test('texture preferences normalize imports and preserve explicit off/zero', () => {
  for (const value of [undefined, null, [], 42, 'current', {}]) {
    assert.deepEqual(normalizeTextureSettings(value), DEFAULT_TEXTURE_SETTINGS)
  }
  for (const value of [undefined, null, true, false, '', ' ', NaN, Infinity, {}, []]) {
    assert.equal(normalizeTextureSettings({ textureIntensity: value }).textureIntensity, 50)
  }
  assert.equal(normalizeTextureSettings({ textureIntensity: -8 }).textureIntensity, 0)
  assert.equal(normalizeTextureSettings({ textureIntensity: 200 }).textureIntensity, 100)
  assert.equal(normalizeTextureSettings({ textureIntensity: '31.7' }).textureIntensity, 32)
  assert.equal(normalizeTextureSettings({ textureMotion: false }).textureMotion, false)
  for (const preset of TEXTURE_PRESETS) {
    assert.equal(normalizeTextureSettings({ texturePreset: preset.id }).texturePreset, preset.id)
    assert.equal(api.getTextureOpacity({ texturePreset: preset.id, textureIntensity: 0 }), 0)
    assert.ok(api.getTextureOpacity({ texturePreset: preset.id, textureIntensity: 100 }) <= 0.5)
  }
})

test('only allowlisted local assets can be selected', () => {
  for (const value of ['__proto__', 'constructor', '../../script', 'https://example.com/a.svg', 'bad");url(//evil)']) {
    assert.equal(api.getTextureImageUrl(value), '/textures/current.svg')
  }
  assert.equal(api.isProceduralBackgroundType('color'), true)
  assert.equal(api.isProceduralBackgroundType('texture'), true)
  for (const value of ['image', 'video', 'featured', 'urls', null]) assert.equal(api.isProceduralBackgroundType(value), false)
})

test('slow frames retain real elapsed time without destabilizing spring integration', () => {
  for (const hz of [10, 15, 30, 60, 144]) {
    const { steps, dt } = api.getTextureFrameTiming(1000 / hz)
    assert.ok(steps >= 1 && steps <= 6)
    assert.ok(dt <= 1 / 60 + Number.EPSILON)
    assert.ok(Math.abs(steps * dt * hz - 1) < 1e-10, `${hz}Hz must not stretch a one-second animation.`)
  }
  assert.equal(api.getTextureFrameTiming(10000).steps, 6, 'A suspended page must not replay an unbounded backlog.')
  for (const invalid of [0, -1, NaN, Infinity]) {
    assert.deepEqual(api.getTextureFrameTiming(invalid), { steps: 1, dt: 1 / 60 })
  }
})

test('backup restore keeps texture preferences in the existing background record', () => {
  const settings = { type: 'texture', texturePreset: 'settle', textureIntensity: 24, textureMotion: false }
  assert.deepEqual(api.buildNewTabStoragePayload({ backgroundSettings: settings }), {
    curatorBookmarkNewTabBackgroundSettings: settings
  })
})

test('texture mode suspends, rather than overwrites, the wallpaper mask', () => {
  const source = {
    type: 'texture', color: '#101013', featuredId: '', imageName: '', videoName: '', url: '',
    maskEnabled: true, maskFilterHover: true, maskBlur: 16, maskFilterSize: 35, maskFilterSpacing: 62,
    maskFilterStrength: 71, maskOverlay: 50, maskStyle: 'water', ...DEFAULT_TEXTURE_SETTINGS
  }
  const preferences = { displaySize: 100, positionX: 50, positionY: 50 }
  const limits = { displaySize: { min: 100, max: 180 }, positionX: { min: 0, max: 100 }, positionY: { min: 0, max: 100 } }
  const texture = api.createNewtabBackgroundSettingsView(source, preferences, limits)
  assert.equal(texture.maskEnabled, false)
  for (const field of ['maskStyleHidden', 'maskBlurHidden', 'maskFilterStrengthHidden', 'maskFilterHoverHidden']) {
    assert.equal(texture[field], true)
  }
  assert.equal(source.maskEnabled, true)
  assert.equal(source.maskStyle, 'water')
  const image = api.createNewtabBackgroundSettingsView({ ...source, type: 'image' }, preferences, limits)
  assert.equal(image.maskEnabled, true)
  assert.equal(image.maskStyle, 'water')
  assert.equal(image.maskFilterStrength, 71)
})

test('the first-paint snapshot is validated, optional, and cleared on other backgrounds', () => {
  const values = new Map()
  const properties = new Map()
  globalThis.localStorage = {
    getItem: key => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key)
  }
  globalThis.document = {
    documentElement: {
      dataset: {},
      style: { setProperty: (key, value) => properties.set(key, value), removeProperty: key => properties.delete(key) }
    }
  }
  try {
    const settings = { type: 'texture', texturePreset: 'settle', textureIntensity: 24, textureMotion: false }
    api.syncTextureBackground(settings)
    assert.deepEqual(api.readTextureBackgroundSnapshot(), { texturePreset: 'settle', textureIntensity: 24, textureMotion: false })
    assert.equal(document.documentElement.dataset.textureBackground, 'settle')
    assert.equal(properties.get('--newtab-texture-image'), 'url("/textures/settle.svg")')
    values.set(api.TEXTURE_SNAPSHOT_KEY, '{bad json')
    assert.equal(api.readTextureBackgroundSnapshot(), null)
    api.syncTextureBackground({ ...settings, type: 'video' })
    assert.equal(values.has(api.TEXTURE_SNAPSHOT_KEY), false)
    assert.equal(document.documentElement.dataset.textureBackground, undefined)
    assert.equal(properties.has('--newtab-texture-image'), false)
    globalThis.localStorage.setItem = () => { throw new Error('quota') }
    assert.doesNotThrow(() => api.syncTextureBackground(settings))
  } finally {
    delete globalThis.document
    delete globalThis.localStorage
  }
})

test('motion is opt-in-capable and disabled for hidden, reduced, coarse and forced-colour contexts', () => {
  const environment = { visible: true, reducedMotion: false, slowUpdates: false, coarsePointer: false, forcedColors: false }
  assert.equal(api.isTextureMotionAllowed(environment), true)
  assert.equal(api.isTextureMotionAllowed({ ...environment, visible: false }), false)
  for (const field of ['reducedMotion', 'slowUpdates', 'coarsePointer', 'forcedColors']) {
    assert.equal(api.isTextureMotionAllowed({ ...environment, [field]: true }), false)
  }
})

test('every offered preset has a local, passive SVG and the shipped MIT notice', async () => {
  for (const preset of TEXTURE_PRESETS) {
    const svg = await readFile(`public/textures/${preset.id}.svg`, 'utf8')
    assert.match(svg, /viewBox="0 0 732 516"/)
    assert.match(svg, /Copyright \(c\) 2026 Textures/)
    assert.doesNotMatch(svg, /<(?:script|image|foreignObject)\b|(?:href|src)=["']https?:|onload=/i)
  }
  assert.match(await readFile('public/textures/LICENSE.txt', 'utf8'), /Permission is hereby granted/)
})
