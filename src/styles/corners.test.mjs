import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { test } from 'node:test'

const read = file => readFile(path.resolve(file), 'utf8')
const tokens = await read('src/styles/tokens.css')
const corners = await read('src/styles/corners.css')
const values = new Map([...tokens.matchAll(/(--ds-[\w-]+):\s*([^;]+);/g)].map(([, name, value]) => [name, value]))
const resolveToken = name => {
  const raw = values.get(name)
  assert.ok(raw, `Missing design token ${name}`)
  const alias = /^var\((--[\w-]+)\)$/.exec(raw)
  return alias ? resolveToken(alias[1]) : Number.parseFloat(raw)
}

test('radii and border-box insets form one progressive 4px scale', () => {
  assert.deepEqual(['xs', 'sm', 'md', 'lg', 'xl', '2xl'].map(size => resolveToken(`--ds-radius-${size}`)), [4, 8, 12, 16, 24, 32])
  for (const [outer, inset, inner] of [
    ['menu', 'control', 'control'],
    ['lg', 'panel', 'control'],
    ['card', 'panel', 'lg'],
    ['card', 'card', 'control'],
    ['dialog', 'card', 'lg'],
    ['dialog', 'dialog', 'control']
  ]) {
    assert.equal(resolveToken(`--ds-radius-${outer}`) - resolveToken(`--ds-inset-${inset}`), resolveToken(`--ds-radius-${inner}`),
      `${outer} - ${inset} must be ${inner}`)
  }
})

test('every surface shares native arcs, including when corner-shape is unsupported', async () => {
  assert.equal(values.get('--ds-corner-shape'), 'round')
  assert.match(corners, /corner-shape: var\(--ds-corner-shape, round\)/)
  assert.match(corners, /:where\(html\[data-curator-surface\]\) :where\(\*\)/)
  assert.doesNotMatch(corners, /clip-path:|mask-image:|overflow:\s*hidden|superellipse\(|@supports/)
  for (const surface of ['popup', 'sidepanel', 'newtab', 'options', 'archive']) {
    assert.match(await read(`src/${surface}/${surface}.html`), new RegExp(`<html\\b[^>]*data-curator-surface="${surface}"`))
  }
  assert.ok((await read('src/styles/globals.css')).includes('@import "./corners.css"'))
})

test('nested controls subtract the painted border from their inset', async () => {
  const tailwind = await read('src/styles/tailwind.css')
  for (const [utility, inset] of [['menu', 'control'], ['panel', 'panel'], ['card', 'card'], ['dialog', 'dialog']]) {
    assert.match(tailwind, new RegExp(`@utility ds-inset-${utility}\\s*\\{\\s*padding: calc\\(var\\(--ds-inset-${inset}\\) - var\\(--ds-stroke-width\\)\\);`))
  }
  const menu = await read('src/ui/base/menu.css')
  assert.match(menu, /padding: calc\(var\(--ds-inset-control\) - var\(--ds-stroke-width\)\)/)
  assert.match(await read('src/ui/base/InlineMenuItems.tsx'), /SUBMENU_INSET_PX = 4/)
})

test('corners require no JS library, startup scanner or per-icon clipping', async () => {
  const manifest = JSON.parse(await read('package.json'))
  assert.equal(manifest.dependencies['@lisse/core'], undefined)
  for (const file of [
    'src/popup/main.tsx', 'src/newtab/main.tsx',
    'src/newtab/components/BookmarkIconShell.tsx', 'src/newtab/newtab-bookmark-preboot.ts'
  ]) {
    assert.doesNotMatch(await read(file), /squircle-engine|applySquircleClipBeforePaint|initSquircleEngine|\.style\.clipPath\s*=/,
      `${file} must let native CSS paint the first frame`)
  }
})

test('first-paint shells share the live radii and discard obsolete clipped snapshots', async () => {
  const popup = await read('src/popup/popup.html')
  assert.match(popup, /border-radius: var\(--popup-radius-surface, 12px\)/)
  assert.match(popup, /corner-shape: var\(--ds-corner-shape, round\)/)
  const preboot = await read('src/newtab/newtab-bookmark-preboot.ts')
  assert.match(preboot, /NEWTAB_BOOKMARK_PREBOOT_VERSION = 8/)
  assert.match(preboot, /border-radius: var\(--ds-radius-lg, 16px\)/)
  assert.match(preboot, /border-radius: var\(--ds-radius-xs, 4px\)/)
  assert.doesNotMatch(preboot, /clipPaths|superellipse\(/)
  assert.match(preboot, /corner-shape: var\(--ds-corner-shape, round\)/)
})

test('Popup sibling surfaces and their placeholders share one radius role', async () => {
  const css = await read('src/popup/popup.css')
  assert.match(css, /--popup-radius-surface: var\(--ds-radius-md\);/)
  assert.match(css, /\.popup-surface\s*\{\s*border-radius: var\(--popup-radius-surface\);\s*\}/)
  const sources = new Map(await Promise.all(
    ['PopupChromeHost', 'PopupSmartClassifier', 'PopupContent', 'PopupAutoAnalyzeStatus']
      .map(async name => [name, await read(`src/popup/components/${name}.tsx`)])
  ))
  for (const [file, constant] of [
    ['PopupChromeHost', 'searchShellClass'],
    ['PopupChromeHost', 'errorBannerClass'],
    ['PopupSmartClassifier', 'pageCardClass'],
    ['PopupSmartClassifier', 'SMART_ERROR_BANNER_CLASS'],
    ['PopupContent', 'paneClass'],
    ['PopupAutoAnalyzeStatus', 'STATUS_BASE_CLASS']
  ]) {
    const declaration = sources.get(file).match(new RegExp(`const ${constant} =\\s*(?:\\[\\s*)?'([^']+)'`))?.[1]
    assert.ok(declaration?.split(' ').includes('popup-surface'), `${file}.${constant} must use the sibling surface role`)
    assert.doesNotMatch(declaration, /\brounded(?:-|\b)/, `${file}.${constant} must not add a competing radius`)
  }
  assert.match(sources.get('PopupSmartClassifier'), /cx\(pageCardClass, pageSkeletonLayerClass\)/)
  assert.match(sources.get('PopupContent'), /<aside className=\{paneClass\} aria-label="文件夹树加载占位"/)
  assert.equal(resolveToken('--ds-radius-md'), 12)
})

test('production component classes use design radii rather than a second Tailwind scale', async () => {
  async function walk(directory) {
    const entries = await readdir(directory, { withFileTypes: true })
    return (await Promise.all(entries.map(entry => entry.isDirectory()
      ? walk(path.join(directory, entry.name)) : path.join(directory, entry.name)))).flat()
  }
  for (const directory of ['src/ui', 'src/options/components', 'src/popup/components', 'src/newtab/components']) {
    for (const file of await walk(directory)) {
      if (!/\.(ts|tsx)$/.test(file) || /\.(test|fixture)/.test(file)) continue
      const source = await readFile(file, 'utf8')
      assert.doesNotMatch(source, /\brounded-(?:sm|md|lg|xl|2xl)(?![-\w])|\brounded-\[\d+px\]/,
        `${file} bypasses the shared radius scale`)
    }
  }
})
