export interface AvailabilityProgressState {
  busy: boolean
  visible: boolean
  durationLabel: string
  progressLabel: string
  progressValue: number
  statusCopy: string
}

export interface AvailabilityDecisionMetricsState {
  ignored: string
  newCount: string
  persistent: string
  recovered: string
}

export interface AvailabilityFilterButtonViewModel {
  active: boolean
  count: number
  filter: string
  label: string
}

export interface AvailabilityFiltersState {
  filters: AvailabilityFilterButtonViewModel[]
}

export type AvailabilityPanelAction =
  | 'clear-selection'
  | 'delete-failed'
  | 'delete-selected'
  | 'filter-change'
  | 'ignore-bookmarks'
  | 'ignore-domains'
  | 'ignore-folders'
  | 'move-selection'
  | 'retest-selection'
  | 'select-failed'
  | 'select-review'

export interface AvailabilityPanelActionDetail {
  action: AvailabilityPanelAction
  filter?: string
}

export interface AvailabilityResultsHeaderState {
  visible: boolean
  reviewVisible?: boolean
  failedVisible?: boolean
  reviewSelectable?: boolean
  failedSelectable?: boolean
  deleteFailedDisabled: boolean
  deleteFailedLabel: string
  failedCount: string
  failedLastRun: string
  failedTitle: string
  reviewCount: string
  reviewSubtitle: string
  reviewTitle: string
}

export interface AvailabilitySelectionActionsState {
  clearDisabled: boolean
  countLabel: string
  deleteDisabled: boolean
  hidden: boolean
  ignoreBookmarkDisabled: boolean
  ignoreDomainDisabled: boolean
  ignoreFolderDisabled: boolean
  moveDisabled: boolean
  retestDisabled: boolean
  retestLabel: string
}
