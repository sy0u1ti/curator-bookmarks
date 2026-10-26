import assert from 'node:assert/strict'
import path from 'node:path'

export async function verifyBookmarkHover(page, tile, output) {
  const title = tile.locator('.bookmark-title')
  const deviceScaleFactor = await page.evaluate(() => devicePixelRatio)
  const resting = await tile.evaluate(readTitle)
  const titleBox = await title.boundingBox()
  const tileBox = await tile.boundingBox()
  const clip = {
    x: Math.floor(titleBox.x),
    y: Math.floor(titleBox.y) - 5,
    width: Math.floor(Math.min(titleBox.width, tileBox.x + tileBox.width - titleBox.x - 40)),
    height: Math.ceil(titleBox.height) + 10
  }
  assert.ok(clip.width > 20, 'The screenshot must contain actual bookmark text, not the menu trigger')

  const report = {}
  for (const direction of ['enter', 'leave']) {
    const recorder = await tile.evaluateHandle(element => {
      const title = element.querySelector('.bookmark-title')
      const neighbors = [...element.parentElement.querySelectorAll('.bookmark-tile')]
        .filter(tile => tile !== element).slice(0, 6)
        .map(tile => ({ tile, box: tile.getBoundingClientRect() }))
      const recording = { samples: [], frame: 0, maxNeighborShift: 0 }
      const sample = () => {
        const box = element.getBoundingClientRect()
        const text = title.getBoundingClientRect()
        recording.samples.push([text.x - box.x, text.y - box.y, text.width, text.height])
        for (const neighbor of neighbors) {
          const bounds = neighbor.tile.getBoundingClientRect()
          recording.maxNeighborShift = Math.max(recording.maxNeighborShift,
            ...['x', 'y', 'width', 'height'].map(key => Math.abs(bounds[key] - neighbor.box[key])))
        }
        recording.frame = requestAnimationFrame(sample)
      }
      sample()
      return recording
    })
    try {
      if (direction === 'enter') await tile.hover()
      else await page.mouse.move(10, 10)
      const motion = await tile.evaluateHandle(element => {
        const animations = element.getAnimations({ subtree: true })
        // Slow real playback to capture the last moving frames reliably. Pausing
        // or finish() changes rasterization and can hide the original snap.
        for (const animation of animations) animation.updatePlaybackRate(0.05)
        return animations.find(animation =>
          animation.transitionProperty === 'top' && animation.effect.target === element
        )
      })
      try {
        assert.equal(await motion.evaluate(animation => Boolean(animation)), true,
          'Hover must retain its relative-position lift')
        await page.waitForFunction(animation => animation &&
          Number(animation.currentTime) / Number(animation.effect.getTiming().duration) >= 0.9,
        motion, { timeout: 10_000 })
        const moving = await tile.evaluate(readTitle)
        assert.equal(await motion.evaluate(animation => animation.playState), 'running')
        const movingPng = await page.screenshot({ clip, path: path.join(output, `bookmark-title-${direction}-moving.png`) })
        assert.equal(await motion.evaluate(animation => animation.playState), 'running',
          'Capture a genuinely moving frame, not just two settled screenshots')
        await motion.evaluate(animation => animation.finished)
        const settledPng = await page.screenshot({ clip, path: path.join(output, `bookmark-title-${direction}-settled.png`) })
        const settled = await tile.evaluate(readTitle)
        const pixels = await page.evaluate(compareGlyphPixels, {
          moving: movingPng.toString('base64'),
          settled: settledPng.toString('base64')
        })
        assert.ok(Math.abs(pixels.width - clip.width * deviceScaleFactor) <= 1,
          'The screenshot must retain the actual device pixel ratio')
        assert.ok(Math.abs(moving.y - settled.y) < 0.02, 'Compare the near-stationary end of the lift')
        assert.ok(pixels.ink > 20, 'The pixel check must sample glyphs')
        assert.ok(pixels.changed <= Math.max(8, pixels.ink * 0.01),
          `${direction}: glyphs re-snapped as the card settled (${pixels.changed}/${pixels.ink} ink pixels changed)`)
        assert.equal(settled.font, resting.font)
        assert.equal(settled.transform, 'none', 'The title must not acquire an independent transform')
        assert.equal(settled.willChange, 'auto', 'The title must not require a separate compositor layer')
        const { samples, maxNeighborShift } = await recorder.evaluate(recording => ({
          samples: recording.samples, maxNeighborShift: recording.maxNeighborShift
        }))
        assert.ok(samples.length > 2)
        assert.ok(maxNeighborShift < 0.01, 'The relative lift must not reflow neighboring tiles')
        for (const sample of samples) {
          for (let index = 0; index < sample.length; index++) {
            assert.ok(Math.abs(sample[index] - samples[0][index]) < 0.01,
              `${direction}: text must retain its offset and dimensions inside the card`)
          }
        }
        report[direction] = { samples: samples.length, maxNeighborShift, ...pixels }
      } finally {
        await motion.dispose()
      }
    } finally {
      await recorder.evaluate(recording => cancelAnimationFrame(recording.frame))
      await recorder.dispose()
    }
  }

  for (let pass = 0; pass < 3; pass++) {
    await tile.hover()
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    await page.mouse.move(10, 10)
    const exited = await tile.evaluate(readTitle)
    assert.equal(exited.border, resting.border, 'Interrupted hover must not leave a bright border')
    assert.equal(exited.overlay, '0', 'Interrupted hover must not leave a fading highlight')
    assert.equal(exited.willChange, resting.willChange, 'Rapid hovering must not recreate the text layer')
  }
  await tile.evaluate(element => Promise.all(element.getAnimations({ subtree: true }).map(animation => animation.finished.catch(() => {}))))
  return { ...report, rapidPasses: 3 }
}

function readTitle(element) {
  const title = element.querySelector('.bookmark-title')
  const style = getComputedStyle(title)
  return {
    y: title.getBoundingClientRect().y,
    font: style.font,
    transform: style.transform,
    willChange: style.willChange,
    border: getComputedStyle(element).borderColor,
    overlay: getComputedStyle(element, '::before').opacity
  }
}

async function compareGlyphPixels({ moving, settled }) {
  const read = async source => {
    const image = new Image()
    image.src = `data:image/png;base64,${source}`
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = image.width
    canvas.height = image.height
    const context = canvas.getContext('2d')
    context.drawImage(image, 0, 0)
    return { data: context.getImageData(0, 0, canvas.width, canvas.height).data, width: canvas.width }
  }
  const [firstImage, secondImage] = await Promise.all([read(moving), read(settled)])
  const first = firstImage.data
  const second = secondImage.data
  let ink = 0
  let changed = 0
  for (let pixel = 0; pixel < first.length; pixel += 4) {
    // This fixture's glass is dark: compare the light glyphs, not its changing tint.
    if (Math.max(first[pixel], second[pixel]) < 90) continue
    ink++
    const delta = Math.abs(first[pixel] - second[pixel]) +
      Math.abs(first[pixel + 1] - second[pixel + 1]) +
      Math.abs(first[pixel + 2] - second[pixel + 2])
    if (delta > 12) changed++
  }
  return { width: firstImage.width, ink, changed }
}
