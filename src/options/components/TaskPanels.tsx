import { Button } from '../../ui/primitives/Button.js'
import { Input } from '../../ui/primitives/Input.js'

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

      <div className="options-group ai-tag-data-card">
        <div className="detect-results-header ai-tag-data-head">
          <div>
            <strong>标签数据</strong>
            <p className="detect-results-subtitle">
              这里保存 AI 生成的摘要、主题和别名，以及 AI 生成或手动维护的标签。可单独导出/导入，也会包含在完整备份中；清空只删除本地标签索引，不删除 Chrome 书签。
            </p>
          </div>
          <span id="ai-tag-data-count" className="option-value">0 条记录</span>
        </div>
        <div className="detect-results-header ai-tag-data-row">
          <div>
            <p id="ai-tag-data-updated" className="detect-results-subtitle">尚未保存标签数据。</p>
            <p id="ai-tag-data-status" className="detect-status-copy" />
          </div>
          <div className="detect-results-actions">
            <Button id="ai-tag-export" className="options-button secondary small" size="sm" type="button" variant="secondary" aria-label="导出书签标签数据">导出标签数据</Button>
            <Button id="ai-tag-import" className="options-button secondary small" size="sm" type="button" variant="secondary" aria-label="导入书签标签数据">导入标签数据</Button>
            <Button id="ai-tag-clear" className="options-button danger small" size="sm" type="button" variant="danger" aria-label="清空全部书签标签数据">清空标签数据</Button>
          </div>
          <Input id="ai-tag-import-input" className="hidden" type="file" accept="application/json,.json" />
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
            <Button id="backup-export" className="options-button small" size="sm" type="button" aria-label="导出完整书签备份">导出完整备份</Button>
            <Button id="backup-import" className="options-button secondary small" size="sm" type="button" variant="secondary" aria-label="导入完整备份并预览">导入并预览</Button>
          </div>
          <Input id="backup-import-input" className="hidden" type="file" accept="application/json,.json" />
        </div>
        <p id="backup-status" className="detect-status-copy" />
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
            <Button id="backup-restore-tags" className="options-button secondary small" size="sm" type="button" variant="secondary" disabled aria-label="从备份预览只恢复书签标签数据">只恢复标签数据</Button>
            <Button id="backup-restore-newtab" className="options-button secondary small" size="sm" type="button" variant="secondary" disabled aria-label="从备份预览只恢复新标签页设置">只恢复新标签页设置</Button>
            <Button id="backup-restore-safe-full" className="options-button small" size="sm" type="button" disabled aria-label="从备份预览恢复全部可安全恢复的数据">恢复全部可安全恢复的数据</Button>
          </div>
        </div>
        <div id="backup-preview" className="detect-results">
          <div className="detect-empty">请选择备份文件进行预览。</div>
        </div>
      </div>
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
