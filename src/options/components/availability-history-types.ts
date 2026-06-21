export interface AvailabilityHistoryControlsState {
  clearDisabled: boolean
  logCount: number
  logToggleDisabled: boolean
  logToggleLabel: string
  metrics: {
    newCount: number
    persistentCount: number
    recoveredCount: number
  }
  subtitle: string
  timestamp: string
}

export interface AvailabilityHistoryResultViewModel {
  id: string
  title: string
  url: string
  path: string
  status: string
  streak: number
}

export interface AvailabilityHistoryRunViewModel {
  runId: string
  completedAt: number
  scope?: {
    label?: string
    key?: string
  }
  results: AvailabilityHistoryResultViewModel[]
  newResults: AvailabilityHistoryResultViewModel[]
  recoveredResults: AvailabilityHistoryResultViewModel[]
  summary?: {
    totalAbnormal?: number
    newCount?: number
    persistentCount?: number
    recoveredCount?: number
    reviewCount?: number
    failedCount?: number
  }
}

export interface AvailabilityHistoryLogState {
  collapsed: boolean
  emptyCopy: string
  maxAbnormalCount: number
  runs: AvailabilityHistoryRunViewModel[]
}

export interface AvailabilityRecoveredHistoryState {
  emptyCopy: string
  results: AvailabilityHistoryResultViewModel[]
}

export interface AvailabilityHistoryState {
  controls: AvailabilityHistoryControlsState
  log: AvailabilityHistoryLogState
  recovered: AvailabilityRecoveredHistoryState
}
