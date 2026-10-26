import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { build } from 'esbuild'
import { chromium } from 'playwright'

const compiled = await build({
  stdin: {
    contents: `
      import React from 'react';
      import { createRoot } from 'react-dom/client';
      import { flushSync } from 'react-dom';
      import { FeaturedBackgroundPicker } from './components/FeaturedBackgroundPicker';
      import { FeaturedBackgroundHoverPreviewHost } from './components/FeaturedBackgroundHoverPreview';
      import { dispatchNewtabFeaturedBackgroundHoverPreviewView } from './newtab-featured-background-hover-preview-store';
      const root = createRoot(document.getElementById('root'));
      const pending = new Map();
      let generation = 0;
      window.fixture = {
        actions: [],
        hovered: [],
        resolve: (id, src) => pending.get(id)(src),
        hover: (src) => flushSync(() => dispatchNewtabFeaturedBackgroundHoverPreviewView({
          src, visible: true, ariaLabel: 'Wallpaper preview', width: 280, height: 175, top: 250, left: 16
        })),
        render: (configs) => {
          window.fixture.actions = [];
          window.fixture.hovered = [];
          const cards = configs.map((config, index) => ({
            favorite: false, selected: false, fetchpriority: 'auto', renderIndex: index,
            previewAccentColor: '#202226', resolutionState: 'pending', resolutionText: '',
            previewFallbackUrls: [],
            ...config,
            imageUrl: config.initialPreviewUrl,
            remotePreviewUrl: config.initialPreviewUrl,
            onResolvePreviewObjectUrl: (_remote, fallback) => config.cache === 'deferred'
              ? new Promise(resolve => pending.set(config.id, resolve))
              : config.cache === 'reject' ? Promise.reject(new Error('Cache unavailable')) : Promise.resolve(fallback),
            onClearHoverPreview: () => {},
            onScheduleHoverPreview: request => window.fixture.hovered.push(request.title),
            onSelect: () => window.fixture.actions.push('select:' + config.id),
            onDownload: () => window.fixture.actions.push('download:' + config.id),
            onFavoriteToggle: () => window.fixture.actions.push('favorite:' + config.id)
          }));
          flushSync(() => root.render(<>
            <FeaturedBackgroundPicker key={++generation} state={{
              type: 'sections',
              sections: [{ type: 'grid', section: { title: 'Wallpapers', emptyText: 'No wallpapers', cards } }]
            }} />
            <FeaturedBackgroundHoverPreviewHost />
          </>));
        }
      };
    `,
    resolveDir: path.resolve('src/newtab'),
    loader: 'tsx'
  },
  bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'silent'
})
const html = await readFile('dist/src/newtab/newtab.html', 'utf8')
const styles = await Promise.all([...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)]
  .map(([, href]) => readFile(path.join('dist', href.replace(/^\//, '')), 'utf8')))
assert.ok(styles.length > 0, 'test uses the built New Tab stylesheet')
const image = '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400"><path fill="#586d80" d="M0 0h640v400H0z"/><circle cx="200" cy="180" r="100" fill="#bdcbd2"/></svg>'
const imageUrl = name => `https://gallery-images.test/${name}.svg`
const requests = []
let releaseSlow
let announceSlow
const slowRequested = new Promise(resolve => { announceSlow = resolve })
const browser = await chromium.launch({ channel: process.env.CURATOR_BROWSER_CHANNEL || 'msedge', headless: true })

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
  page.setDefaultTimeout(5000)
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route('https://gallery-images.test/**', async route => {
    const name = new URL(route.request().url()).pathname
    requests.push(name)
    if (name === '/slow.svg') {
      await new Promise(resolve => {
        releaseSlow = resolve
        announceSlow()
      })
    }
    await route.fulfill(name.includes('missing')
      ? { status: 404, contentType: 'text/plain', body: 'Missing image' }
      : { contentType: 'image/svg+xml', body: image })
  })
  await page.setContent('<div id="root" style="padding:24px;max-width:100%"></div>')
  await page.addStyleTag({ content: styles.join('\n') })
  await page.addScriptTag({ content: compiled.outputFiles[0].text })
  const render = configs => page.evaluate(configs => window.fixture.render(configs), configs)
  const card = id => page.locator(`[data-featured-background-id="${id}"]`)
  const preview = id => card(id).locator('.featured-wallpaper-preview')
  const waitState = (id, state) => page.waitForFunction(({ id, state }) =>
    document.querySelector(`[data-featured-background-id="${id}"] .featured-wallpaper-preview`)?.dataset.state === state,
  { id, state })
  const settle = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))

  await render([{
    id: 'fallback', title: 'Landscape', initialPreviewUrl: imageUrl('missing-first'),
    previewFallbackUrls: [imageUrl('missing-first'), imageUrl('fallback'), imageUrl('fallback')],
    resolutionState: 'ready', resolutionText: '3840 x 2160'
  }])
  await waitState('fallback', 'ready')
  assert.equal(await card('fallback').locator('img').getAttribute('src'), imageUrl('fallback'))
  assert.equal(requests.filter(url => url === '/missing-first.svg').length, 1, 'each failed source is tried once')
  assert.equal(requests.filter(url => url === '/fallback.svg').length, 1)
  assert.equal(await card('fallback').locator('.featured-wallpaper-resolution').innerText(), '3840 x 2160')

  await render([{
    id: 'offline', title: 'Unavailable landscape', initialPreviewUrl: imageUrl('missing-offline'),
    previewFallbackUrls: [imageUrl('missing-offline'), imageUrl('missing-original')],
    cache: 'deferred'
  }])
  await waitState('offline', 'error')
  assert.equal(await preview('offline').getAttribute('aria-busy'), 'false', 'exhausted fallbacks terminate loading')
  assert.equal(await card('offline').locator('img').isVisible(), false, 'native broken-image chrome is never painted')
  assert.equal(await card('offline').locator('.featured-wallpaper-preview-error').isVisible(), true)
  assert.equal(await card('offline').locator('.featured-wallpaper-resolution').count(), 0, 'unknown dimensions do not become repeated status labels')
  await card('offline').hover()
  assert.deepEqual(await page.evaluate(() => window.fixture.hovered), [], 'failed images do not schedule large hover previews')
  const requestCount = requests.length
  await page.evaluate(src => window.fixture.resolve('offline', src), imageUrl('missing-offline'))
  await settle()
  assert.equal(await preview('offline').getAttribute('data-state'), 'error', 'late cache fallback cannot reset a failed source')
  assert.equal(requests.length, requestCount, 'late cache completion does not retry exhausted URLs')

  await render([{ id: 'recovery', title: 'Cached landscape', initialPreviewUrl: imageUrl('missing-cache'), cache: 'deferred' }])
  await waitState('recovery', 'error')
  await page.evaluate(src => window.fixture.resolve('recovery', src), imageUrl('cached'))
  await waitState('recovery', 'ready')
  assert.equal(await card('recovery').locator('.featured-wallpaper-preview-error').count(), 0, 'a valid late cache result can recover the preview')

  await render([{ id: 'slow', title: 'Slow landscape', initialPreviewUrl: imageUrl('slow'), cache: 'reject' }])
  await slowRequested
  assert.equal(await preview('slow').getAttribute('data-state'), 'loading')
  assert.equal(await card('slow').locator('img').isVisible(), false)
  assert.equal(await card('slow').locator('.featured-wallpaper-preview-error').count(), 0, 'a pending request is not an error')
  assert.ok(releaseSlow)
  releaseSlow()
  await waitState('slow', 'ready')
  await page.mouse.move(0, 0)
  await card('slow').hover()
  assert.deepEqual(await page.evaluate(() => window.fixture.hovered), ['Slow landscape'])

  await page.evaluate(src => window.fixture.hover(src), imageUrl('hover'))
  await page.locator('.featured-wallpaper-hover-preview.is-visible').waitFor()
  await page.evaluate(src => window.fixture.hover(src), imageUrl('missing-hover'))
  await page.waitForFunction(() => !document.querySelector('.featured-wallpaper-hover-preview'))
  assert.equal(await page.locator('.featured-wallpaper-hover-preview').isVisible(), false, 'failed large previews do not expose a broken-image frame')

  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 900 })
    await page.keyboard.press('Tab')
    await card('slow').focus()
    const contours = await card('slow').evaluate(element => {
      const style = getComputedStyle(element)
      return { border: style.borderTopWidth, clip: style.clipPath, outline: style.outlineWidth, outlineStyle: style.outlineStyle }
    })
    assert.equal(contours.border, '0px')
    assert.equal(contours.clip, 'none')
    assert.equal(contours.outline, '2px')
    assert.equal(contours.outlineStyle, 'solid')
    await page.keyboard.press('Enter')
    await page.keyboard.press('Tab')
    assert.equal(await card('slow').getByRole('button', { name: /下载/ }).evaluate(element =>
      element === document.activeElement && getComputedStyle(element).outlineStyle === 'solid' &&
      parseFloat(getComputedStyle(element).outlineWidth) >= 2), true, 'nested actions retain visible keyboard focus')
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
  }
  assert.deepEqual(await page.evaluate(() => window.fixture.actions), ['select:slow', 'select:slow', 'select:slow'])
  assert.deepEqual(errors, [], 'cache errors are contained and no page error escapes')
  console.log('Gallery preview tests passed: fallback exhaustion, delayed cache races, loading, recovery, hover failures, and keyboard contours at 1440/768/390px.')
} finally {
  releaseSlow?.()
  await browser.close()
}
