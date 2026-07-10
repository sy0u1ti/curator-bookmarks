import {
  SMART_LOADING_PROGRESS_TARGETS,
  SMART_LOADING_PROGRESS_TICK_MS,
  SMART_LOADING_STAGE_STARTS,
  getNextSmartProgress,
  getSmartCheckpointProgress,
  getSmartDisplayProgress,
  getSmartProgressTarget,
  normalizeSmartLoadingStep
} from './smart-loading-progress.js'

function run(): void {
  testDisplayProgressHonorsStageStart()
  testProgressTargetsSplitTheTrackIntoEqualThirds()
  testCheckpointsMapWithinTheActiveStage()
  testLoadingProgressKeepsCreepingWithinTheStage()
  testAiStageKeepsMovingForTheMaximumRequestTimeout()
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

function testProgressTargetsSplitTheTrackIntoEqualThirds(): void {
  assertClose(SMART_LOADING_STAGE_STARTS[1], 100 / 3, 'step 2 start')
  assertClose(SMART_LOADING_STAGE_STARTS[2], 200 / 3, 'step 3 start')
  assertClose(getSmartProgressTarget(1), SMART_LOADING_PROGRESS_TARGETS[0], 'step 1 target')
  assertClose(getSmartProgressTarget(2), SMART_LOADING_PROGRESS_TARGETS[1], 'step 2 target')
  assertClose(getSmartProgressTarget(3), SMART_LOADING_PROGRESS_TARGETS[2], 'step 3 target')
  assert(normalizeSmartLoadingStep(99) === 3, 'step should clamp to the last stage')
}

function testCheckpointsMapWithinTheActiveStage(): void {
  assertClose(
    getSmartCheckpointProgress(2, 0),
    SMART_LOADING_STAGE_STARTS[1],
    'step 2 should begin at its real stage boundary'
  )
  assertClose(getSmartCheckpointProgress(2, 1), SMART_LOADING_PROGRESS_TARGETS[1], 'step 2 target')
  assertClose(getSmartCheckpointProgress(2, 0.5), 50, 'step 2 midpoint')
}

function testLoadingProgressKeepsCreepingWithinTheStage(): void {
  const currentProgress = 40
  const nextProgress = getNextSmartProgress(currentProgress, 2)
  assert(nextProgress > currentProgress, 'loading progress should keep moving between checkpoints')
  assert(nextProgress < SMART_LOADING_PROGRESS_TARGETS[1], 'loading progress must stay inside the active stage')
}

function testAiStageKeepsMovingForTheMaximumRequestTimeout(): void {
  let progress = getSmartCheckpointProgress(2, 0.36)
  const ticksAcrossTwoMinutes = Math.floor(120000 / SMART_LOADING_PROGRESS_TICK_MS)
  for (let tick = 0; tick < ticksAcrossTwoMinutes; tick += 1) {
    progress = getNextSmartProgress(progress, 2)
  }

  const nextProgress = getNextSmartProgress(progress, 2)
  assert(nextProgress > progress, 'AI progress should still be moving after a two-minute request')
  assert(nextProgress < SMART_LOADING_PROGRESS_TARGETS[1], 'AI progress should not cross into the next stage')
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
