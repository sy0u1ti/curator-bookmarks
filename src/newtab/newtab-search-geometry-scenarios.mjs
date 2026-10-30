import assert from 'node:assert/strict'

export function readSearchGeometry() {
  const field = document.querySelector('.newtab-search')
  const rect = field.getBoundingClientRect()
  const input = field.querySelector('input')
  const clear = field.querySelector('.newtab-search-clear')
  const submit = field.querySelector('.newtab-search-submit')
  const box = element => {
    const bounds = element.getBoundingClientRect()
    return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height, right: bounds.right, bottom: bounds.bottom }
  }
  return {
    viewport: { width: innerWidth, height: innerHeight },
    field: box(field),
    input: box(input),
    action: {
      query: input.value,
      clearAvailable: !clear.hidden && !clear.inert,
      canSubmit: submit ? !submit.disabled : null
    },
    controls: [...field.querySelectorAll('button')].filter(button => !button.hidden && button.checkVisibility()).map(button => {
      const bounds = button.getBoundingClientRect()
      return {
        label: button.getAttribute('aria-label'),
        targetHeight: button.offsetHeight,
        ...box(button),
        insetTop: bounds.top - rect.top,
        insetBottom: rect.bottom - bounds.bottom
      }
    }),
    horizontalOverflow: document.documentElement.scrollWidth - innerWidth
  }
}

export function assertSearchGeometry(geometry, label) {
  assert.ok(geometry.field.height >= 36, `${label}: the field must never be shorter than its safe minimum`)
  assert.ok(geometry.field.x >= -1 && geometry.field.right <= geometry.viewport.width + 1, `${label}: the field stays within the viewport`)
  assert.ok(geometry.input.width >= 48, `${label}: the input retains usable space`)
  assert.ok(geometry.horizontalOverflow <= 1, `${label}: no document overflow`)
  assert.equal(geometry.action.clearAvailable, Boolean(geometry.action.query), `${label}: the clear action matches the retained query`)
  if (geometry.action.canSubmit !== null) {
    assert.equal(geometry.action.canSubmit, Boolean(geometry.action.query.trim()), `${label}: the submit action matches the retained query`)
  }
  for (const control of geometry.controls) {
    assert.ok(control.targetHeight >= 24, `${label}: ${control.label} keeps a usable target`)
    assert.ok(control.insetTop >= 4 && control.insetBottom >= 4, `${label}: ${control.label} must clear the field border`)
    assert.ok(control.x >= geometry.field.x && control.right <= geometry.field.right, `${label}: ${control.label} stays inside the field`)
  }
  const ordered = [geometry.input, ...geometry.controls].sort((left, right) => left.x - right.x)
  for (let index = 1; index < ordered.length; index++) {
    assert.ok(ordered[index].x >= ordered[index - 1].right - 0.5, `${label}: input and controls must not overlap`)
  }
}

// The driver only needs standard Page operations; use the same cases with
// Ego's CDP viewport adapter and the extension's persistent-browser harness.
export async function verifySearchGeometryMatrix(page, setViewport) {
  const key = 'curatorBookmarkNewTabSearchSettings'
  const initial = await page.evaluate(async key => ({
    settings: (await chrome.storage.local.get(key))[key],
    query: document.querySelector('.newtab-search-input').value,
    viewport: { width: innerWidth, height: innerHeight }
  }), key)
  const results = []
  try {
    await page.fill('.newtab-search-input', 'Geometry regression')
    for (const width of [320, 390, 480, 520, 521, 768, 1440, 2560]) {
      await setViewport({ width, height: 900 })
      for (const [height, expected] of [[28, 36], [36, 36], [40, 40], [44, 44], [48, 48], [56, 56], [1000, 56]]) {
        await page.evaluate(async ({ key, height }) => {
          const stored = await chrome.storage.local.get(key)
          await chrome.storage.local.set({
            [key]: { ...stored[key], height, width: 16, engine: 'brave', webSearchEnabled: true }
          })
        }, { key, height })
        await page.waitForFunction(expected => document.querySelector('.newtab-search')?.getBoundingClientRect().height === expected, expected)
        await page.evaluate(async () => {
          await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
          await Promise.all(document.querySelector('.newtab-search-shell').getAnimations({ subtree: true })
            .filter(animation => animation.effect?.getTiming().iterations !== Infinity)
            .map(animation => animation.finished.catch(() => {})))
        })
        const geometry = await page.evaluate(readSearchGeometry)
        assert.equal(geometry.action.query, 'Geometry regression')
        assertSearchGeometry(geometry, `${width}px viewport, saved height ${height}`)
        results.push({ width, height, geometry })
      }
    }
    return results
  } finally {
    await page.evaluate(async ({ key, settings }) => chrome.storage.local.set({ [key]: settings }), { key, settings: initial.settings })
    await setViewport(initial.viewport)
    await page.fill('.newtab-search-input', initial.query)
  }
}
