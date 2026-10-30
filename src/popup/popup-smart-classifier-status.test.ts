import { getPopupSmartClassifierRenderStatus } from './popup-smart-classifier-status.js'
import {
  getPopupCurrentPagePolicy,
  isPopupSmartClassifiableUrl,
  isPopupWebPageUrl
} from './popup-page-policy.js'
import { assessSensitiveExternalUrl } from '../shared/sensitive-url.js'

function run(): void {
  testBaseRefreshDoesNotRenderPageLoading()
  testActiveSmartStatesArePreserved()
  testUnavailableUrlsUseIdleShell()
  testSensitiveWebPagesKeepTheirPageIdentity()
  testOrdinaryPagesKeepAllActions()
  testInvalidAndBrowserUrlsCannotBeSaved()
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

function testSensitiveWebPagesKeepTheirPageIdentity(): void {
  for (const url of [
    'https://platform.yeta.ai/billing',
    'https://platform.yeta.ai/%62illing',
    'https://example.com/login',
    'https://mail.google.com/mail/u/0/#inbox',
    'https://docs.google.com/document/d/private-document/edit',
    'https://www.notion.so/workspace',
    'https://www.figma.com/design/private-file',
    'https://example.com/medical',
    'http://localhost:3000/dashboard',
    'http://192.168.1.1/',
    'https://example.com/download?token=private-token',
    'https://example.com/#access_token=private-token'
  ]) {
    const policy = getPopupCurrentPagePolicy(url)
    assert(assessSensitiveExternalUrl(url).sensitive, `${url} must retain external-request protection`)
    assert(policy.isWebPage && isPopupWebPageUrl(url), `${url} must still be locally recognizable and saveable`)
    assert(!policy.canClassify && !isPopupSmartClassifiableUrl(url), `${url} must not be sent to AI`)
    assert(policy.classificationMessage.includes('保护隐私'), 'the UI should explain the unavailable action')

    const status = getPopupSmartClassifierRenderStatus({ currentUrl: url, isLoading: false, smartStatus: 'results' })
    assert(status === 'idle', 'protected pages must not reveal stale AI results')
  }
}

function testOrdinaryPagesKeepAllActions(): void {
  for (const url of ['https://platform.yeta.ai/models', 'https://example.com/article', 'http://example.com/']) {
    const policy = getPopupCurrentPagePolicy(url)
    assert(policy.isWebPage && policy.canClassify, `${url} should support both save and classification`)
    assert(policy.classificationMessage === '', 'ordinary pages should have no protection warning')
  }
}

function testInvalidAndBrowserUrlsCannotBeSaved(): void {
  for (const url of [null, undefined, '', 'not a URL', 'https://', 'chrome://extensions/', 'about:blank',
    'chrome-extension://fixture/src/popup/popup.html', 'file:///C:/private.txt', 'javascript:alert(1)', 'data:text/html,test']) {
    const policy = getPopupCurrentPagePolicy(url)
    assert(!policy.isWebPage && !isPopupWebPageUrl(url), `${url} must not enable current-page saving`)
    assert(!policy.canClassify && !isPopupSmartClassifiableUrl(url), `${url} must not enable AI classification`)
    assert(policy.classificationMessage === '', 'non-web pages should use the existing unavailable placeholder')
  }
}

function assert(value: unknown, message: string): void {
  if (!value) {
    throw new Error(message)
  }
}

run()
console.log('Popup smart classifier status tests passed.')
