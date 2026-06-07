import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  dispatchPopupContentAction,
  dispatchPopupContentResultHover,
  subscribePopupContentChange
} from '../popup-events'
import { PopupContent } from './PopupContent'
import type { PopupContentViewModel } from './PopupViewModels'

const INITIAL_CONTENT_STATE: PopupContentViewModel = {
  loading: true,
  rows: [],
  title: '书签栏'
}

export function PopupContentHost() {
  const contentRef = useRef<HTMLDivElement | null>(null)
  const pendingScrollTopRef = useRef<number | null>(null)
  const shouldRevealActiveResultRef = useRef(false)
  const [state, setState] = useState<PopupContentViewModel>(INITIAL_CONTENT_STATE)

  useEffect(() => {
    return subscribePopupContentChange((detail) => {
      const root = contentRef.current
      const scrollContainer = root?.querySelector<HTMLElement>('[data-popup-main-list]') || root

      pendingScrollTopRef.current = detail.preserveScroll && scrollContainer
        ? scrollContainer.scrollTop
        : null
      shouldRevealActiveResultRef.current = !detail.preserveScroll
      setState(detail.state ?? INITIAL_CONTENT_STATE)
    })
  }, [])

  useLayoutEffect(() => {
    const root = contentRef.current
    if (!root) {
      return
    }

    const scrollContainer = root.querySelector<HTMLElement>('[data-popup-main-list]') || root
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
    const activeResult = root.querySelector<HTMLElement>('[data-result-index].active')
    if (!activeResult) {
      return
    }

    const maxScrollTop = Math.max(0, scrollContainer.scrollHeight - scrollContainer.clientHeight)
    const resultIndex = Number(activeResult.getAttribute('data-result-index'))
    if (resultIndex === 0) {
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
      className="content"
      ref={contentRef}
    >
      <PopupContent
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
          onMenuAction: (bookmarkId, menuAction) => {
            dispatchPopupContentAction({ action: 'menu-action', bookmarkId, menuAction })
          },
          onResultHover: (index) => {
            dispatchPopupContentResultHover(index)
          }
        }}
        state={state}
      />
    </div>
  )
}
