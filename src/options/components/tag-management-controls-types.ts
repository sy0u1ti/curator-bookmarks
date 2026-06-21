export type TagManagementAction = 'delete' | 'refresh' | 'rename'

export interface TagManagementActionDetail {
  action: TagManagementAction
  sourceTag?: string
  targetTag?: string
}

export interface TagManagementControlsState {
  focusTargetRequestId: number
  loading: boolean
  manualTags: number
  sourceTag: string
  status: string
  taggedBookmarks: number
  targetTag: string
  totalTags: number
}
