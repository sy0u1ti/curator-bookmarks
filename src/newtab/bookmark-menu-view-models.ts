export type BookmarkMenuActionIcon = 'trash' | 'refresh' | 'save' | 'plus' | 'copy' | 'pin'
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
  onSelect: () => void | Promise<void>
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
  onCloseRequest: () => void
  onExpand: () => void | Promise<void>
  x: number
  y: number
}
