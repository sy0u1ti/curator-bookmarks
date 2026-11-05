import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { verifySearchReturnContour } from './newtab-search-return-scenarios.mjs'

export function readGlassSurfaceInventory() {
  const selectors = [
    '.newtab-search-surface', '.newtab-clock', '.bookmark-tile', '.newtab-speed-dial',
    '.newtab-speed-dial-card', '.settings-trigger', '.folder-section-header',
    '.newtab-search-engine-menu', '.bookmark-menu-surface', '.settings-drawer-panel',
    '[data-drawer-content]', '.custom-select-list', '.newtab-glass-preview'
  ]
  const visible = element => element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })
  const surfaces = selectors.flatMap(selector => [...document.querySelectorAll(selector)].filter(visible).map(element => {
    const css = getComputedStyle(element)
    const bounds = element.getBoundingClientRect()
    return {
      selector, renderer: element.dataset.glassRenderer, tone: element.dataset.glassTone,
      background: css.backgroundColor, filter: css.backdropFilter, radius: css.borderRadius,
      curve: css.cornerShape, clip: css.clipPath, mask: css.maskImage,
      sheen: css.backgroundImage, backgroundOrigin: css.backgroundOrigin,
      width: bounds.width, height: bounds.height,
      decorations: [...element.children].filter(child => child.matches('.glass-surface__rim,.glass-surface__sheen')).map(child => ({
        position: getComputedStyle(child).position, pointerEvents: getComputedStyle(child).pointerEvents,
        hidden: child.getAttribute('aria-hidden')
      }))
    }
  }))
  const unmatched = [...document.querySelectorAll('body *')].filter(element => {
    if (!(element instanceof HTMLElement) || !visible(element) || element.matches('.newtab-glass')) return false
    if (element.closest('#newtab-background-mask, #newtab-wallpaper-stage, .newtab-dynamic-background-stage') ||
      element.matches('.settings-backdrop,.featured-wallpaper-backdrop,.t-modal-backdrop')) return false
    return getComputedStyle(element).backdropFilter !== 'none'
  }).map(element => ({ tag: element.tagName, className: element.className }))
  return {
    surfaces, unmatched,
    legacy: document.querySelectorAll('[data-hyalite-surface], .glass-surface__filter, .glass-surface__canvas').length,
    focus: { className: document.activeElement?.className, tag: document.activeElement?.tagName },
    errors: window.__glassFixture?.errors || [],
    workers: window.__glassFixture?.workers || []
  }
}

export async function runGlassSurfaceChecks(page, origin, directory) {
  const checks = []
  const url = `${origin}/src/newtab/newtab.html`
  const ready = () => page.waitForFunction(() =>
    document.querySelector('.bookmark-tile') && document.querySelector('.newtab-clock') &&
    !document.getElementById('newtab-bookmark-preboot'), undefined, { timeout: 12000 })
  const inspect = async label => {
    const inventory = await page.evaluate(readGlassSurfaceInventory)
    for (const surface of inventory.surfaces) {
      assert.equal(surface.renderer, 'react-bits', `${label}: ${surface.selector} uses GlassSurface`)
      assert.equal(surface.decorations.length, 0, `${label}: ${surface.selector} has no independently clipped decoration`)
      assert.match(surface.curve, /^(?:round|superellipse\(1\))?$/, `${label}: ${surface.selector} shares the native arc`)
      assert.equal(surface.clip, 'none', `${label}: ${surface.selector} must not clip its border or focus ring`)
      assert.equal(surface.mask, 'none', `${label}: ${surface.selector} needs no composited contour mask`)
      assert.equal(surface.backgroundOrigin, 'border-box', `${label}: the sheen uses the same bounds as the border`)
      assert.match(surface.sheen, /linear-gradient/, `${label}: the host paints its own material`)
      assert.ok(surface.width > 0 && surface.height > 0)
      if (surface.tone === 'panel') {
        assert.ok(surface.background === 'rgb(22, 24, 29)' ||
          Number(surface.background.match(/,\s*([\d.]+)\)$/)?.[1]) >= 0.85,
        `${label}: ${surface.selector} must keep panel text readable`)
        if (!surface.selector.includes('drawer-content') && !surface.selector.includes('custom-select')) {
          assert.match(surface.filter, /blur\(16px\)/, `${label}: the panel owns its material`)
        }
      }
    }
    assert.equal(inventory.legacy, 0, `${label}: no retired or negotiated renderer`)
    assert.deepEqual(inventory.unmatched, [], `${label}: all visible glass belongs to the component`)
    assert.deepEqual(inventory.errors, [], `${label}: no runtime errors`)
    assert.deepEqual(inventory.workers, [], `${label}: Frosted needs no Workers`)
    checks.push({ label, ...inventory })
  }
  try {
    for (const width of [1440, 768, 390]) {
      await page.cdp('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false })
      await page.goto(url)
      await ready()
      await inspect(`${width}-initial`)
      for (let index = 0; index < 2; index++) {
        await page.reload()
        await ready()
        await page.waitForFunction(() => window.__glassFixture?.sampled)
        const frames = await page.evaluate(() => window.__glassFixture.frames)
        assert.ok(frames.length > 0)
        assert.equal(new Set(frames.map(frame => JSON.stringify(frame))).size, 1, `${width}: refresh never changes material after first paint`)
        await inspect(`${width}-reload-${index}`)
      }
      await page.screenshot({ path: `${directory}/newtab-${width}.png` })
      checks.push({ label: `${width}-search-return`, frames: await verifySearchReturnContour(page, directory, `${width}`) })
    }
    await page.cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
    await page.goto(url + '?worker-error=1')
    await ready()
    await inspect('workers-unavailable')
    const field = await page.evaluate(() => {
      const { width, height } = document.querySelector('.newtab-search').getBoundingClientRect()
      return { width, height }
    })
    await page.fill('.newtab-search-input', '文档')
    await page.waitForSelector('.newtab-search-suggestion')
    const typed = await page.evaluate(() => {
      const { width, height } = document.querySelector('.newtab-search').getBoundingClientRect()
      return { width, height }
    })
    assert.deepEqual(typed, field, 'Input preserves the action row')
    await page.press('.newtab-search-input', 'Tab')
    assert.ok(await page.evaluate(() => document.activeElement?.classList.contains('newtab-search-clear')))
    await page.fill('.newtab-search-input', '')
    await page.click('.newtab-search-engine')
    await page.waitForFunction(() => document.querySelector('.newtab-search-engine')?.getAttribute('aria-expanded') === 'true')
    await inspect('engine-menu')
    await page.waitForFunction(() => document.querySelector('.newtab-search-engine-menu')?.contains(document.activeElement))
    await page.evaluate(async () => {
      await Promise.all(document.querySelector('.newtab-search-engine-menu').getAnimations({ subtree: true })
        .filter(animation => animation.effect?.getTiming().iterations !== Infinity)
        .map(animation => animation.finished.catch(() => {})))
    })
    await page.keyboard.press('Escape')
    await page.waitForFunction(() => document.querySelector('.newtab-search-engine')?.getAttribute('aria-expanded') !== 'true')

    await page.hover('a.bookmark-tile[data-bookmark-id="101"]')
    await page.click('a.bookmark-tile[data-bookmark-id="101"] [data-bookmark-menu-trigger]')
    await page.waitForSelector('.bookmark-edit-menu')
    await inspect('bookmark-menu')
    assert.equal(await page.evaluate(() => document.querySelectorAll('.bookmark-edit-menu .newtab-glass').length), 0, 'Inline menu content shares its outer material')
    await page.waitForFunction(() => document.querySelector('.bookmark-edit-menu')?.contains(document.activeElement))
    await page.keyboard.press('Escape')

    await page.click('#newtab-settings-trigger')
    await page.waitForSelector('#newtab-settings-drawer .settings-drawer-panel')
    await page.click("loc=role:tab[name='外观']")
    await page.click('#background-type-control')
    await page.waitForSelector('.base-select-popup[data-drawer-content]')
    await inspect('settings-select')
    await page.evaluate(async () => {
      await Promise.all(document.querySelector('.base-select-popup[data-drawer-content]').getAnimations({ subtree: true })
        .filter(animation => animation.effect?.getTiming().iterations !== Infinity)
        .map(animation => animation.finished.catch(() => {})))
    })
    await page.keyboard.press('Escape')
    await page.waitForFunction(() => !document.querySelector('.base-select-popup[data-drawer-content]')?.checkVisibility())
    await page.click("loc=role:tab[name='玻璃']")
    await page.click("loc=role:button[name='精细调整玻璃材质']")
    await page.waitForSelector('.newtab-glass-preview')
    await inspect('glass-settings')
    const top = await page.evaluate(() => document.querySelector('.settings-drawer-panel').getBoundingClientRect().top)
    await page.press("loc=role:slider[name='背景饱和度']", 'ArrowLeft')
    await page.waitForFunction(() => window.__glassFixture.data.curatorBookmarkNewTabGlassSettings?.saturation === 139)
    await page.evaluate(() => { window.__glassFixture.failGlassSaves = true })
    await page.press("loc=role:slider[name='背景饱和度']", 'ArrowLeft')
    await page.waitForFunction(() => document.body.textContent.includes('设置保存失败'))
    assert.equal(await page.evaluate(() => document.querySelector('.settings-drawer-panel').getBoundingClientRect().top), top)
    await page.evaluate(() => { window.__glassFixture.failGlassSaves = false })
    await page.press("loc=role:slider[name='背景饱和度']", 'ArrowRight')
    await page.waitForFunction(() => !document.body.textContent.includes('设置保存失败'))
    await page.press("loc=role:slider[name='边缘高光']", 'Home')
    await page.waitForFunction(() => window.__glassFixture.data.curatorBookmarkNewTabGlassSettings?.highlight === 0)
    assert.ok(await page.evaluate(() => {
      const css = getComputedStyle(document.querySelector('.newtab-glass-preview'))
      return css.getPropertyValue('--glass-highlight').trim() === '0' &&
        !css.backgroundImage.includes('rgb(') &&
        [...css.backgroundImage.matchAll(/rgba\([^)]+,\s*([.\d]+)\)/g)].every(([, alpha]) => Number(alpha) === 0)
    }), 'Zero highlight must remove the sheen without changing the contour')
    await page.press("loc=role:slider[name='边缘高光']", 'End')
    await page.waitForFunction(() => window.__glassFixture.data.curatorBookmarkNewTabGlassSettings?.highlight === 150)
    await page.click("loc=role:button[name='柔和']")
    await page.waitForFunction(() => window.__glassFixture.data.curatorBookmarkNewTabGlassSettings?.tint === 24)
    await page.screenshot({ path: `${directory}/settings-glass.png` })
    await page.keyboard.press('Escape')
    await page.reload()
    await ready()
    assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.newtab-search-surface')).backgroundColor), 'rgba(0, 0, 0, 0.24)')
    await inspect('preferences-after-refresh')

    for (const deviceScaleFactor of [1.25, 1.5, 2]) {
      await page.cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor, mobile: false })
      await inspect(`dpi-${deviceScaleFactor}`)
      checks.push({ label: `dpi-${deviceScaleFactor}-search-return`,
        frames: await verifySearchReturnContour(page, directory, `dpi-${deviceScaleFactor}`) })
    }
    await page.cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
    await inspect('reduced-motion')
    await page.cdp('Emulation.setEmulatedMedia', { features: [{ name: 'forced-colors', value: 'active' }] })
    assert.ok(await page.evaluate(() => [...document.querySelectorAll('.newtab-glass')].every(element => getComputedStyle(element).backdropFilter === 'none')))
    await page.cdp('Emulation.setEmulatedMedia', { features: [] })
    await writeFile(`${directory}/report.json`, JSON.stringify({ passed: true, checks }, null, 2))
    return { passed: true, checks: checks.length, directory }
  } catch (error) {
    await writeFile(`${directory}/report.json`, JSON.stringify({ passed: false, error: error.message, checks, current: await page.evaluate(readGlassSurfaceInventory) }, null, 2))
    await page.screenshot({ path: `${directory}/failure.png` })
    throw error
  }
}
