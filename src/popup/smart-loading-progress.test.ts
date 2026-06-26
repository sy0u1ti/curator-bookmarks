import {
  SMART_LOADING_PROGRESS_TARGETS,
  SMART_LOADING_STAGE_STARTS,
  advanceSmartProgressToStageStart,
  getNextSmartProgress,
  getSmartDisplayProgress,
  getSmartProgressTarget,
  normalizeSmartLoadingStep
} from './smart-loading-progress.js'

function run(): void {
  testDisplayProgressHonorsStageStart()
  testProgressTargetsMatchThreeStages()
  testTickerCatchesUpToStageStart()
  testTickerCrawlsInsideAiStage()
}

function testDisplayProgressHonorsStageStart(): void {
  assertClose(
    getSmartDisplayProgress(18, 2),
    SMART_LOADING_STAGE_STARTS[1],
    'step 2 display progress should start at the first divider'
  )
  assertClose(
    getSmartDisplayProgress(42, 3),
    SMART_LOADING_STAGE_STARTS[2],
    'step 3 display progress should start at the second divider'
  )
}

function testProgressTargetsMatchThreeStages(): void {
  assertClose(getSmartProgressTarget(1), SMART_LOADING_PROGRESS_TARGETS[0], 'step 1 target')
  assertClose(getSmartProgressTarget(2), SMART_LOADING_PROGRESS_TARGETS[1], 'step 2 target')
  assertClose(getSmartProgressTarget(3), SMART_LOADING_PROGRESS_TARGETS[2], 'step 3 target')
  assert(normalizeSmartLoadingStep(99) === 3, 'step should clamp to the last stage')
}

function testTickerCatchesUpToStageStart(): void {
  let progress = 18
  for (let index = 0; index < 16; index += 1) {
    progress = getNextSmartProgress(progress, 2)
  }

  assert(
    progress >= SMART_LOADING_STAGE_STARTS[1],
    'step 2 ticker should catch up to the first divider'
  )
  assertClose(
    advanceSmartProgressToStageStart(18, 2),
    SMART_LOADING_STAGE_STARTS[1],
    'stage start advancement should snap internal progress to the divider'
  )
}

function testTickerCrawlsInsideAiStage(): void {
  const progress = getNextSmartProgress(40, 2)

  assert(progress > 40, 'step 2 ticker should keep moving while AI work is running')
  assert(
    progress < SMART_LOADING_PROGRESS_TARGETS[1],
    'step 2 ticker should not jump straight to the next stage'
  )
}

function assert(value: unknown, message: string): void {
  if (!value) {
    throw new Error(message)
  }
}

function assertClose(actual: number, expected: number, message: string): void {
  if (Math.abs(actual - expected) > 0.001) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`)
  }
}

run()
console.log('Smart loading progress tests passed.')
