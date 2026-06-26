import { BackupControls } from './BackupControls.js'
import { DuplicateControls, DuplicateResultsControls } from './DuplicateControls.js'
import { DuplicateGroups } from './DuplicateGroups.js'
import { FolderCleanupControls } from './FolderCleanupControls.js'
import { FolderCleanupResults } from './FolderCleanupResults.js'
import { IgnoreRules } from './IgnoreRules.js'
import {
  OPTION_PANEL_CLASS,
  OPTION_GROUP_CLASS,
  OPTION_COPY_CLASS,
  OPTION_COPY_TEXT_CLASS,
  OPTION_COPY_TITLE_CLASS,
  OPTION_PANEL_TITLE_CLASS,
  OPTION_REVEAL_ENTER_CLASS,
  OPTION_ROW_CLASS,
  OPTION_SECTION_LABEL_CLASS,
  OPTION_VALUE_CLASS
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
  'mt-5 rounded-ds-md border border-ds-border-subtle bg-ds-surface-1 p-[18px_20px_20px] shadow-none max-[760px]:p-4'
const REDIRECTS_GROUP_CLASS =
  `mt-5 rounded-ds-md border border-ds-border-subtle bg-ds-surface-1 p-[18px_20px_20px] shadow-none ${OPTION_REVEAL_ENTER_CLASS} max-[760px]:p-4`
const RECYCLE_GROUP_CLASS =
  `mt-5 rounded-ds-md border border-ds-border-subtle bg-ds-surface-1 p-[18px_20px_20px] shadow-none ${OPTION_REVEAL_ENTER_CLASS} max-[760px]:p-4`
const FOLDER_CLEANUP_GROUP_CLASS =
  `mt-5 rounded-ds-md border border-ds-border-subtle bg-ds-surface-1 p-[18px_20px_20px] shadow-none ${OPTION_REVEAL_ENTER_CLASS} max-[760px]:p-4`
const DUPLICATES_GROUP_CLASS =
  `mt-5 rounded-ds-md border border-ds-border-subtle bg-ds-surface-1 p-[18px_20px_20px] shadow-none ${OPTION_REVEAL_ENTER_CLASS} max-[760px]:p-4`

export function HistoryPanel({ hidden }: OptionsPanelVisibilityProps) {
  return (
    <section id="history" className={OPTION_PANEL_CLASS} aria-labelledby="history-title" hidden={hidden}>
      <p className={OPTION_SECTION_LABEL_CLASS}>History</p>
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
      <p className={OPTION_SECTION_LABEL_CLASS}>Data & Backup</p>
      <h1 id="backup-title" className={OPTION_PANEL_TITLE_CLASS}>数据与备份</h1>

      <BackupControls />
    </section>
  )
}

export function RedirectsPanel({ hidden }: OptionsPanelVisibilityProps) {
  return (
    <section id="redirects" className={OPTION_PANEL_CLASS} aria-labelledby="redirects-title" hidden={hidden}>
      <p className={OPTION_SECTION_LABEL_CLASS}>Redirects</p>
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
      <p className={OPTION_SECTION_LABEL_CLASS}>Duplicates</p>
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
      <p className={OPTION_SECTION_LABEL_CLASS}>文件夹清理</p>
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
      <p className={OPTION_SECTION_LABEL_CLASS}>Ignore Rules</p>
      <h1 id="ignore-title" className={OPTION_PANEL_TITLE_CLASS}>忽略规则 / 白名单</h1>
      <div className={OPTION_GROUP_CLASS}>
        <div className={OPTION_ROW_CLASS}>
          <div className={OPTION_COPY_CLASS}>
            <strong className={OPTION_COPY_TITLE_CLASS}>规则来源说明</strong>
            <p className={OPTION_COPY_TEXT_CLASS}>忽略规则从检测结果添加，不能提前手动录入。</p>
          </div>
          <span className={OPTION_VALUE_CLASS}>检测结果生成</span>
        </div>
      </div>

      <IgnoreRules />
    </section>
  )
}

export function RecyclePanel({ hidden }: OptionsPanelVisibilityProps) {
  return (
    <section id="recycle" className={OPTION_PANEL_CLASS} aria-labelledby="recycle-title" hidden={hidden}>
      <p className={OPTION_SECTION_LABEL_CLASS}>Recycle Bin</p>
      <h1 id="recycle-title" className={OPTION_PANEL_TITLE_CLASS}>回收站</h1>

      <div className={RECYCLE_GROUP_CLASS}>
        <RecycleControls />
        <RecycleBin />
      </div>
    </section>
  )
}
