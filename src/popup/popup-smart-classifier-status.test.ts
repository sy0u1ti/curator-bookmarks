import { getPopupSmartClassifierRenderStatus } from './popup-smart-classifier-status.js'

function run(): void {
  testBaseRefreshDoesNotRenderPageLoading()
  testActiveSmartStatesArePreserved()
  testUnavailableUrlsUseIdleShell()
}

function testBaseRefreshDoesNotRenderPageLoading(): void {
  const status = getPopupSmartClassifierRenderStatus({
    currentUrl: 'https://example.com/article',
    isLoading: true,
    smartStatus: 'idle'
  })

  assert(status === 'idle', `base refresh should keep the stable current-page shell, got ${status}`)
}

function testActiveSmartStatesArePreserved(): void {
  const status = getPopupSmartClassifierRenderStatus({
    currentUrl: 'https://example.com/article',
    isLoading: true,
    smartStatus: 'loading'
  })

  assert(status === 'loading', `explicit smart loading should be preserved, got ${status}`)
}

function testUnavailableUrlsUseIdleShell(): void {
  const status = getPopupSmartClassifierRenderStatus({
    currentUrl: 'chrome://extensions/',
    isLoading: false,
    smartStatus: 'results'
  })

  assert(status === 'idle', `unavailable URLs should use idle shell, got ${status}`)
}

function assert(value: unknown, message: string): void {
  if (!value) {
    throw new Error(message)
  }
}

run()
console.log('Popup smart classifier status tests passed.')
