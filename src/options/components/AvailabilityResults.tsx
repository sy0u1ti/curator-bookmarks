import { displayUrl } from '../../shared/text.js'
import { Button } from '../../ui/base/Button.js'
import { CheckboxControl } from '../../ui/base/Checkbox.js'
import { cx } from '../../ui/base/utils.js'
import { handleAvailabilityResultAction } from '../options-controller'
import { useAvailabilityResultsState } from './availability-results-store.js'
import { OPTION_RESULT_CHECKBOX_CLASS } from './option-layout-classes.js'
import type {
  AvailabilityResultCardViewModel,
  AvailabilityResultPanelKind
} from './availability-results-types.js'

const AVAILABILITY_RESULT_CARD_CLASS =
  'rounded-[18px] border border-[var(--ui-divider-subtle)] bg-[#171719] p-[14px_16px]'
const AVAILABILITY_RESULT_CARD_SELECTED_CLASS = '!border-[rgba(245,245,247,0.22)] !bg-[#1e1e22]'
const AVAILABILITY_RESULT_EMPTY_CLASS =
  'rounded-[18px] border border-[var(--ui-divider-subtle)] bg-[#171719] p-[18px_16px] text-[13px] leading-[1.7] text-[var(--ui-text-secondary)]'
const AVAILABILITY_RESULT_HEAD_CLASS =
  'flex min-w-0 items-start justify-between gap-3 max-[760px]:flex-col'
const AVAILABILITY_RESULT_HEAD_LEFT_CLASS = 'flex min-w-0 flex-wrap items-center gap-2.5'
const AVAILABILITY_RESULT_CHECK_CLASS =
  'inline-flex items-center gap-2 text-xs font-semibold text-[var(--ui-text-secondary)]'
const AVAILABILITY_RESULT_ACTIONS_CLASS = 'flex min-w-0 flex-wrap items-center justify-end gap-2.5'
const AVAILABILITY_RESULT_LINK_CLASS =
  'border-0 bg-transparent p-0 text-xs font-semibold text-[var(--ui-text-disabled)] transition-colors duration-[var(--ui-motion-standard)] ease-[var(--ui-ease-standard)] hover:text-[var(--ui-text-primary)] focus-visible:text-[var(--ui-text-primary)]'
const AVAILABILITY_RESULT_COPY_CLASS = 'mt-3 min-w-0'
const AVAILABILITY_RESULT_TITLE_CLASS =
  'block min-w-0 text-[15px] font-semibold leading-[1.4] text-[var(--ui-text-primary)] [overflow-wrap:anywhere]'
const AVAILABILITY_RESULT_URL_CLASS =
  'mt-[7px] inline-block text-[13px] leading-[1.6] text-[var(--ui-text-secondary)] [overflow-wrap:anywhere] [word-break:break-word]'
const AVAILABILITY_RESULT_DETAIL_CLASS =
  'mt-[7px] mb-0 text-[13px] leading-[1.6] text-[var(--ui-text-secondary)] [overflow-wrap:anywhere] [word-break:break-word]'
const AVAILABILITY_RESULT_PATH_CLASS =
  'mt-[7px] mb-0 text-[13px] leading-[1.6] text-[var(--ui-text-disabled)] [overflow-wrap:anywhere] [word-break:break-word]'
const AVAILABILITY_RESULT_ACTION_CLASS =
  'border-0 bg-transparent p-0 font-[inherit] text-xs font-semibold text-[var(--ui-text-disabled)] transition-colors duration-[var(--ui-motion-standard)] ease-[var(--ui-ease-standard)] hover:text-[var(--ui-text-primary)] focus-visible:text-[var(--ui-text-primary)] disabled:cursor-default disabled:opacity-50 disabled:hover:text-[var(--ui-text-disabled)] disabled:focus-visible:text-[var(--ui-text-disabled)]'
const AVAILABILITY_RESULT_META_CLASS = 'mt-2.5 flex flex-wrap gap-2'
const AVAILABILITY_RESULT_META_ITEM_CLASS =
  'max-w-full text-xs leading-[1.45] text-[var(--ui-text-disabled)] [overflow-wrap:anywhere]'
const AVAILABILITY_RESULT_QUICK_ACTIONS_CLASS =
  'mt-[13px] flex flex-wrap items-start gap-2 border-t border-[var(--ui-divider-subtle)] pt-3'
const AVAILABILITY_RESULT_QUICK_ACTION_PAIR_CLASS = 'inline-flex min-w-0 items-baseline gap-1.5'
const AVAILABILITY_RESULT_QUICK_ACTION_IMPACT_CLASS =
  'max-w-[190px] text-xs leading-[1.45] text-[var(--ui-text-disabled)] [overflow-wrap:anywhere]'
const AVAILABILITY_RESULT_BADGE_BASE_CLASS =
  'inline-flex min-h-6 max-w-full items-center justify-center rounded-full border px-2.5 text-xs font-semibold leading-none tracking-[0] [overflow-wrap:anywhere]'
const AVAILABILITY_RESULT_BADGE_TONE_CLASSES: Record<string, string> = {
  danger: 'border-[rgba(255,138,130,0.22)] bg-[rgba(255,138,130,0.12)] text-[#ffb7b0]',
  muted: 'border-[var(--ui-surface-hover)] bg-[var(--ui-surface-raised)] text-[var(--ui-text-tertiary)]',
  success: 'border-[rgba(170,237,189,0.32)] bg-[rgba(170,237,189,0.16)] text-[#e2ffe9]',
  warning: 'border-[rgba(255,206,141,0.2)] bg-[rgba(255,206,141,0.12)] text-[#ffdca5]'
}

export function AvailabilityResults({ kind }: { kind: AvailabilityResultPanelKind }) {
  const state = useAvailabilityResultsState(kind)

  if (!state.results.length) {
    return <div className={AVAILABILITY_RESULT_EMPTY_CLASS}>{state.emptyMessage}</div>
  }

  return (
    <>
      {state.results.map((result) => (
        <AvailabilityResultCard key={result.bookmarkId} kind={kind} result={result} />
      ))}
    </>
  )
}

function AvailabilityResultCard({
  kind,
  result
}: {
  kind: AvailabilityResultPanelKind
  result: AvailabilityResultCardViewModel
}) {
  const statusBadgeClassName = cx(
    AVAILABILITY_RESULT_BADGE_BASE_CLASS,
    AVAILABILITY_RESULT_BADGE_TONE_CLASSES[result.tone] || AVAILABILITY_RESULT_BADGE_TONE_CLASSES.muted
  )
  const modeBadgeClassName = cx(
    AVAILABILITY_RESULT_BADGE_BASE_CLASS,
    AVAILABILITY_RESULT_BADGE_TONE_CLASSES.muted
  )

  return (
    <article
      className={[
        AVAILABILITY_RESULT_CARD_CLASS,
        result.selected ? AVAILABILITY_RESULT_CARD_SELECTED_CLASS : ''
      ].filter(Boolean).join(' ')}
    >
      <div className={AVAILABILITY_RESULT_HEAD_CLASS}>
        <div className={AVAILABILITY_RESULT_HEAD_LEFT_CLASS}>
          {result.selectable ? (
            <label className={AVAILABILITY_RESULT_CHECK_CLASS}>
              <CheckboxControl
                aria-label={result.selectionLabel}
                className={OPTION_RESULT_CHECKBOX_CLASS}
                checked={result.selected}
                disabled={result.selectionDisabled}
                onCheckedChange={(checked) => {
                  handleAvailabilityResultAction({
                    action: 'toggle-selection',
                    bookmarkId: result.bookmarkId,
                    checked: Boolean(checked),
                    panel: kind
                  })
                }}
                unstyled
              />
              <span>选择</span>
            </label>
          ) : null}
          <span className={statusBadgeClassName}>{result.statusLabel}</span>
          <span className={modeBadgeClassName}>{result.badgeText}</span>
        </div>
        <div className={AVAILABILITY_RESULT_ACTIONS_CLASS}>
          <AvailabilityPanelMoveAction kind={kind} result={result} />
          {result.url ? (
            <a
              className={AVAILABILITY_RESULT_LINK_CLASS}
              href={result.url}
              target="_blank"
              rel="noreferrer noopener"
              aria-label={result.openLabel}
            >
              打开链接
            </a>
          ) : null}
        </div>
      </div>
      <div className={AVAILABILITY_RESULT_COPY_CLASS}>
        <strong className={AVAILABILITY_RESULT_TITLE_CLASS}>{result.title || '未命名书签'}</strong>
        {result.url ? (
          <a className={AVAILABILITY_RESULT_URL_CLASS} href={result.url} target="_blank" rel="noreferrer noopener">
            {displayUrl(result.url)}
          </a>
        ) : (
          <p className={AVAILABILITY_RESULT_URL_CLASS}>无可打开 URL</p>
        )}
        {result.showFinalUrl ? (
          <p className={AVAILABILITY_RESULT_DETAIL_CLASS}>最终地址：{displayUrl(result.finalUrl)}</p>
        ) : null}
        <p className={AVAILABILITY_RESULT_DETAIL_CLASS}>{result.recommendation}</p>
        <p className={AVAILABILITY_RESULT_DETAIL_CLASS}>证据摘要：{result.evidenceCopy}</p>
        <p className={AVAILABILITY_RESULT_PATH_CLASS} title={result.path || '未归档路径'}>
          路径：{result.path || '未归档路径'}
        </p>
        <div className={AVAILABILITY_RESULT_META_CLASS}>
          {result.metadataItems.map((item) => (
            <span className={AVAILABILITY_RESULT_META_ITEM_CLASS} key={`${result.bookmarkId}:${item}`}>{item}</span>
          ))}
        </div>
        <AvailabilityQuickActions kind={kind} result={result} />
      </div>
    </article>
  )
}

function AvailabilityPanelMoveAction({
  kind,
  result
}: {
  kind: AvailabilityResultPanelKind
  result: AvailabilityResultCardViewModel
}) {
  if (!result.actionButton) {
    return null
  }

  return (
    <Button
      className={AVAILABILITY_RESULT_ACTION_CLASS}
      type="button"
      aria-label={result.actionButton.ariaLabel}
      disabled={result.actionButton.disabled}
      onClick={() => {
        if (!result.actionButton) {
          return
        }
        handleAvailabilityResultAction({
          action: result.actionButton.action,
          bookmarkId: result.bookmarkId,
          panel: kind
        })
      }}
      unstyled
    >
      {result.actionButton.label}
    </Button>
  )
}

function AvailabilityQuickActions({
  kind,
  result
}: {
  kind: AvailabilityResultPanelKind
  result: AvailabilityResultCardViewModel
}) {
  if (!result.quickActions.length) {
    return null
  }

  return (
    <div className={AVAILABILITY_RESULT_QUICK_ACTIONS_CLASS} aria-label="异常结果忽略操作">
      {result.quickActions.map((action) => (
        <span className={AVAILABILITY_RESULT_QUICK_ACTION_PAIR_CLASS} key={`${result.bookmarkId}:${action.action}`}>
          <Button
            className={AVAILABILITY_RESULT_ACTION_CLASS}
            type="button"
            aria-label={`${action.label}：${action.impact}`}
            title={action.impact}
            disabled={action.disabled}
            onClick={() => handleAvailabilityResultAction({
              action: action.action,
              bookmarkId: result.bookmarkId,
              panel: kind
            })}
            unstyled
          >
            {action.label}
          </Button>
          <span className={AVAILABILITY_RESULT_QUICK_ACTION_IMPACT_CLASS}>{action.impact}</span>
        </span>
      ))}
    </div>
  )
}
