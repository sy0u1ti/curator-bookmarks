import { BackupControls } from './BackupControls.js'
import { DuplicateControls, DuplicateResultsControls } from './DuplicateControls.js'
import { DuplicateGroups } from './DuplicateGroups.js'
import { FolderCleanupControls } from './FolderCleanupControls.js'
import { FolderCleanupResults } from './FolderCleanupResults.js'
import { IgnoreRules } from './IgnoreRules.js'
import {
  OPTION_PANEL_CLASS,
  OPTION_PANEL_TITLE_CLASS,
  OPTION_TOOL_PANEL_CLASS
} from './option-layout-classes.js'
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

const AVAILABILITY_HISTORY_GROUP_CLASS =
  OPTION_TOOL_PANEL_CLASS
const REDIRECTS_GROUP_CLASS =
  OPTION_TOOL_PANEL_CLASS
const RECYCLE_GROUP_CLASS =
  OPTION_TOOL_PANEL_CLASS
const FOLDER_CLEANUP_GROUP_CLASS =
  OPTION_TOOL_PANEL_CLASS
const DUPLICATES_GROUP_CLASS =
  OPTION_TOOL_PANEL_CLASS

export function HistoryPanel({ hidden }: OptionsPanelVisibilityProps) {
  return (
    <section id="history" className={OPTION_PANEL_CLASS} aria-labelledby="history-title" hidden={hidden}>
      <h1 id="history-title" className={OPTION_PANEL_TITLE_CLASS}>检测历史</h1>

      <ScopePickerTrigger source="history" />

      <div className={AVAILABILITY_HISTORY_GROUP_CLASS}>
        <AvailabilityHistory />
      </div>
    </section>
  )
}

export function BackupPanel({ hidden }: OptionsPanelVisibilityProps) {
  return (
    <section id="backup" className={OPTION_PANEL_CLASS} aria-labelledby="backup-title" hidden={hidden}>
      <h1 id="backup-title" className={OPTION_PANEL_TITLE_CLASS}>数据与备份</h1>

      <BackupControls />
    </section>
  )
}

export function RedirectsPanel({ hidden }: OptionsPanelVisibilityProps) {
  return (
    <section id="redirects" className={OPTION_PANEL_CLASS} aria-labelledby="redirects-title" hidden={hidden}>
      <h1 id="redirects-title" className={OPTION_PANEL_TITLE_CLASS}>重定向更新</h1>

      <div className={REDIRECTS_GROUP_CLASS}>
        <RedirectControls />
        <RedirectResults />
        <ResultsPagination kind="redirects" ariaLabel="重定向结果分页" />
      </div>
    </section>
  )
}

export function DuplicatesPanel({ hidden }: OptionsPanelVisibilityProps) {
  return (
    <section id="duplicates" className={OPTION_PANEL_CLASS} aria-labelledby="duplicates-title" hidden={hidden}>
      <h1 id="duplicates-title" className={OPTION_PANEL_TITLE_CLASS}>重复书签检测</h1>

      <DuplicateControls />

      <div className={DUPLICATES_GROUP_CLASS}>
        <DuplicateResultsControls />
        <DuplicateGroups />
      </div>
    </section>
  )
}

export function FolderCleanupPanel({ hidden }: OptionsPanelVisibilityProps) {
  return (
    <section id="folder-cleanup" className={OPTION_PANEL_CLASS} aria-labelledby="folder-cleanup-title" hidden={hidden}>
      <h1 id="folder-cleanup-title" className={OPTION_PANEL_TITLE_CLASS}>文件夹清理</h1>

      <div className={FOLDER_CLEANUP_GROUP_CLASS}>
        <FolderCleanupControls />
        <FolderCleanupResults />
      </div>
    </section>
  )
}

export function IgnoreRulesPanel({ hidden }: OptionsPanelVisibilityProps) {
  return (
    <section id="ignore" className={OPTION_PANEL_CLASS} aria-labelledby="ignore-title" hidden={hidden}>
      <h1 id="ignore-title" className={OPTION_PANEL_TITLE_CLASS}>忽略规则</h1>

      <IgnoreRules />
    </section>
  )
}

export function RecyclePanel({ hidden }: OptionsPanelVisibilityProps) {
  return (
    <section id="recycle" className={OPTION_PANEL_CLASS} aria-labelledby="recycle-title" hidden={hidden}>
      <h1 id="recycle-title" className={OPTION_PANEL_TITLE_CLASS}>回收站</h1>

      <div className={RECYCLE_GROUP_CLASS}>
        <RecycleControls />
        <RecycleBin />
      </div>
    </section>
  )
}
