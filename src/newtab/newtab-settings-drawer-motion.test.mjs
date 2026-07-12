import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { chromium } from 'playwright'

const extensionPath = path.resolve('dist')
const profilePath = await mkdtemp(path.join(tmpdir(), 'curator-interface-quality-'))
const visualCaptureDir = process.env.CURATOR_VISUAL_CAPTURE_DIR
  ? path.resolve(process.env.CURATOR_VISUAL_CAPTURE_DIR)
  : ''
const performanceRecords = []

async function captureVisual(page, name, options = {}) {
  if (!visualCaptureDir) {
    return
  }
  await mkdir(visualCaptureDir, { recursive: true })
  await page.screenshot({
    animations: 'disabled',
    caret: 'hide',
    path: path.join(visualCaptureDir, `${name}.png`),
    ...options
  })
}

async function captureNewtabWallpaperVariants(page) {
  if (!visualCaptureDir) {
    return
  }
  await captureVisual(page, 'newtab-dark')
  for (const [name, background] of [
    ['newtab-bright', 'linear-gradient(135deg,#f8f3d6 0%,#d6ecff 48%,#f3cfdb 100%)'],
    ['newtab-detailed', 'repeating-linear-gradient(32deg,rgba(255,255,255,.18) 0 2px,transparent 2px 14px),radial-gradient(circle at 18% 22%,#f6c76f 0 12%,transparent 34%),radial-gradient(circle at 78% 28%,#60a5d8 0 14%,transparent 38%),linear-gradient(145deg,#26405d,#6e3755 55%,#152c2f)']
  ]) {
    await page.evaluate((value) => {
      const app = document.querySelector('.newtab-app')
      document.querySelector('#interface-quality-wallpaper-probe')?.remove()
      const probe = document.createElement('div')
      probe.id = 'interface-quality-wallpaper-probe'
      Object.assign(probe.style, {
        background: value,
        inset: '0',
        pointerEvents: 'none',
        position: 'fixed',
        zIndex: '0'
      })
      app?.append(probe)
      app?.setAttribute('data-background-media', 'true')
    }, background)
    await waitForFrames(page)
    await captureVisual(page, name)
  }
  await page.evaluate(() => {
    document.querySelector('#interface-quality-wallpaper-probe')?.remove()
    document.querySelector('.newtab-app')?.removeAttribute('data-background-media')
  })
}

async function verifyNewtabAccessibilityMaterials(page, context) {
  const client = await context.newCDPSession(page)
  await client.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }]
  })
  await page.waitForFunction(() => matchMedia('(prefers-reduced-transparency: reduce)').matches)
  const reducedTransparency = await page.locator('.newtab-speed-dial').evaluate((element) => {
    const style = getComputedStyle(element)
    return {
      backdropFilter: style.backdropFilter,
      backgroundColor: style.backgroundColor,
      webkitBackdropFilter: style.webkitBackdropFilter
    }
  })
  assert.ok(
    reducedTransparency.backdropFilter === 'none' &&
      (!reducedTransparency.webkitBackdropFilter || reducedTransparency.webkitBackdropFilter === 'none'),
    `Reduced transparency should remove glass blur: ${JSON.stringify(reducedTransparency)}`
  )
  assert.match(reducedTransparency.backgroundColor, /^rgb\(/, 'Reduced transparency should use an opaque neutral surface')
  await captureVisual(page, 'newtab-reduced-transparency')

  await client.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-contrast', value: 'more' }]
  })
  await page.waitForFunction(() => matchMedia('(prefers-contrast: more)').matches)
  const increasedContrast = await page.locator('.source-navigation-label').evaluate((element) => {
    const style = getComputedStyle(element)
    return { borderColor: style.borderColor, color: style.color }
  })
  assert.equal(increasedContrast.borderColor, 'rgba(255, 255, 255, 0.72)', 'Increased contrast should strengthen wallpaper dividers')
  assert.equal(increasedContrast.color, 'rgba(245, 245, 247, 0.88)', 'Increased contrast should preserve readable primary navigation text')
  await captureVisual(page, 'newtab-high-contrast')

  await client.send('Emulation.setEmulatedMedia', {
    features: [
      { name: 'prefers-reduced-transparency', value: 'no-preference' },
      { name: 'prefers-contrast', value: 'no-preference' }
    ]
  })
  await page.waitForFunction(() => !matchMedia('(prefers-reduced-transparency: reduce)').matches && !matchMedia('(prefers-contrast: more)').matches)
  await client.detach()
}

async function waitForFrames(page, count = 2) {
  await page.evaluate((frameCount) => new Promise((resolve) => {
    let remaining = frameCount
    const tick = () => {
      remaining -= 1
      if (remaining <= 0) {
        resolve()
        return
      }
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }), count)
}

async function recordAnimationFrames(page, label, durationMs, action) {
  const frameProbe = page.evaluate((duration) => new Promise((resolve) => {
    const startedAt = performance.now()
    let previous = startedAt
    const gaps = []
    const sample = (now) => {
      gaps.push(now - previous)
      previous = now
      if (now - startedAt < duration) {
        requestAnimationFrame(sample)
        return
      }
      const sorted = gaps.slice().sort((left, right) => left - right)
      resolve({
        duration: now - startedAt,
        frames: gaps.length,
        maxGap: Math.max(...gaps),
        p95Gap: sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))]
      })
    }
    requestAnimationFrame(sample)
  }), durationMs)
  const actionResult = await action()
  const frames = await frameProbe
  performanceRecords.push({ label, ...frames })
  assert.ok(
    frames.frames >= 1 && Number.isFinite(frames.maxGap) && Number.isFinite(frames.p95Gap),
    `${label} should produce a valid frame recording: ${JSON.stringify(frames)}`
  )
  return { actionResult, frames }
}

async function seedExtension(worker) {
  return worker.evaluate(async () => {
    const tree = await chrome.bookmarks.getTree()
    const root = tree[0]
    const bookmarksBar = root.children?.find((node) => node.id === '1') || root.children?.[0]
    if (!bookmarksBar?.id) {
      throw new Error('Bookmarks bar is unavailable')
    }

    const stamp = Date.now()
    const folders = []
    const bookmarks = []
    for (let folderIndex = 0; folderIndex < 3; folderIndex += 1) {
      const folder = await chrome.bookmarks.create({
        parentId: bookmarksBar.id,
        title: `Curator Smoke Folder ${folderIndex + 1} ${stamp}`
      })
      folders.push(folder)
      for (let bookmarkIndex = 0; bookmarkIndex < 12; bookmarkIndex += 1) {
        const label = bookmarkIndex === 0
          ? ['Alpha', 'Beta', 'Gamma'][folderIndex]
          : `Item ${folderIndex + 1}-${bookmarkIndex + 1}`
        bookmarks.push(await chrome.bookmarks.create({
          parentId: folder.id,
          title: `Curator Smoke ${label}`,
          url: `https://example.com/curator-smoke/${folderIndex + 1}/${bookmarkIndex + 1}`
        }))
      }
    }

    const now = Date.now()
    await chrome.storage.local.set({
      curatorBookmarkAiNamingSettings: {
        apiKey: 'curator-smoke-key',
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-5',
        reasoningEffort: 'medium'
      },
      curatorBookmarkNewTabFolderSettings: {
        selectedFolderIds: folders.map((folder) => folder.id),
        hideFolderNames: false
      },
      curatorBookmarkNewTabWorkspaceSettings: {
        activeWorkspaceId: 'default',
        workspaces: [{
          id: 'default',
          name: 'Speed Dial',
          pinnedIds: bookmarks.slice(0, 4).map((bookmark) => bookmark.id),
          createdAt: now,
          updatedAt: now
        }]
      }
    })

    return {
      bookmarkIds: bookmarks.map((bookmark) => bookmark.id),
      folderIds: folders.map((folder) => folder.id),
      folderTitles: folders.map((folder) => folder.title)
    }
  })
}

async function waitForDrawerClosed(page) {
  await page.waitForFunction(() => document.querySelector('.settings-drawer-panel')?.hasAttribute('hidden'))
}

async function openDrawer(page) {
  await page.locator('#newtab-settings-trigger').evaluate((element) => element.click())
  await page.waitForFunction(() => !document.querySelector('.settings-drawer-panel')?.hasAttribute('hidden'))
}

async function waitForDrawerSettledOpen(page) {
  await page.waitForFunction(() => {
    const panel = document.querySelector('.settings-drawer-panel')
    if (!panel || panel.hasAttribute('hidden')) return false
    const rect = panel.getBoundingClientRect()
    return Math.abs(rect.right - innerWidth) <= 2 && Number.parseFloat(getComputedStyle(panel).opacity) >= 0.99
  })
}

async function closeDrawer(page, method = 'escape', expectFocusReturn = true) {
  if (method === 'button') {
    await page.locator('#newtab-settings-close').click()
  } else {
    await page.keyboard.press('Escape')
  }
  await waitForDrawerClosed(page)
  if (expectFocusReturn) {
    await page.waitForFunction(() => document.activeElement?.id === 'newtab-settings-trigger')
  }
}

async function verifyDrawerCloseDuringEntrance(page) {
  await waitForDrawerClosed(page)
  await openDrawer(page)
  await page.waitForTimeout(45)

  const beforeClose = await page.locator('.settings-drawer-panel').evaluate((element) => {
    const rect = element.getBoundingClientRect()
    return {
      left: rect.left,
      openLeft: innerWidth - rect.width,
      viewportWidth: innerWidth
    }
  })
  assert.ok(
    beforeClose.left > beforeClose.openLeft + 8 && beforeClose.left < beforeClose.viewportWidth - 2,
    `Close-during-entrance probe must catch an intermediate frame: ${JSON.stringify(beforeClose)}`
  )

  await page.evaluate(() => {
    const panel = document.querySelector('.settings-drawer-panel')
    const probe = {
      done: false,
      endingLeft: null,
      frames: [],
      hidden: false,
      sawEndingStyle: false
    }
    window.__curatorDrawerEntranceCloseProbe = probe
    const startedAt = performance.now()
    const observer = new MutationObserver(() => {
      if (panel?.hasAttribute('data-ending-style')) {
        probe.sawEndingStyle = true
        probe.endingLeft ??= panel.getBoundingClientRect().left
      }
    })
    observer.observe(panel, { attributes: true, attributeFilter: ['data-ending-style', 'hidden'] })
    const sample = (now) => {
      if (probe.sawEndingStyle && panel && !panel.hasAttribute('hidden')) {
        probe.frames.push(panel.getBoundingClientRect().left)
      }
      if (panel?.hasAttribute('hidden') || now - startedAt > 720) {
        probe.hidden = panel?.hasAttribute('hidden') || false
        probe.done = true
        observer.disconnect()
        return
      }
      requestAnimationFrame(sample)
    }
    requestAnimationFrame(sample)
  })

  await page.keyboard.press('Escape')
  await page.waitForFunction(() => window.__curatorDrawerEntranceCloseProbe?.done)
  const result = await page.evaluate(() => {
    const probe = window.__curatorDrawerEntranceCloseProbe
    delete window.__curatorDrawerEntranceCloseProbe
    return probe
  })
  assert.ok(result.sawEndingStyle, 'Closing during entrance should enter the Base UI ending state')
  assert.ok(result.hidden, 'Closing during entrance should finish hidden')
  assert.ok(result.frames.length >= 2, 'Closing during entrance should preserve visible exit frames')
  assert.ok(
    result.endingLeft > beforeClose.openLeft + 8 &&
      result.endingLeft < beforeClose.viewportWidth - 8 &&
      result.endingLeft <= beforeClose.left + 12,
    `Interrupted entrance should reverse from its current visual position: ${JSON.stringify({ beforeClose, result })}`
  )
  assert.ok(
    result.frames.some((left) => left > result.endingLeft + 8),
    'Closing during entrance should continue moving toward the right edge'
  )
  await page.waitForFunction(() => document.activeElement?.id === 'newtab-settings-trigger')
}

async function probeDrawerOpening(page) {
  const panel = page.locator('.settings-drawer-panel')
  await panel.waitFor({ state: 'attached' })
  await waitForDrawerClosed(page)

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
      const handleTransitionRun = (event) => transitionProperties.push(event.propertyName)
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

  await page.locator('#newtab-settings-trigger').evaluate((element) => element.click())
  const probe = await probePromise
  const finalFrame = probe.frames.at(-1)
  await page.waitForTimeout(420)
  const settledFrame = await panel.evaluate((element) => {
    const rect = element.getBoundingClientRect()
    const style = getComputedStyle(element)
    return {
      left: rect.left,
      transform: style.transform,
      swipe: style.getPropertyValue('--drawer-swipe-movement-x'),
      width: rect.width
    }
  })
  const viewport = page.viewportSize()
  const backdropBackground = await page.locator('#newtab-settings-backdrop').evaluate(
    (element) => getComputedStyle(element).backgroundColor
  )

  assert.ok(probe.sawStartingStyle, 'Base UI should expose the drawer opening frame')
  assert.equal(backdropBackground, 'rgba(0, 0, 0, 0)', 'The drawer backdrop must stay visually transparent')
  assert.ok(
    probe.transitionProperties.some((property) => property === 'transform' || property === 'translate'),
    'Opening from hidden should start a horizontal transition'
  )
  assert.ok(finalFrame && finalFrame.width > 0, 'The open drawer should have measurable geometry')
  assert.ok(
    probe.frames.some((frame) => frame.left > finalFrame.left + 8),
    'Opening should include an intermediate horizontal frame'
  )
  assert.ok(
    viewport && Math.abs(settledFrame.left + settledFrame.width - viewport.width) <= 2,
    `The drawer should finish flush with the right edge (left=${settledFrame.left}, width=${settledFrame.width}, viewport=${viewport?.width}, transform=${settledFrame.transform}, swipe=${settledFrame.swipe})`
  )
}

async function verifyDesktopDrawer(page) {
  await page.setViewportSize({ width: 1280, height: 720 })
  await waitForDrawerClosed(page)

  for (let attempt = 0; attempt < 5; attempt += 1) {
    await probeDrawerOpening(page)
    await closeDrawer(page, attempt % 2 === 0 ? 'escape' : 'button')
  }

  await verifyDrawerCloseDuringEntrance(page)

  await openDrawer(page)
  const desktopState = await page.evaluate(() => ({
    backdropPointerEvents: getComputedStyle(document.querySelector('#newtab-settings-backdrop')).pointerEvents,
    rootInert: document.querySelector('#newtab-root').inert
  }))
  assert.equal(desktopState.backdropPointerEvents, 'none', 'Desktop drawer must not install a pointer-catching backdrop')
  assert.equal(desktopState.rootInert, false, 'Desktop content must remain interactive while settings are open')
  await waitForDrawerSettledOpen(page)
  await captureVisual(page, 'settings-drawer-desktop')

  const backgroundSearch = page.locator('.newtab-search-input')
  await backgroundSearch.click({ position: { x: 20, y: 18 } })
  assert.equal(await backgroundSearch.evaluate((element) => document.activeElement === element), true, 'A desktop background control should remain interactive')

  const outsideFocus = await page.evaluate(async () => {
    const trigger = document.querySelector('#newtab-dashboard-trigger')
    trigger?.focus()
    await new Promise((resolve) => setTimeout(resolve, 40))
    return {
      activeId: document.activeElement?.id,
      insidePanel: Boolean(document.activeElement?.closest('.settings-drawer-panel'))
    }
  })
  assert.equal(outsideFocus.activeId, 'newtab-dashboard-trigger', 'Desktop drawer must allow focus outside the inspector')
  assert.equal(outsideFocus.insidePanel, false, 'Desktop drawer must not trap focus')
  await closeDrawer(page, 'escape', false)
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'newtab-dashboard-trigger', 'Closing a non-modal inspector should preserve deliberate outside focus')

  await openDrawer(page)
  await waitForDrawerSettledOpen(page)
  const interruptionProbe = page.evaluate(() => new Promise((resolve) => {
    const panel = document.querySelector('.settings-drawer-panel')
    const trigger = document.querySelector('#newtab-settings-trigger')
    let sawHidden = false
    const events = []
    const observer = new MutationObserver(() => {
      sawHidden ||= panel?.hasAttribute('hidden') || false
      events.push({
        expanded: trigger?.getAttribute('aria-expanded'),
        hidden: panel?.hasAttribute('hidden') || false,
        time: performance.now()
      })
    })
    observer.observe(panel, { attributes: true, attributeFilter: ['hidden', 'data-ending-style', 'data-starting-style'] })
    observer.observe(trigger, { attributes: true, attributeFilter: ['aria-expanded'] })
    setTimeout(() => {
      observer.disconnect()
      resolve({
        events,
        expanded: trigger?.getAttribute('aria-expanded'),
        sawHidden,
        open: !panel?.hasAttribute('hidden')
      })
    }, 720)
  }))
  await page.keyboard.press('Escape')
  await page.waitForTimeout(45)
  await page.locator('#newtab-settings-trigger').evaluate((element) => element.click())
  const interruption = await interruptionProbe
  assert.equal(interruption.sawHidden, false, `Reopening during exit must reverse without hiding the drawer: ${JSON.stringify(interruption)}`)
  assert.equal(interruption.open, true, 'Interrupted close should finish open')

  await page.getByRole('tab', { name: '外观' }).click()
  const { actionResult: scrollProbe } = await recordAnimationFrames(
    page,
    'settings drawer sustained scrolling',
    1_000,
    () => page.evaluate(async () => {
      const host = document.querySelector('.settings-drawer-scroll')
      const root = document.querySelector('.settings-drawer-scrollbar')
      const track = document.querySelector('.settings-drawer-scrollbar-track')
      const thumb = document.querySelector('.settings-drawer-scrollbar-thumb')
      if (!(host instanceof HTMLElement) || !(root instanceof HTMLElement) || !(track instanceof HTMLElement) || !(thumb instanceof HTMLElement)) {
        throw new Error('Settings scrollbar is unavailable')
      }
      const maxScroll = host.scrollHeight - host.clientHeight
      let maxError = 0
      for (let index = 1; index <= 24; index += 1) {
        host.scrollTop = maxScroll * index / 24
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
        const trackHeight = Math.max(track.clientHeight, 1)
        const thumbHeight = Math.min(100, Math.max((40 / trackHeight) * 100, (host.clientHeight / host.scrollHeight) * 100))
        const expected = (host.scrollTop / Math.max(maxScroll, 1)) * (100 - thumbHeight)
        const trackRect = track.getBoundingClientRect()
        const thumbRect = thumb.getBoundingClientRect()
        const actual = ((thumbRect.top - trackRect.top) / Math.max(trackRect.height, 1)) * 100
        maxError = Math.max(maxError, Math.abs(actual - expected))
      }
      return { maxError, maxScroll, visible: root.dataset.visible }
    })
  )
  assert.ok(scrollProbe.maxScroll > 100, 'Settings content should provide a sustained scrolling surface')
  assert.ok(scrollProbe.maxError < 1.5, `Custom scrollbar thumb lagged by ${scrollProbe.maxError.toFixed(2)} percentage points`)
  assert.equal(scrollProbe.visible, 'true', 'Custom scrollbar should stay visible while content can scroll')
  await closeDrawer(page, 'button')
}

async function verifyNarrowAndReducedMotionDrawer(page) {
  await page.setViewportSize({ width: 390, height: 720 })
  await page.waitForFunction(() => matchMedia('(max-width: 600px)').matches)
  await openDrawer(page)
  await page.waitForFunction(() => {
    const panel = document.querySelector('.settings-drawer-panel')
    if (!panel) return false
    const rect = panel.getBoundingClientRect()
    return Math.abs(rect.left) <= 2 && Math.abs(rect.width - innerWidth) <= 2
  })
  const narrowState = await page.evaluate(() => {
    const panel = document.querySelector('.settings-drawer-panel')
    const rect = panel.getBoundingClientRect()
    const backdrop = document.querySelector('#newtab-settings-backdrop')
    return {
      backdropPointerEvents: getComputedStyle(backdrop).pointerEvents,
      backdropTabIndex: backdrop.tabIndex,
      left: rect.left,
      rootInert: document.querySelector('#newtab-root').inert,
      width: rect.width
    }
  })
  assert.ok(Math.abs(narrowState.left) <= 2 && Math.abs(narrowState.width - 390) <= 2, 'Narrow settings must fill the viewport')
  assert.equal(narrowState.rootInert, true, 'Narrow settings must make the background inert')
  assert.equal(narrowState.backdropPointerEvents, 'none', 'Full-screen narrow settings do not need a pointer backdrop')
  assert.equal(narrowState.backdropTabIndex, -1, 'The decorative backdrop must not join the focus order')
  if (visualCaptureDir) {
    await page.locator('.settings-drawer-scroll').evaluate((element) => { element.scrollTop = 0 })
    await waitForFrames(page)
  }
  await captureVisual(page, 'settings-drawer-narrow')

  await page.evaluate(() => {
    const panel = document.querySelector('.settings-drawer-panel')
    const focusables = [...panel.querySelectorAll('button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])')]
      .filter((element) => element instanceof HTMLElement && element.offsetParent !== null)
    focusables.at(-1)?.focus()
  })
  await page.keyboard.press('Tab')
  assert.equal(
    await page.evaluate(() => Boolean(document.activeElement?.closest('.settings-drawer-panel'))),
    true,
    'Narrow settings must trap keyboard focus inside the full-screen surface'
  )
  await closeDrawer(page, 'button')

  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1280, height: 720 })
  await openDrawer(page)
  const reducedMotion = await page.locator('.settings-drawer-panel').evaluate((element) => {
    const style = getComputedStyle(element)
    return {
      duration: style.transitionDuration,
      property: style.transitionProperty,
      transform: style.transform
    }
  })
  assert.ok(!reducedMotion.property.includes('transform'), 'Reduced motion must remove the drawer translation transition')
  assert.ok(reducedMotion.duration.split(',').every((value) => Number.parseFloat(value) <= 0.1), 'Reduced motion feedback must stay at or below 100ms')
  assert.equal(reducedMotion.transform, 'none', 'Reduced motion must remove the drawer transform')
  await closeDrawer(page)
  await page.emulateMedia({ reducedMotion: 'no-preference' })
}

async function verifyDashboardOverlay(page) {
  await page.setViewportSize({ width: 1280, height: 720 })
  const trigger = page.locator('#newtab-dashboard-trigger')
  await trigger.click()
  const panel = page.locator('#newtab-dashboard-overlay .curator-overlay-panel')
  await page.waitForFunction(() => !document.querySelector('#newtab-dashboard-overlay .curator-overlay-panel')?.hasAttribute('hidden'))
  await page.waitForFunction(() => {
    const overlay = document.querySelector('#newtab-dashboard-overlay')
    return overlay?.getAttribute('data-dashboard-ready') === 'true' || overlay?.getAttribute('data-dashboard-error') === 'true'
  }, { timeout: 30_000 })
  assert.equal(await page.locator('#newtab-dashboard-overlay').getAttribute('data-dashboard-error'), 'false', 'Dashboard overlay should load its embedded dashboard')
  assert.ok(await panel.isVisible(), 'Dashboard overlay panel should be visible')
  await captureVisual(page, 'dashboard-overlay')
  await page.frameLocator('#newtab-dashboard-frame').locator('#dashboard-query').focus()
  await page.keyboard.press('Escape')
  await page.waitForFunction(() => document.querySelector('#newtab-dashboard-overlay .curator-overlay-panel')?.hasAttribute('hidden'))
  await page.waitForFunction(() => document.activeElement?.id === 'newtab-dashboard-trigger')
}

async function probePopoverOpening(page, triggerSelector, popupSelector) {
  await page.waitForFunction((selector) => {
    const popup = document.querySelector(selector)
    return !popup || popup.hasAttribute('data-closed')
  }, popupSelector)
  const probePromise = page.evaluate((selector) => {
    return new Promise((resolve) => {
      let sawStartingStyle = false
      const startedAt = performance.now()
      const sample = (now) => {
        const popup = document.querySelector(selector)
        sawStartingStyle ||= popup?.hasAttribute('data-starting-style') || false
        if (now - startedAt < 260) {
          requestAnimationFrame(sample)
          return
        }
        const style = getComputedStyle(popup)
        const origin = style.transformOrigin.split(' ').map(Number.parseFloat)
        resolve({
          hidden: popup?.hasAttribute('data-closed'),
          origin,
          sawStartingStyle,
          side: popup?.getAttribute('data-side')
        })
      }
      requestAnimationFrame(sample)
    })
  }, popupSelector)
  await page.locator(triggerSelector).click()
  return probePromise
}

async function verifyResolvedOverlayDirections(page) {
  const directions = await page.evaluate(() => {
    const sides = ['top', 'bottom', 'left', 'right']
    return sides.map((side) => {
      const popup = document.createElement('div')
      popup.className = 'curator-overlay-panel curator-overlay-panel--popover'
      popup.dataset.side = side
      popup.setAttribute('data-starting-style', '')
      Object.assign(popup.style, {
        height: '20px',
        left: '-1000px',
        position: 'fixed',
        top: '-1000px',
        width: '40px'
      })
      document.body.append(popup)
      const style = getComputedStyle(popup)
      const matrix = new DOMMatrixReadOnly(style.transform)
      const origin = style.transformOrigin.split(' ').map(Number.parseFloat)
      popup.remove()
      return { side, x: matrix.e, y: matrix.f, originX: origin[0], originY: origin[1] }
    })
  })
  const bySide = Object.fromEntries(directions.map((entry) => [entry.side, entry]))
  assert.ok(bySide.top.y > 0 && bySide.top.originY >= 18, 'A top popover should enter toward its bottom trigger edge')
  assert.ok(bySide.bottom.y < 0 && bySide.bottom.originY <= 2, 'A bottom popover should enter from its top trigger edge')
  assert.ok(bySide.left.x > 0 && bySide.left.originX >= 38, 'A left popover should enter toward its right trigger edge')
  assert.ok(bySide.right.x < 0 && bySide.right.originX <= 2, 'A right popover should enter from its left trigger edge')
}

async function verifyPopup(page, extensionId, seeded) {
  await page.setViewportSize({ width: 800, height: 600 })
  await page.goto(`chrome-extension://${extensionId}/src/popup/popup.html`, { waitUntil: 'domcontentloaded' })
  await page.locator('#search-help-toggle').waitFor({ state: 'attached' })
  await page.waitForTimeout(350)
  await verifyResolvedOverlayDirections(page)

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const probe = await probePopoverOpening(page, '#search-help-toggle', '#search-help-popover')
    assert.equal(probe.hidden, false, 'Repeated popover opening should leave the panel visible')
    assert.equal(probe.sawStartingStyle, true, 'Repeated popover opening should expose a starting state')
    assert.equal(probe.side, 'bottom', 'Search help should resolve below its trigger')
    assert.ok(probe.origin[1] <= 2, 'A bottom popover should originate from its top edge')
    await page.keyboard.press('Escape')
    await page.waitForFunction(() => {
      const popup = document.querySelector('#search-help-popover')
      return !popup || popup.hasAttribute('data-closed')
    })
    await page.waitForFunction(() => document.activeElement?.id === 'search-help-toggle')
  }

  await page.locator('#search-help-toggle').click()
  await page.waitForFunction(() => !document.querySelector('#search-help-popover')?.hasAttribute('data-closed'))
  await page.waitForFunction(() => {
    const popup = document.querySelector('#search-help-popover')
    return popup?.hasAttribute('data-open') && popup.getAnimations().length === 0
  })
  const interruptionProbe = page.evaluate(() => new Promise((resolve) => {
    const popup = document.querySelector('#search-help-popover')
    let sawHidden = false
    const startedAt = performance.now()
    const sample = (now) => {
      sawHidden ||= !popup?.isConnected || popup?.hasAttribute('hidden') || getComputedStyle(popup).display === 'none'
      if (now - startedAt < 420) {
        requestAnimationFrame(sample)
        return
      }
      resolve({ open: !popup?.hasAttribute('data-closed'), sawHidden })
    }
    requestAnimationFrame(sample)
  }))
  await page.evaluate(() => {
    const popup = document.querySelector('#search-help-popover')
    const trigger = document.querySelector('#search-help-toggle')
    const state = { done: false }
    window.__curatorPopoverReopenProbe = state
    const observer = new MutationObserver(() => {
      if (!popup?.hasAttribute('data-ending-style')) {
        return
      }
      trigger?.click()
      state.done = true
      observer.disconnect()
    })
    observer.observe(popup, { attributes: true, attributeFilter: ['data-ending-style'] })
  })
  await page.keyboard.press('Escape')
  await page.waitForFunction(() => window.__curatorPopoverReopenProbe?.done)
  await page.evaluate(() => { delete window.__curatorPopoverReopenProbe })
  const interrupted = await interruptionProbe
  assert.equal(interrupted.sawHidden, false, 'Popover reopening during exit should reverse without unmounting')
  assert.equal(interrupted.open, true, 'Interrupted popover exit should finish open')
  await page.keyboard.press('Escape')
  await page.waitForFunction(() => {
    const popup = document.querySelector('#search-help-popover')
    return !popup || popup.hasAttribute('data-closed')
  })

  const input = page.locator('#search-input')
  await input.fill(`site:example.com folder:"${seeded.folderTitles[0]}" -beta`)
  await page.waitForFunction(() => document.querySelectorAll('#search-chips > span').length >= 3)
  const chipStyles = await page.locator('#search-chips > span').evaluateAll((chips) => chips.map((chip) => {
    const style = getComputedStyle(chip)
    return { background: style.backgroundColor, border: style.borderColor }
  }))
  assert.ok(chipStyles.every((style) => style.background === chipStyles[0].background && style.border === chipStyles[0].border), 'Ordinary and exclusion query chips should share one neutral surface')
  await captureVisual(page, 'popup-filters')

  await input.fill('Alpha')
  await input.fill('Beta')
  await page.waitForFunction(() => {
    const rows = [...document.querySelectorAll('.popup-main-row')]
      .filter((row) => row.textContent?.trim())
    return rows.length === 1 && rows[0]?.textContent?.includes('Curator Smoke Beta')
  })
  const immediateCount = await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => {
    const row = [...document.querySelectorAll('.popup-main-row')].find((element) => element.textContent?.includes('Curator Smoke Beta'))
    const section = row?.closest('section')
    resolve(section?.querySelector('header .t-number-value')?.textContent || '')
  })))
  assert.match(immediateCount, /^1(?:\s|$)/, 'The latest result count should be visible on the next frame')

  await input.fill('Curator Smoke')
  await page.waitForFunction(() => [...document.querySelectorAll('.popup-main-row')].filter((row) => row.textContent?.trim()).length >= 3)
  const popupHoverPoints = await page.locator('.popup-main-row').evaluateAll((rows) => rows
    .filter((row) => row.textContent?.trim())
    .slice(0, 5)
    .map((row) => {
      const rect = row.getBoundingClientRect()
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
    }))
  await recordAnimationFrames(page, 'Popup result hover actions', 500, async () => {
    for (let repeat = 0; repeat < 3; repeat += 1) {
      for (const point of popupHoverPoints) {
        await page.mouse.move(point.x, point.y, { steps: 2 })
      }
    }
  })
  await input.focus()
  const beforeActive = await page.locator('.popup-main-row[data-active="true"]').textContent()
  await page.keyboard.press('ArrowDown')
  await waitForFrames(page, 1)
  const afterActive = await page.locator('.popup-main-row[data-active="true"]').textContent()
  assert.notEqual(afterActive, beforeActive, 'Arrow-key navigation should update the active result by the next frame')

  await input.fill('')
  await page.waitForFunction(() => [...document.querySelectorAll('.popup-main-row')].filter((row) => row.textContent?.trim()).length >= 3)
  const firstRow = page.locator('.popup-main-row').filter({ has: page.locator('button[aria-expanded]') }).first()
  const actionTrigger = firstRow.locator('button[aria-expanded]')
  await actionTrigger.click()
  const editButton = firstRow.locator('button[aria-label^="编辑书签"]')
  await editButton.click()
  await page.waitForFunction(() => !document.querySelector('#modal-backdrop .curator-overlay-panel')?.hasAttribute('hidden'))
  await page.waitForFunction(() => {
    const panel = document.querySelector('#modal-backdrop .curator-overlay-panel')
    const backdrop = document.querySelector('#modal-backdrop .t-modal-backdrop')
    return panel?.hasAttribute('data-open') &&
      backdrop?.hasAttribute('data-open') &&
      panel.getAnimations().length === 0 &&
      backdrop.getAnimations().length === 0
  })
  await captureVisual(page, 'popup-modal')
  const exitProbe = page.evaluate(() => new Promise((resolve) => {
    const panel = document.querySelector('#modal-backdrop .curator-overlay-panel')
    const backdrop = document.querySelector('#modal-backdrop .t-modal-backdrop')
    let panelEnding = false
    let backdropEnding = false
    let together = false
    const startedAt = performance.now()
    const sample = (now) => {
      panelEnding ||= panel?.hasAttribute('data-ending-style') || false
      backdropEnding ||= backdrop?.hasAttribute('data-ending-style') || false
      together ||= Boolean(panel?.hasAttribute('data-ending-style') && backdrop?.hasAttribute('data-ending-style'))
      if (now - startedAt < 340) {
        requestAnimationFrame(sample)
        return
      }
      resolve({ backdropEnding, panelEnding, together })
    }
    requestAnimationFrame(sample)
  }))
  await page.locator('#close-edit-modal').click()
  const exit = await exitProbe
  assert.ok(exit.panelEnding && exit.backdropEnding && exit.together, `Modal card and backdrop should exit as one hierarchy: ${JSON.stringify(exit)}`)
  await page.waitForFunction(() => document.querySelector('#modal-backdrop .curator-overlay-panel')?.hasAttribute('hidden'))
  await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label')?.startsWith('编辑书签'))
}

async function verifyOptionsAndFullDashboard(page, extensionId) {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto(`chrome-extension://${extensionId}/src/options/options.html`, { waitUntil: 'domcontentloaded' })
  await page.locator('#general').waitFor({ state: 'attached' })
  await page.waitForFunction(() => !document.querySelector('#general')?.hasAttribute('hidden'))
  const navLabels = await page.locator('aside nav a').allTextContents()
  assert.ok(navLabels.every((label) => !label.trim().startsWith('-')), 'Options navigation should not use decorative terminal prefixes')
  await captureVisual(page, 'options-general', { fullPage: true })

  await page.goto(`chrome-extension://${extensionId}/src/options/options.html#general`, { waitUntil: 'domcontentloaded' })
  const reasoningTrigger = page.getByRole('button', { name: /^推理强度：/ })
  await reasoningTrigger.waitFor({ state: 'visible', timeout: 20_000 })
  await reasoningTrigger.click()
  const reasoningSlider = page.getByRole('slider', { name: '推理强度' })
  await reasoningSlider.waitFor({ state: 'visible' })
  const reasoningTrack = reasoningSlider.locator('..')
  const reasoningTrackBox = await reasoningTrack.boundingBox()
  assert.ok(reasoningTrackBox, 'Reasoning effort track should be measurable')
  const reasoningBefore = await reasoningSlider.getAttribute('aria-valuenow')
  await recordAnimationFrames(page, 'reasoning effort drag and spring settle', 800, async () => {
    const startX = reasoningTrackBox.x + 28
    const endX = reasoningTrackBox.x + reasoningTrackBox.width - 34
    const y = reasoningTrackBox.y + reasoningTrackBox.height / 2
    await page.mouse.move(startX, y)
    await page.mouse.down()
    await page.mouse.move(endX, y, { steps: 8 })
    await page.mouse.up()
  })
  await page.waitForFunction((previous) => document.querySelector('[role="slider"][aria-label="推理强度"]')?.getAttribute('aria-valuenow') !== previous, reasoningBefore)
  await page.keyboard.press('Escape')

  await page.goto(`chrome-extension://${extensionId}/src/options/options.html#dashboard`, { waitUntil: 'domcontentloaded' })
  await page.locator('#dashboard-query').waitFor({ state: 'visible', timeout: 30_000 })
  assert.ok(await page.locator('#dashboard').isVisible(), 'Full Dashboard should load as an Options route')
  await page.waitForFunction(() => {
    const cards = [...document.querySelectorAll('article[data-bookmark-id]')]
    return cards.length > 0 && cards.every((card) => !card.querySelector('.t-skel'))
  }, null, { timeout: 30_000 })
  const dashboardCard = page.locator('article[data-bookmark-id]').first()
  await dashboardCard.waitFor({ state: 'visible' })
  const dashboardCardBox = await dashboardCard.boundingBox()
  assert.ok(dashboardCardBox, 'Dashboard card geometry should be measurable')
  const dashboardDragStart = await dashboardCard.evaluate((card) => {
    const rect = card.getBoundingClientRect()
    const candidates = [
      [0.5, 0.5],
      [0.78, 0.78],
      [0.22, 0.78],
      [0.78, 0.22]
    ]
    for (const [xRatio, yRatio] of candidates) {
      const x = rect.left + rect.width * xRatio
      const y = rect.top + rect.height * yRatio
      const target = document.elementFromPoint(x, y)
      if (!target?.closest('button,a,input,textarea,select,[contenteditable="true"]')) {
        return { x, y }
      }
    }
    return { x: rect.left + 12, y: rect.top + 12 }
  })
  const dashboardDragEnd = {
    x: dashboardDragStart.x + 120,
    y: dashboardDragStart.y + 46
  }
  await recordAnimationFrames(page, 'Dashboard drag', 700, async () => {
    await page.mouse.move(dashboardDragStart.x, dashboardDragStart.y)
    await page.mouse.down()
    await page.mouse.move(dashboardDragEnd.x, dashboardDragEnd.y, { steps: 8 })
    await page.waitForFunction(() => Boolean(document.querySelector('.dashboard-drag-preview')), null, { timeout: 2_000 })
    const previewBox = await page.locator('.dashboard-drag-preview').boundingBox()
    assert.ok(previewBox, 'Dashboard drag preview should be measurable')
    const expectedPreview = {
      x: dashboardDragEnd.x - (dashboardDragStart.x - dashboardCardBox.x),
      y: dashboardDragEnd.y - (dashboardDragStart.y - dashboardCardBox.y)
    }
    assert.ok(Math.abs(previewBox.x - expectedPreview.x) <= 2, 'Dashboard preview should preserve the horizontal grab offset')
    assert.ok(Math.abs(previewBox.y - expectedPreview.y) <= 2, 'Dashboard preview should preserve the vertical grab offset')
    await page.mouse.up()
    await page.locator('.dashboard-drag-preview').waitFor({ state: 'hidden', timeout: 2_000 })
  })
  await page.getByRole('button', { name: '查看高级搜索语法' }).click()
  await page.waitForFunction(() => !document.querySelector('#dashboard-search-help-popover')?.hasAttribute('hidden'))
  const dashboardPopoverSide = await page.locator('#dashboard-search-help-popover').getAttribute('data-side')
  assert.equal(dashboardPopoverSide, 'bottom', 'Dashboard search help should resolve below its trigger')
  await captureVisual(page, 'dashboard-full')
  await page.keyboard.press('Escape')
}

async function dispatchTouch(client, type, points) {
  await client.send('Input.dispatchTouchEvent', {
    type,
    touchPoints: points.map((point) => ({
      id: point.id ?? 1,
      x: Math.round(point.x),
      y: Math.round(point.y),
      radiusX: 2,
      radiusY: 2,
      force: 1
    }))
  })
}

async function observeGhostSettle(page, selector) {
  return page.evaluate((ghostSelector) => new Promise((resolve) => {
    const startedAt = performance.now()
    let frames = 0
    let sawGhost = false
    const sample = (now) => {
      const ghost = document.querySelector(ghostSelector)
      if (ghost) {
        sawGhost = true
        frames += 1
      } else if (sawGhost) {
        resolve({ elapsed: now - startedAt, frames })
        return
      }
      if (now - startedAt > 900) {
        resolve({ elapsed: now - startedAt, frames })
        return
      }
      requestAnimationFrame(sample)
    }
    requestAnimationFrame(sample)
  }), selector)
}

async function verifyTouchDrag(page, client, {
  container,
  ghost,
  handle,
  target
}) {
  await page.locator(container).first().scrollIntoViewIfNeeded()
  await waitForFrames(page)
  const source = page.locator(container).first()
  const sourceHandle = page.locator(handle).first()
  const targetItem = page.locator(target).nth(1)
  const [sourceBox, handleBox, targetBox] = await Promise.all([
    source.boundingBox(),
    sourceHandle.boundingBox(),
    targetItem.boundingBox()
  ])
  assert.ok(sourceBox && handleBox && targetBox, `Touch drag geometry should exist for ${container}`)
  const start = { x: Math.round(handleBox.x + Math.min(8, handleBox.width / 2)), y: Math.round(handleBox.y + handleBox.height / 2), id: 1 }
  const destination = { x: Math.round(targetBox.x + targetBox.width / 2), y: Math.round(targetBox.y + targetBox.height / 2), id: 1 }
  const grabOffset = { x: start.x - sourceBox.x, y: start.y - sourceBox.y }

  await dispatchTouch(client, 'touchStart', [start])
  await page.waitForTimeout(350)
  await page.locator(ghost).waitFor({ state: 'attached', timeout: 2_000 })
  await dispatchTouch(client, 'touchMove', [destination])
  await waitForFrames(page)
  const ghostBox = await page.locator(ghost).boundingBox()
  assert.ok(ghostBox, `Drag preview should remain visible for ${container}`)
  const expectedGhost = { x: destination.x - grabOffset.x, y: destination.y - grabOffset.y }
  const ghostDiagnostics = await page.locator(ghost).evaluate((element) => ({
    computedTransform: getComputedStyle(element).transform,
    devicePixelRatio: window.devicePixelRatio,
    inlineTransform: element.style.transform,
    rootScrollLeft: document.getElementById('newtab-root')?.scrollLeft || 0,
    rootScrollTop: document.getElementById('newtab-root')?.scrollTop || 0,
    viewportOffsetLeft: window.visualViewport?.offsetLeft || 0,
    viewportScale: window.visualViewport?.scale || 1
  }))
  assert.ok(
    Math.abs(ghostBox.x - expectedGhost.x) <= 2,
    `Drag preview should preserve horizontal grab offset for ${container}: ${JSON.stringify({ actual: ghostBox.x, expected: expectedGhost.x, grabOffset, sourceBox, handleBox, destination, ghostDiagnostics })}`
  )
  assert.ok(
    Math.abs(ghostBox.y - expectedGhost.y) <= 2,
    `Drag preview should preserve vertical grab offset for ${container}: ${JSON.stringify({ actual: ghostBox.y, expected: expectedGhost.y, grabOffset })}`
  )

  const settleProbe = observeGhostSettle(page, ghost)
  await dispatchTouch(client, 'touchEnd', [])
  const settle = await settleProbe
  assert.ok(settle.frames >= 3 && settle.elapsed >= 80 && settle.elapsed < 900, `Drop preview should visibly settle before removal for ${container}`)
  await page.waitForTimeout(100)
}

async function verifyTouchAndKeyboard(page, context, extensionId) {
  await page.setViewportSize({ width: 1000, height: 720 })
  await page.goto(`chrome-extension://${extensionId}/src/newtab/newtab.html`, { waitUntil: 'domcontentloaded' })
  await page.locator('.bookmark-tile').first().waitFor({ state: 'visible', timeout: 20_000 })
  await page.locator('.newtab-speed-dial-card').first().waitFor({ state: 'visible' })
  await page.locator('[data-folder-drag-handle]').first().waitFor({ state: 'visible' })
  const client = await context.newCDPSession(page)

  const shell = page.locator('#newtab-root')
  await shell.evaluate((element) => { element.scrollTop = 0 })
  const card = page.locator('.bookmark-tile').first()
  await card.scrollIntoViewIfNeeded()
  const cardBox = await card.boundingBox()
  assert.ok(cardBox, 'A bookmark card should be available for the touch scroll probe')
  const scrollStart = { x: cardBox.x + 18, y: cardBox.y + cardBox.height / 2, id: 1 }
  await dispatchTouch(client, 'touchStart', [scrollStart])
  for (let step = 1; step <= 5; step += 1) {
    await dispatchTouch(client, 'touchMove', [{ ...scrollStart, y: scrollStart.y - step * 18 }])
    await page.waitForTimeout(18)
  }
  await dispatchTouch(client, 'touchEnd', [])
  await page.waitForTimeout(120)
  assert.ok(await shell.evaluate((element) => element.scrollTop) > 12, 'Vertical touch movement on a bookmark body should scroll instead of starting drag')

  await page.locator('.bookmark-tile').first().scrollIntoViewIfNeeded()
  const cancelHandle = page.locator('[data-bookmark-drag-handle]').first()
  const cancelBox = await cancelHandle.boundingBox()
  assert.ok(cancelBox, 'The coarse-pointer bookmark drag handle should be visible')
  const cancelStart = { x: cancelBox.x + cancelBox.width / 2, y: cancelBox.y + cancelBox.height / 2, id: 1 }
  const beforeFeedback = await cancelHandle.evaluate((element) => getComputedStyle(element).backgroundColor)
  await dispatchTouch(client, 'touchStart', [cancelStart])
  await page.waitForTimeout(70)
  const pendingFeedback = await cancelHandle.evaluate((element) => getComputedStyle(element).backgroundColor)
  assert.notEqual(pendingFeedback, beforeFeedback, 'Long-press pending state should provide feedback within 100ms')
  await dispatchTouch(client, 'touchMove', [{ ...cancelStart, y: cancelStart.y + 16 }])
  await page.waitForTimeout(340)
  assert.equal(await page.locator('.bookmark-drag-ghost').count(), 0, 'Movement before long press should cancel bookmark drag')
  await dispatchTouch(client, 'touchEnd', [])

  await verifyTouchDrag(page, client, {
    container: '.newtab-speed-dial-card',
    ghost: '.speed-dial-drag-ghost',
    handle: '[data-speed-dial-drag-handle]',
    target: '.newtab-speed-dial-card'
  })
  await verifyTouchDrag(page, client, {
    container: '.bookmark-tile',
    ghost: '.bookmark-drag-ghost',
    handle: '[data-bookmark-drag-handle]',
    target: '.bookmark-tile'
  })
  await verifyTouchDrag(page, client, {
    container: '[data-folder-drag-handle]',
    ghost: '.folder-drag-ghost',
    handle: '[data-folder-drag-handle]',
    target: '[data-folder-drag-handle]'
  })

  const keyboardCases = [
    { selector: '.newtab-speed-dial-card', key: 'Alt+ArrowRight' },
    { selector: '.bookmark-tile', key: 'Alt+ArrowRight' },
    { selector: '[data-folder-drag-handle]', key: 'Alt+ArrowDown' }
  ]
  for (const keyboardCase of keyboardCases) {
    const item = page.locator(keyboardCase.selector).first()
    await item.scrollIntoViewIfNeeded()
    const identity = await item.evaluate((element) => element.getAttribute('data-bookmark-id') || element.getAttribute('data-folder-drag-handle'))
    await item.focus()
    await page.keyboard.press(keyboardCase.key)
    await page.waitForFunction(() => [...document.querySelectorAll('[role="status"]')].some((element) => element.textContent?.includes('移动')))
    const focusedIdentity = await page.evaluate(() => document.activeElement?.getAttribute('data-bookmark-id') || document.activeElement?.getAttribute('data-folder-drag-handle'))
    assert.equal(focusedIdentity, identity, `Keyboard reorder should keep focus on ${keyboardCase.selector}`)
  }

  const newtabSearch = page.locator('.newtab-search-input')
  await newtabSearch.fill('Curator Smoke')
  await page.waitForFunction(() => document.querySelectorAll('#newtab-search-suggestions .newtab-search-suggestion').length >= 3)
  const activeSuggestionBefore = await newtabSearch.getAttribute('aria-activedescendant')
  await recordAnimationFrames(page, 'New Tab search suggestion navigation', 500, async () => {
    for (let index = 0; index < 8; index += 1) {
      await page.keyboard.press('ArrowDown')
      await page.waitForTimeout(18)
    }
  })
  const activeSuggestionAfter = await newtabSearch.getAttribute('aria-activedescendant')
  assert.notEqual(activeSuggestionAfter, activeSuggestionBefore, 'New Tab suggestion navigation should update the active option immediately')
  await page.keyboard.press('Escape')
}

let context

try {
  context = await chromium.launchPersistentContext(profilePath, {
    headless: false,
    hasTouch: true,
    reducedMotion: 'no-preference',
    viewport: { width: 1280, height: 720 },
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`
    ]
  })

  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker', { timeout: 15_000 })
  const extensionId = new URL(worker.url()).host
  const seeded = await seedExtension(worker)
  const page = await context.newPage()

  await page.goto(`chrome-extension://${extensionId}/src/newtab/newtab.html`, { waitUntil: 'domcontentloaded' })
  await page.locator('#newtab-settings-trigger').waitFor({ state: 'attached' })
  await page.waitForTimeout(400)
  await captureNewtabWallpaperVariants(page)
  await verifyNewtabAccessibilityMaterials(page, context)
  await verifyDesktopDrawer(page)
  await verifyNarrowAndReducedMotionDrawer(page)
  await verifyDashboardOverlay(page)
  await verifyPopup(page, extensionId, seeded)
  await verifyOptionsAndFullDashboard(page, extensionId)
  await verifyTouchAndKeyboard(page, context, extensionId)

  console.log(`Interface performance frame probes: ${JSON.stringify(performanceRecords)}`)
  console.log('Curator interface quality extension smoke tests passed.')
} finally {
  await context?.close()
  await rm(profilePath, { recursive: true, force: true })
}
