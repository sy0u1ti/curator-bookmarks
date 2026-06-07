import { useEffect, useState } from 'react'
import { AiSetupPrompt, Button, DialogOverlay, Icon, Input, Popover, ThemeProvider } from '../ui'
import { getModalCloseDurationMs } from '../shared/motion'
import { PopupAutoAnalyzeStatus } from './components/PopupAutoAnalyzeStatus'
import { PopupSavedSearches } from './components/PopupSavedSearches'
import { PopupSearchChips } from './components/PopupSearchChips'
import { PopupToasts } from './components/PopupToasts'

export function PopupApp() {
  useEffect(() => {
    let disposed = false
    let cleanupRuntime: (() => void) | null = null

    void import('./popup-runtime.js').then(({ startPopupRuntime }) => {
      if (!disposed) {
        cleanupRuntime = startPopupRuntime()
      }
    })

    return () => {
      disposed = true
      cleanupRuntime?.()
      cleanupRuntime = null
    }
  }, [])

  return (
    <ThemeProvider>
      <PopupShell />
    </ThemeProvider>
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
    <label className="cb-search modal-search" htmlFor={htmlFor}>
      <Icon name="Search" className="cb-search__icon" size={16} aria-hidden="true" />
      <Input
        id={inputId}
        className="cb-search__input"
        type="text"
        role="searchbox"
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
  const [modalClosing, setModalClosing] = useState(false)
  const [modalPortalContainer, setModalPortalContainer] = useState<HTMLElement | null>(null)

  useEffect(() => {
    let modalCloseTimer = 0
    const handleOpen = () => setSearchHelpOpen(true)
    const handleClose = () => setSearchHelpOpen(false)
    const handleModalState = (event: Event) => {
      const detail = (event as CustomEvent<{ open?: boolean }>).detail
      const nextOpen = Boolean(detail?.open)
      window.clearTimeout(modalCloseTimer)
      if (nextOpen) {
        setModalClosing(false)
        setModalOpen(true)
        return
      }
      setModalClosing(true)
      modalCloseTimer = window.setTimeout(() => {
        setModalClosing(false)
        setModalOpen(false)
      }, getModalCloseDurationMs())
    }

    setModalPortalContainer(document.getElementById('popup-root'))
    window.addEventListener('popup:search-help-open', handleOpen)
    window.addEventListener('popup:search-help-close', handleClose)
    window.addEventListener('popup:modal-state', handleModalState)

    return () => {
      window.removeEventListener('popup:search-help-open', handleOpen)
      window.removeEventListener('popup:search-help-close', handleClose)
      window.removeEventListener('popup:modal-state', handleModalState)
      window.clearTimeout(modalCloseTimer)
    }
  }, [])

  const modalBackdropClassName = [
    'modal-backdrop',
    modalOpen ? '' : 'hidden',
    modalClosing ? 'is-closing' : ''
  ].filter(Boolean).join(' ')

  return (
    <>
      <main id="popup-app-shell" className="app-shell">
        <header className="hero">
          <div className="hero-brand">
            <div className="hero-mark" aria-hidden="true">
              <img className="hero-logo" src="../assets/icon128.png" alt="" />
            </div>
            <div className="hero-copy">
              <p className="hero-eyebrow">Chrome Bookmark Manager</p>
              <div className="hero-title-row">
                <Popover
                  id="search-help-popover"
                  className="search-help-popover"
                  open={searchHelpOpen}
                  onOpenChange={setSearchHelpOpen}
                  portal={false}
                  triggerId="search-help-toggle"
                  align="start"
                  sideOffset={6}
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
                      <Icon name="CircleHelp" size={13} aria-hidden="true" />
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
              </div>
            </div>
          </div>
          <div className="hero-actions">
            <Button id="open-settings" className="hero-settings-button" type="button" aria-label="打开设置页" title="打开设置页" unstyled>
              <Icon name="Settings" size={15} aria-hidden="true" />
              <span>设置</span>
            </Button>
          </div>
        </header>

        <section className="command-panel" aria-label="书签搜索与操作">
          <section className="search-block" aria-label="搜索书签">
            <label className="cb-search" htmlFor="search-input">
              <Icon name="Search" className="cb-search__icon" size={16} aria-hidden="true" />
              <Input
                id="search-input"
                className="cb-search__input search-input"
                type="text"
                role="searchbox"
                spellCheck={false}
                autoComplete="off"
                placeholder="关键词搜索"
                autoFocus
                aria-label="搜索书签标题、网址或高级语法"
                unstyled
              />
              <Button id="clear-search" className="cb-search__clear hidden" type="button" aria-label="清空搜索" unstyled>
                <Icon name="X" size={14} aria-hidden="true" />
              </Button>
              <Button
                id="natural-search-toggle"
                className="cb-search__mode"
                type="button"
                aria-label="语义搜索"
                aria-pressed="false"
                title="AI 语义搜索：需要先配置 AI 渠道"
                unstyled
              >
                语义
              </Button>
            </label>

            <PopupSearchChips />
            <PopupSavedSearches />
          </section>

          <section id="smart-classifier" className="smart-classifier hidden" aria-live="polite"></section>
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

        <PopupAutoAnalyzeStatus />

        <footer id="smart-footer" className="smart-footer hidden" aria-hidden="true">
          <span id="smart-total" className="smart-total">总计 0</span>
          <Button id="smart-footer-settings" className="smart-settings-link" type="button" tabIndex={-1} unstyled>设置</Button>
        </footer>
      </main>

      <DialogOverlay
        id="modal-backdrop"
        className={modalBackdropClassName}
        open={modalOpen}
        onOpenChange={(open) => {
          if (!open && modalOpen) {
            window.dispatchEvent(new CustomEvent('popup:modal-close'))
            return
          }
          setModalOpen(open)
        }}
        aria-hidden={modalOpen && !modalClosing ? 'false' : 'true'}
        disablePointerDismissal
        portalContainer={modalPortalContainer ?? undefined}
      >
        <div
          className="popup-modal-stack"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              window.dispatchEvent(new CustomEvent('popup:modal-close'))
            }
          }}
        >
        <section id="move-modal" className="modal-card t-modal hidden" aria-labelledby="move-modal-title" tabIndex={-1}>
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

        <section id="smart-folder-modal" className="modal-card t-modal hidden" aria-labelledby="smart-folder-modal-title" tabIndex={-1}>
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

        <section id="ai-provider-prompt-modal" className="modal-card t-modal small hidden" aria-labelledby="ai-provider-prompt-title" tabIndex={-1}>
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

        <section id="edit-modal" className="modal-card t-modal hidden" aria-labelledby="edit-modal-title" tabIndex={-1}>
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

        <section id="delete-modal" className="modal-card t-modal small hidden" aria-labelledby="delete-modal-title" tabIndex={-1}>
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
        </div>
      </DialogOverlay>

      <PopupToasts />
    </>
  )
}
