import {
  dispatchPopupSmartClassifierAction,
  dispatchPopupSmartClassifierTitleChange,
  usePopupSmartClassifierView
} from '../popup-controller-store'
import { cx } from '../../ui/base/utils'
import { PopupSmartClassifier } from './PopupSmartClassifier'

const smartClassifierBaseClass = 'relative z-[1] min-h-[auto] flex-none pb-0'
const smartClassifierIdleClass = 'block'
const smartClassifierActiveClass =
  'grid min-h-0 flex-[1_1_auto] grid-rows-[minmax(0,1fr)_auto] content-stretch items-stretch justify-stretch justify-items-stretch gap-2 p-0 [&>*]:min-w-0'

export function PopupSmartClassifierHost() {
  const state = usePopupSmartClassifierView()

  const hidden = state.status === 'hidden'
  const active = ['loading', 'results', 'error', 'permission'].includes(state.status)

  return (
    <section
      id="smart-classifier"
      className={cx(
        smartClassifierBaseClass,
        active ? smartClassifierActiveClass : smartClassifierIdleClass
      )}
      hidden={hidden}
      aria-live="polite"
    >
      <PopupSmartClassifier
        handlers={{
          onAction: (action, returnFocusElement) => {
            dispatchPopupSmartClassifierAction({ action, returnFocusElement })
          },
          onCurrentPageAction: (currentPageAction, returnFocusElement) => {
            dispatchPopupSmartClassifierAction({ action: 'current-page', currentPageAction, returnFocusElement })
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
