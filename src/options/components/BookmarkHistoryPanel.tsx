import { Button, Card } from '../../ui'

const historyMetrics = [
  {
    label: '总记录',
    valueId: 'bookmark-add-history-total'
  },
  {
    label: '已移动',
    valueId: 'bookmark-add-history-moved'
  },
  {
    label: '匹配已有文件夹',
    valueId: 'bookmark-add-history-existing'
  },
  {
    label: '新建文件夹',
    valueId: 'bookmark-add-history-new'
  }
]

export function BookmarkHistoryPanel() {
  return (
    <section
      id="bookmark-history"
      className="options-panel"
      data-section-panel="bookmark-history"
      aria-labelledby="bookmark-history-title"
      hidden
    >
      <p className="options-section-label">Auto Analysis Add History</p>
      <h1 id="bookmark-history-title">自动分析添加历史</h1>

      <div className="options-group detect-history-group">
        <div className="detect-results-header">
          <div>
            <strong>自动分析添加记录</strong>
            <p id="bookmark-add-history-subtitle" className="detect-results-subtitle">
              开启“自动分析”后，新增普通网页书签完成 AI 分类时会在这里记录保存位置。
            </p>
          </div>
          <div className="detect-results-actions">
            <span id="bookmark-add-history-timestamp" className="option-value">
              尚无历史
            </span>
            <Button
              id="bookmark-add-history-clear"
              className="options-button secondary small"
              size="sm"
              type="button"
              variant="secondary"
              aria-label="清空自动分析添加历史记录"
            >
              清空自动分析添加历史
            </Button>
          </div>
        </div>

        <div className="detect-history-grid bookmark-add-history-grid">
          {historyMetrics.map((metric) => (
            <Card className="summary-card compact" key={metric.valueId}>
              <span className="summary-label">{metric.label}</span>
              <strong id={metric.valueId}>0</strong>
            </Card>
          ))}
        </div>

        <div id="bookmark-add-history-results" className="detect-results compact bookmark-add-history-results">
          <div className="detect-empty with-cta" data-empty-key="bookmark-add-history">
            <p className="detect-empty-title">还没有自动分析添加记录</p>
            <p className="detect-empty-detail">
              开启「自动分析」后，新增普通网页书签并完成分类时会写入这里。
            </p>
            <div className="detect-empty-actions">
              <Button
                className="options-button primary small"
                size="sm"
                type="button"
                data-empty-cta="open-auto-analyze"
              >
                开启自动分析
              </Button>
              <Button
                className="options-button secondary small"
                size="sm"
                type="button"
                variant="secondary"
                data-empty-cta="configure-ai"
              >
                配置 AI 渠道
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
