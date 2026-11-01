interface RunPresentationInput {
  active: boolean
  startedAt: number
  completedAt: number
  resultCount: number
  hasError: boolean
  hasFilter?: boolean
}

/** Lifecycle facts, not translated labels, decide when run-only UI is useful. */
export function getRunPresentation(input: RunPresentationInput) {
  const hasResults = input.resultCount > 0
  const hasRun = input.active || input.startedAt > 0 || input.completedAt > 0
  const settled = input.completedAt > 0 || (input.startedAt > 0 && !input.active)
  return {
    progress: hasRun || hasResults || input.hasError,
    results: settled || hasResults || Boolean(input.hasFilter),
    filters: hasResults || Boolean(input.hasFilter)
  }
}
