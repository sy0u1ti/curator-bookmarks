import { useEffect, useState } from 'react'
import {
  dispatchPopupSmartClassifierAction,
  dispatchPopupSmartClassifierTitleChange,
  POPUP_SMART_CLASSIFIER_CHANGE_EVENT,
  type PopupSmartClassifierChangeDetail
} from '../popup-events'
import { PopupSmartClassifier, type PopupSmartClassifierViewModel } from './PopupRuntimeIslands'

const EMPTY_SMART_CLASSIFIER: PopupSmartClassifierViewModel = {
  error: '',
  loadingLabel: '',
  loadingProgress: 0,
  loadingStartProgress: 0,
  loadingStep: 1,
  loadingStepCount: 3,
  page: null,
  permissionOrigins: [],
  recommendations: [],
  saved: false,
  saving: false,
  status: 'hidden',
  suggestedTitle: ''
}

export function PopupSmartClassifierHost() {
  const [state, setState] = useState<PopupSmartClassifierViewModel>(EMPTY_SMART_CLASSIFIER)

  useEffect(() => {
    const handleChange = (event: Event) => {
      const detail = (event as CustomEvent<PopupSmartClassifierChangeDetail>).detail
      setState(detail?.state ?? EMPTY_SMART_CLASSIFIER)
    }

    window.addEventListener(POPUP_SMART_CLASSIFIER_CHANGE_EVENT, handleChange)
    return () => window.removeEventListener(POPUP_SMART_CLASSIFIER_CHANGE_EVENT, handleChange)
  }, [])

  const hidden = state.status === 'hidden'

  return (
    <section
      id="smart-classifier"
      className={['smart-classifier', hidden ? 'hidden' : ''].filter(Boolean).join(' ')}
      aria-live="polite"
      onClick={handleSmartClassifierClick}
      onInput={handleSmartClassifierInput}
    >
      <PopupSmartClassifier state={state} />
    </section>
  )
}

function handleSmartClassifierClick(event: React.MouseEvent<HTMLElement>) {
  const target = event.target
  if (!(target instanceof Element)) {
    return
  }

  const savedSearchButton = target.closest('[data-saved-search-action]')
  if (savedSearchButton) {
    dispatchPopupSmartClassifierAction({
      action: 'saved-search',
      currentPageAction: savedSearchButton.getAttribute('data-saved-search-action') || '',
      recommendationId: savedSearchButton.getAttribute('data-saved-search-id') || ''
    })
    return
  }

  const quickActionButton = target.closest('[data-current-page-action]')
  if (quickActionButton) {
    dispatchPopupSmartClassifierAction({
      action: 'current-page',
      currentPageAction: quickActionButton.getAttribute('data-current-page-action') || ''
    })
    return
  }

  const recommendationButton = target.closest('[data-smart-recommendation]')
  if (recommendationButton) {
    dispatchPopupSmartClassifierAction({
      action: 'recommendation',
      recommendationId: recommendationButton.getAttribute('data-smart-recommendation') || ''
    })
    return
  }

  const actionButton = target.closest('[data-smart-action]')
  if (actionButton) {
    dispatchPopupSmartClassifierAction({
      action: actionButton.getAttribute('data-smart-action') || ''
    })
  }
}

function handleSmartClassifierInput(event: React.FormEvent<HTMLElement>) {
  const target = event.target
  if (target instanceof HTMLInputElement && target.id === 'smart-title-input') {
    dispatchPopupSmartClassifierTitleChange(target.value)
  }
}
