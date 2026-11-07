import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'

const styles = [
  ['dim', '均匀暗化', 0],
  ['gradient', '柔和渐暗', 0],
  ['frosted', '轻磨砂', 8]
]
const properties = [
  '--wallpaper-filter', '--wallpaper-overscan', '--wallpaper-dim', '--wallpaper-dim-image'
]

export async function runWallpaperMaskChecks(page, origin, directory) {
  const report = { checks: [], screenshots: [], errors: [] }
  const url = `${origin}/src/newtab/newtab.html`
  const record = (label, details = {}) => report.checks.push({ label, ...details })
  const read = () => page.evaluate(properties => ({
    css: Object.fromEntries(properties.map(property => [property, document.documentElement.style.getPropertyValue(property)])),
    snapshot: JSON.parse(localStorage.getItem('curatorNewTabWallpaperAdjustments') || '{}'),
    stored: window.__glassFixture.data.curatorBookmarkNewTabBackgroundSettings,
    errors: window.__glassFixture.errors
  }), properties)
  const ready = () => page.waitForFunction(() =>
    window.__glassFixture && document.querySelector('.bookmark-tile') &&
    document.querySelector('#newtab-dynamic-background-stage #newtab-wallpaper-dim'),
  undefined, { timeout: 12000 })
  const selectStyle = async (style, label) => {
    await page.click('loc=role:combobox[name="背景蒙版样式"]')
    await page.waitForSelector('[role="option"]', { state: 'visible' })
    await page.click(`loc=role:option[name="${label}"]`)
    await page.waitForFunction(style =>
      JSON.parse(localStorage.getItem('curatorNewTabWallpaperAdjustments') || '{}').wallpaperStyle === style, style)
  }
  const adjust = async (field, key, expected) => {
    await page.press(`#wallpaper-${field}-root input`, key)
    await page.waitForFunction(({ field, expected }) =>
      document.querySelector(`#wallpaper-${field}-root input`)?.value === String(expected),
    { field, expected })
  }
  const capture = async name => {
    await page.evaluate(async () => {
      await Promise.all(document.getAnimations()
        .filter(animation => Number.isFinite(animation.effect?.getComputedTiming().endTime))
        .map(animation => animation.finished.catch(() => {})))
    })
    const viewport = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }))
    const { data } = await page.cdp('Page.captureScreenshot', {
      format: 'png', captureBeyondViewport: false,
      clip: { x: 0, y: 0, ...viewport, scale: 1 }
    })
    const path = `${directory}/${name}.png`
    await writeFile(path, Buffer.from(data, 'base64'))
    report.screenshots.push(path)
    return data
  }
  const geometry = () => page.evaluate(() => Object.fromEntries(
    ['wallpaper-style-row', 'wallpaper-dim-row', 'wallpaper-blur-row'].map(id => {
      const bounds = document.getElementById(id).getBoundingClientRect()
      return [id, { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height }]
    })
  ))
  try {
    await page.goto(url)
    await ready()
    await page.evaluate(async () => {
      await chrome.storage.local.set({
        curatorBookmarkNewTabBackgroundSettings: {
          type: 'urls', color: '#101013', url: `${location.origin}/wallpaper.svg`,
          maskEnabled: true, maskStyle: 'grain', maskOverlay: 29, maskBlur: 24, maskFilterStrength: 45
        }
      })
    })
    await page.waitForFunction(() =>
      JSON.parse(localStorage.getItem('curatorNewTabWallpaperAdjustments') || '{}').wallpaperDim === 29)
    const migrated = await read()
    assert.equal(migrated.snapshot.wallpaperStyle, 'dim')
    assert.equal('wallpaperGrain' in migrated.snapshot, false)
    assert.equal(migrated.snapshot.wallpaperDim, 29)
    assert.equal(migrated.snapshot.wallpaperBlur, 0)
    record('legacy migration', migrated.snapshot)
    await page.evaluate(() => {
      const original = chrome.storage.local.set.bind(chrome.storage.local)
      const probe = window.__wallpaperSaveProbe = { mode: 'ready', pending: [] }
      chrome.storage.local.set = (values, callback) => {
        if (!('curatorBookmarkNewTabBackgroundSettings' in values)) return original(values, callback)
        const deliver = () => {
          if (probe.mode !== 'error') return original(values, callback)
          return new Promise(resolve => queueMicrotask(() => {
            chrome.runtime.lastError = { message: 'Fixture storage failure. '.repeat(120) }
            callback?.()
            delete chrome.runtime.lastError
            resolve()
          }))
        }
        if (probe.mode !== 'pending') return deliver()
        return new Promise(resolve => probe.pending.push(() => { void deliver().then(resolve) }))
      }
    })

    for (const width of [1440, 768, 390]) {
      const height = width === 390 ? 844 : 1000
      await page.cdp('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
      await page.cdp('Emulation.setFocusEmulationEnabled', { enabled: true })
      await page.waitForFunction(width => innerWidth === width, width)
      await page.click('#newtab-settings-trigger')
      await page.click('loc=role:tab[name="外观"]')
      await page.waitForSelector('#wallpaper-style-row', { state: 'visible' })
      console.log((await page.snapshot({ scope: 'full_page' })).split('\n').filter(line => /蒙版|颗粒|浓度|模糊/.test(line)).join('\n'))
      await page.click('loc=role:combobox[name="背景蒙版样式"]')
      await page.waitForSelector('[role="option"]', { state: 'visible' })
      const options = await page.evaluate(() => [...document.querySelectorAll('[role=option]')].map(option => option.textContent.trim()))
      assert.deepEqual(options, styles.map(([, label]) => label))
      await page.keyboard.press('Escape')

      for (const [style, label, blur] of styles) {
        await selectStyle(style, label)
        const current = await read()
        assert.equal(current.snapshot.wallpaperBlur, blur)
        assert.equal(current.css['--wallpaper-filter'], blur ? `blur(${blur}px)` : 'none')
        assert.deepEqual(current.errors, [])
        if (width === 1440) await capture(`style-${style}`)
      }
      await adjust('blur', 'End', 32)
      const overscan = await page.evaluate(() => {
        const bounds = document.getElementById('newtab-wallpaper-stage').getBoundingClientRect()
        return bounds.left < 0 && bounds.top < 0 && bounds.right > innerWidth && bounds.bottom > innerHeight
      })
      assert.equal(overscan, true, 'Blurred wallpaper must extend beyond all viewport edges.')
      await adjust('blur', 'Home', 0)
      await adjust('dim', 'Home', 0)
      const clear = await read()
      assert.equal(clear.css['--wallpaper-filter'], 'none')
      assert.equal(clear.css['--wallpaper-dim-image'], 'none')

      const before = await geometry()
      await adjust('dim', 'ArrowRight', 1)
      await adjust('dim', 'End', 100)
      assert.deepEqual(await geometry(), before, 'Slider values must not move peer controls.')
      const { data: covered } = await page.cdp('Page.captureScreenshot', {
        format: 'png', captureBeyondViewport: false,
        clip: { x: 4, y: height - 44, width: 8, height: 8, scale: 1 }
      })
      if (width === 1440) {
        const average = await page.evaluate(async data => {
          const image = new Image()
          image.src = `data:image/png;base64,${data}`
          await image.decode()
          const canvas = document.createElement('canvas')
          canvas.width = image.width
          canvas.height = image.height
          const context = canvas.getContext('2d')
          context.drawImage(image, 0, 0)
          const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
          let total = 0
          for (let offset = 0; offset < pixels.length; offset += 4) total += pixels[offset] + pixels[offset + 1] + pixels[offset + 2]
          return total / (pixels.length * 0.75)
        }, covered)
        assert.ok(average < 1, 'Full dim must cover the wallpaper.')
      }

      const enabled = await read()
      await page.click('loc=role:switch[name="背景蒙版"]')
      await page.waitForFunction(() => document.documentElement.style.getPropertyValue('--wallpaper-dim') === '0')
      const disabled = await read()
      assert.equal(disabled.snapshot.wallpaperDim, enabled.snapshot.wallpaperDim)
      assert.equal(disabled.snapshot.wallpaperStyle, enabled.snapshot.wallpaperStyle)
      await page.click('loc=role:switch[name="背景蒙版"]')
      await page.waitForFunction(() => document.documentElement.style.getPropertyValue('--wallpaper-dim') === '1')
      assert.deepEqual((await read()).css, enabled.css)
      await adjust('dim', 'Home', 0)
      await adjust('dim', 'ArrowRight', 1)
      await capture(`settings-${width}`)
      const overflow = await page.evaluate(() => {
        const drawer = document.querySelector('.settings-drawer-scroll')
        return { document: document.documentElement.scrollWidth - innerWidth, drawer: drawer.scrollWidth - drawer.clientWidth }
      })
      assert.ok(overflow.document <= 1 && overflow.drawer <= 1, `${width}: no horizontal overflow`)
      record(`${width}: styles, keyboard, zero, coverage, toggle, geometry`, overflow)
      const beforeSave = await geometry()
      await page.evaluate(() => { window.__wallpaperSaveProbe.mode = 'pending' })
      await adjust('dim', 'ArrowRight', 2)
      await page.waitForFunction(() => window.__wallpaperSaveProbe.pending.length > 0)
      assert.deepEqual(await geometry(), beforeSave, 'Pending saves must keep controls stable.')
      await page.evaluate(() => {
        window.__wallpaperSaveProbe.mode = 'error'
        window.__wallpaperSaveProbe.pending.splice(0).forEach(deliver => deliver())
      })
      await page.waitForFunction(() => document.getElementById('settings-save-status')?.dataset.state === 'error')
      assert.deepEqual(await geometry(), beforeSave, 'Long storage errors must keep controls stable.')
      await capture(`save-error-${width}`)
      await page.evaluate(() => { window.__wallpaperSaveProbe.mode = 'ready' })
      await adjust('dim', 'ArrowLeft', 1)
      await page.waitForFunction(() => document.getElementById('settings-save-status')?.dataset.state === 'idle')
      assert.deepEqual(await geometry(), beforeSave, 'Save recovery must keep controls stable.')
      record(`${width}: pending, long error, recovery`)
      await page.keyboard.press('Escape')
      await page.waitForFunction(() => document.getElementById('newtab-settings-trigger')?.getAttribute('aria-expanded') === 'false')
    }

    await page.cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })
    const beforeReload = await read()
    await page.cdp('Page.addScriptToEvaluateOnNewDocument', {
      source: `(() => {
        window.__wallpaperBootFrames = [];
        const properties = ${JSON.stringify(properties)};
        const observer = new MutationObserver(() => {
          const root = document.documentElement;
          if (!root?.classList.contains('instant-wallpaper-ready')) return;
          const frame = Object.fromEntries(properties.map(property => [property, root.style.getPropertyValue(property)]));
          if (frame['--wallpaper-dim']) window.__wallpaperBootFrames.push(frame);
        });
        observer.observe(document, { subtree: true, attributes: true, attributeFilter: ['style', 'class'] });
        setTimeout(() => observer.disconnect(), 2500);
      })()`
    })
    await page.reload()
    await ready()
    const afterReload = await read()
    assert.deepEqual(afterReload.css, beforeReload.css)
    const frames = await page.evaluate(() => window.__wallpaperBootFrames)
    assert.ok(frames.length > 0)
    for (const frame of frames) assert.deepEqual(frame, beforeReload.css, 'Boot and hydration must paint identical settings.')
    record('first paint and reload', { frames: frames.length })

    await page.evaluate(async () => {
      const source = window.__glassFixture.data.curatorBookmarkNewTabBackgroundSettings
      await chrome.storage.local.set({ curatorBookmarkNewTabBackgroundSettings: { ...source, type: 'color' } })
    })
    await page.waitForFunction(() => document.documentElement.style.getPropertyValue('--wallpaper-dim') === '0')
    await page.reload()
    await ready()
    assert.equal((await read()).css['--wallpaper-dim'], '0')
    await page.evaluate(async () => {
      const source = window.__glassFixture.data.curatorBookmarkNewTabBackgroundSettings
      await chrome.storage.local.set({ curatorBookmarkNewTabBackgroundSettings: { ...source, type: 'urls' } })
    })
    await page.waitForFunction(() => document.documentElement.style.getPropertyValue('--wallpaper-dim') === '1')
    assert.deepEqual((await read()).css, beforeReload.css)
    record('solid color suspends and restores settings')
    const videoData = await page.evaluate(async () => {
      const canvas = document.createElement('canvas')
      canvas.width = 640
      canvas.height = 480
      const context = canvas.getContext('2d')
      const gradient = context.createLinearGradient(0, 0, 640, 480)
      gradient.addColorStop(0, '#155878')
      gradient.addColorStop(1, '#bd8667')
      context.fillStyle = gradient
      context.fillRect(0, 0, 640, 480)
      const stream = canvas.captureStream(10)
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' })
      const chunks = []
      recorder.ondataavailable = event => chunks.push(event.data)
      const complete = new Promise((resolve, reject) => {
        recorder.onstop = resolve
        recorder.onerror = reject
      })
      recorder.start(100)
      let frame = 0
      const timer = setInterval(() => {
        context.fillStyle = gradient
        context.fillRect(0, 0, 640, 480)
        context.fillStyle = '#eff6e8'
        context.fillRect(40 + frame++ * 12, 180, 80, 100)
      }, 100)
      setTimeout(() => { clearInterval(timer); recorder.stop() }, 800)
      await complete
      stream.getTracks().forEach(track => track.stop())
      const bytes = new Uint8Array(await new Blob(chunks).arrayBuffer())
      let binary = ''
      for (const value of bytes) binary += String.fromCharCode(value)
      return btoa(binary)
    })
    const videoPath = `${directory}/wallpaper-fixture.webm`
    await writeFile(videoPath, Buffer.from(videoData, 'base64'))
    await page.cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })
    await page.click('#newtab-settings-trigger')
    await page.click('loc=role:tab[name="外观"]')
    await page.click('loc=role:combobox[name="背景类型"]')
    await page.click('loc=role:option[name="视频"]')
    await page.setInputFiles('#background-video-file', [videoPath])
    await page.waitForFunction(() => {
      const video = document.querySelector('.newtab-background-video')
      return video?.readyState >= 2 && video.currentTime > 0
    }, undefined, { timeout: 15000 })
    await page.evaluate(() => {
      const video = document.querySelector('.newtab-background-video')
      const probe = window.__wallpaperVideoProbe = { video, src: video.currentSrc, reloads: 0 }
      video.addEventListener('loadstart', () => { probe.reloads++ })
    })
    await adjust('blur', 'End', 32)
    const videoAppearance = await page.evaluate(() => {
      const video = document.querySelector('.newtab-background-video')
      const bounds = video.getBoundingClientRect()
      return {
        filter: getComputedStyle(video).filter,
        overscan: bounds.left < 0 && bounds.top < 0 && bounds.right > innerWidth && bounds.bottom > innerHeight
      }
    })
    assert.deepEqual(videoAppearance, { filter: 'blur(32px)', overscan: true })
    await adjust('dim', 'End', 100)
    await page.waitForFunction(() => document.getElementById('settings-save-status')?.dataset.state === 'idle')
    assert.deepEqual(await page.evaluate(() => ({
      sameNode: document.querySelector('.newtab-background-video') === window.__wallpaperVideoProbe.video,
      sameSource: window.__wallpaperVideoProbe.video.currentSrc === window.__wallpaperVideoProbe.src,
      reloads: window.__wallpaperVideoProbe.reloads
    })), { sameNode: true, sameSource: true, reloads: 0 })
    record('video blur, edge coverage and uninterrupted playback')
    assert.deepEqual((await read()).errors, [])
    await writeFile(`${directory}/wallpaper-report.json`, JSON.stringify(report, null, 2))
    return { passed: true, checks: report.checks.length, directory }
  } catch (error) {
    report.errors.push(String(error))
    await writeFile(`${directory}/wallpaper-report.json`, JSON.stringify(report, null, 2))
    await capture('failure').catch(() => {})
    throw error
  }
}
