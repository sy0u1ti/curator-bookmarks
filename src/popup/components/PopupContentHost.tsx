import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  dispatchPopupContentAction,
  dispatchPopupContentResultHover,
  POPUP_CONTENT_CHANGE_EVENT,
  type PopupContentChangeDetail
} from '../popup-events'
import { PopupContent, type PopupContentViewModel } from './PopupRuntimeIslands'

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
    const handleChange = (event: Event) => {
      const detail = (event as CustomEvent<PopupContentChangeDetail>).detail
      const root = contentRef.current
      const scrollContainer = root?.querySelector<HTMLElement>('[data-popup-main-list]') || root

      pendingScrollTopRef.current = detail?.preserveScroll && scrollContainer
        ? scrollContainer.scrollTop
        : null
      shouldRevealActiveResultRef.current = !detail?.preserveScroll
      setState(detail?.state ?? INITIAL_CONTENT_STATE)
    }

    window.addEventListener(POPUP_CONTENT_CHANGE_EVENT, handleChange)
    return () => window.removeEventListener(POPUP_CONTENT_CHANGE_EVENT, handleChange)
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
      role="list"
      ref={contentRef}
      onClick={handleContentClick}
      onPointerOver={handleContentPointerOver}
    >
      <PopupContent state={state} />
    </div>
  )
}

function handleContentClick(event: React.MouseEvent<HTMLElement>) {
  const target = event.target
  if (!(target instanceof Element)) {
    return
  }

  const sidebarFolderButton = target.closest('[data-sidebar-folder-filter]')
  if (sidebarFolderButton) {
    dispatchPopupContentAction({
      action: 'filter-folder',
      folderId: sidebarFolderButton.getAttribute('data-sidebar-folder-filter') || ''
    })
    return
  }

  const folderToggle = target.closest('[data-toggle-folder]')
  if (folderToggle) {
    dispatchPopupContentAction({
      action: 'toggle-folder',
      folderId: folderToggle.getAttribute('data-toggle-folder') || ''
    })
    return
  }

  const actionButton = target.closest('[data-menu-action]')
  if (actionButton) {
    dispatchPopupContentAction({
      action: 'menu-action',
      bookmarkId: actionButton.getAttribute('data-bookmark-id') || '',
      menuAction: actionButton.getAttribute('data-menu-action') || ''
    })
    return
  }

  const bookmarkButton = target.closest('[data-open-bookmark]')
  if (bookmarkButton) {
    dispatchPopupContentAction({
      action: 'open-bookmark',
      bookmarkId: bookmarkButton.getAttribute('data-open-bookmark') || ''
    })
    return
  }

  const emptyAction = target.closest('[data-empty-action]')
  if (emptyAction) {
    dispatchPopupContentAction({
      action: 'empty-action',
      emptyAction: emptyAction.getAttribute('data-empty-action') || ''
    })
  }
}

function handleContentPointerOver(event: React.PointerEvent<HTMLElement>) {
  const target = event.target
  if (!(target instanceof Element)) {
    return
  }

  const resultCard = target.closest('[data-result-index]')
  if (!resultCard) {
    return
  }

  const nextIndex = Number(resultCard.getAttribute('data-result-index'))
  if (!Number.isNaN(nextIndex)) {
    dispatchPopupContentResultHover(nextIndex)
  }
}
