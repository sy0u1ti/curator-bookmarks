export type BookmarkMenuActionIcon =
  | 'trash'
  | 'refresh'
  | 'save'
  | 'plus'
  | 'copy'
  | 'pin'
  | 'move'
  | 'folder'
  | 'sort'
  | 'folder-plus'
  | 'folder-open'
export type BookmarkIconMode = 'website' | 'custom'

export interface BookmarkMenuTextFieldViewModel {
  disabled: boolean
  id: string
  label: string
  onChange: (value: string) => void
  onEnter: () => void | Promise<void>
  placeholder: string
  type: 'text' | 'url'
  value: string
}

export interface BookmarkMenuActionViewModel {
  actionId?: string
  ariaLabel: string
  disabled: boolean
  icon: BookmarkMenuActionIcon
  id: string
  label: string
  feedback?: import('../shared/action-feedback').ActionFeedback
  onSelect: () => void | Promise<void>
  separatorBefore?: boolean
  children?: () => BookmarkMenuActionViewModel[]
  variant?: 'danger' | ''
}

export interface BookmarkEditMenuViewModel {
  actions: BookmarkMenuActionViewModel[]
  error: string
  fields: [BookmarkMenuTextFieldViewModel, BookmarkMenuTextFieldViewModel]
  iconMode: BookmarkIconMode
  iconModeDisabled: boolean
  onCustomIconFileSelect: (file: File | null) => void | Promise<void>
  onCloseRequest: () => void
  onIconModeChange: (value: BookmarkIconMode) => void | Promise<void>
  status: string
  statusTone?: 'warning' | ''
  x: number
  y: number
}

export interface BookmarkAddMenuViewModel {
  actions: BookmarkMenuActionViewModel[]
  error: string
  expanded: boolean
  fields: [BookmarkMenuTextFieldViewModel, BookmarkMenuTextFieldViewModel]
  folderAction?: BookmarkMenuActionViewModel
  folderField?: BookmarkMenuTextFieldViewModel
  mode?: 'collapsed' | 'bookmark' | 'folder'
  onCloseRequest: () => void
  onExpand: () => void | Promise<void>
  onExpandFolder?: () => void | Promise<void>
  onOpenManager?: () => void
  x: number
  y: number
}

export interface BookmarkFolderMenuViewModel {
  actions: BookmarkMenuActionViewModel[]
  canRename: boolean
  error: string
  nameField: BookmarkMenuTextFieldViewModel
  onCloseRequest: () => void
  status: string
  statusTone?: 'warning' | ''
  subfolderAction?: BookmarkMenuActionViewModel
  subfolderExpanded: boolean
  subfolderField?: BookmarkMenuTextFieldViewModel
  title: string
  x: number
  y: number
}
