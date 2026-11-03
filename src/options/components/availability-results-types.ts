export type AvailabilityResultPanelKind = 'review' | 'failed'

export interface AvailabilityQuickActionViewModel {
  action: 'hide-run' | 'ignore-bookmark' | 'ignore-domain' | 'ignore-folder'
  disabled: boolean
  impact: string
  label: string
}

export type AvailabilityResultActionDetail =
  | {
      action: 'toggle-selection'
      bookmarkId: string
      checked: boolean
      panel: AvailabilityResultPanelKind
    }
  | {
      action: 'retest' | 'delete'
      bookmarkId: string
      panel: AvailabilityResultPanelKind
    }
  | {
      action: AvailabilityQuickActionViewModel['action']
      bookmarkId: string
      panel: AvailabilityResultPanelKind
    }

export interface AvailabilityResultCardViewModel {
  badgeText: string
  bookmarkId: string
  evidenceCopy: string
  finalUrl: string
  metadataItems: string[]
  openLabel: string
  path: string
  quickActions: AvailabilityQuickActionViewModel[]
  summary: string
  retestDisabled: boolean
  retestLabel?: string
  deleteDisabled?: boolean
  selectable: boolean
  selected: boolean
  selectionDisabled: boolean
  selectionLabel: string
  showFinalUrl: boolean
  statusLabel: string
  title: string
  tone: string
  url: string
}

export interface AvailabilityResultsState {
  emptyMessage: string
  results: AvailabilityResultCardViewModel[]
}
