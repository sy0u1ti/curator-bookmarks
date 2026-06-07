import {
  dispatchPopupSmartClassifierAction,
  dispatchPopupSmartClassifierTitleChange,
  usePopupSmartClassifierView
} from '../popup-events'
import { PopupSmartClassifier } from './PopupSmartClassifier'

export function PopupSmartClassifierHost() {
  const state = usePopupSmartClassifierView()

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
