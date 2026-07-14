import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { chromium } from 'playwright'

const extensionPath = path.resolve('dist')
const profilePath = await mkdtemp(path.join(tmpdir(), 'curator-mask-zero-'))

function parseAlpha(color) {
  const match = color.match(/^rgba?\([^,]+,[^,]+,[^,]+(?:,\s*([\d.]+))?\)$/)
  if (!match) {
    throw new Error(`Unsupported computed color: ${color}`)
  }
  return match[1] === undefined ? 1 : Number(match[1])
}

async function readMaskSymptom(page) {
  return page.locator('#newtab-background-mask').evaluate((mask) => {
    const style = getComputedStyle(mask)
    const value = document.querySelector('#background-mask-overlay-value')?.textContent?.trim()
    return {
      backgroundColor: style.backgroundColor,
      backgroundImage: style.backgroundImage,
      backdropFilter: style.backdropFilter,
      maskOpacity: style.opacity,
      maskOverlayValue: value,
      reducedTransparency: matchMedia('(prefers-reduced-transparency: reduce)').matches
    }
  })
}

let context

try {
  context = await chromium.launchPersistentContext(profilePath, {
    headless: false,
    viewport: { width: 1280, height: 720 },
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`
    ]
  })

  const worker = context.serviceWorkers()[0]
    ?? await context.waitForEvent('serviceworker', { timeout: 15_000 })
  const extensionId = new URL(worker.url()).host

  await worker.evaluate(async () => {
    await chrome.storage.local.set({
      curatorBookmarkNewTabBackgroundSettings: {
        type: 'color',
        color: '#f8f8f8',
        imageName: '',
        videoName: '',
        url: '',
        featuredId: '',
        maskEnabled: true,
        maskStyle: 'noise',
        maskBlur: 1,
        maskOverlay: 0,
        maskFilterHover: true,
        maskFilterStrength: 50,
        maskFilterSize: 50,
        maskFilterSpacing: 50
      }
    })
  })

  const page = await context.newPage()
  const client = await context.newCDPSession(page)
  await client.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-transparency', value: 'no-preference' }]
  })

  await page.goto(`chrome-extension://${extensionId}/src/newtab/newtab.html`, {
    waitUntil: 'domcontentloaded'
  })
  await page.waitForFunction(() => {
    const app = document.querySelector('.newtab-app')
    const mask = document.querySelector('#newtab-background-mask')
    return app?.classList.contains('background-mask-enabled')
      && mask
      && !mask.hasAttribute('data-mask-initial')
  })
  await page.locator('#newtab-settings-trigger').click()
  await page.locator('#background-mask-overlay-value').waitFor({ state: 'attached' })

  const normal = await readMaskSymptom(page)

  await client.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }]
  })
  await page.waitForFunction(() => matchMedia('(prefers-reduced-transparency: reduce)').matches)
  await page.evaluate(() => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve))
  }))
  await page.waitForTimeout(220)
  const reduced = await readMaskSymptom(page)

  assert.equal(normal.reducedTransparency, false, 'The baseline must run without reduced transparency')
  assert.equal(reduced.reducedTransparency, true, 'The comparison must enable reduced transparency')
  assert.equal(normal.maskOverlayValue, '0%', 'The baseline settings value must remain pinned to zero')
  assert.equal(reduced.maskOverlayValue, '0%', 'The comparison settings value must remain pinned to zero')
  assert.equal(normal.maskOpacity, '1', 'The enabled mask layer should be present in the baseline')
  assert.equal(reduced.maskOpacity, '1', 'The enabled mask layer should be present in the comparison')
  assert.ok(
    parseAlpha(normal.backgroundColor) <= 0.2 && parseAlpha(reduced.backgroundColor) <= 0.2,
    `A zero-strength mask must stay light under both transparency preferences: ${JSON.stringify({ normal, reduced })}`
  )

  console.log(`New Tab zero-mask computed styles: ${JSON.stringify({ normal, reduced })}`)
  console.log('New Tab zero-mask regression test passed.')
} finally {
  await context?.close()
  await rm(profilePath, { recursive: true, force: true })
}
