import { Button } from '../../ui/primitives/Button.js'

function EmptyCta({
  title,
  detail,
  primaryLabel,
  primaryAction,
  secondaryLabel,
  secondaryAction,
  emptyKey
}: {
  title: string
  detail: string
  primaryLabel: string
  primaryAction: string
  secondaryLabel: string
  secondaryAction: string
  emptyKey: string
}) {
  return (
    <div className="detect-empty with-cta" data-empty-key={emptyKey}>
      <p className="detect-empty-title">{title}</p>
      <p className="detect-empty-detail">{detail}</p>
      <div className="detect-empty-actions">
        <Button className="options-button primary small" size="sm" type="button" data-empty-cta={primaryAction}>
          {primaryLabel}
        </Button>
        <Button
          className="options-button secondary small"
          size="sm"
          type="button"
          variant="secondary"
          data-empty-cta={secondaryAction}
        >
          {secondaryLabel}
        </Button>
      </div>
    </div>
  )
}

export function HistoryPanel() {
  return (
    <section id="history" className="options-panel" data-section-panel="history" aria-labelledby="history-title" hidden>
      <p className="options-section-label">History</p>
      <h1 id="history-title">检测历史</h1>

      <div className="options-group">
        <div className="option-row">
          <div className="option-copy">
            <strong>历史范围</strong>
            <p id="history-scope-copy">当前显示范围：全部书签。这里只展示对应检测范围的历史日志与趋势变化。</p>
          </div>
          <Button id="history-scope-trigger" className="scope-picker-trigger" type="button" aria-label="选择历史范围">
            <span id="history-scope-label">全部书签</span>
            <span className="scope-picker-caret" aria-hidden="true" />
          </Button>
        </div>
      </div>

      <div className="options-group detect-history-group">
        <div id="availability-history-controls" />
        <div id="availability-history-log-list" className="detect-results compact">
          <EmptyCta
            emptyKey="availability-history"
            title="还没有检测日志"
            detail="完成一次检测后，这里会保留最近多次结果，用于趋势对比和连续异常计数。"
            primaryLabel="开始一次检测"
            primaryAction="run-availability"
            secondaryLabel="查看检测范围"
            secondaryAction="availability-info"
          />
        </div>
        <div className="detect-results-header history-subheader">
          <div>
            <strong>最近一次已恢复</strong>
            <p className="detect-results-subtitle">这里会展示相较于上一轮已恢复的书签。</p>
          </div>
        </div>
        <div id="availability-history-recovered-list" className="detect-results compact">
          <div className="detect-empty">完成检测后，这里会展示相较于上一次已恢复的书签。</div>
        </div>
      </div>
    </section>
  )
}

export function BackupPanel() {
  return (
    <section id="backup" className="options-panel" data-section-panel="backup" aria-labelledby="backup-title" hidden>
      <p className="options-section-label">Data & Backup</p>
      <h1 id="backup-title">数据与备份</h1>

      <div id="backup-controls" />
    </section>
  )
}

export function TagManagementPanel() {
  return (
    <section id="tags" className="options-panel" data-section-panel="tags" aria-labelledby="tags-title" hidden>
      <p className="options-section-label">Tag Management</p>
      <h1 id="tags-title">标签管理中心</h1>

      <div className="options-group tag-management-usage">
        <div id="tag-management-controls" />
        <div id="tag-management-results" className="tag-management-results">
          <div className="detect-empty">正在读取标签统计...</div>
        </div>
      </div>
    </section>
  )
}

export function RedirectsPanel() {
  return (
    <section id="redirects" className="options-panel" data-section-panel="redirects" aria-labelledby="redirects-title" hidden>
      <p className="options-section-label">Redirects</p>
      <h1 id="redirects-title">重定向更新</h1>

      <div className="options-group detect-results-group">
        <div id="redirect-controls" />
        <div id="redirect-results" className="detect-results">
          <EmptyCta
            emptyKey="redirect"
            title="还没有可更新的重定向"
            detail="完成一次可用性检测后，这里会展示原地址与落地地址不一致的书签，可一键更新。"
            primaryLabel="运行可用性检测"
            primaryAction="run-availability"
            secondaryLabel="了解重定向更新"
            secondaryAction="redirect-info"
          />
        </div>
        <div id="redirect-pagination" aria-label="重定向结果分页" />
      </div>
    </section>
  )
}

export function DuplicatesPanel() {
  return (
    <section id="duplicates" className="options-panel" data-section-panel="duplicates" aria-labelledby="duplicates-title" hidden>
      <p className="options-section-label">Duplicates</p>
      <h1 id="duplicates-title">重复书签检测</h1>

      <div id="duplicate-controls" />

      <div className="options-group detect-results-group">
        <div id="duplicate-results-controls" />
        <div id="duplicate-groups" className="detect-results">
          <div className="detect-empty">正在分析重复书签。</div>
        </div>
      </div>
    </section>
  )
}

export function FolderCleanupPanel() {
  return (
    <section id="folder-cleanup" className="options-panel" data-section-panel="folder-cleanup" aria-labelledby="folder-cleanup-title" hidden>
      <p className="options-section-label">文件夹清理</p>
      <h1 id="folder-cleanup-title">文件夹清理</h1>

      <div className="options-group detect-results-group">
        <div id="folder-cleanup-controls" />
        <div id="folder-cleanup-results" className="detect-results">
          <div className="detect-empty">点击重新扫描后，这里会展示可预览的文件夹清理建议。</div>
        </div>
      </div>
    </section>
  )
}

export function IgnoreRulesPanel() {
  return (
    <section id="ignore" className="options-panel" data-section-panel="ignore" aria-labelledby="ignore-title" hidden>
      <p className="options-section-label">Ignore Rules</p>
      <h1 id="ignore-title">忽略规则 / 白名单</h1>
      <div className="options-group">
        <div className="option-row">
          <div className="option-copy">
            <strong>规则来源说明</strong>
            <p>忽略规则是从检测结果里指定的，不是提前手动录入。请先完成一次检测，再从低/高置信异常结果里添加要忽略的书签、域名或文件夹。</p>
          </div>
          <span className="option-value">检测结果生成</span>
        </div>
      </div>

      <div id="ignore-rules" />
    </section>
  )
}

export function RecyclePanel() {
  return (
    <section id="recycle" className="options-panel" data-section-panel="recycle" aria-labelledby="recycle-title" hidden>
      <p className="options-section-label">Recycle Bin</p>
      <h1 id="recycle-title">回收站</h1>

      <div className="options-group detect-results-group">
        <div id="recycle-controls" />
        <div id="recycle-results" className="detect-results">
          <EmptyCta
            emptyKey="recycle"
            title="回收站当前为空"
            detail="删除的书签会暂存到这里，最多保留 30 天，可以在原位置或备份恢复。"
            primaryLabel="查看仪表盘"
            primaryAction="open-dashboard"
            secondaryLabel="了解删除保护"
            secondaryAction="recycle-info"
          />
        </div>
      </div>
    </section>
  )
}
