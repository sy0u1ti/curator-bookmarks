import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'

const output = path.resolve('.tmp-test/newtab-glass/material.mjs')
await mkdir(path.dirname(output), { recursive: true })
await build({
  stdin: {
    contents: `
      export * from './src/newtab/glass-settings';
      import { createElement } from 'react';
      import { renderToStaticMarkup } from 'react-dom/server';
      import { NewtabGlassSurface, NewtabFloatingSurface } from './src/newtab/components/NewtabGlassSurface';
      import { SurfaceMaterial, SurfaceMaterialProvider } from './src/ui/base/SurfaceMaterial';
      import { MotionPanel } from './src/ui/motion/MotionPanel';
      export function renderSurface(as, props) {
        return renderToStaticMarkup(createElement(NewtabGlassSurface, { as, ...props }, 'Curator'));
      }
      export function renderPopup(skin) {
        const popup = createElement(SurfaceMaterial, { id: 'popup', role: 'dialog', tabIndex: -1 }, 'Content');
        return renderToStaticMarkup(skin ? createElement(SurfaceMaterialProvider, { component: NewtabFloatingSurface }, popup) : popup);
      }
      export function renderInlineMenu() {
        return renderToStaticMarkup(createElement(SurfaceMaterialProvider, { component: NewtabFloatingSurface },
          createElement(MotionPanel, { material: false, variant: 'menu', role: 'menu' }, 'Actions')));
      }
    `,
    resolveDir: process.cwd(), loader: 'tsx'
  },
  bundle: true, packages: 'external', format: 'esm', platform: 'node',
  jsx: 'automatic', outfile: output
})
const api = await import(pathToFileURL(output).href)

test('migrates old glass preferences without losing tint or blur', () => {
  const legacy = Object.freeze({ tint: 17, blur: 7.5, rim: 0.15, bevel: 44, thickness: 28, dispersion: 0.11, light: -25, smooth: 0.75 })
  const migrated = api.normalizeGlassSettings(legacy)
  assert.deepEqual(migrated, { tint: 17, blur: 7.5, saturation: 140, brightness: 104, highlight: 50 })
  assert.deepEqual(api.normalizeGlassSettings(migrated), migrated)
  assert.equal(api.normalizeGlassSettings({ rim: 1.6, highlight: 37 }).highlight, 37)
  assert.equal(api.normalizeGlassSettings({ rim: ' ' }).highlight, 100)
})

test('invalid and boundary preferences stay finite and preserve explicit zero', () => {
  assert.deepEqual(api.normalizeGlassSettings(null), api.DEFAULT_GLASS_SETTINGS)
  assert.deepEqual(api.normalizeGlassSettings({
    tint: 0, blur: 0, saturation: Infinity, brightness: -20, highlight: ' '
  }), { tint: 0, blur: 0, saturation: 140, brightness: 80, highlight: 100 })
  assert.equal(api.normalizeGlassSettings({ blur: 50 }).blur, 12)
  for (const preset of api.GLASS_PRESETS) {
    assert.deepEqual(api.normalizeGlassSettings(preset.settings), preset.settings)
    assert.equal(api.getGlassPresetId(preset.settings), preset.id)
  }
})

test('every material control reaches CSS without asynchronous rendering', () => {
  const values = new Map()
  api.applyGlassSettingsCss({ tint: 0, blur: 3, saturation: 125, brightness: 108, highlight: 40 }, {
    style: { setProperty: (name, value) => values.set(name, value) }
  })
  assert.equal(values.get('--newtab-glass-bg-fill'), 'rgba(0, 0, 0, 0)')
  assert.equal(values.get('--newtab-glass-background-blur'), '3px')
  assert.equal(values.get('--newtab-glass-saturation'), '1.25')
  assert.equal(values.get('--newtab-glass-brightness'), '1.08')
  assert.equal(values.get('--newtab-glass-highlight'), '0.4')
})

test('GlassSurface keeps host semantics and paints Frosted in server markup', () => {
  const anchor = api.renderSurface('a', { href: '/bookmark', 'aria-label': 'Bookmark', className: 'bookmark-tile' })
  assert.match(anchor, /^<a /)
  assert.match(anchor, /href="\/bookmark"/)
  assert.match(anchor, /aria-label="Bookmark"/)
  assert.match(anchor, /data-glass-renderer="react-bits"/)
  assert.match(anchor, /glass-surface--fallback/)
  assert.equal((anchor.match(/aria-hidden="true"/g) || []).length, 0)
  assert.doesNotMatch(anchor, /<canvas|<svg|hyalite|glass-surface__/)
  assert.match(api.renderSurface('button', { disabled: true, type: 'button', tone: 'chip' }), /^<button [^>]*disabled=""/)
})

test('shared popup roots acquire glass only within the New Tab provider', () => {
  assert.equal(api.renderPopup(false), '<div id="popup" role="dialog" tabindex="-1">Content</div>')
  const glass = api.renderPopup(true)
  assert.match(glass, /^<div id="popup" role="dialog" tabindex="-1"/)
  assert.match(glass, /data-glass-tone="panel"/)
  assert.equal((glass.match(/<div/g) || []).length, 1)
  const inline = api.renderInlineMenu()
  assert.match(inline, /role="menu"/)
  assert.doesNotMatch(inline, /glass-surface/, 'Inline content must not paint a second glass pane inside its host')
})

test('startup and renderer source cannot restore the retired texture pipeline', async () => {
  const [main, html, vendor, preboot] = await Promise.all([
    'src/newtab/main.tsx', 'src/newtab/newtab.html',
    'src/vendor/react-bits/GlassSurface.tsx', 'src/newtab/newtab-bookmark-preboot.ts'
  ].map(file => readFile(file, 'utf8')))
  assert.doesNotMatch(main + html, /newtab-glass-startup|newtab-glass-runtime|hyalite/)
  assert.doesNotMatch(vendor, /new Worker|createObjectURL|ResizeObserver|useEffect|requestAnimationFrame/)
  assert.match(preboot, /glass-surface glass-surface--fallback/)
  assert.match(preboot, /NEWTAB_BOOKMARK_PREBOOT_VERSION = 8/)
})

test('Frosted paints its sheen on the host without independent masked contours', async () => {
  const css = await readFile('src/vendor/react-bits/GlassSurface.css', 'utf8')
  assert.match(css, /background-image: var\(--glass-sheen\)/)
  assert.match(css, /background-origin: border-box/)
  assert.doesNotMatch(css, /(?:^|\n)\s*(?:-webkit-)?(?:mask(?:-[\w-]+)?|clip-path)\s*:/)
  const preboot = await readFile('src/newtab/newtab-bookmark-preboot.ts', 'utf8')
  assert.match(preboot, /background-image: var\(--glass-sheen\)/)
  assert.doesNotMatch(preboot, /glass-surface__/)
})
