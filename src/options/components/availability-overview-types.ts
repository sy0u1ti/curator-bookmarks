export interface AvailabilityProgressState {
  busy: boolean
  durationLabel: string
  progressLabel: string
  progressValue: number
  statusCopy: string
}

export interface AvailabilityDecisionMetricsState {
  ignored: string
  newCount: string
  persistent: string
  progress: string
  recovered: string
  scope: string
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
  | 'demote-selection'
  | 'filter-change'
  | 'ignore-bookmarks'
  | 'ignore-domains'
  | 'ignore-folders'
  | 'move-selection'
  | 'promote-selection'
  | 'retest-selection'
  | 'select-failed'
  | 'select-review'

export interface AvailabilityPanelActionDetail {
  action: AvailabilityPanelAction
  filter?: string
}

export interface AvailabilityResultsHeaderState {
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
  demoteDisabled: boolean
  hidden: boolean
  ignoreBookmarkDisabled: boolean
  ignoreDomainDisabled: boolean
  ignoreFolderDisabled: boolean
  moveDisabled: boolean
  promoteDisabled: boolean
  retestDisabled: boolean
  retestLabel: string
}
