import { Button } from '../../ui'

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
        <div id="bookmark-add-history-header" />

        <div id="bookmark-add-history-summary" />

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
