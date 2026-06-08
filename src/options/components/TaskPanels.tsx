import { Button, Card, Input } from '../../ui'

const historyMetrics = [
  { label: '新增异常', valueId: 'availability-history-new' },
  { label: '持续异常', valueId: 'availability-history-persistent' },
  { label: '已恢复', valueId: 'availability-history-recovered' }
]

const duplicateMetrics = [
  { label: '重复分组', valueId: 'duplicate-summary-groups', className: 'metric-total' },
  { label: '建议清理', valueId: 'duplicate-summary-candidates', className: 'metric-info' },
  { label: '跨文件夹', valueId: 'duplicate-summary-cross-folder', className: 'metric-warning' },
  { label: '标题差异', valueId: 'duplicate-summary-title-variants', className: 'metric-warning' },
  { label: '高风险', valueId: 'duplicate-summary-high-risk', className: 'metric-danger' },
  { label: '已选择', valueId: 'duplicate-summary-selected', className: 'metric-success' }
]

const folderCleanupMetrics = [
  { label: '建议总数', valueId: 'folder-cleanup-summary-total', className: 'metric-total' },
  { label: '空文件夹', valueId: 'folder-cleanup-summary-empty', className: 'metric-danger' },
  { label: '深层低价值', valueId: 'folder-cleanup-summary-deep', className: 'metric-warning' },
  { label: '同名合并', valueId: 'folder-cleanup-summary-same-name', className: 'metric-info' },
  { label: '超大拆分', valueId: 'folder-cleanup-summary-large', className: 'metric-muted' }
]

const ignoreMetrics = [
  { label: '书签规则', valueId: 'ignore-bookmark-count' },
  { label: '域名规则', valueId: 'ignore-domain-count' },
  { label: '文件夹规则', valueId: 'ignore-folder-count' }
]

const duplicateStrategies = [
  { label: '保留最新', value: 'newest' },
  { label: '保留最早', value: 'oldest' },
  { label: '保留路径最短', value: 'shorter-path' },
  { label: '保留有标签', value: 'tagged' },
  { label: '保留新标签页来源', value: 'newtab-source' },
  { label: '保留最近访问', value: 'recent' }
]

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
        <div className="detect-results-header">
          <div>
            <strong>检测历史</strong>
            <p id="availability-history-subtitle" className="detect-results-subtitle">
              完成一次检测后，这里会生成一条检测日志，保留最近多次结果用于趋势和连续异常对比。
            </p>
          </div>
          <div className="detect-results-actions">
            <span id="availability-history-timestamp" className="option-value">尚无历史</span>
            <Button id="availability-clear-history" className="options-button secondary small" size="sm" type="button" variant="secondary" aria-label="清空可用性检测历史日志">
              清空历史日志
            </Button>
          </div>
        </div>
        <div className="detect-history-grid">
          {historyMetrics.map((metric) => (
            <Card className="summary-card compact" key={metric.valueId}>
              <span className="summary-label">{metric.label}</span>
              <strong id={metric.valueId}>0</strong>
            </Card>
          ))}
        </div>
        <div className="detect-results-header history-subheader">
          <div>
            <strong>检测日志</strong>
            <p className="detect-results-subtitle">每条日志会同时展示异常数量变化、新增异常、已恢复结果，以及各异常书签的连续异常次数。</p>
          </div>
          <div className="detect-results-actions">
            <span id="availability-history-log-count" className="option-value">0 次记录</span>
            <Button id="availability-toggle-history-logs" className="options-button secondary small" size="sm" type="button" variant="secondary">
              收起日志
            </Button>
          </div>
        </div>
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
        <div className="tag-management-head">
          <div className="tag-management-title">
            <strong>标签词云</strong>
            <p className="detect-results-subtitle">字号和明暗代表使用频率，点击标签可填入整理表单。</p>
          </div>
          <div className="tag-management-metrics" aria-label="标签统计概览">
            <span id="tag-management-total">0 个标签</span>
            <span id="tag-management-tagged-bookmarks">0 条书签</span>
            <span id="tag-management-manual">0 个手动标签</span>
          </div>
        </div>

        <div className="tag-management-toolbar">
          <div className="tag-management-form">
            <label>
              <span>原标签</span>
              <Input id="tag-management-rename-source" type="text" autoComplete="off" placeholder="选择或输入标签" />
            </label>
            <label>
              <span>新标签</span>
              <Input id="tag-management-rename-target" type="text" autoComplete="off" placeholder="用于重命名" />
            </label>
            <div className="tag-management-form-actions">
              <Button id="tag-management-rename" className="options-button small" size="sm" type="button" aria-label="重命名书签标签">重命名</Button>
              <Button id="tag-management-delete" className="options-button danger small" size="sm" type="button" variant="danger" aria-label="删除书签标签">删除标签</Button>
            </div>
          </div>
          <Button id="tag-management-refresh" className="options-button secondary small" size="sm" type="button" variant="secondary" aria-label="刷新标签统计">刷新统计</Button>
          <p id="tag-management-status" className="detect-status-copy" />
        </div>
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

      <div id="redirect-selection-group" className="options-group detect-selection-group hidden">
        <div className="detect-results-header">
          <div>
            <strong id="redirect-selection-count">0 条已选择</strong>
            <p className="detect-results-subtitle">可批量更新这些重定向书签为最终地址，或直接批量删除并移入回收站。</p>
          </div>
          <div className="detect-results-actions">
            <Button id="redirect-clear-selection" className="options-button secondary small" size="sm" type="button" variant="secondary" aria-label="清空重定向更新已选书签">清空选择</Button>
            <Button id="redirect-batch-update" className="options-button small" size="sm" type="button" aria-label="批量更新重定向已选书签为最终 URL">批量更新最终 URL</Button>
            <Button id="redirect-delete-selection" className="options-button danger small" size="sm" type="button" variant="danger" aria-label="删除重定向更新已选书签">删除所选</Button>
          </div>
        </div>
      </div>

      <div className="options-group detect-results-group">
        <div className="detect-results-header">
          <div>
            <strong>待更新重定向</strong>
            <p id="redirect-results-subtitle" className="detect-results-subtitle">完成检测后，这里会展示原书签地址与最终落地地址不一致的结果。结果会本地缓存，刷新页面后仍可直接更新。</p>
          </div>
          <div className="detect-results-actions">
            <Button id="redirect-select-all" className="options-button secondary small" size="sm" type="button" variant="secondary" aria-label="全选待更新重定向书签">全选本区</Button>
            <Button id="redirect-delete-all" className="options-button danger small" size="sm" type="button" variant="danger" aria-label="批量删除待更新重定向书签">批量删除本区</Button>
            <span id="redirect-count" className="option-value">0 条待更新</span>
          </div>
        </div>
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

      <div id="duplicate-selection-group" className="options-group detect-selection-group hidden">
        <div className="detect-results-header">
          <div>
            <strong id="duplicate-selection-count">0 条已选择</strong>
            <p id="duplicate-selection-impact" className="detect-results-subtitle">将删除 0 条，保留 0 条。</p>
            <p id="duplicate-selection-warning" className="duplicate-selection-warning hidden" />
          </div>
          <div className="detect-results-actions">
            <Button id="duplicate-clear-selection" className="options-button secondary small" size="sm" type="button" variant="secondary" aria-label="清空重复书签已选项">清空选择</Button>
            <Button id="duplicate-delete-selection" className="options-button danger small" size="sm" type="button" variant="danger" aria-label="将重复书签已选项移入回收站">移入回收站</Button>
          </div>
        </div>
      </div>

      <div className="detect-summary-grid compact-grid duplicate-summary-grid">
        {duplicateMetrics.map((metric) => (
          <Card className={`summary-card compact metric-card ${metric.className}`} key={metric.valueId}>
            <span className="summary-label">{metric.label}</span>
            <strong id={metric.valueId}>0</strong>
          </Card>
        ))}
      </div>

      <div className="options-group detect-results-group">
        <div className="detect-results-header">
          <div>
            <strong>重复分组</strong>
            <p id="duplicate-results-subtitle" className="detect-results-subtitle">同一归一化地址下出现多个书签时，会归到同一组。</p>
          </div>
          <span id="duplicate-group-count" className="option-value">0 组重复</span>
        </div>
        <div className="duplicate-toolbar">
          <div id="duplicate-strategy-controls" className="duplicate-strategy-controls duplicate-primary-action-row" aria-label="重复书签选择策略">
            <Button className="options-button small duplicate-primary-action" size="sm" type="button" data-duplicate-strategy="recommended" aria-label="按推荐选择重复书签当前结果">按推荐选择当前结果</Button>
            {duplicateStrategies.map((strategy) => (
              <Button
                className="options-button secondary small"
                size="sm"
                type="button"
                variant="secondary"
                data-duplicate-strategy={strategy.value}
                aria-label={`${strategy.label}重复书签`}
                key={strategy.value}
              >
                {strategy.label}
              </Button>
            ))}
            <span id="duplicate-strategy-status" className="duplicate-strategy-status" />
          </div>
        </div>
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

      <div className="options-group">
        <div className="option-row">
          <div className="option-copy">
            <strong>建议和预览优先</strong>
            <p>先重新读取当前 Chrome 书签树，再扫描空文件夹、深层低价值文件夹、单一路径、同名文件夹和超大文件夹；删除、合并、移动和拆分都会在确认后执行，并先调用自动备份 hook。拆分会记录本次移动，可在建议区撤销本次拆分。</p>
          </div>
          <div className="detect-results-actions">
            <span id="folder-cleanup-status" className="options-chip muted">未扫描</span>
            <Button id="folder-cleanup-analyze" className="options-button small" size="sm" type="button">重新扫描</Button>
          </div>
        </div>
      </div>

      <div className="detect-summary-grid compact-grid">
        {folderCleanupMetrics.map((metric) => (
          <Card className={`summary-card compact metric-card ${metric.className}`} key={metric.valueId}>
            <span className="summary-label">{metric.label}</span>
            <strong id={metric.valueId}>0</strong>
          </Card>
        ))}
      </div>

      <div className="options-group detect-results-group">
        <div className="detect-results-header">
          <div>
            <strong>清理建议</strong>
            <p id="folder-cleanup-results-subtitle" className="detect-results-subtitle">所有建议默认只预览，不会自动修改书签。</p>
          </div>
          <span id="folder-cleanup-count" className="option-value">0 条建议</span>
        </div>
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

      <div className="detect-summary-grid compact-grid">
        {ignoreMetrics.map((metric) => (
          <Card className="summary-card compact" key={metric.valueId}>
            <span className="summary-label">{metric.label}</span>
            <strong id={metric.valueId}>0</strong>
          </Card>
        ))}
      </div>

      <div className="options-group detect-results-group">
        <div className="detect-results-header">
          <div>
            <strong>按书签忽略</strong>
            <p className="detect-results-subtitle">仅压制指定书签本身的异常提示。</p>
          </div>
          <Button id="ignore-clear-bookmarks" className="options-button secondary small" size="sm" type="button" variant="secondary" aria-label="清空按书签忽略规则">清空本类</Button>
        </div>
        <div id="ignore-bookmark-rules" className="detect-results">
          <div className="detect-empty">暂无按书签忽略的规则。</div>
        </div>
      </div>

      <div className="options-group detect-results-group">
        <div className="detect-results-header">
          <div>
            <strong>按域名忽略</strong>
            <p className="detect-results-subtitle">同一域名下的异常提示会被压制。</p>
          </div>
          <Button id="ignore-clear-domains" className="options-button secondary small" size="sm" type="button" variant="secondary" aria-label="清空按域名忽略规则">清空本类</Button>
        </div>
        <div id="ignore-domain-rules" className="detect-results">
          <div className="detect-empty">暂无按域名忽略的规则。</div>
        </div>
      </div>

      <div className="options-group detect-results-group">
        <div className="detect-results-header">
          <div>
            <strong>按文件夹忽略</strong>
            <p className="detect-results-subtitle">命中该文件夹及其子层级的异常提示会被压制。</p>
          </div>
          <Button id="ignore-clear-folders" className="options-button secondary small" size="sm" type="button" variant="secondary" aria-label="清空按文件夹忽略规则">清空本类</Button>
        </div>
        <div id="ignore-folder-rules" className="detect-results">
          <div className="detect-empty">暂无按文件夹忽略的规则。</div>
        </div>
      </div>
    </section>
  )
}

export function RecyclePanel() {
  return (
    <section id="recycle" className="options-panel" data-section-panel="recycle" aria-labelledby="recycle-title" hidden>
      <p className="options-section-label">Recycle Bin</p>
      <h1 id="recycle-title">回收站</h1>

      <div id="recycle-selection-group" className="options-group detect-selection-group hidden">
        <div className="detect-results-header">
          <div>
            <strong id="recycle-selection-count">0 条已选择</strong>
            <p className="detect-results-subtitle">可批量恢复选中的回收站书签，也可只清除回收站记录。</p>
          </div>
          <div className="detect-results-actions">
            <Button id="recycle-clear-selection" className="options-button secondary small" size="sm" type="button" variant="secondary" aria-label="清空回收站已选书签">清空选择</Button>
            <Button id="recycle-restore-selection" className="options-button small" size="sm" type="button" aria-label="批量恢复回收站已选书签">批量恢复</Button>
            <Button id="recycle-clear-selected" className="options-button danger small" size="sm" type="button" variant="danger" aria-label="清除回收站已选记录">清除所选</Button>
          </div>
        </div>
      </div>

      <div className="options-group detect-results-group">
        <div className="detect-results-header">
          <div>
            <strong>回收站条目</strong>
            <p id="recycle-results-subtitle" className="detect-results-subtitle">恢复时会优先尝试放回原文件夹；若原文件夹已不存在，则回到书签栏。</p>
          </div>
          <div className="detect-results-actions">
            <Button id="recycle-select-all" className="options-button secondary small" size="sm" type="button" variant="secondary" aria-label="全选回收站条目">全选本区</Button>
            <Button id="recycle-clear-all" className="options-button danger small" size="sm" type="button" variant="danger" aria-label="清空全部回收站记录">清空回收站</Button>
            <span id="recycle-count" className="option-value">0 条回收站条目</span>
          </div>
        </div>
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
