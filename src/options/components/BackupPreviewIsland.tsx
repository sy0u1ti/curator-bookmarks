import { flushSync } from 'react-dom'
import { createRoot, type Root } from 'react-dom/client'
import type { BackupRestorePreview } from '../../shared/backup.js'
import { ThemeProvider } from '../../ui'

export interface BackupPreviewState {
  preview: BackupRestorePreview | null
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
