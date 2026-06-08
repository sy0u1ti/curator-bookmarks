import { useEffect, useState } from 'react'
import {
  Button,
  DotMatrixLoader,
  Icon,
  Input,
  Popover,
  PopoverPopup,
  PopoverPortal,
  PopoverPositioner,
  PopoverRoot,
  Textarea
} from '../../ui'

export function DashboardPanel() {
  const [searchHelpOpen, setSearchHelpOpen] = useState(false)

  useEffect(() => {
    const handleOpen = () => setSearchHelpOpen(true)
    const handleClose = () => setSearchHelpOpen(false)
    const handleToggle = () => setSearchHelpOpen((open) => !open)

    window.addEventListener('dashboard:search-help-open', handleOpen)
    window.addEventListener('dashboard:search-help-close', handleClose)
    window.addEventListener('dashboard:search-help-toggle', handleToggle)

    return () => {
      window.removeEventListener('dashboard:search-help-open', handleOpen)
      window.removeEventListener('dashboard:search-help-close', handleClose)
      window.removeEventListener('dashboard:search-help-toggle', handleToggle)
    }
  }, [])

  return (
    <section
      id="dashboard"
      className="options-panel dashboard-panel dashboard-performance-mode"
      data-section-panel="dashboard"
      data-dashboard-ready="false"
      aria-labelledby="dashboard-title"
      hidden
    >
      <div className="dashboard-loading-screen" role="status" aria-label="正在读取书签仪表盘">
        <div className="dashboard-loading-card">
          <DotMatrixLoader className="dashboard-loading-loader" />
        </div>
      </div>

      <h1 id="dashboard-title" className="sr-only">
        书签栏 <span id="dashboard-total">(0)</span>
      </h1>

      <div className="options-group dashboard-toolbar">
        <div className="dashboard-search-box">
          <label className="options-search dashboard-search">
            <span className="options-search-label">搜索书签</span>
            <span className="dashboard-query-row">
              <Popover
                id="dashboard-search-help-popover"
                className="dashboard-help-popover"
                open={searchHelpOpen}
                onOpenChange={setSearchHelpOpen}
                portal={false}
                triggerId="dashboard-search-help-toggle"
                align="end"
                sideOffset={8}
                trigger={
                  <Button
                    id="dashboard-search-help-toggle"
                    className="dashboard-help-button"
                    type="button"
                    data-dashboard-action="toggle-search-help"
                    aria-label="查看高级搜索语法"
                    aria-controls="dashboard-search-help-popover"
                    aria-describedby="dashboard-search-help-popover"
                    unstyled
                  >
                    ?
                  </Button>
                }
              >
                <strong>高级搜索语法</strong>
                <span>site:github.com 限定站点</span>
                <span>folder:"前端资料" 限定文件夹</span>
                <span>type:文档 限定内容类型</span>
                <span>最近 2 周、昨天、上个月限定时间</span>
                <span>-youtube 或 -"短视频" 排除结果</span>
              </Popover>
              <span className="dashboard-search-input-field">
                <Icon name="Search" size={16} className="dashboard-search-icon" aria-hidden="true" />
                <Input
                  id="dashboard-query"
                  className="dashboard-search-input"
                  type="search"
                  spellCheck={false}
                  placeholder="关键词搜索"
                />
                <span id="dashboard-search-controls" className="dashboard-search-controls">
                  <Button
                    id="dashboard-clear-search"
                    className="dashboard-clear-search hidden"
                    type="button"
                    data-dashboard-action="clear-search"
                    aria-label="清空 Dashboard 搜索"
                    unstyled
                  >
                    清空
                  </Button>
                  <Button
                    id="dashboard-natural-search-toggle"
                    className="dashboard-natural-search-toggle"
                    type="button"
                    data-dashboard-action="toggle-natural-search"
                    aria-pressed="false"
                    aria-label="开启 Dashboard AI 语义搜索"
                    title="开启 AI 语义搜索"
                    unstyled
                  >
                    <span className="dashboard-natural-search-marker" aria-hidden="true" />
                    <span className="dashboard-natural-search-label">语义</span>
                  </Button>
                </span>
              </span>
            </span>
          </label>
          <div id="dashboard-search-chips" className="dashboard-search-chips hidden" aria-label="当前搜索条件" />
          <nav id="dashboard-folder-breadcrumbs" className="dashboard-folder-breadcrumbs" aria-label="当前 Dashboard 文件夹路径" />
        </div>
        <div className="dashboard-title-actions">
          <span id="dashboard-status" className="ai-provider-save-state muted" />
          <Button className="options-button secondary small" size="sm" type="button" data-dashboard-action="exit-dashboard" variant="secondary">
            退出
          </Button>
        </div>
      </div>

      <div id="dashboard-selection-group" className="options-group detect-selection-group is-empty">
        <div className="detect-results-header">
          <div>
            <strong id="dashboard-selection-count">0 条已选择</strong>
            <p className="detect-results-subtitle">所选书签可批量移动到目标文件夹，或删除并移入回收站。</p>
          </div>
          <div className="detect-results-actions">
            <Button id="dashboard-select-visible-top" className="options-button secondary small" size="sm" type="button" data-dashboard-action="select-visible" variant="secondary" aria-label="选择当前可见的 Dashboard 书签">
              选择当前可见
            </Button>
            <Button id="dashboard-clear-selection" className="options-button secondary small" size="sm" type="button" data-dashboard-action="clear-selection" variant="secondary" aria-label="清空 Dashboard 已选书签">
              清空选择
            </Button>
            <Button id="dashboard-move-selection" className="options-button secondary small" size="sm" type="button" data-dashboard-action="move-selected" variant="secondary" aria-label="批量移动 Dashboard 已选书签">
              批量移动
            </Button>
            <Button id="dashboard-delete-selection" className="options-button danger small" size="sm" type="button" data-dashboard-action="delete-selected" variant="danger" aria-label="批量删除 Dashboard 已选书签">
              批量删除
            </Button>
          </div>
        </div>
      </div>

      <section className="options-group dashboard-results-group" aria-labelledby="dashboard-cards-title">
        <div className="dashboard-results-head">
          <div className="dashboard-results-copy">
            <strong id="dashboard-cards-title">书签栏</strong>
            <p className="detect-results-subtitle">拖动卡片空白区域可拖入目标文件夹；按钮、链接和复选框不会触发拖拽。</p>
          </div>
        </div>
        <div className="dashboard-content-layout">
          <aside id="dashboard-folder-sidebar" className="dashboard-folder-sidebar" aria-labelledby="dashboard-folder-sidebar-title" aria-label="书签文件夹">
            <div className="dashboard-folder-sidebar-head">
              <strong id="dashboard-folder-sidebar-title">文件夹</strong>
              <span id="dashboard-folder-sidebar-count" className="option-value">0 个文件夹</span>
            </div>
            <nav
              id="dashboard-folder-tree"
              className="dashboard-folder-tree"
              aria-label="按文件夹筛选书签"
              role="listbox"
            />
          </aside>
          <div id="dashboard-card-region" className="dashboard-card-region">
            <div id="dashboard-results" className="dashboard-card-grid">
              <div className="detect-empty">正在读取书签目录。</div>
            </div>
          </div>
        </div>
      </section>

      <div id="dashboard-drag-overlay" className="dashboard-drag-overlay hidden" aria-hidden="true">
        <div
          id="dashboard-delete-drop-target"
          className="dashboard-delete-drop-target"
          data-dashboard-delete-drop
          role="presentation"
        >
          <span className="dashboard-delete-drop-icon" aria-hidden="true" />
          <span className="dashboard-delete-drop-copy">
            <strong>删除书签</strong>
            <small>拖到这里松开，确认后移入回收站</small>
          </span>
        </div>
        <div className="dashboard-drop-panel" role="presentation">
          <div className="dashboard-drop-head">
            <div>
              <strong>拖入文件夹移动书签</strong>
              <p id="dashboard-drag-hint">选择目标文件夹后松开即可移动。</p>
            </div>
            <span className="option-value">Esc 取消</span>
          </div>
          <div id="dashboard-folder-drop-grid" className="dashboard-folder-drop-grid" role="listbox" aria-label="拖放目标文件夹" />
        </div>
        <div id="dashboard-drag-preview" className="dashboard-drag-preview" aria-hidden="true" />
      </div>

      <div
        id="dashboard-tag-editor"
        className="dashboard-tag-editor hidden"
        aria-modal="false"
        data-dashboard-no-drag
      >
        <PopoverRoot open triggerId="dashboard-tag-editor">
          <PopoverPortal keepMounted container={null}>
            <PopoverPositioner className="dashboard-tag-editor-positioner" anchor={() => document.getElementById('dashboard-tag-editor')} collisionAvoidance={{ side: 'none', align: 'none' }}>
              <PopoverPopup
                className="dashboard-tag-editor-panel"
                aria-labelledby="dashboard-tag-editor-title"
                aria-describedby="dashboard-tag-editor-help dashboard-tag-editor-status"
                tabIndex={-1}
                initialFocus={false}
                finalFocus={false}
              >
                <div className="dashboard-tag-editor-head">
                  <div>
                    <p className="dashboard-kicker">Tags</p>
                    <strong id="dashboard-tag-editor-title">修改标签</strong>
                    <span id="dashboard-tag-editor-meta" />
                  </div>
                </div>
                <label className="dashboard-tag-editor-field">
                  <span>标签</span>
                  <Textarea id="dashboard-tag-editor-input" rows={5} placeholder="用逗号、顿号或换行分隔标签" />
                </label>
                <p id="dashboard-tag-editor-help" className="dashboard-tag-editor-help">每行一个标签，也可以用逗号、顿号分隔；保存后会自动去重。</p>
                <p id="dashboard-tag-editor-status" className="detect-results-subtitle dashboard-tag-editor-status" role="status" aria-live="polite" aria-atomic="true" />
                <div className="dashboard-tag-editor-actions">
                  <Button id="dashboard-tag-editor-clear-ai" className="options-button secondary small" size="sm" type="button" data-dashboard-action="clear-ai-tags" variant="secondary" aria-label="清除当前 Dashboard 书签的 AI 标签">
                    清除 AI 标签
                  </Button>
                  <Button id="dashboard-tag-editor-regenerate-ai" className="options-button secondary small" size="sm" type="button" data-dashboard-action="regenerate-ai-tags" variant="secondary" aria-label="重新生成当前 Dashboard 书签的 AI 标签">
                    重新生成 AI 标签
                  </Button>
                  <Button className="options-button secondary small" size="sm" type="button" data-dashboard-action="close-tag-editor" variant="secondary" aria-label="取消编辑当前 Dashboard 书签标签">
                    取消
                  </Button>
                  <Button id="dashboard-tag-editor-save" className="options-button small" size="sm" type="button" data-dashboard-action="save-tags" aria-label="保存当前 Dashboard 书签标签">
                    保存标签
                  </Button>
                </div>
              </PopoverPopup>
            </PopoverPositioner>
          </PopoverPortal>
        </PopoverRoot>
      </div>
    </section>
  )
}
