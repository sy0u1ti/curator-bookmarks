import { displayUrl } from '../../shared/text.js'
import { Button } from '../../ui/base/Button'
import { CheckboxControl } from '../../ui/base/Checkbox'
import { Icon } from '../../ui/icons/Icon'
import type { IconName } from '../../ui/icons/icon-map'
import { cx } from '../../ui/base/utils'
import { handleAvailabilityResultAction } from '../options-controller'
import { useAvailabilityResultsState } from './availability-results-store.js'
import { OPTION_RESULT_CHECKBOX_CLASS } from './option-layout-classes.js'
import { OptionEmptyState } from './OptionEmptyState.js'
import { OptionDetails } from './OptionDetails.js'
import { OptionActionsMenu, type OptionMenuAction } from './OptionActionsMenu.js'
import type { AvailabilityResultCardViewModel, AvailabilityResultPanelKind } from './availability-results-types.js'

const CARD_CLASS = 'min-w-0 rounded-ds-sm border border-ds-border-subtle bg-ds-surface-1 p-4'
const BADGE_CLASS = 'inline-flex min-h-6 max-w-full items-center rounded-full border px-2.5 py-1 text-xs font-medium leading-4'
const TONES: Record<string, string> = {
  danger: 'border-ds-danger/35 bg-ds-danger-soft text-ds-danger-text',
  warning: 'border-ds-warning/35 bg-ds-warning-soft text-ds-warning',
  success: 'border-ds-success/35 bg-ds-success-soft text-ds-success-text',
  muted: 'border-ds-border bg-ds-surface-2 text-ds-text-secondary'
}
const ACTION_ICONS: Record<string, IconName> = { 'hide-run': 'EyeOff', 'ignore-bookmark': 'Bookmark', 'ignore-domain': 'Globe', 'ignore-folder': 'Folder' }
const DETAIL_TEXT = 'm-0 text-[13px] leading-[1.65] text-ds-text-secondary [overflow-wrap:anywhere]'

export function AvailabilityResults({ kind }: { kind: AvailabilityResultPanelKind }) {
  const state = useAvailabilityResultsState(kind)
  if (!state.results.length) return <OptionEmptyState title={kind === 'failed' ? '没有高置信异常' : '没有待确认异常'} description={state.emptyMessage} />
  return <>{state.results.map(result => <AvailabilityResultCard key={result.bookmarkId} kind={kind} result={result} />)}</>
}

function AvailabilityResultCard({ kind, result }: { kind: AvailabilityResultPanelKind; result: AvailabilityResultCardViewModel }) {
  const actions: OptionMenuAction[] = result.quickActions.map(action => ({
    id: action.action, label: action.label, description: action.impact,
    icon: ACTION_ICONS[action.action], disabled: action.disabled,
    separatorBefore: action.action === 'ignore-bookmark',
    onSelect: () => handleAvailabilityResultAction({ action: action.action, bookmarkId: result.bookmarkId, panel: kind })
  }))
  if (result.actionButton) {
    const action = result.actionButton
    actions.push({ id: action.action, label: action.label, disabled: action.disabled, separatorBefore: true,
      description: action.action === 'promote-failed' ? '手动归类，移入高置信异常区' : '保留结果，等待进一步确认',
      onSelect: () => handleAvailabilityResultAction({ action: action.action, bookmarkId: result.bookmarkId, panel: kind }) })
  }
  return (
    <article data-availability-result={result.bookmarkId} className={cx(CARD_CLASS, result.selected && 'border-ds-border-hover bg-ds-selected')}>
      <div className="flex min-w-0 items-start gap-3">
        {result.selectable ? (
          <label className="inline-flex min-h-6 min-w-6 cursor-pointer items-center justify-center" htmlFor={'availability-result-' + kind + '-' + result.bookmarkId}>
            <CheckboxControl
              id={'availability-result-' + kind + '-' + result.bookmarkId}
              aria-label={result.selectionLabel}
              className={OPTION_RESULT_CHECKBOX_CLASS}
              checked={result.selected}
              disabled={result.selectionDisabled}
              onCheckedChange={checked => handleAvailabilityResultAction({ action: 'toggle-selection', bookmarkId: result.bookmarkId, checked: Boolean(checked), panel: kind })}
              unstyled
            />
          </label>
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
            <strong className="min-w-0 flex-1 text-[15px] font-semibold leading-6 text-ds-text-primary [overflow-wrap:anywhere]">{result.title || '未命名书签'}</strong>
            <span className={cx(BADGE_CLASS, TONES[result.tone] || TONES.muted)}>{result.badgeText || result.statusLabel}</span>
          </div>
          {result.url ? (
            <a className="mt-1 block truncate text-[13px] leading-5 text-ds-text-secondary underline-offset-4 hover:text-ds-text-primary hover:underline focus-visible:rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-ds-focus"
              href={result.url} target="_blank" rel="noreferrer noopener" title={result.url}>
              {displayUrl(result.url)}
            </a>
          ) : <p className="m-0 mt-1 text-xs text-ds-text-muted">无可打开的地址</p>}
        </div>
      </div>
      <p className="mb-0 mt-2 text-[13px] leading-[1.6] text-ds-text-secondary">{result.summary}</p>
      <OptionDetails
        className="mt-3"
        label="检测详情"
        ariaLabel={'检测详情：' + result.title}
        actions={<>
          {result.url ? <Button size="sm" variant="secondary" aria-label={result.openLabel} render={<a aria-label={result.openLabel} href={result.url} target="_blank" rel="noreferrer noopener" />}>
            <Icon name="ExternalLink" size={14} aria-hidden="true" />打开链接
          </Button> : null}
          {result.selectable ? <Button size="sm" variant="secondary" disabled={result.retestDisabled} aria-label={'重新检测：' + result.title}
            onClick={() => handleAvailabilityResultAction({ action: 'retest', bookmarkId: result.bookmarkId, panel: kind })}>
            <Icon name="RefreshCw" size={14} aria-hidden="true" />重新检测
          </Button> : null}
          <OptionActionsMenu actions={actions} label={'更多操作：' + result.title} />
        </>}
      >
        <div className="grid min-w-0 gap-3">
          <div>
            <strong className="mb-1 block text-xs font-medium text-ds-text-primary">检测依据</strong>
            <p className={DETAIL_TEXT}>{result.evidenceCopy || '暂无详细检测记录。'}</p>
          </div>
          <dl className="m-0 grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2 text-xs leading-[1.6]">
            <dt className="text-ds-text-muted">文件夹</dt><dd className="m-0 text-ds-text-secondary [overflow-wrap:anywhere]">{result.path || '未归档'}</dd>
            {result.showFinalUrl ? <><dt className="text-ds-text-muted">最终地址</dt><dd className="m-0 text-ds-text-secondary [overflow-wrap:anywhere]">{result.finalUrl}</dd></> : null}
          </dl>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs leading-[1.6] text-ds-text-muted">
            {result.metadataItems.map(item => <span key={item}>{item}</span>)}
          </div>
        </div>
      </OptionDetails>
    </article>
  )
}
