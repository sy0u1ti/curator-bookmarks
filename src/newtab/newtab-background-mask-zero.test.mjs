import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { chromium } from 'playwright'

const extensionPath = path.resolve('dist')
const profilePath = await mkdtemp(path.join(tmpdir(), 'curator-mask-zero-'))

async function readMaskSymptom(page) {
  return page.locator('#newtab-wallpaper-dim').evaluate((dim) => {
    const style = getComputedStyle(dim)
    const value = document.querySelector('#wallpaper-dim-value')?.textContent?.trim()
    return {
      backdropFilter: style.backdropFilter,
      dimOpacity: style.opacity,
      dimValue: value,
      reducedTransparency: matchMedia('(prefers-reduced-transparency: reduce)').matches
    }
  })
}

let context

try {
  context = await chromium.launchPersistentContext(profilePath, {
    channel: 'chromium',
    headless: process.env.CURATOR_HEADLESS === '1',
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
        type: 'urls',
        color: '#f8f8f8',
        imageName: '',
        videoName: '',
        url: '',
        featuredId: '',
        wallpaperDim: 0,
        wallpaperBlur: 1
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
  await page.waitForFunction(() => document.querySelector('#newtab-wallpaper-adjustments-host #newtab-wallpaper-dim'))
  await page.locator('#newtab-settings-trigger').click()
  await page.getByRole('tab', { name: '外观', exact: true }).click()
  await page.locator('#wallpaper-dim-value').waitFor({ state: 'attached' })

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
  assert.equal(normal.dimValue, '0%', 'The baseline settings value must remain pinned to zero')
  assert.equal(reduced.dimValue, '0%', 'The comparison settings value must remain pinned to zero')
  for (const snapshot of [normal, reduced]) {
    assert.equal(snapshot.dimOpacity, '0', `Zero dim must add no tint: ${JSON.stringify(snapshot)}`)
    assert.equal(snapshot.backdropFilter, 'none')
  }

  console.log(`New Tab zero-mask computed styles: ${JSON.stringify({ normal, reduced })}`)
  console.log('New Tab zero-mask regression test passed.')
} finally {
  await context?.close()
  await rm(profilePath, { recursive: true, force: true })
}
