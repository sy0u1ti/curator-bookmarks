export const SMART_LOADING_STEP_COUNT = 3
export const SMART_LOADING_STAGE_STARTS = [0, 100 / 3, 200 / 3] as const
export const SMART_LOADING_PROGRESS_TARGETS = [100 / 3, 200 / 3, 100] as const
export const SMART_LOADING_PROGRESS_TICK_MS = 80
export const SMART_LOADING_PROGRESS_TRANSITION_MS = 420
export const SMART_LOADING_PROGRESS_SETTLE_MS = 120
export const SMART_LOADING_PROGRESS_COMPLETE_MS =
  SMART_LOADING_PROGRESS_TRANSITION_MS + SMART_LOADING_PROGRESS_SETTLE_MS

export function normalizeSmartLoadingStep(rawStep: number): number {
  const numericStep = Number(rawStep)
  const step = Number.isFinite(numericStep) ? Math.trunc(numericStep) : 1
  return Math.max(1, Math.min(step || 1, SMART_LOADING_STEP_COUNT))
}

export function getSmartStageStart(rawStep: number): number {
  const step = normalizeSmartLoadingStep(rawStep)
  return SMART_LOADING_STAGE_STARTS[step - 1] ?? 0
}

export function getSmartProgressTarget(rawStep: number): number {
  const step = normalizeSmartLoadingStep(rawStep)
  return SMART_LOADING_PROGRESS_TARGETS[step - 1] ?? SMART_LOADING_PROGRESS_TARGETS[0]
}

export function getSmartDisplayProgress(rawProgress: number, rawStep: number): number {
  const step = normalizeSmartLoadingStep(rawStep)
  const stageStart = getSmartStageStart(step)
  const targetProgress = getSmartProgressTarget(step)
  const progress = normalizeSmartProgressValue(rawProgress)
  return Math.max(stageStart, Math.min(progress, targetProgress))
}

export function advanceSmartProgressToStageStart(rawProgress: number, rawStep: number): number {
  return Math.max(normalizeSmartProgressValue(rawProgress), getSmartStageStart(rawStep))
}

export function getNextSmartProgress(currentProgress: number, rawStep: number): number {
  const step = normalizeSmartLoadingStep(rawStep)
  const stageStart = getSmartStageStart(step)
  const targetProgress = getSmartProgressTarget(step)
  const current = Math.max(0, Math.min(normalizeSmartProgressValue(currentProgress), targetProgress))

  if (current < stageStart) {
    const catchUpDelta = stageStart - current
    return Math.min(stageStart, current + Math.max(2.2, catchUpDelta * 0.28))
  }

  const remaining = targetProgress - current
  if (remaining <= 0.08) {
    return current
  }

  const easing = step === 1 ? 0.12 : step === 2 ? 0.006 : 0.035
  const minimumStep = step === 1 ? 1.15 : step === 2 ? 0.06 : 0.28
  return Math.min(targetProgress - 0.02, current + Math.max(minimumStep, remaining * easing))
}

function normalizeSmartProgressValue(value: number): number {
  const numericValue = Number(value)
  const progress = Number.isFinite(numericValue) ? numericValue : 0
  return Math.max(0, Math.min(progress, 100))
}
