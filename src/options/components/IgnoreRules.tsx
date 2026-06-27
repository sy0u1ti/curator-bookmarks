import { displayUrl } from '../../shared/text.js'
import { Button, Card, NumberPop } from '../../ui'
import { handleIgnoreRuleAction } from '../options-controller'
import { useIgnoreRulesState } from './ignore-rules-store.js'
import { OPTION_REVEAL_ENTER_CLASS } from './option-layout-classes.js'
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
  'mt-5 grid grid-cols-3 gap-3 max-[920px]:grid-cols-1'
const IGNORE_SUMMARY_CARD_CLASS =
  'min-h-[96px] rounded-ds-md border border-ds-border-subtle bg-ds-surface-1 p-4 shadow-none'
const IGNORE_SUMMARY_LABEL_CLASS =
  'block text-xs font-semibold leading-[1.3] text-ds-text-muted'
const IGNORE_SUMMARY_VALUE_CLASS =
  'mt-2 block text-[26px] font-bold leading-none tracking-[0] text-ds-text-primary'
const IGNORE_RULE_GROUP_CLASS =
  `mt-5 rounded-ds-md border border-ds-border-subtle bg-ds-surface-1 p-[18px_20px_20px] shadow-none ${OPTION_REVEAL_ENTER_CLASS} max-[760px]:p-4`
const IGNORE_RULE_HEADER_CLASS =
  'flex min-w-0 flex-wrap items-center justify-between gap-3'
const IGNORE_RULE_HEADER_COPY_CLASS = 'min-w-0'
const IGNORE_RULE_TITLE_CLASS =
  'block text-[15px] font-semibold leading-[1.35] tracking-[0] text-ds-text-primary'
const IGNORE_RULE_SUBTITLE_CLASS =
  'mt-2 text-[13px] leading-[1.7] text-ds-text-secondary'
const IGNORE_RULE_CLEAR_BUTTON_CLASS =
  'justify-center whitespace-nowrap max-[760px]:w-full'
const IGNORE_RULE_LIST_CLASS = 'mt-4 flex flex-col gap-3'
const IGNORE_RULE_EMPTY_CLASS =
  'rounded-ds-sm border border-ds-border-subtle bg-ds-surface-1 px-4 py-[18px] text-[13px] leading-[1.7] text-ds-text-secondary'
const IGNORE_RULE_CARD_CLASS =
  'rounded-ds-sm border border-ds-border-subtle bg-ds-surface-1 p-[14px_16px]'
const IGNORE_RULE_CARD_HEAD_CLASS =
  'flex min-w-0 items-start justify-between gap-3'
const IGNORE_RULE_CARD_HEAD_LEFT_CLASS =
  'flex min-w-0 flex-wrap items-center gap-2'
const IGNORE_RULE_BADGE_CLASS =
  'inline-flex min-h-[26px] items-center whitespace-nowrap rounded-full border border-ds-hover bg-ds-surface-2 px-[10px] text-[11px] font-semibold leading-none tracking-[0] text-ds-text-muted'
const IGNORE_RULE_ACTIONS_CLASS =
  'flex min-w-0 flex-wrap items-center justify-end gap-2.5'
const IGNORE_RULE_DELETE_BUTTON_CLASS =
  'border-0 bg-transparent p-0 font-[inherit] text-xs font-semibold text-ds-text-disabled transition-colors hover:text-ds-text-secondary focus-visible:rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-focus'
const IGNORE_RULE_COPY_CLASS = 'mt-3 min-w-0'
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
  const groups = [
    {
      clearLabel: '清空按书签忽略规则',
      detail: '仅压制指定书签本身的异常提示。',
      kind: 'bookmark',
      rules: state.bookmarks,
      title: '按书签忽略'
    },
    {
      clearLabel: '清空按域名忽略规则',
      detail: '同一域名下的异常提示会被压制。',
      kind: 'domain',
      rules: state.domains,
      title: '按域名忽略'
    },
    {
      clearLabel: '清空按文件夹忽略规则',
      detail: '命中该文件夹及其子层级的异常提示会被压制。',
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
      {groups.map((group) => (
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
              disabled={group.rules.length === 0}
              onClick={() => handleIgnoreRuleAction({ action: 'clear', kind: group.kind })}
            >
              清空本类
            </Button>
          </div>
          <div className={IGNORE_RULE_LIST_CLASS}>
            <IgnoreRuleList kind={group.kind} rules={group.rules} />
          </div>
        </div>
      ))}
    </>
  )
}

function IgnoreRulesSummary({ state }: { state: IgnoreRulesSummaryState }) {
  return (
    <div className={IGNORE_SUMMARY_GRID_CLASS}>
      {ignoreSummaryMetrics.map((metric) => (
        <Card className={IGNORE_SUMMARY_CARD_CLASS} key={metric.key}>
          <span className={IGNORE_SUMMARY_LABEL_CLASS}>{metric.label}</span>
          <strong className={IGNORE_SUMMARY_VALUE_CLASS}>
            <NumberPop text={state[metric.key]} />
          </strong>
        </Card>
      ))}
    </div>
  )
}

function IgnoreRuleList({
  kind,
  rules
}: {
  kind: IgnoreRuleKind
  rules: IgnoreRuleViewModel[]
}) {
  if (!rules.length) {
    return <div className={IGNORE_RULE_EMPTY_CLASS}>当前没有这类忽略规则。</div>
  }

  return (
    <>
      {rules
        .slice()
        .sort((left, right) => (Number(right.createdAt) || 0) - (Number(left.createdAt) || 0))
        .map((rule) => (
          <IgnoreRuleCard kind={kind} key={`${kind}:${getIgnoreRuleId(rule, kind)}`} rule={rule} />
        ))}
    </>
  )
}

function IgnoreRuleCard({
  kind,
  rule
}: {
  kind: IgnoreRuleKind
  rule: IgnoreRuleViewModel
}) {
  const title = getIgnoreRuleTitle(rule, kind)
  const detail = getIgnoreRuleDetail(rule, kind)
  const ruleId = getIgnoreRuleId(rule, kind)
  const deleteLabel = getIgnoreRuleActionLabel('删除忽略规则', rule, kind)

  return (
    <article className={IGNORE_RULE_CARD_CLASS}>
      <div className={IGNORE_RULE_CARD_HEAD_CLASS}>
        <div className={IGNORE_RULE_CARD_HEAD_LEFT_CLASS}>
          <span className={IGNORE_RULE_BADGE_CLASS}>忽略规则</span>
        </div>
        <div className={IGNORE_RULE_ACTIONS_CLASS}>
          <Button
            className={IGNORE_RULE_DELETE_BUTTON_CLASS}
            type="button"
            aria-label={deleteLabel}
            onClick={() => handleIgnoreRuleAction({ action: 'remove', kind, ruleId })}
            unstyled
          >
            删除规则
          </Button>
        </div>
      </div>
      <div className={IGNORE_RULE_COPY_CLASS}>
        <strong className={IGNORE_RULE_COPY_TITLE_CLASS}>{title || '未命名规则'}</strong>
        <div className={IGNORE_RULE_DETAIL_CLASS}>{detail || ''}</div>
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
  return '按域名忽略'
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
