import { useEffect, useState } from 'react'
import { AiSetupPrompt, Button, DialogOverlay, DialogPanel, Icon, Input, Popover, ThemeProvider } from '../ui'

export function PopupApp() {
  useEffect(() => {
    let disposed = false

    void import('./popup-runtime.js').then(({ startPopupRuntime }) => {
      if (!disposed) {
        startPopupRuntime()
      }
    })

    return () => {
      disposed = true
    }
  }, [])

  return (
    <ThemeProvider>
      <PopupShell />
    </ThemeProvider>
  )
}

function SearchIconSpan() {
  return (
    <span className="search-icon" aria-hidden="true">
      <Icon name="Search" size={15} />
    </span>
  )
}

function FolderSearch({
  htmlFor,
  inputId,
  placeholder,
  label,
  controls
}: {
  htmlFor: string
  inputId: string
  placeholder: string
  label: string
  controls: string
}) {
  return (
    <label className="search-shell modal-search" htmlFor={htmlFor}>
      <SearchIconSpan />
      <Input
        id={inputId}
        className="search-input"
        type="search"
        spellCheck={false}
        autoComplete="off"
        placeholder={placeholder}
        aria-label={label}
        aria-controls={controls}
        unstyled
      />
    </label>
  )
}

function PopupShell() {
  const [searchHelpOpen, setSearchHelpOpen] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)

  useEffect(() => {
    const handleOpen = () => setSearchHelpOpen(true)
    const handleClose = () => setSearchHelpOpen(false)
    const handleModalState = (event: Event) => {
      const detail = (event as CustomEvent<{ open?: boolean }>).detail
      setModalOpen(Boolean(detail?.open))
    }

    window.addEventListener('popup:search-help-open', handleOpen)
    window.addEventListener('popup:search-help-close', handleClose)
    window.addEventListener('popup:modal-state', handleModalState)

    return () => {
      window.removeEventListener('popup:search-help-open', handleOpen)
      window.removeEventListener('popup:search-help-close', handleClose)
      window.removeEventListener('popup:modal-state', handleModalState)
    }
  }, [])

  return (
    <>
      <main id="popup-app-shell" className="app-shell">
        <header className="hero">
          <Popover
            id="search-help-popover"
            className="search-help-popover"
            open={searchHelpOpen}
            onOpenChange={setSearchHelpOpen}
            portal={false}
            triggerId="search-help-toggle"
            align="start"
            sideOffset={7}
            trigger={
              <Button
                id="search-help-toggle"
                className="search-help-toggle"
                type="button"
                aria-label="查看高级搜索语法"
                title="查看高级搜索语法（site / folder / type / -排除）"
                aria-controls="search-help-popover"
                unstyled
              >
                <Icon name="CircleHelp" size={15} aria-hidden="true" />
              </Button>
            }
          >
            <strong>高级搜索语法</strong>
            <ul className="search-help-list">
              <li><span className="search-help-tag">站点</span><span className="search-help-example"><code>site:github.com</code></span></li>
              <li><span className="search-help-tag">文件夹</span><span className="search-help-example"><code>folder:"前端资料"</code></span></li>
              <li><span className="search-help-tag">类型</span><span className="search-help-example"><code>type:文档</code></span></li>
              <li><span className="search-help-tag">排除</span><span className="search-help-example"><code>-youtube</code><span>或</span><code>-"短视频"</code></span></li>
            </ul>
            <span className="search-help-hint">Esc 关闭 · 点击外部收起</span>
          </Popover>
          <div className="hero-brand">
            <div className="hero-mark" aria-hidden="true">
              <img className="hero-logo" src="../assets/icon128.png" alt="" />
            </div>
            <div className="hero-copy">
              <p className="hero-eyebrow">Chrome Bookmark Manager</p>
              <h1>Curator Bookmark</h1>
              <p className="hero-subtitle" id="hero-subtitle">本地读取，不上传任何书签内容</p>
            </div>
          </div>
          <Button id="open-settings" className="hero-settings-button" type="button" aria-label="打开设置页" title="打开设置页" unstyled>
            <Icon name="Settings" size={18} aria-hidden="true" />
          </Button>
        </header>

        <section id="smart-classifier" className="smart-classifier hidden" aria-live="polite"></section>

        <section className="filter-row" aria-label="筛选范围">
          <Button id="folder-filter-trigger" className="filter-trigger" type="button" aria-label="选择文件夹筛选范围" title="选择文件夹筛选范围" unstyled>
            <span className="filter-trigger-label">筛选</span>
            <span id="folder-filter-trigger-text" className="filter-trigger-text">全部文件夹</span>
            <span className="filter-trigger-icon" aria-hidden="true">
              <Icon name="ChevronDown" size={14} />
            </span>
          </Button>
          <Button id="clear-folder-filter" className="filter-clear hidden" type="button" title="清除文件夹筛选" unstyled>
            清除筛选
          </Button>
        </section>
        <nav id="folder-breadcrumbs" className="folder-breadcrumbs hidden" aria-label="当前文件夹路径"></nav>

        <section className="search-block" aria-label="搜索书签">
          <label className="search-shell" htmlFor="search-input">
            <SearchIconSpan />
            <Input
              id="search-input"
              className="search-input"
              type="search"
              spellCheck={false}
              autoComplete="off"
              placeholder="关键词搜索"
              autoFocus
              aria-label="搜索书签标题、网址或高级语法"
              unstyled
            />
            <Button id="clear-search" className="clear-search hidden" type="button" aria-label="清空搜索" unstyled>
              清空
            </Button>
            <Button
              id="natural-search-toggle"
              className="natural-search-toggle"
              type="button"
              aria-label="语义搜索"
              aria-pressed="false"
              title="AI 语义搜索：需要先配置 AI 渠道"
              unstyled
            >
              语义
            </Button>
          </label>

          <div id="search-chips" className="search-chips hidden" aria-label="当前搜索条件"></div>
          <div id="saved-searches" className="saved-searches hidden" aria-label="已保存搜索"></div>
        </section>

        <section className="toolbar" aria-label="当前视图状态">
          <p className="view-caption" id="view-caption">书签栏</p>
          <p className="key-hint">↑ ↓ 切换 · Enter 打开 · Esc 返回</p>
        </section>

        <section id="error-banner" className="error-banner hidden" role="alert"></section>

        <section className="content-shell">
          <div id="loading-state" className="state-panel">正在加载书签…</div>
          <div id="empty-state" className="state-panel hidden"></div>
          <div id="content" className="content" role="list"></div>
        </section>

        <section id="auto-analyze-status" className="auto-analyze-status hidden" aria-live="polite" aria-atomic="true"></section>

        <footer id="smart-footer" className="smart-footer hidden">
          <span id="smart-total" className="smart-total">总计 0</span>
          <Button id="smart-footer-settings" className="smart-settings-link" type="button" unstyled>设置</Button>
        </footer>
      </main>

      <DialogOverlay
        id="modal-backdrop"
        className={modalOpen ? 'modal-backdrop' : 'modal-backdrop hidden'}
        open={modalOpen}
        onOpenChange={(open) => {
          if (!open && modalOpen) {
            window.dispatchEvent(new CustomEvent('popup:modal-close'))
            return
          }
          setModalOpen(open)
        }}
        aria-hidden={modalOpen ? 'false' : 'true'}
        disablePointerDismissal
      >
        <DialogPanel
          className="popup-modal-stack"
          initialFocus={false}
          finalFocus={false}
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              window.dispatchEvent(new CustomEvent('popup:modal-close'))
            }
          }}
          unanimated
        >
        <section id="filter-modal" className="modal-card hidden" aria-labelledby="filter-modal-title" tabIndex={-1}>
          <header className="modal-header">
            <div>
              <p className="modal-eyebrow">文件夹筛选</p>
              <h2 id="filter-modal-title">选择筛选文件夹</h2>
            </div>
            <Button id="close-filter-modal" className="icon-button ghost" type="button" aria-label="关闭筛选面板" unstyled>
              关闭
            </Button>
          </header>
          <FolderSearch htmlFor="filter-search-input" inputId="filter-search-input" placeholder="搜索文件夹名称或路径" label="搜索筛选文件夹" controls="filter-folder-list" />
          <div id="filter-folder-list" className="modal-list" role="listbox" aria-label="筛选文件夹候选列表"></div>
        </section>

        <section id="move-modal" className="modal-card hidden" aria-labelledby="move-modal-title" tabIndex={-1}>
          <header className="modal-header">
            <div>
              <p className="modal-eyebrow">移动书签</p>
              <h2 id="move-modal-title">选择目标文件夹</h2>
            </div>
            <Button id="close-move-modal" className="icon-button ghost" type="button" aria-label="关闭移动面板" unstyled>
              关闭
            </Button>
          </header>
          <div className="modal-bookmark-card">
            <p className="modal-card-label">当前书签</p>
            <p id="move-bookmark-title" className="modal-card-title"></p>
            <p id="move-bookmark-path" className="modal-card-path"></p>
          </div>
          <FolderSearch htmlFor="move-search-input" inputId="move-search-input" placeholder="搜索目标文件夹" label="搜索移动目标文件夹" controls="move-folder-list" />
          <div id="move-folder-list" className="modal-list" role="tree" aria-label="移动目标文件夹"></div>
        </section>

        <section id="smart-folder-modal" className="modal-card hidden" aria-labelledby="smart-folder-modal-title" tabIndex={-1}>
          <header className="modal-header">
            <div>
              <p className="modal-eyebrow">当前网页</p>
              <h2 id="smart-folder-modal-title">选择保存文件夹</h2>
            </div>
            <Button id="close-smart-folder-modal" className="icon-button ghost" type="button" aria-label="关闭文件夹选择" unstyled>
              关闭
            </Button>
          </header>
          <div className="modal-bookmark-card">
            <p className="modal-card-label">即将保存</p>
            <p id="smart-folder-page-title" className="modal-card-title"></p>
            <p id="smart-folder-page-url" className="modal-card-path"></p>
          </div>
          <FolderSearch htmlFor="smart-folder-search-input" inputId="smart-folder-search-input" placeholder="搜索目标文件夹" label="搜索保存目标文件夹" controls="smart-folder-list" />
          <div id="smart-folder-list" className="modal-list" role="tree" aria-label="保存目标文件夹"></div>
        </section>

        <section id="ai-provider-prompt-modal" className="modal-card small hidden" aria-labelledby="ai-provider-prompt-title" tabIndex={-1}>
          <header className="modal-header compact">
            <div>
              <p className="modal-eyebrow">AI 搜索</p>
              <h2 id="ai-provider-prompt-title">请配置 AI 渠道</h2>
            </div>
            <Button id="close-ai-provider-prompt" className="icon-button ghost" type="button" aria-label="关闭 AI 渠道配置提示" unstyled>
              关闭
            </Button>
          </header>
          <AiSetupPrompt
            className="modal-ai-setup-prompt"
            description="普通搜索已包含本地规则。语义搜索需要先配置 AI 渠道。"
            descriptionClassName="modal-note"
            titleClassName="sr-only"
            title="AI 渠道配置提示"
          />
          <footer className="modal-actions">
            <Button id="cancel-ai-provider-prompt" className="secondary-button" type="button" unstyled>暂不配置</Button>
            <Button id="open-ai-provider-settings" className="secondary-button primary-button" type="button" unstyled>配置 AI 渠道</Button>
          </footer>
        </section>

        <section id="edit-modal" className="modal-card hidden" aria-labelledby="edit-modal-title" tabIndex={-1}>
          <header className="modal-header">
            <div>
              <p className="modal-eyebrow">编辑书签</p>
              <h2 id="edit-modal-title">修改标题与网址</h2>
            </div>
            <Button id="close-edit-modal" className="icon-button ghost" type="button" aria-label="关闭编辑面板" unstyled>
              关闭
            </Button>
          </header>
          <div className="modal-bookmark-card">
            <p className="modal-card-label">来源路径</p>
            <div className="modal-path-row">
              <p id="edit-bookmark-path" className="modal-card-path"></p>
              <Button id="edit-folder-picker-button" className="secondary-button compact" type="button" aria-expanded="false" aria-controls="edit-folder-picker" unstyled>
                更改
              </Button>
            </div>
          </div>
          <section id="edit-folder-picker" className="edit-folder-picker hidden" aria-label="选择新的来源路径">
            <FolderSearch htmlFor="edit-folder-search-input" inputId="edit-folder-search-input" placeholder="搜索目标文件夹" label="搜索编辑目标文件夹" controls="edit-folder-list" />
            <div id="edit-folder-list" className="modal-list compact" role="tree" aria-label="编辑目标文件夹"></div>
          </section>
          <div className="modal-form">
            <label className="modal-field" htmlFor="edit-title-input">
              <span className="modal-label">标题</span>
              <Input id="edit-title-input" className="modal-input" type="text" spellCheck={false} maxLength={512} unstyled />
            </label>
            <label className="modal-field" htmlFor="edit-url-input">
              <span className="modal-label">网址</span>
              <Input id="edit-url-input" className="modal-input" type="url" spellCheck={false} inputMode="url" unstyled />
            </label>
          </div>
          <footer className="modal-actions">
            <Button id="cancel-edit" className="secondary-button" type="button" unstyled>取消</Button>
            <Button id="save-edit" className="secondary-button primary-button" type="button" unstyled>保存</Button>
          </footer>
        </section>

        <section id="delete-modal" className="modal-card small hidden" aria-labelledby="delete-modal-title" tabIndex={-1}>
          <header className="modal-header compact">
            <div>
              <p className="modal-eyebrow danger">删除确认</p>
              <h2 id="delete-modal-title">确认删除该书签？</h2>
            </div>
          </header>
          <div className="modal-bookmark-card">
            <p className="modal-card-label">即将删除</p>
            <p id="delete-bookmark-title" className="modal-card-title"></p>
            <p id="delete-bookmark-path" className="modal-card-path"></p>
          </div>
          <footer className="modal-actions">
            <Button id="cancel-delete" className="secondary-button" type="button" unstyled>取消</Button>
            <Button id="confirm-delete" className="danger-button" type="button" unstyled>删除</Button>
          </footer>
        </section>
        </DialogPanel>
      </DialogOverlay>

      <section id="toast-root" className="toast-root" aria-live="polite" aria-atomic="true"></section>
    </>
  )
}
