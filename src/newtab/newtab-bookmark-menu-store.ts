import { createUiViewStoreSlice, useUiViewStoreSlice } from '../shared/ui-view-store.js'
import type {
  BookmarkAddMenuViewModel,
  BookmarkEditMenuViewModel
} from './bookmark-menu-view-models'

export interface NewtabBookmarkEditMenuView {
  closing: boolean
  focusAction: string
  focusFirst: boolean
  menu: BookmarkEditMenuViewModel
  onExitComplete: () => void
}

export interface NewtabBookmarkAddMenuView {
  closing: boolean
  focusFirst: boolean
  menu: BookmarkAddMenuViewModel
  onExitComplete: () => void
}

export interface NewtabBookmarkMenusView {
  add: NewtabBookmarkAddMenuView | null
  edit: NewtabBookmarkEditMenuView | null
}

const EMPTY_VIEW: NewtabBookmarkMenusView = {
  add: null,
  edit: null
}

const bookmarkMenusStore = createUiViewStoreSlice(
  'newtab',
  'bookmark-menus',
  EMPTY_VIEW
)

export function dispatchNewtabBookmarkEditMenuView(view: NewtabBookmarkEditMenuView | null): void {
  bookmarkMenusStore.setState((current) => ({
    ...current,
    edit: view
  }))
}

export function dispatchNewtabBookmarkAddMenuView(view: NewtabBookmarkAddMenuView | null): void {
  bookmarkMenusStore.setState((current) => ({
    ...current,
    add: view
  }))
}

export function dispatchNewtabBookmarkEditMenuClosing(): void {
  const bookmarkMenusView = bookmarkMenusStore.getState()
  if (!bookmarkMenusView.edit || bookmarkMenusView.edit.closing) {
    return
  }

  bookmarkMenusStore.setState({
    ...bookmarkMenusView,
    edit: {
      ...bookmarkMenusView.edit,
      closing: true,
      focusAction: '',
      focusFirst: false
    }
  })
}

export function dispatchNewtabBookmarkAddMenuClosing(): void {
  const bookmarkMenusView = bookmarkMenusStore.getState()
  if (!bookmarkMenusView.add || bookmarkMenusView.add.closing) {
    return
  }

  bookmarkMenusStore.setState({
    ...bookmarkMenusView,
    add: {
      ...bookmarkMenusView.add,
      closing: true,
      focusFirst: false
    }
  })
}

export function useNewtabBookmarkMenusView(): NewtabBookmarkMenusView {
  return useUiViewStoreSlice(bookmarkMenusStore)
}
