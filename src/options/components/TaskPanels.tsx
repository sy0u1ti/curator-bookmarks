import { BackupControls } from './BackupControls.js'
import { DuplicateControls, DuplicateResultsControls } from './DuplicateControls.js'
import { DuplicateGroups } from './DuplicateGroups.js'
import { IgnoreRules } from './IgnoreRules.js'
import {
  OPTION_PANEL_CLASS,
  OPTION_PANEL_SETTINGS_CLASS
} from './option-layout-classes.js'
import { OptionPanelHeader } from './OptionPanelHeader.js'
import { RedirectControls } from './RedirectControls.js'
import { RedirectResults } from './RedirectResults.js'
import { RecycleBin } from './RecycleBin.js'
import { RecycleControls } from './RecycleControls.js'
import { ResultsPagination } from './ResultsPagination.js'
import { ScopePickerTrigger } from './ScopePickerTrigger.js'
import { AvailabilityHistory } from './AvailabilityHistory.js'

interface OptionsPanelVisibilityProps {
  hidden: boolean
}

type TaskPanelKey = 'history' | 'backup' | 'redirects' | 'duplicates' | 'ignore' | 'recycle'

export function TaskPanel({ hidden, sectionKey }: OptionsPanelVisibilityProps & { sectionKey: TaskPanelKey }) {
  if (sectionKey === 'history') return <HistoryPanel hidden={hidden} />
  if (sectionKey === 'backup') return <BackupPanel hidden={hidden} />
  if (sectionKey === 'redirects') return <RedirectsPanel hidden={hidden} />
  if (sectionKey === 'duplicates') return <DuplicatesPanel hidden={hidden} />
  if (sectionKey === 'ignore') return <IgnoreRulesPanel hidden={hidden} />
  return <RecyclePanel hidden={hidden} />
}

export function HistoryPanel({ hidden }: OptionsPanelVisibilityProps) {
  return (
    <section id="history" className={OPTION_PANEL_CLASS} aria-labelledby="history-title" hidden={hidden}>
      <OptionPanelHeader titleId="history-title" title="检测历史" />

      <ScopePickerTrigger source="history" />

      <AvailabilityHistory />
    </section>
  )
}

export function BackupPanel({ hidden }: OptionsPanelVisibilityProps) {
  return (
    <section id="backup" className={OPTION_PANEL_SETTINGS_CLASS} aria-labelledby="backup-title" hidden={hidden}>
      <OptionPanelHeader titleId="backup-title" title="数据与备份" />

      <BackupControls />
    </section>
  )
}

export function RedirectsPanel({ hidden }: OptionsPanelVisibilityProps) {
  return (
    <section id="redirects" className={OPTION_PANEL_CLASS} aria-labelledby="redirects-title" hidden={hidden}>
      <OptionPanelHeader titleId="redirects-title" title="网址更新" />

      <RedirectControls />
      <RedirectResults />
      <ResultsPagination kind="redirects" ariaLabel="重定向结果分页" />
    </section>
  )
}

export function DuplicatesPanel({ hidden }: OptionsPanelVisibilityProps) {
  return (
    <section id="duplicates" className={OPTION_PANEL_CLASS} aria-labelledby="duplicates-title" hidden={hidden}>
      <OptionPanelHeader titleId="duplicates-title" title="重复书签检测" />

      <DuplicateControls />
      <DuplicateResultsControls />
      <DuplicateGroups />
    </section>
  )
}

export function IgnoreRulesPanel({ hidden }: OptionsPanelVisibilityProps) {
  return (
    <section id="ignore" className={OPTION_PANEL_CLASS} aria-labelledby="ignore-title" hidden={hidden}>
      <OptionPanelHeader titleId="ignore-title" title="忽略规则" />

      <IgnoreRules />
    </section>
  )
}

export function RecyclePanel({ hidden }: OptionsPanelVisibilityProps) {
  return (
    <section id="recycle" className={OPTION_PANEL_CLASS} aria-labelledby="recycle-title" hidden={hidden}>
      <OptionPanelHeader titleId="recycle-title" title="回收站" />

      <RecycleControls />
      <RecycleBin />
    </section>
  )
}
