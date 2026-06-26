import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { SMART_LOADING_STAGE_STARTS } from '../smart-loading-progress.js'
import { PopupSmartClassifier } from './PopupSmartClassifier'
import type { PopupSmartClassifierViewModel } from './PopupViewModels.js'

function run(): void {
  testLoadingProgressIsClampedToVisibleStage()
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
