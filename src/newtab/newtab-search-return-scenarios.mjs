import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'

// Compare moving pixels with native paint at the same position. Checking only
// transforms or the final frame misses the resampled rim visible during return.
export async function verifySearchReturnContour(page, directory, label) {
  const frames = []
  await page.fill('.newtab-search-input', '')
  for (const time of [16, 32, 80]) {
    await page.click('.newtab-search-input', { label: 'Focus search contour' })
    await page.waitForFunction(() => {
      const shell = document.querySelector('.newtab-search-shell')
      const slot = document.querySelector('.newtab-search-slot')
      const lift = parseFloat(getComputedStyle(shell).getPropertyValue('--ds-hover-lift'))
      return Math.abs(shell.getBoundingClientRect().top - slot.getBoundingClientRect().top - lift) < 0.02
    })
    const initial = await page.evaluate(() => {
      const shell = document.querySelector('.newtab-search-shell')
      const measure = selector => {
        const { x, y, width, height } = document.querySelector(selector).getBoundingClientRect()
        return { x, y, width, height }
      }
      const state = window.__curatorReturnContour = { style: shell.getAttribute('style') }
      state.freeze = event => {
        if (event.target !== shell) return
        state.animations = shell.getAnimations({ subtree: true })
          .filter(animation => animation.effect.getTiming().iterations !== Infinity)
        state.animations.forEach(animation => animation.pause())
        shell.removeEventListener('transitionrun', state.freeze)
      }
      shell.addEventListener('transitionrun', state.freeze)
      return { slot: measure('.newtab-search-slot'), bookmark: measure('.bookmark-tile'), height: innerHeight }
    })
    try {
      await page.mouse.click(2, initial.height - 2, { label: 'Inspect returning contour' })
      await page.waitForFunction(() => window.__curatorReturnContour.animations?.length > 0)
      const frame = await page.evaluate(time => {
        window.__curatorReturnContour.animations.forEach(animation => { animation.currentTime = time })
        const shell = document.querySelector('.newtab-search-shell')
        const css = getComputedStyle(shell)
        const measure = selector => {
          const { x, y, width, height } = document.querySelector(selector).getBoundingClientRect()
          return { x, y, width, height }
        }
        const slot = measure('.newtab-search-slot')
        const bounds = shell.getBoundingClientRect()
        return {
          time, slot, bookmark: measure('.bookmark-tile'),
          offset: css.transform === 'none' ? css.top : `${bounds.top - slot.y}px`,
          clip: { x: Math.floor(bounds.x) - 4, y: Math.floor(slot.y) - 4, width: 32, height: 56, scale: 1 }
        }
      }, time)
      assert.deepEqual(frame.slot, initial.slot, `${label}: search motion never moves or resizes its slot`)
      assert.deepEqual(frame.bookmark, initial.bookmark, `${label}: search motion never moves the bookmarks`)
      const capture = () => page.cdp('Page.captureScreenshot', { format: 'png', fromSurface: true, clip: frame.clip })
      const animated = await capture()
      await page.evaluate(offset => {
        const shell = document.querySelector('.newtab-search-shell')
        shell.style.transition = 'none'
        shell.style.transform = 'none'
        shell.style.top = offset
      }, frame.offset)
      const reference = await capture()
      const pixels = await page.evaluate(async ({ animated, reference }) => {
        const decode = async data => {
          const bitmap = await createImageBitmap(new Blob([Uint8Array.from(atob(data), c => c.charCodeAt(0))], { type: 'image/png' }))
          const canvas = document.createElement('canvas')
          canvas.width = bitmap.width
          canvas.height = bitmap.height
          const context = canvas.getContext('2d', { willReadFrequently: true })
          context.drawImage(bitmap, 0, 0)
          bitmap.close()
          return context.getImageData(0, 0, canvas.width, canvas.height).data
        }
        const [a, b] = await Promise.all([decode(animated), decode(reference)])
        let maxDelta = 0
        let changedPixels = 0
        for (let index = 0; index < a.length; index += 4) {
          const delta = Math.max(...[0, 1, 2].map(channel => Math.abs(a[index + channel] - b[index + channel])))
          maxDelta = Math.max(maxDelta, delta)
          if (delta > 4) changedPixels++
        }
        return { maxDelta, changedPixels, count: a.length / 4 }
      }, { animated: animated.data, reference: reference.data })
      await writeFile(`${directory}/search-return-${label}-${time}.png`, Buffer.from(animated.data, 'base64'))
      await writeFile(`${directory}/search-return-${label}-${time}-reference.png`, Buffer.from(reference.data, 'base64'))
      frames.push({ ...frame, pixels })
      assert.equal(pixels.changedPixels, 0,
        `${label} at ${time}ms: moving glass must match its native contour; ${JSON.stringify(pixels)}`)
    } finally {
      await page.evaluate(() => {
        const shell = document.querySelector('.newtab-search-shell')
        const state = window.__curatorReturnContour
        shell.removeEventListener('transitionrun', state.freeze)
        if (state.style === null) shell.removeAttribute('style')
        else shell.setAttribute('style', state.style)
        state.animations?.forEach(animation => {
          if (animation.playState !== 'idle') animation.finish()
        })
        delete window.__curatorReturnContour
      })
    }
  }
  return frames
}
