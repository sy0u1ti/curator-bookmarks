export interface RedirectResultViewModel {
  id: string
  title: string
  url: string
  finalUrl: string
  path: string
}

export interface RedirectResultsState {
  emptyMessage: string
  locked: boolean
  results: RedirectResultViewModel[]
  selectedIds: Set<unknown>
}
