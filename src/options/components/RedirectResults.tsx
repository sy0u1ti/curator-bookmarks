import { displayUrl } from '../../shared/text.js'
import { Button } from '../../ui/base/Button'
import { CheckboxControl } from '../../ui/base/Checkbox'
import { OPTION_RESULT_CHECKBOX_CLASS } from './option-layout-classes.js'
import { handleRedirectAction } from '../options-controller'
import { useRedirectResultsState } from './redirect-results-store.js'
import { OptionEmptyState } from './OptionEmptyState.js'
import type { RedirectResultViewModel } from './redirect-results-types.js'

const REDIRECT_RESULTS_LIST_CLASS = 'mt-4 flex flex-col gap-3'
const REDIRECT_CARD_CLASS =
  'rounded-ds-sm border border-ds-border-subtle bg-ds-surface-1 p-[14px_16px] [transition:border-color_var(--ds-motion-standard)_var(--ds-ease-standard),background-color_var(--ds-motion-standard)_var(--ds-ease-standard)] hover:border-ds-border-hover hover:bg-ds-hover'
const REDIRECT_CARD_SELECTED_CLASS = 'border-ds-border-hover bg-ds-selected'
const REDIRECT_CARD_HEAD_CLASS =
  'flex min-w-0 items-start justify-between gap-3 max-[760px]:flex-col'
const REDIRECT_CARD_HEAD_LEFT_CLASS = 'flex min-w-0 flex-wrap items-center gap-2.5'
const REDIRECT_CHECK_CLASS =
  'inline-flex items-center gap-2 text-xs font-semibold text-ds-text-secondary'
const REDIRECT_CARD_ACTIONS_CLASS = 'flex min-w-0 flex-wrap items-center justify-end gap-2.5'
const REDIRECT_CARD_ACTION_CLASS =
  'border-0 bg-transparent p-0 font-[inherit] text-xs font-semibold text-ds-text-disabled [transition:color_var(--ds-motion-standard)_var(--ds-ease-standard)] hover:text-ds-text-primary focus-visible:text-ds-text-primary disabled:cursor-default disabled:opacity-50 disabled:hover:text-ds-text-disabled disabled:focus-visible:text-ds-text-disabled data-[disabled]:cursor-default data-[disabled]:opacity-50 data-[disabled]:hover:text-ds-text-disabled data-[disabled]:focus-visible:text-ds-text-disabled'
const REDIRECT_CARD_LINK_CLASS =
  'border-0 bg-transparent p-0 text-xs font-semibold text-ds-text-disabled no-underline [transition:color_var(--ds-motion-standard)_var(--ds-ease-standard)] hover:text-ds-text-primary focus-visible:text-ds-text-primary'
const REDIRECT_CARD_COPY_CLASS = 'mt-3 min-w-0'
const REDIRECT_CARD_TITLE_CLASS =
  'block min-w-0 text-[15px] font-semibold leading-[1.4] text-ds-text-primary [overflow-wrap:anywhere]'
const REDIRECT_CARD_DETAIL_CLASS =
  'mt-[7px] text-[13px] leading-[1.6] text-ds-text-secondary [overflow-wrap:anywhere] [word-break:break-word]'
const REDIRECT_INLINE_URL_CLASS =
  'font-semibold text-ds-text-primary [overflow-wrap:anywhere] [word-break:break-word]'
const REDIRECT_CARD_PATH_CLASS =
  'mt-[7px] mb-0 text-[13px] leading-[1.6] text-ds-text-disabled [overflow-wrap:anywhere] [word-break:break-word]'
const REDIRECT_STATUS_BADGE_CLASS =
  'inline-flex min-h-6 max-w-full items-center justify-center rounded-full border border-ds-success/35 bg-ds-success-soft px-2.5 text-xs font-semibold leading-none tracking-[0] text-ds-success-text [overflow-wrap:anywhere]'

export function RedirectResults() {
  const state = useRedirectResultsState()

  return (
    <div className={REDIRECT_RESULTS_LIST_CLASS}>
      {state.results.length ? (
        state.results.map((result) => (
          <RedirectResultCard
            key={result.id}
            locked={state.locked}
            result={result}
            selected={state.selectedIds.has(String(result.id))}
          />
        ))
      ) : (
        <OptionEmptyState
          title="没有待更新的重定向"
          description={`${state.emptyMessage} 完成一次书签可用性检测后，原地址和最终地址不同的结果会出现在这里。`}
          actions={[{ action: 'run-availability', label: '去做可用性检测', variant: 'primary' }]}
        />
      )}
    </div>
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
    <article
      className={[
        REDIRECT_CARD_CLASS,
        selected ? REDIRECT_CARD_SELECTED_CLASS : ''
      ].filter(Boolean).join(' ')}
    >
      <div className={REDIRECT_CARD_HEAD_CLASS}>
        <div className={REDIRECT_CARD_HEAD_LEFT_CLASS}>
          <label className={REDIRECT_CHECK_CLASS} htmlFor={`redirect-result-${result.id}`}>
            <CheckboxControl
              id={`redirect-result-${result.id}`}
              aria-label={selectionLabel}
              checked={selected}
              className={OPTION_RESULT_CHECKBOX_CLASS}
              disabled={locked}
              onCheckedChange={(checked) => handleRedirectAction({
                action: 'toggle-result',
                bookmarkId: result.id,
                checked
              })}
              unstyled
            />
            <span>选择</span>
          </label>
          <span className={REDIRECT_STATUS_BADGE_CLASS}>已跳转</span>
        </div>
        <div className={REDIRECT_CARD_ACTIONS_CLASS}>
          <Button
            className={REDIRECT_CARD_ACTION_CLASS}
            type="button"
            aria-label={updateLabel}
            disabled={locked}
            onClick={() => handleRedirectAction({
              action: 'update-result',
              bookmarkId: result.id
            })}
            unstyled
          >
            更新为最终 URL
          </Button>
          <a
            className={REDIRECT_CARD_LINK_CLASS}
            href={finalUrl}
            target="_blank"
            rel="noreferrer noopener"
            aria-label={openFinalLabel}
          >
            打开最终链接
          </a>
        </div>
      </div>
      <div className={REDIRECT_CARD_COPY_CLASS}>
        <strong className={REDIRECT_CARD_TITLE_CLASS}>{result.title || '未命名书签'}</strong>
        <div className={REDIRECT_CARD_DETAIL_CLASS}>
          原地址：<span className={REDIRECT_INLINE_URL_CLASS}>{displayUrl(result.url)}</span>
        </div>
        <div className={REDIRECT_CARD_DETAIL_CLASS}>
          最终地址：<span className={REDIRECT_INLINE_URL_CLASS}>{displayUrl(finalUrl)}</span>
        </div>
        <div className={REDIRECT_CARD_DETAIL_CLASS}>
          建议：先打开最终链接确认。
        </div>
        <p className={REDIRECT_CARD_PATH_CLASS} title={result.path || '未归档路径'}>
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
