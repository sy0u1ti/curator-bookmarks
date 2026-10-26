import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { chromium } from 'playwright'

const bundle = await build({
  stdin: {
    contents: `
      import { initSquircleEngine, applySquircleClipBeforePaint } from './src/shared/squircle-engine'
      window.eagerClip = applySquircleClipBeforePaint
      initSquircleEngine()
    `,
    resolveDir: process.cwd(),
    loader: 'ts'
  },
  bundle: true,
  write: false,
  format: 'iife',
  platform: 'browser'
})

const browser = await chromium.launch({
  channel: process.env.CURATOR_BROWSER_CHANNEL || 'msedge',
  headless: true
})

const fixture = `
  <style>
    * { box-sizing: border-box; }
    body { margin: 24px; background: #111; }
    .pair { display: flex; gap: 24px; margin-bottom: 24px; }
    .rounded {
      appearance: none; display: block; width: 160px; height: 48px;
      border: 1px solid #777; border-radius: 12px; background: #252525;
      outline: none; padding: 0;
    }
    .transparent { border-color: transparent; }
    .transparent:hover { border-color: #aaa; }
    .shadow { border: 0; box-shadow: inset 0 0 0 1px #777; }
    button:focus { outline: 2px solid #ddd; outline-offset: 3px; }
    .artwork { width: 40px; height: 40px; border: 0; background: #aaa; }
    .bordered { border: 1px solid #777; }
  </style>
  <div class="pair">
    <div id="automatic" class="rounded"></div>
    <div id="automatic-reference" class="rounded" data-squircle="off"></div>
  </div>
  <div class="pair">
    <div id="explicit" class="rounded" data-squircle="on"></div>
    <div id="explicit-reference" class="rounded" data-squircle="off"></div>
  </div>
  <div class="pair">
    <div id="shadow" class="rounded shadow" data-squircle="on"></div>
    <div id="shadow-reference" class="rounded shadow" data-squircle="off"></div>
  </div>
  <div id="transparent" class="rounded transparent" data-squircle="on"></div>
  <div class="pair">
    <div id="focus-parent" class="rounded artwork" data-squircle="on"><button id="focus-child" class="rounded"></button></div>
  </div>
  <div id="artwork" class="rounded artwork" data-squircle="on"></div>
  <div data-squircle-subtree="off"><div id="opt-out" class="rounded artwork"></div></div>
`

async function settle(page) {
  await page.evaluate(() => new Promise(resolve =>
    requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  ))
}

try {
  for (const deviceScaleFactor of [1, 1.25, 2]) {
    const context = await browser.newContext({ deviceScaleFactor, viewport: { width: 800, height: 700 } })
    const page = await context.newPage()
    await page.setContent(fixture)
    await page.addScriptTag({ content: bundle.outputFiles[0].text })
    await page.evaluate(() => {
      for (const id of ['explicit', 'shadow', 'transparent', 'focus-parent', 'focus-child', 'opt-out']) {
        window.eagerClip(document.getElementById(id))
      }
    })
    await settle(page)

    for (const id of ['automatic', 'explicit', 'shadow', 'transparent', 'focus-parent', 'focus-child', 'opt-out']) {
      assert.equal(await page.locator('#' + id).evaluate(element => getComputedStyle(element).clipPath), 'none',
        `${id} must retain its native contour at ${deviceScaleFactor}x`)
    }
    for (const id of ['automatic', 'explicit', 'shadow']) {
      const actual = await page.locator('#' + id).screenshot()
      const native = await page.locator('#' + id + '-reference').screenshot()
      assert.deepEqual(actual, native, `${id} must paint the same complete border as the native reference`)
    }

    await page.locator('#transparent').hover()
    assert.equal(await page.locator('#transparent').evaluate(element => getComputedStyle(element).borderColor), 'rgb(170, 170, 170)')
    await page.locator('#focus-child').focus()
    assert.equal(await page.locator('#focus-child').evaluate(element => getComputedStyle(element).outlineWidth), '2px')
    assert.equal(await page.locator('#focus-parent').evaluate(element => getComputedStyle(element).clipPath), 'none')

    const artwork = page.locator('#artwork')
    const originalPath = await artwork.evaluate(element => getComputedStyle(element).clipPath)
    assert.match(originalPath, /^path\(/, 'Borderless artwork still receives a smooth contour')
    await artwork.evaluate(element => { element.style.width = '56px' })
    await page.waitForFunction(path => getComputedStyle(document.getElementById('artwork')).clipPath !== path, originalPath)
    await artwork.evaluate(element => element.classList.add('bordered'))
    await settle(page)
    assert.equal(await artwork.evaluate(element => getComputedStyle(element).clipPath), 'none',
      'Adding a native border must release the previous clip')
    await artwork.evaluate(element => element.classList.remove('bordered'))
    await settle(page)
    assert.match(await artwork.evaluate(element => getComputedStyle(element).clipPath), /^path\(/)
    await context.close()
  }
  console.log('Native borders, hover borders and focus rings remain intact at 1x, 1.25x and 2x; decorative artwork still resizes correctly.')
} finally {
  await browser.close()
}
