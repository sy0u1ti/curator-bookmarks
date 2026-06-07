import { useEffect, useState } from 'react'
import {
  dispatchPopupSmartClassifierAction,
  dispatchPopupSmartClassifierTitleChange,
  POPUP_SMART_CLASSIFIER_CHANGE_EVENT,
  type PopupSmartClassifierChangeDetail
} from '../popup-events'
import { PopupSmartClassifier } from './PopupSmartClassifier'
import type { PopupSmartClassifierViewModel } from './PopupViewModels'

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
    >
      <PopupSmartClassifier
        handlers={{
          onAction: (action) => {
            dispatchPopupSmartClassifierAction({ action })
          },
          onCurrentPageAction: (currentPageAction) => {
            dispatchPopupSmartClassifierAction({ action: 'current-page', currentPageAction })
          },
          onRecommendationSelect: (recommendationId) => {
            dispatchPopupSmartClassifierAction({ action: 'recommendation', recommendationId })
          },
          onTitleChange: (title) => {
            dispatchPopupSmartClassifierTitleChange(title)
          }
        }}
        state={state}
      />
    </section>
  )
}
