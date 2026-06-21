export type ResultsPaginationDirection = 'next' | 'prev'

export interface ResultsPaginationActionDetail {
  direction: ResultsPaginationDirection
  kind: string
}

export interface ResultsPaginationState {
  end: number
  kind: string
  label: string
  page: number
  start: number
  totalCount: number
  totalPages: number
  visible: boolean
}
