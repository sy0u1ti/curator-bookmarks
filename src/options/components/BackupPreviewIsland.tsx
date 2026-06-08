import { flushSync } from 'react-dom'
import { createRoot, type Root } from 'react-dom/client'
import type { BackupRestorePreview } from '../../shared/backup.js'
import { Button } from '../../ui/primitives/Button.js'
import { Input } from '../../ui/primitives/Input.js'
import { ThemeProvider } from '../../ui/theme/ThemeProvider.js'
import { dispatchBackupAction } from './backup-events.js'

export interface BackupPreviewState {
  preview: BackupRestorePreview | null
}

export interface BackupControlsState {
  backup: {
    busy: boolean
    hasBackup: boolean
    preview: BackupRestorePreview | null
    status: string
  }
  tagData: {
    busy: boolean
    countLabel: string
    hasRecords: boolean
    status: string
    updatedLabel: string
  }
}

const roots = new WeakMap<Element, Root>()

export function renderBackupPreviewIsland(container: Element, state: BackupPreviewState): void {
  let root = roots.get(container)
  if (!root) {
    root = createRoot(container)
    roots.set(container, root)
  }

  flushSync(() => {
    root.render(
      <ThemeProvider>
        <BackupPreview state={state} />
      </ThemeProvider>
    )
  })
}

export function renderBackupControlsIsland(container: Element, state: BackupControlsState): void {
  let root = roots.get(container)
  if (!root) {
    root = createRoot(container)
    roots.set(container, root)
  }

  flushSync(() => {
    root.render(
      <ThemeProvider>
        <BackupControls state={state} />
      </ThemeProvider>
    )
  })
}

function BackupControls({ state }: { state: BackupControlsState }) {
  return (
    <>
      <div className="options-group ai-tag-data-card">
        <div className="detect-results-header ai-tag-data-head">
          <div>
            <strong>标签数据</strong>
            <p className="detect-results-subtitle">
              这里保存 AI 生成的摘要、主题和别名，以及 AI 生成或手动维护的标签。可单独导出/导入，也会包含在完整备份中；清空只删除本地标签索引，不删除 Chrome 书签。
            </p>
          </div>
          <span id="ai-tag-data-count" className="option-value">{state.tagData.countLabel}</span>
        </div>
        <div className="detect-results-header ai-tag-data-row">
          <div>
            <p id="ai-tag-data-updated" className="detect-results-subtitle">{state.tagData.updatedLabel}</p>
            <p id="ai-tag-data-status" className="detect-status-copy">{state.tagData.status}</p>
          </div>
          <div className="detect-results-actions">
            <Button
              id="ai-tag-export"
              className="options-button secondary small"
              size="sm"
              type="button"
              variant="secondary"
              aria-label="导出书签标签数据"
              disabled={!state.tagData.hasRecords || state.tagData.busy}
              focusableWhenDisabled={state.tagData.busy}
              onClick={() => dispatchBackupAction({ action: 'export-tags' })}
            >
              导出标签数据
            </Button>
            <Button
              id="ai-tag-import"
              className="options-button secondary small"
              size="sm"
              type="button"
              variant="secondary"
              aria-label="导入书签标签数据"
              disabled={state.tagData.busy}
              focusableWhenDisabled={state.tagData.busy}
              onClick={() => clickFileInput('ai-tag-import-input')}
            >
              导入标签数据
            </Button>
            <Button
              id="ai-tag-clear"
              className="options-button danger small"
              size="sm"
              type="button"
              variant="danger"
              aria-label="清空全部书签标签数据"
              disabled={!state.tagData.hasRecords || state.tagData.busy}
              focusableWhenDisabled={state.tagData.busy}
              onClick={() => dispatchBackupAction({ action: 'clear-tags' })}
            >
              清空标签数据
            </Button>
          </div>
          <Input
            id="ai-tag-import-input"
            aria-label="导入书签标签数据文件"
            className="hidden"
            type="file"
            accept="application/json,.json"
            onChange={(event) => {
              dispatchBackupAction({ action: 'import-tags', file: event.currentTarget.files?.[0] })
              event.currentTarget.value = ''
            }}
          />
        </div>
      </div>

      <div className="options-group ai-tag-data-card">
        <div className="detect-results-header ai-tag-data-head">
          <div>
            <strong>完整备份</strong>
            <p className="detect-results-subtitle">
              导出 Chrome 书签树、标签数据、回收站、忽略规则、重定向历史、新标签页配置和 AI 设置；不会导出 API Key、浏览器密码、Cookie 或网页正文缓存。
            </p>
          </div>
          <div className="detect-results-actions">
            <Button
              id="backup-export"
              className="options-button small"
              size="sm"
              type="button"
              aria-label="导出完整书签备份"
              disabled={state.backup.busy}
              focusableWhenDisabled={state.backup.busy}
              onClick={() => dispatchBackupAction({ action: 'export-backup' })}
            >
              导出完整备份
            </Button>
            <Button
              id="backup-import"
              className="options-button secondary small"
              size="sm"
              type="button"
              variant="secondary"
              aria-label="导入完整备份并预览"
              disabled={state.backup.busy}
              focusableWhenDisabled={state.backup.busy}
              onClick={() => clickFileInput('backup-import-input')}
            >
              导入并预览
            </Button>
          </div>
          <Input
            id="backup-import-input"
            aria-label="导入完整备份文件"
            className="hidden"
            type="file"
            accept="application/json,.json"
            onChange={(event) => {
              dispatchBackupAction({ action: 'import-backup', file: event.currentTarget.files?.[0] })
              event.currentTarget.value = ''
            }}
          />
        </div>
        <p id="backup-status" className="detect-status-copy">{state.backup.status}</p>
      </div>

      <div className="options-group ai-tag-data-card">
        <div className="detect-results-header ai-tag-data-row">
          <div>
            <strong>恢复预览</strong>
            <p className="detect-results-subtitle">
              导入文件后先查看差异，再选择恢复范围；标签恢复按当前书签 URL 匹配，新标签页恢复只写入设置项，安全完整恢复会复制缺失书签到恢复文件夹，不会直接替换整个 Chrome 书签树。
            </p>
          </div>
          <div className="detect-results-actions">
            <Button
              id="backup-restore-tags"
              className="options-button secondary small"
              size="sm"
              type="button"
              variant="secondary"
              aria-label="从备份预览只恢复书签标签数据"
              disabled={!state.backup.hasBackup || state.backup.busy}
              focusableWhenDisabled={state.backup.busy}
              onClick={() => dispatchBackupAction({ action: 'restore', mode: 'tagsOnly' })}
            >
              只恢复标签数据
            </Button>
            <Button
              id="backup-restore-newtab"
              className="options-button secondary small"
              size="sm"
              type="button"
              variant="secondary"
              aria-label="从备份预览只恢复新标签页设置"
              disabled={!state.backup.hasBackup || state.backup.busy}
              focusableWhenDisabled={state.backup.busy}
              onClick={() => dispatchBackupAction({ action: 'restore', mode: 'newTabOnly' })}
            >
              只恢复新标签页设置
            </Button>
            <Button
              id="backup-restore-safe-full"
              className="options-button small"
              size="sm"
              type="button"
              aria-label="从备份预览恢复全部可安全恢复的数据"
              disabled={!state.backup.hasBackup || state.backup.busy}
              focusableWhenDisabled={state.backup.busy}
              onClick={() => dispatchBackupAction({ action: 'restore', mode: 'safeFull' })}
            >
              恢复全部可安全恢复的数据
            </Button>
          </div>
        </div>
        <div id="backup-preview" className="detect-results">
          <BackupPreview state={{ preview: state.backup.preview }} />
        </div>
      </div>
    </>
  )
}

function BackupPreview({ state }: { state: BackupPreviewState }) {
  if (!state.preview) {
    return <div className="detect-empty">请选择备份文件进行预览。</div>
  }

  const { counts } = state.preview

  return (
    <article className="detect-result-card">
      <div className="detect-result-copy">
        <strong>{state.preview.fileName || '已导入备份文件'}</strong>
        <div className="detect-result-detail">
          导出时间：{state.preview.exportedAt || '未知'} · 扩展版本：{state.preview.extensionVersion || '未知'}
        </div>
        <div className="detect-result-detail">
          书签 URL：{counts.bookmarkUrls}，当前缺失：{counts.missingBookmarkUrls}；标签记录：
          {counts.tagRecords}，可匹配：{counts.tagMatched}，无法匹配：{counts.tagUnmatched}
        </div>
        <div className="detect-result-detail">
          回收站：{counts.recycleEntries}；忽略规则：{counts.ignoreRules}；重定向历史：
          {counts.redirectEntries}；新标签页配置：{counts.newTabSections}
        </div>
        {state.preview.warnings.length ? (
          <ul className="detect-result-evidence">
            {state.preview.warnings.map((warning, index) => (
              <li key={`${index}:${warning}`}>{warning}</li>
            ))}
          </ul>
        ) : (
          <p className="detect-result-detail">未发现阻塞恢复的问题。</p>
        )}
      </div>
    </article>
  )
}

function clickFileInput(id: string): void {
  const input = document.getElementById(id)
  if (input instanceof HTMLInputElement) {
    input.click()
  }
}
