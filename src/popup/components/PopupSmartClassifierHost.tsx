import {
  dispatchPopupSmartClassifierAction,
  dispatchPopupSmartClassifierTitleChange,
  usePopupSmartClassifierView
} from '../popup-controller-store'
import { useEffect } from 'react'
import { PopupSmartClassifier } from './PopupSmartClassifier'

export function PopupSmartClassifierHost() {
  const state = usePopupSmartClassifierView()

  const hidden = state.status === 'hidden'
  const active = ['loading', 'results', 'error', 'permission'].includes(state.status)

  useEffect(() => {
    document.body.classList.toggle('smart-active', active)
    return () => {
      document.body.classList.remove('smart-active')
    }
  }, [active])

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
