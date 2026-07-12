import { useSyncExternalStore } from 'react'
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

let bookmarkMenusView: NewtabBookmarkMenusView = EMPTY_VIEW

const listeners = new Set<() => void>()

function subscribeBookmarkMenus(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function emitBookmarkMenusChange(): void {
  listeners.forEach((listener) => listener())
}

export function dispatchNewtabBookmarkEditMenuView(view: NewtabBookmarkEditMenuView | null): void {
  bookmarkMenusView = {
    ...bookmarkMenusView,
    edit: view
  }
  emitBookmarkMenusChange()
}

export function dispatchNewtabBookmarkAddMenuView(view: NewtabBookmarkAddMenuView | null): void {
  bookmarkMenusView = {
    ...bookmarkMenusView,
    add: view
  }
  emitBookmarkMenusChange()
}

export function dispatchNewtabBookmarkEditMenuClosing(): void {
  if (!bookmarkMenusView.edit || bookmarkMenusView.edit.closing) {
    return
  }

  bookmarkMenusView = {
    ...bookmarkMenusView,
    edit: {
      ...bookmarkMenusView.edit,
      closing: true,
      focusAction: '',
      focusFirst: false
    }
  }
  emitBookmarkMenusChange()
}

export function dispatchNewtabBookmarkAddMenuClosing(): void {
  if (!bookmarkMenusView.add || bookmarkMenusView.add.closing) {
    return
  }

  bookmarkMenusView = {
    ...bookmarkMenusView,
    add: {
      ...bookmarkMenusView.add,
      closing: true,
      focusFirst: false
    }
  }
  emitBookmarkMenusChange()
}

export function useNewtabBookmarkMenusView(): NewtabBookmarkMenusView {
  return useSyncExternalStore(
    subscribeBookmarkMenus,
    () => bookmarkMenusView,
    () => EMPTY_VIEW
  )
}
