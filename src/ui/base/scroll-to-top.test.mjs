import assert from 'node:assert/strict'
import { test } from 'node:test'
import { build } from 'esbuild'

const { outputFiles } = await build({
  stdin: {
    contents: `
      export { computeNextScrollToTopVisible, DEFAULT_SCROLL_TOP_THRESHOLD } from './src/ui/base/ScrollToTopButton';
      export { computeOptionsScrollTopPlacement } from './src/options/components/OptionsScrollToTop';
    `,
    loader: 'ts',
    resolveDir: process.cwd()
  },
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
  plugins: [{
    name: 'stub-ui-deps',
    setup(builder) {
      builder.onResolve({ filter: /^(react|react-dom|react\/jsx-runtime|\.\.\/icons\/Icon)$/ }, (args) => ({
        path: args.path,
        namespace: 'stub'
      }))
      builder.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({
        contents: 'export default {}; export const useCallback = () => {}; export const useEffect = () => {}; export const useLayoutEffect = () => {}; export const useMemo = () => {}; export const useRef = () => ({}); export const useState = () => [false, () => {}]; export const useSyncExternalStore = () => null; export const createPortal = () => null; export const jsx = () => null; export const jsxs = () => null; export const Icon = () => null;',
        loader: 'js'
      }))
    }
  }]
})

const {
  computeNextScrollToTopVisible,
  DEFAULT_SCROLL_TOP_THRESHOLD,
  computeOptionsScrollTopPlacement
} = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`)

test('scroll-to-top visibility uses threshold hysteresis and respects suppression', () => {
  assert.equal(DEFAULT_SCROLL_TOP_THRESHOLD, 320)
  assert.equal(computeNextScrollToTopVisible({ scrollTop: 0, currentVisible: false, threshold: 320 }), false)
  assert.equal(computeNextScrollToTopVisible({ scrollTop: 319, currentVisible: false, threshold: 320 }), false)
  assert.equal(computeNextScrollToTopVisible({ scrollTop: 320, currentVisible: false, threshold: 320 }), true)
  // Stays visible between hide threshold (208) and show threshold (320) to prevent edge jitter.
  assert.equal(computeNextScrollToTopVisible({ scrollTop: 260, currentVisible: true, threshold: 320 }), true)
  assert.equal(computeNextScrollToTopVisible({ scrollTop: 207, currentVisible: true, threshold: 320 }), false)
  assert.equal(computeNextScrollToTopVisible({ scrollTop: 800, currentVisible: true, threshold: 320, suppressed: true }), false)
  assert.equal(computeNextScrollToTopVisible({ scrollTop: Number.NaN, currentVisible: true, threshold: 320 }), false)
})

test('OptionsScrollToTop anchors beside the content column on ultrawide displays without overlapping floating layers', () => {
  const ultrawide = computeOptionsScrollTopPlacement({
    viewportWidth: 3440,
    mainRight: 3440,
    panelRight: 2402,
    dock: { left: 1322, right: 2362, bottom: 16, height: 64 },
    toastOpen: true
  })
  assert.deepEqual(ultrawide, { left: 2422, bottom: 24, lift: 0 })
})

test('OptionsScrollToTop clamps cleanly on desktop and lifts above SelectionDock or UndoToast when horizontally overlapping', () => {
  const desktopAtRest = computeOptionsScrollTopPlacement({
    viewportWidth: 1440,
    mainRight: 1440,
    panelRight: 1397,
    dock: null,
    toastOpen: false
  })
  assert.deepEqual(desktopAtRest, { left: 1362, bottom: 24, lift: 0 })

  const desktopWithDock = computeOptionsScrollTopPlacement({
    viewportWidth: 1440,
    mainRight: 1440,
    panelRight: 1397,
    dock: { left: 322, right: 1362, bottom: 16, height: 68 },
    toastOpen: false
  })
  assert.equal(desktopWithDock.left, 1362)
  assert.equal(desktopWithDock.lift, 76)

  const desktopWithToast = computeOptionsScrollTopPlacement({
    viewportWidth: 1440,
    mainRight: 1440,
    panelRight: 1397,
    dock: null,
    toastOpen: true
  })
  assert.equal(desktopWithToast.lift, 80)
})

test('OptionsScrollToTop aligns to the bottom-right corner on mobile and lifts clear of dock/toast', () => {
  const mobile = computeOptionsScrollTopPlacement({
    viewportWidth: 390,
    mainRight: 376,
    panelRight: 376,
    dock: null,
    toastOpen: false
  })
  assert.deepEqual(mobile, { left: 334, bottom: 16, lift: 0 })

  const mobileWithToast = computeOptionsScrollTopPlacement({
    viewportWidth: 390,
    mainRight: 376,
    panelRight: 376,
    dock: null,
    toastOpen: true
  })
  assert.equal(mobileWithToast.lift, 88)
})
