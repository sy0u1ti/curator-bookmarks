export type BookmarkMenuActionIcon = 'trash' | 'refresh' | 'save' | 'plus' | 'copy' | 'pin'

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
  iconMode: 'website' | 'custom'
  iconModeDisabled: boolean
  onIconModeChange: (value: string) => void | Promise<void>
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
  onExpand: () => void | Promise<void>
  x: number
  y: number
}
