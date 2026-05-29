import { flushSync } from 'react-dom'
import { createRoot, type Root } from 'react-dom/client'
import { displayUrl } from '../../shared/text.js'
import { Button, Checkbox, ThemeProvider } from '../../ui'

export interface RedirectResultViewModel {
  id: string
  title: string
  url: string
  finalUrl: string
  path: string
}

export interface RedirectResultsState {
  emptyMessage: string
  locked: boolean
  results: RedirectResultViewModel[]
  selectedIds: Set<unknown>
}

const roots = new WeakMap<Element, Root>()

export function renderRedirectResultsIsland(container: Element, state: RedirectResultsState): void {
  let root = roots.get(container)
  if (!root) {
    root = createRoot(container)
    roots.set(container, root)
  }

  flushSync(() => {
    root.render(
      <ThemeProvider>
        <RedirectResults state={state} />
      </ThemeProvider>
    )
  })
}

function RedirectResults({ state }: { state: RedirectResultsState }) {
  if (!state.results.length) {
    return <div className="detect-empty">{state.emptyMessage}</div>
  }

  return (
    <>
      {state.results.map((result) => (
        <RedirectResultCard
          key={result.id}
          locked={state.locked}
          result={result}
          selected={state.selectedIds.has(String(result.id))}
        />
      ))}
    </>
  )
}

function RedirectResultCard({
  locked,
  result,
  selected
}: {
  locked: boolean
  result: RedirectResultViewModel
  selected: boolean
}) {
  const selectionLabel = getRedirectResultActionLabel('选择重定向书签', result)
  const updateLabel = getRedirectResultActionLabel('更新为最终 URL', result)
  const openFinalLabel = getRedirectResultActionLabel('打开最终链接', result)
  const finalUrl = result.finalUrl || result.url

  return (
    <article className={['detect-result-card', selected ? 'selected' : ''].filter(Boolean).join(' ')}>
      <div className="detect-result-head">
        <div className="detect-result-head-left">
          <Checkbox
            aria-label={selectionLabel}
            checked={selected}
            className="detect-result-check-box"
            data-bookmark-id={result.id}
            data-redirect-select="true"
            disabled={locked}
            label="选择"
            labelAttributes={{
              'data-bookmark-id': result.id,
              'data-redirect-select': 'true'
            }}
            labelClassName="detect-result-check"
          />
          <span className="options-chip success">已跳转</span>
        </div>
        <div className="detect-result-actions">
          <Button
            className="detect-result-action"
            type="button"
            data-redirect-update={result.id}
            aria-label={updateLabel}
            disabled={locked}
            unstyled
          >
            更新为最终 URL
          </Button>
          <a
            className="detect-result-open"
            href={finalUrl}
            target="_blank"
            rel="noreferrer noopener"
            aria-label={openFinalLabel}
          >
            打开最终链接
          </a>
        </div>
      </div>
      <div className="detect-result-copy">
        <strong>{result.title || '未命名书签'}</strong>
        <div className="detect-result-detail">
          原地址：<span className="detect-inline-url">{displayUrl(result.url)}</span>
        </div>
        <div className="detect-result-detail">
          最终地址：<span className="detect-inline-url">{displayUrl(finalUrl)}</span>
        </div>
        <div className="detect-result-detail">
          建议：先打开最终链接确认；更新前会重新读取书签，只有当前 URL 仍等于检测时原地址才会写入。
        </div>
        <p className="detect-result-path" title={result.path || '未归档路径'}>
          {result.path || '未归档路径'}
        </p>
      </div>
    </article>
  )
}

function getRedirectResultActionLabel(
  action: string,
  result: Pick<RedirectResultViewModel, 'title' | 'url' | 'finalUrl'>
): string {
  const title = String(result?.title || displayUrl(result?.finalUrl || result?.url) || '未命名书签')
    .replace(/\s+/g, ' ')
    .trim()
  const safeTitle = title.length > 48 ? `${title.slice(0, 47).trim()}...` : title

  return `${action}：${safeTitle || '未命名书签'}`
}
