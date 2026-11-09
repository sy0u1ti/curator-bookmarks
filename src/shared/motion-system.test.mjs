import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { build } from 'esbuild'

const { outputFiles } = await build({
  entryPoints: ['src/shared/motion-spring.ts'], bundle: true, platform: 'node', format: 'esm', write: false
})
const { advanceSpring, springSettled, DEFAULT_SPRING } =
  await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`)
const read = path => readFileSync(path, 'utf8')
const tokens = read('src/styles/tokens.css').split('@supports')[0]
function token(name) {
  const value = tokens.match(new RegExp(`${name}:\\s*([^;]+)`))?.[1]
  assert.ok(value, `Missing motion token ${name}`)
  return value.replace(/var\((--[\w-]+)\)/g, (_, reference) => token(reference))
}
function at(seconds, fps = 60, target = 200) {
  const axis = { position: 0, velocity: 0 }
  for (let time = 0; time < seconds - 1e-8; time += 1 / fps) advanceSpring(axis, target, Math.min(1 / fps, seconds - time))
  return axis
}

test('selection uses the measured Magpie spring, with frame-rate-independent integration', () => {
  assert.equal(Number.parseFloat(token('--ds-spring-response')) / 1000, DEFAULT_SPRING.response)
  assert.equal(Number(token('--ds-spring-damping')), DEFAULT_SPRING.damping)
  for (const time of [0.1, 0.3, 0.6]) {
    const positions = [30, 60, 120, 144].map(fps => at(time, fps).position)
    assert.ok(Math.max(...positions) - Math.min(...positions) < 2, `${time}s: ${positions}`)
  }
  assert.ok(springSettled(at(0.8), 200))
})

test('rapid reversal preserves position and momentum instead of restarting a timed curve', () => {
  const axis = at(0.1)
  const before = { ...axis }
  advanceSpring(axis, -100, 0.001)
  assert.ok(axis.position > before.position, 'Existing forward momentum survives the retarget')
  assert.ok(axis.velocity > 0 && axis.velocity < before.velocity)
  for (let frame = 0; frame < 90; frame++) advanceSpring(axis, -100, 1 / 60)
  assert.ok(springSettled(axis, -100))
})

test('a suspended frame cannot explode the spring', () => {
  const long = { position: 0, velocity: 0 }
  const bounded = { ...long }
  advanceSpring(long, 200, 10)
  advanceSpring(bounded, 200, 1 / 30)
  assert.deepEqual(long, bounded)
})

test('sidebar hover keeps native text ink and cannot write light into adjacent rows', () => {
  const css = read('src/options/options.css')
  const motion = read('src/options/options-sidebar-motion.ts')
  assert.ok(!motion.includes('pointermove') && !motion.includes('attachPointerLight'))
  assert.ok(!css.includes('background-clip: text') && !css.includes('is-pointer-lit'))
  assert.ok(css.includes('.options-nav-link:hover .options-nav-label'))
  assert.ok(!css.includes('.options-nav-active-indicator::before'))
  assert.ok(css.includes('inset 0 0.5px 0 var(--options-nav-selection-rim)'))
})

test('navigation groups follow the current route and retain separate parent and child highlights', () => {
  const app = read('src/options/OptionsApp.tsx')
  const motion = read('src/options/options-sidebar-motion.ts')
  assert.ok(app.includes('const availabilityOpen = availabilitySectionKeys.has(activeSectionKey)'))
  assert.ok(!app.includes('setAvailabilityOpen'))
  assert.ok(app.includes('aria-current={availabilityOpen ? \'true\' : undefined}'))
  assert.ok(app.includes('navSubIndicatorClass') && app.includes('inert={!availabilityOpen}'))
  assert.ok(motion.includes('.options-nav-trigger[data-active]'))
  assert.ok(motion.includes('.options-nav-sub-indicator') && motion.includes('positionSublists'))
})

test('opening a settings panel leaves the main thread free for the sidebar slide', () => {
  const storage = read('src/options/components/StorageManagement.tsx')
  const app = read('src/options/OptionsApp.tsx')
  assert.ok(storage.includes('requestStorageUsage()') && !storage.includes('getStorageUsage'),
    'The storage inventory reads all of storage and must stay in the worker')
  assert.ok(app.includes('runIdle(preloadOptionsPanels'),
    'Lazy panels preload so navigation does not commit a suspended panel mid-slide')
})

test('motion roles separate feedback, state and surfaces without delaying opacity', () => {
  const ms = name => Number.parseFloat(token(name))
  assert.ok(ms('--ds-motion-feedback') <= ms('--ds-motion-fast'))
  assert.ok(ms('--ds-motion-fast') < ms('--ds-motion-state'))
  assert.ok(ms('--ds-motion-state') < ms('--ds-motion-surface'))
  for (const role of ['dropdown', 'modal', 'panel']) {
    assert.ok(ms(`--${role}-close-dur`) < ms(`--${role}-open-dur`))
  }
  assert.ok(ms('--ds-motion-enter-opacity') < ms('--dropdown-open-dur'))
  assert.ok(ms('--modal-opacity-in') < ms('--modal-open-dur'))
  assert.equal(token('--toggle-ease'), token('--ds-ease-standard'))
  assert.equal(token('--acc-ease'), token('--ds-ease-settle'))
  assert.equal(ms('--acc-content-delay'), 0, 'Ordinary disclosures have no choreographed delay')
  assert.ok(ms('--nav-content-delay') + 5 * ms('--duration-stagger') < 300)
})

test('sidebar and reasoning slider share the solver while value controls settle without overshoot', () => {
  const sidebar = read('src/options/options-sidebar-motion.ts')
  const slider = read('src/options/components/ReasoningEffortSelector.tsx')
  const chrome = read('src/options/components/options-chrome-classes.ts')
  for (const source of [sidebar, slider]) {
    assert.ok(source.includes('advanceSpring(') && source.includes('shouldSkipMotion()'))
  }
  assert.ok(sidebar.includes('getMotionSpring('))
  assert.ok(slider.includes("getMotionDurationMs('--slider-grip-settle'") && slider.includes('damping: 1'))
  assert.ok(!slider.includes('SPRING_STIFFNESS') && !slider.includes('SPRING_DAMPING'))
  assert.ok(!chrome.includes('options-nav-active-indicator-exit'))
  assert.ok(!/\[--acc-[\w-]+:\d/.test(chrome), 'Sidebar timings must not fork the shared roles')
  assert.ok(sidebar.includes('cancelAnimationFrame(frame)') && sidebar.includes('observer.disconnect()'))
})

test('text fields mark focus with one eased stroke', () => {
  const motion = read('src/styles/controls-motion.css')
  const fieldMotion = motion.slice(motion.indexOf('.base-input,'), motion.indexOf('.options-switch-thumb'))
  assert.ok(fieldMotion.includes('border-color var(--ds-motion-standard)'))
  for (const file of [
    'src/ui/base/Input.tsx',
    'src/ui/base/Textarea.tsx',
    'src/options/components/ai-provider-settings-classes.ts',
    'src/options/components/AiAnalysisResultsFilter.tsx',
    'src/popup/components/PopupContent.tsx',
    'src/popup/components/PopupModalsHost.tsx',
    'src/popup/components/PopupSmartClassifier.tsx',
    'src/newtab/components/SettingsDrawer.tsx',
    'src/newtab/components/BookmarkMenusHost.tsx'
  ]) {
    assert.doesNotMatch(read(file), /(?<![\w-])focus(?:-within)?:(?:shadow-ds|\[outline|outline\b)/, file)
  }
})

test('keyboard policy removes interpolation, not truthful transforms or busy indicators', () => {
  const css = read('src/styles/globals.css')
  const policy = css.slice(css.indexOf('/* Keyboard input'), css.indexOf('@media (pointer: coarse)'))
  assert.ok(policy.includes('transition-duration: 0s !important'))
  assert.ok(policy.includes('transition-delay: 0s !important'))
  assert.ok(!policy.includes('transform: none') && !policy.includes('animation-duration:'))
  assert.ok(read('src/ui/theme/ThemeProvider.tsx').includes('observeMotionPreferences'))
  assert.ok(read('src/shared/motion-preferences.ts').includes("document.addEventListener('keydown', onKey, true)"))
  assert.ok(read('src/shared/motion-preferences.ts').includes('root.dataset.motionInput !== input'),
    'Pointer movement and key repeat must not rewrite the root attribute each time')
})
