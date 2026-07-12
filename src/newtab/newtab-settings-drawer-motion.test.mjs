import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { chromium } from 'playwright'

const extensionPath = path.resolve('dist')
const profilePath = await mkdtemp(path.join(tmpdir(), 'curator-drawer-motion-'))

async function probeOpening(page) {
  const panel = page.locator('.settings-drawer-panel')
  await panel.waitFor({ state: 'attached' })
  await page.waitForFunction(() => document.querySelector('.settings-drawer-panel')?.hasAttribute('hidden'))

  const probePromise = page.evaluate(() => {
    const target = document.querySelector('.settings-drawer-panel')
    if (!(target instanceof HTMLElement)) {
      throw new Error('Settings drawer panel is missing')
    }

    return new Promise((resolve) => {
      const frames = []
      const transitionProperties = []
      let sawStartingStyle = false
      const startedAt = performance.now()

      const handleTransitionRun = (event) => {
        transitionProperties.push(event.propertyName)
      }
      target.addEventListener('transitionrun', handleTransitionRun)

      const sample = (now) => {
        sawStartingStyle ||= target.hasAttribute('data-starting-style')

        if (!target.hasAttribute('hidden')) {
          const rect = target.getBoundingClientRect()
          frames.push({ left: rect.left, width: rect.width })
        }

        if (now - startedAt < 520) {
          requestAnimationFrame(sample)
          return
        }

        target.removeEventListener('transitionrun', handleTransitionRun)
        resolve({ frames, sawStartingStyle, transitionProperties })
      }

      requestAnimationFrame(sample)
    })
  })

  await page.locator('#newtab-settings-trigger').click({ force: true })
  const probe = await probePromise
  const finalFrame = probe.frames.at(-1)
  const backdropBackground = await page.locator('#newtab-settings-backdrop').evaluate(
    (element) => getComputedStyle(element).backgroundColor
  )

  assert.ok(probe.sawStartingStyle, 'Base UI should expose the drawer opening frame')
  assert.equal(
    backdropBackground,
    'rgba(0, 0, 0, 0)',
    'Opening settings should keep the new tab background visually unobscured'
  )
  assert.ok(
    probe.transitionProperties.some((property) => property === 'transform' || property === 'translate'),
    'Opening from a fully hidden state should start a horizontal transition'
  )
  assert.ok(finalFrame && finalFrame.width > 0, 'The open drawer should have measurable geometry')

  const finalLeft = finalFrame.left
  assert.ok(
    probe.frames.some((frame) => frame.left > finalLeft + 8),
    'Opening should include at least one offscreen or intermediate horizontal frame'
  )
  assert.ok(
    Math.abs(finalLeft + finalFrame.width - 1280) <= 2,
    'The drawer should finish flush with the right edge of the viewport'
  )
}

let context

try {
  context = await chromium.launchPersistentContext(profilePath, {
    headless: false,
    reducedMotion: 'no-preference',
    viewport: { width: 1280, height: 720 },
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`
    ]
  })

  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker', { timeout: 15_000 })
  const extensionId = new URL(worker.url()).host
  const page = await context.newPage()

  await page.goto(`chrome-extension://${extensionId}/src/newtab/newtab.html`, {
    waitUntil: 'domcontentloaded'
  })
  await page.locator('#newtab-settings-trigger').waitFor({ state: 'attached' })
  await page.waitForTimeout(300)

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await probeOpening(page)
    await page.keyboard.press('Escape')
    await page.waitForFunction(() => document.querySelector('.settings-drawer-panel')?.hasAttribute('hidden'))
  }

  console.log('Newtab settings drawer motion test passed.')
} finally {
  await context?.close()
  await rm(profilePath, { recursive: true, force: true })
}
