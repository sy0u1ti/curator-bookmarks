import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { SMART_LOADING_STAGE_STARTS } from '../smart-loading-progress.js'
import { EMPTY_POPUP_SMART_CLASSIFIER } from '../popup-controller-store.js'
import { PopupSmartClassifier } from './PopupSmartClassifier'
import type { PopupSmartClassifierViewModel, PopupSmartPageViewModel } from './PopupViewModels.js'

function run(): void {
  testLoadingProgressIsClampedToVisibleStage()
  testInitialSmartClassifierStateUsesStablePlaceholder()
  testReadyPageRevealLayersAvoidConflictingOpacityUtilities()
}

function testLoadingProgressIsClampedToVisibleStage(): void {
  const rawProgress = 14.7
  const markup = renderToStaticMarkup(
    createElement(PopupSmartClassifier, {
      state: {
        ...getBaseSmartClassifierState(),
        loadingLabel: 'AI 分析内容…',
        loadingProgress: rawProgress,
        loadingStartProgress: rawProgress,
        loadingStep: 2,
        status: 'loading'
      }
    })
  )

  const target = getNumericAttribute(markup, 'data-smart-progress-target')
  assert(
    target >= SMART_LOADING_STAGE_STARTS[1],
    `step 2 progress should render at the first divider, got ${target}`
  )
  assert(!markup.includes('scaleX('), 'progress indicator should not scale an already width-based bar')
}

function testInitialSmartClassifierStateUsesStablePlaceholder(): void {
  const markup = renderToStaticMarkup(
    createElement(PopupSmartClassifier, {
      state: EMPTY_POPUP_SMART_CLASSIFIER
    })
  )

  assert(markup.includes('data-state="ready"'), 'initial smart classifier should use the stable ready placeholder')
  assert(!markup.includes('aria-busy="true"'), 'initial smart classifier should not announce a loading page')
  assert(markup.includes('当前标签页'), 'initial smart classifier should reserve the current-page row')
}

function testReadyPageRevealLayersAvoidConflictingOpacityUtilities(): void {
  const markup = renderToStaticMarkup(
    createElement(PopupSmartClassifier, {
      state: {
        ...getBaseSmartClassifierState(),
        page: getLoadedPageState(),
        status: 'idle'
      }
    })
  )

  assert(markup.includes('data-state="ready"'), 'ready reveal shell should expose ready state')
  const layerClasses = Array.from(markup.matchAll(/class="([^"]*popup-page-(?:skeleton|content)[^"]*)"/g), (match) => match[1])
  assert(layerClasses.length === 2, `ready reveal should render skeleton and content layers, got ${layerClasses.length}`)
  for (const className of layerClasses) {
    assert(!/\bopacity-(?:0|100)\b/.test(className), `reveal layer should not use conflicting opacity utilities: ${className}`)
  }
}

function getBaseSmartClassifierState(): PopupSmartClassifierViewModel {
  return {
    error: '',
    loadingLabel: '',
    loadingProgress: 0,
    loadingStartProgress: 0,
    loadingStep: 1,
    loadingStepCount: 3,
    page: null,
    permissionOrigins: [],
    recommendations: [],
    saved: false,
    saving: false,
    status: 'hidden',
    suggestedTitle: ''
  }
}

function getLoadedPageState(): PopupSmartPageViewModel {
  return {
    bookmarked: false,
    fallbackIcon: '小',
    favicon: '',
    pinLabel: '固定',
    pinPending: false,
    pinned: false,
    status: '未收藏 · 可快速保存到文件夹',
    statusTitle: '未收藏 · 可快速保存到文件夹',
    title: '小红书体育的小红书直播间'
  }
}

function getNumericAttribute(markup: string, name: string): number {
  const match = markup.match(new RegExp(`${name}="([^"]+)"`))
  if (!match) {
    throw new Error(`missing ${name} in rendered markup`)
  }
  const value = Number(match[1])
  if (!Number.isFinite(value)) {
    throw new Error(`${name} is not numeric: ${match[1]}`)
  }
  return value
}

function assert(value: unknown, message: string): void {
  if (!value) {
    throw new Error(message)
  }
}

run()
console.log('Popup smart classifier tests passed.')
