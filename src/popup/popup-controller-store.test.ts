import {
  EMPTY_POPUP_SMART_CLASSIFIER,
  dispatchPopupContentChange,
  dispatchPopupSmartClassifierChange,
  getPopupSmartClassifierSnapshot,
  resetPopupViewStore,
  subscribePopupContentChange
} from './popup-controller-store.js'

function run(): void {
  testResetClearsRetainedPopupSurface()
}

function testResetClearsRetainedPopupSurface(): void {
  let latestTitle = ''
  let latestLoading = false
  const unsubscribe = subscribePopupContentChange((detail) => {
    latestTitle = detail.state.title
    latestLoading = detail.state.loading === true
  })

  dispatchPopupContentChange({
    loading: false,
    rows: [],
    title: 'Example Article'
  })
  dispatchPopupSmartClassifierChange({
    ...EMPTY_POPUP_SMART_CLASSIFIER,
    status: 'results',
    suggestedTitle: 'Example Article'
  })

  resetPopupViewStore()

  const smartClassifier = getPopupSmartClassifierSnapshot()
  assert(latestTitle === '书签栏', `reset should restore the default content title, got ${latestTitle}`)
  assert(latestLoading, 'reset should restore the loading content shell')
  assert(smartClassifier.status === 'idle', `reset should clear retained smart state, got ${smartClassifier.status}`)
  assert(smartClassifier.suggestedTitle === '', 'reset should clear retained smart title')

  unsubscribe()
}

function assert(value: unknown, message: string): void {
  if (!value) {
    throw new Error(message)
  }
}

run()
console.log('Popup controller store tests passed.')
