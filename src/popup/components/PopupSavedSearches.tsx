import { useEffect, useState } from 'react'
import { Button } from '../../ui'
import {
  dispatchPopupSavedSearchAction,
  POPUP_SAVED_SEARCHES_CHANGE_EVENT,
  type PopupSavedSearchesChangeDetail,
  type PopupSavedSearchesView
} from '../popup-events'

const EMPTY_SAVED_SEARCHES: PopupSavedSearchesView = {
  canSaveCurrent: false,
  error: '',
  expanded: false,
  hasCurrentSaved: false,
  items: [],
  show: false
}

export function PopupSavedSearches() {
  const [state, setState] = useState<PopupSavedSearchesView>(EMPTY_SAVED_SEARCHES)

  useEffect(() => {
    const handleChange = (event: Event) => {
      const detail = (event as CustomEvent<PopupSavedSearchesChangeDetail>).detail
      setState(detail?.state ?? EMPTY_SAVED_SEARCHES)
    }

    window.addEventListener(POPUP_SAVED_SEARCHES_CHANGE_EVENT, handleChange)
    return () => window.removeEventListener(POPUP_SAVED_SEARCHES_CHANGE_EVENT, handleChange)
  }, [])

  const className = [
    'saved-searches',
    state.show ? '' : 'hidden',
    state.expanded ? 'expanded' : 'collapsed'
  ].filter(Boolean).join(' ')
  const visibleItems = state.items.slice(0, 6)

  return (
    <div id="saved-searches" className={className} aria-label="已保存搜索">
      {state.show ? (
        <>
          <div className="saved-search-head">
            {state.items.length ? (
              <Button
                className="saved-search-toggle"
                type="button"
                onClick={() => dispatchPopupSavedSearchAction('toggle')}
                aria-expanded={state.expanded}
                aria-controls="saved-searches-list"
                unstyled
              >
                <span className="saved-search-toggle-icon" aria-hidden="true"></span>
                <span className="saved-search-toggle-label">已保存 {state.items.length}</span>
              </Button>
            ) : (
              <span className="saved-search-status">暂无保存项</span>
            )}
            {state.canSaveCurrent ? (
              <Button
                className="saved-search-save"
                type="button"
                onClick={() => dispatchPopupSavedSearchAction('save-current')}
                disabled={state.hasCurrentSaved}
                aria-label={state.hasCurrentSaved ? '当前搜索已保存' : '保存当前搜索'}
                unstyled
              >
                {state.hasCurrentSaved ? '已保存' : '保存当前搜索'}
              </Button>
            ) : null}
          </div>
          {state.error ? <span className="saved-search-status error">{state.error}</span> : null}
          {state.expanded && visibleItems.length ? (
            <div id="saved-searches-list" className="saved-search-list">
              {visibleItems.map((item) => (
                <span className={['saved-search-chip', item.active ? 'active' : ''].filter(Boolean).join(' ')} key={item.id}>
                  <Button
                    className="saved-search-apply"
                    type="button"
                    onClick={() => dispatchPopupSavedSearchAction('apply', item.id)}
                    title={item.query}
                    unstyled
                  >
                    {item.label}
                  </Button>
                  <Button
                    className="saved-search-delete"
                    type="button"
                    onClick={() => dispatchPopupSavedSearchAction('delete', item.id)}
                    aria-label={`删除保存搜索：${item.label}`}
                    unstyled
                  >
                    {'\u00d7'}
                  </Button>
                </span>
              ))}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
