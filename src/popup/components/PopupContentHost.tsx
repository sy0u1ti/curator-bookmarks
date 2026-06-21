import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  dispatchPopupContentAction,
  dispatchPopupContentResultHover,
  subscribePopupContentChange
} from '../popup-controller-store'
import { PopupContent } from './PopupContent'
import type { PopupContentViewModel } from './PopupViewModels'

const contentHostClass = 'relative z-0 block h-full min-h-0 overflow-hidden'

const INITIAL_CONTENT_STATE: PopupContentViewModel = {
  loading: true,
  rows: [],
  title: '书签栏'
}

export function PopupContentHost() {
  const contentRef = useRef<HTMLDivElement | null>(null)
  const mainListRef = useRef<HTMLUListElement | null>(null)
  const activeResultRef = useRef<HTMLLIElement | null>(null)
  const pendingScrollTopRef = useRef<number | null>(null)
  const shouldRevealActiveResultRef = useRef(false)
  const [state, setState] = useState<PopupContentViewModel>(INITIAL_CONTENT_STATE)

  useEffect(() => {
    return subscribePopupContentChange((detail) => {
      const scrollContainer = mainListRef.current || contentRef.current

      pendingScrollTopRef.current = detail.preserveScroll && scrollContainer
        ? scrollContainer.scrollTop
        : null
      shouldRevealActiveResultRef.current = !detail.preserveScroll
      setState(detail.state ?? INITIAL_CONTENT_STATE)
    })
  }, [])

  useLayoutEffect(() => {
    const scrollContainer = mainListRef.current || contentRef.current
    if (!scrollContainer) {
      return
    }

    const pendingScrollTop = pendingScrollTopRef.current
    if (pendingScrollTop !== null) {
      scrollContainer.scrollTop = pendingScrollTop
      pendingScrollTopRef.current = null
      shouldRevealActiveResultRef.current = false
      return
    }

    if (!shouldRevealActiveResultRef.current) {
      return
    }

    shouldRevealActiveResultRef.current = false
    const activeResult = activeResultRef.current
    if (!activeResult) {
      return
    }

    const maxScrollTop = Math.max(0, scrollContainer.scrollHeight - scrollContainer.clientHeight)
    const activeResultRowIndex = (state.mainRows || state.rows).findIndex((row) => {
      return row.kind !== 'folder' && Boolean(row.active)
    })
    if (activeResultRowIndex === 0) {
      scrollContainer.scrollTop = 0
      return
    }

    const resultTop = activeResult.offsetTop - scrollContainer.offsetTop
    const resultBottom = resultTop + activeResult.offsetHeight
    const viewportTop = scrollContainer.scrollTop
    const viewportBottom = viewportTop + scrollContainer.clientHeight

    if (resultTop < viewportTop) {
      scrollContainer.scrollTop = Math.max(0, resultTop)
      return
    }
    if (resultBottom > viewportBottom) {
      scrollContainer.scrollTop = Math.min(maxScrollTop, resultBottom - scrollContainer.clientHeight)
    }
  }, [state])

  return (
    <div
      id="content"
      className={contentHostClass}
      ref={contentRef}
    >
      <PopupContent
        activeResultRef={activeResultRef}
        handlers={{
          onBookmarkOpen: (bookmarkId) => {
            dispatchPopupContentAction({ action: 'open-bookmark', bookmarkId })
          },
          onEmptyAction: (emptyAction) => {
            dispatchPopupContentAction({ action: 'empty-action', emptyAction })
          },
          onFolderFilter: (folderId) => {
            dispatchPopupContentAction({ action: 'filter-folder', folderId })
          },
          onMenuAction: (bookmarkId, menuAction, returnFocusElement) => {
            dispatchPopupContentAction({ action: 'menu-action', bookmarkId, menuAction, returnFocusElement })
          },
          onResultHover: (index) => {
            dispatchPopupContentResultHover(index)
          }
        }}
        mainListRef={mainListRef}
        state={state}
      />
    </div>
  )
}
