export type IgnoreRuleKind = 'bookmark' | 'domain' | 'folder'

export type IgnoreRuleAction =
  | 'clear'
  | 'remove'

export interface IgnoreRuleActionDetail {
  action: IgnoreRuleAction
  kind: IgnoreRuleKind
  ruleId?: string
}

export interface BookmarkIgnoreRuleViewModel {
  bookmarkId: string
  createdAt: number
  title: string
  url: string
}

export interface DomainIgnoreRuleViewModel {
  createdAt: number
  domain: string
}

export interface FolderIgnoreRuleViewModel {
  createdAt: number
  folderId: string
  path: string
  title: string
}

export type IgnoreRuleViewModel =
  | BookmarkIgnoreRuleViewModel
  | DomainIgnoreRuleViewModel
  | FolderIgnoreRuleViewModel

export interface IgnoreRulesState {
  bookmarks: BookmarkIgnoreRuleViewModel[]
  domains: DomainIgnoreRuleViewModel[]
  folders: FolderIgnoreRuleViewModel[]
}

export interface IgnoreRulesSummaryState {
  bookmarkCount: number
  domainCount: number
  folderCount: number
}
