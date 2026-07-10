import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const componentSource = readFileSync(
  resolve(process.cwd(), 'src/popup/components/PopupSmartClassifier.tsx'),
  'utf8'
)
const controllerSource = readFileSync(
  resolve(process.cwd(), 'src/popup/popup-controller.ts'),
  'utf8'
)
const popupCssSource = readFileSync(
  resolve(process.cwd(), 'src/popup/popup.css'),
  'utf8'
)
const smartClassifierSource = readFileSync(
  resolve(process.cwd(), 'src/popup/smart-classifier.ts'),
  'utf8'
)
const progressClassSource = componentSource.match(
  /const progressBarClass = \[[\s\S]*?\]\.join\(' '\)/
)?.[0] || ''

assert(progressClassSource.includes('transition-transform'), 'smart progress should animate with transform')
assert(progressClassSource.includes('duration-[320ms] ease-linear'), 'smart progress should use a continuous linear crawl')
assert(progressClassSource.includes('rgba(237,237,237,0.86)'), 'smart progress should use the Geist gray-white fill')
assert(!progressClassSource.includes('--ds-accent'), 'smart progress should not use the blue accent token')
assert(!progressClassSource.includes('--ds-focus'), 'smart progress should not use the blue focus token')
assert(componentSource.includes('<NumberPop text={`${loadingPercent}%`} />'), 'smart progress should show its visible percentage')
assert(
  /prefers-reduced-motion[\s\S]*?\.smart-progress-bar::after[\s\S]*?animation:\s*none\s*!important/.test(popupCssSource),
  'reduced motion should stop the progress sheen'
)
assert(popupCssSource.includes('left: 33.333333%'), 'first smart progress divider should mark one third')
assert(popupCssSource.includes('left: 66.666667%'), 'second smart progress divider should mark two thirds')
assert(controllerSource.includes('startSmartProgressTicker(runId)'), 'smart progress should keep creeping while loading')

const contextIndex = controllerSource.indexOf('await smartClassifier.buildCurrentPageContext')
const aiStageIndex = controllerSource.indexOf('advanceSmartProgressStage(runId, 2)')
const aiRequestIndex = controllerSource.indexOf('await smartClassifier.requestSmartClassification')
const matchingStageIndex = controllerSource.indexOf('advanceSmartProgressStage(runId, 3)')
assert(contextIndex >= 0 && contextIndex < aiStageIndex, 'AI stage must begin after page context is ready')
assert(aiStageIndex < aiRequestIndex, 'AI stage must contain the AI request')
assert(aiRequestIndex < matchingStageIndex, 'matching stage must begin after the AI response is ready')

const smartRequestStart = smartClassifierSource.indexOf('export async function requestSmartClassification')
const providerRequestStart = smartClassifierSource.indexOf(
  'const result = await requestStructuredAiOutput',
  smartRequestStart
)
const progressBeforeProviderResponse = smartClassifierSource.slice(smartRequestStart, providerRequestStart)
assert(
  !progressBeforeProviderResponse.includes('reportSmartProgress(onProgress'),
  'AI stage should creep from one third instead of jumping before the provider responds'
)

function assert(value: unknown, message: string): void {
  if (!value) {
    throw new Error(message)
  }
}

console.log('Popup smart progress style tests passed.')
