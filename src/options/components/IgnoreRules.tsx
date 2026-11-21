import { displayUrl } from '../../shared/text.js'
import { Button } from '../../ui/base/Button'
import { useListExit } from '../../ui/motion/useListExit'
import { handleIgnoreRuleAction } from '../options-controller'
import { useIgnoreRulesState } from './ignore-rules-store.js'
import {
  OPTION_LIST_HEADER_CLASS,
  OPTION_LIST_ROW_CLASS,
  OPTION_LIST_SECTION_CLASS
} from './option-layout-classes.js'
import { OptionEmptyState } from './OptionEmptyState.js'
import type {
  IgnoreRuleKind,
  IgnoreRuleViewModel,
  IgnoreRulesSummaryState
} from './ignore-rules-types.js'

const ignoreSummaryMetrics = [
  { key: 'bookmarkCount', label: '书签规则' },
  { key: 'domainCount', label: '域名规则' },
  { key: 'folderCount', label: '文件夹规则' }
] satisfies Array<{
  key: keyof IgnoreRulesSummaryState
  label: string
}>

const IGNORE_SUMMARY_GRID_CLASS =
  'options-interactive-surface m-0 mt-6 grid grid-cols-4 gap-px overflow-hidden rounded-ds-md border border-ds-border-subtle bg-ds-border-subtle max-[760px]:mt-4 max-[760px]:grid-cols-2'
const IGNORE_SUMMARY_ITEM_CLASS = 'grid content-center gap-2 bg-ds-surface-1 px-5 py-4 max-[760px]:px-4'
const IGNORE_SUMMARY_LABEL_CLASS =
  'block text-xs font-medium leading-4 text-ds-text-muted'
const IGNORE_SUMMARY_VALUE_CLASS =
  'm-0 text-2xl font-semibold leading-none tracking-[-0.03em] text-ds-text-primary tabular-nums'
const IGNORE_RULE_GROUP_CLASS = OPTION_LIST_SECTION_CLASS
const IGNORE_RULE_HEADER_CLASS = OPTION_LIST_HEADER_CLASS
const IGNORE_RULE_HEADER_COPY_CLASS = 'min-w-0'
const IGNORE_RULE_TITLE_CLASS =
  'block text-sm font-semibold leading-5 tracking-[-0.01em] text-ds-text-primary'
const IGNORE_RULE_SUBTITLE_CLASS =
  'mt-1 mb-0 text-xs leading-[1.5] text-ds-text-secondary'
const IGNORE_RULE_CLEAR_BUTTON_CLASS =
  'justify-center whitespace-nowrap max-[760px]:w-full'
const IGNORE_RULE_LIST_CLASS = 'flex flex-col divide-y divide-ds-border-subtle [--list-exit-gap:0px]'
const IGNORE_RULE_EMPTY_CLASS =
  'px-5 py-5 text-[13px] leading-[1.6] text-ds-text-secondary max-[760px]:px-4'
const IGNORE_RULE_CARD_CLASS = OPTION_LIST_ROW_CLASS
const IGNORE_RULE_CARD_HEAD_CLASS =
  'flex min-w-0 items-center justify-between gap-3 max-[760px]:items-start'
const IGNORE_RULE_ACTIONS_CLASS =
  'flex min-w-0 flex-none flex-wrap items-center justify-end gap-2.5'
const IGNORE_RULE_DELETE_BUTTON_CLASS = 'shrink-0'
const IGNORE_RULE_COPY_CLASS = 'min-w-0'
const IGNORE_RULE_COPY_TITLE_CLASS =
  'block min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[15px] font-semibold leading-[1.35] text-ds-text-primary max-[760px]:whitespace-normal'
const IGNORE_RULE_DETAIL_CLASS =
  'mt-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[13px] leading-[1.55] text-ds-text-secondary max-[760px]:whitespace-normal'

export function IgnoreRules() {
  const state = useIgnoreRulesState()
  const summaryState: IgnoreRulesSummaryState = {
    bookmarkCount: state.bookmarks.length,
    domainCount: state.domains.length,
    folderCount: state.folders.length
  }
  const totalRules = summaryState.bookmarkCount + summaryState.domainCount + summaryState.folderCount
  const groups = [
    {
      clearLabel: '清空按书签忽略规则',
      detail: '跳过所选书签。',
      kind: 'bookmark',
      rules: state.bookmarks,
      title: '按书签忽略'
    },
    {
      clearLabel: '清空按域名忽略规则',
      detail: '跳过同一域名下的书签。',
      kind: 'domain',
      rules: state.domains,
      title: '按域名忽略'
    },
    {
      clearLabel: '清空按文件夹忽略规则',
      detail: '跳过此文件夹及子文件夹中的书签。',
      kind: 'folder',
      rules: state.folders,
      title: '按文件夹忽略'
    }
  ] satisfies Array<{
    clearLabel: string
    detail: string
    kind: IgnoreRuleKind
    rules: IgnoreRuleViewModel[]
    title: string
  }>

  return (
    <>
      <IgnoreRulesSummary state={summaryState} />
      {totalRules === 0 ? (
        <div className="mt-5">
          <OptionEmptyState
            title="当前没有忽略规则"
            description="在检测结果的「更多操作」中，可按书签、域名或文件夹添加规则。"
            actions={[{ action: 'run-availability', label: '去做可用性检测', variant: 'primary' }]}
          />
        </div>
      ) : null}
      {groups.flatMap((combineValue, combineIndex, combineArray) => { if (!((group) => group.rules.length > 0)(combineValue)) return []; const combinedResult = ((group) => (
        <div className={IGNORE_RULE_GROUP_CLASS} key={group.kind}>
          <div className={IGNORE_RULE_HEADER_CLASS}>
            <div className={IGNORE_RULE_HEADER_COPY_CLASS}>
              <strong className={IGNORE_RULE_TITLE_CLASS}>{group.title}</strong>
              <p className={IGNORE_RULE_SUBTITLE_CLASS}>{group.detail}</p>
            </div>
            <Button
              className={IGNORE_RULE_CLEAR_BUTTON_CLASS}
              size="sm"
              type="button"
              variant="secondary"
              aria-label={group.clearLabel}
              disabled={state.locked}
              onClick={() => handleIgnoreRuleAction({ action: 'clear', kind: group.kind })}
            >
              清空此类规则
            </Button>
          </div>
          <div className={IGNORE_RULE_LIST_CLASS}>
            <IgnoreRuleList kind={group.kind} rules={group.rules} locked={state.locked} />
          </div>
        </div>
      ))(combineValue); return [combinedResult] })}
    </>
  )
}

function IgnoreRulesSummary({ state }: { state: IgnoreRulesSummaryState }) {
  const total = state.bookmarkCount + state.domainCount + state.folderCount
  return (
    <dl className={IGNORE_SUMMARY_GRID_CLASS}>
      <div className={IGNORE_SUMMARY_ITEM_CLASS}>
        <dt className={IGNORE_SUMMARY_LABEL_CLASS}>规则总数</dt>
        <dd className={IGNORE_SUMMARY_VALUE_CLASS}>{total}</dd>
      </div>
      {ignoreSummaryMetrics.map((metric) => (
        <div className={IGNORE_SUMMARY_ITEM_CLASS} key={metric.key}>
          <dt className={IGNORE_SUMMARY_LABEL_CLASS}>{metric.label}</dt>
          <dd className={IGNORE_SUMMARY_VALUE_CLASS}>{state[metric.key]}</dd>
        </div>
      ))}
    </dl>
  )
}

function IgnoreRuleList({
  kind,
  rules,
  locked
}: {
  kind: IgnoreRuleKind
  rules: IgnoreRuleViewModel[]
  locked: boolean
}) {
  const sortedRules = rules
    .slice()
    .sort((left, right) => (Number(right.createdAt) || 0) - (Number(left.createdAt) || 0))
  const entries = useListExit(sortedRules, (rule) => `${kind}:${getIgnoreRuleId(rule, kind)}`)

  if (!rules.length && !entries.length) {
    return <div className={IGNORE_RULE_EMPTY_CLASS}>当前没有这类忽略规则。</div>
  }

  return (
    <>
      {entries.map((entry) => (
        <div ref={entry.ref} className="t-list-exit" data-exiting={entry.exiting ? 'true' : 'false'} inert={entry.exiting || undefined} key={entry.key}>
          <div className="t-list-exit-inner">
            <IgnoreRuleCard kind={kind} rule={entry.item} locked={locked} />
          </div>
        </div>
      ))}
    </>
  )
}

function IgnoreRuleCard({
  kind,
  rule,
  locked
}: {
  kind: IgnoreRuleKind
  rule: IgnoreRuleViewModel
  locked: boolean
}) {
  const title = getIgnoreRuleTitle(rule, kind)
  const detail = getIgnoreRuleDetail(rule, kind)
  const ruleId = getIgnoreRuleId(rule, kind)
  const deleteLabel = getIgnoreRuleActionLabel('取消忽略', rule, kind)

  return (
    <article className={IGNORE_RULE_CARD_CLASS}>
      <div className={IGNORE_RULE_CARD_HEAD_CLASS}>
        <div className={IGNORE_RULE_COPY_CLASS}>
          <strong className={IGNORE_RULE_COPY_TITLE_CLASS}>{title || '未命名规则'}</strong>
          {detail ? <div className={IGNORE_RULE_DETAIL_CLASS}>{detail}</div> : null}
        </div>
        <div className={IGNORE_RULE_ACTIONS_CLASS}>
          <Button variant="secondary" size="sm"
            className={IGNORE_RULE_DELETE_BUTTON_CLASS}
            type="button"
            aria-label={deleteLabel}
            disabled={locked}
            onClick={() => handleIgnoreRuleAction({ action: 'remove', kind, ruleId })}
          >
            取消忽略
          </Button>
        </div>
      </div>
    </article>
  )
}

function getIgnoreRuleTitle(rule: IgnoreRuleViewModel, kind: IgnoreRuleKind): string {
  if (kind === 'bookmark' && 'title' in rule) {
    return rule.title
  }
  if (kind === 'folder' && 'title' in rule) {
    return rule.title
  }
  if (kind === 'domain' && 'domain' in rule) {
    return rule.domain
  }
  return ''
}

function getIgnoreRuleDetail(rule: IgnoreRuleViewModel, kind: IgnoreRuleKind): string {
  if (kind === 'bookmark' && 'url' in rule) {
    return displayUrl(rule.url)
  }
  if (kind === 'folder' && 'path' in rule && 'title' in rule) {
    return rule.path || rule.title
  }
  return ''
}

function getIgnoreRuleId(rule: IgnoreRuleViewModel, kind: IgnoreRuleKind): string {
  if (kind === 'bookmark' && 'bookmarkId' in rule) {
    return rule.bookmarkId
  }
  if (kind === 'folder' && 'folderId' in rule) {
    return rule.folderId
  }
  if (kind === 'domain' && 'domain' in rule) {
    return rule.domain
  }
  return ''
}

function getIgnoreRuleActionLabel(
  action: string,
  rule: IgnoreRuleViewModel,
  kind: IgnoreRuleKind
): string {
  const title = kind === 'bookmark'
    ? getIgnoreRuleTitle(rule, kind) || getIgnoreRuleDetail(rule, kind)
    : kind === 'folder'
      ? getIgnoreRuleDetail(rule, kind) || getIgnoreRuleTitle(rule, kind)
      : getIgnoreRuleTitle(rule, kind)
  const normalizedTitle = String(title || '未命名规则')
    .replace(/\s+/g, ' ')
    .trim()
  const safeTitle = normalizedTitle.length > 48
    ? `${normalizedTitle.slice(0, 47).trim()}...`
    : normalizedTitle

  return `${action}：${safeTitle || '未命名规则'}`
}
