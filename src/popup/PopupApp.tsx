import { useEffect, useState } from 'react'
import { Button, DialogOverlay, Icon, Input, Popover, ThemeProvider } from '../ui'
import { getModalCloseDurationMs } from '../shared/motion'
import { PopupAutoAnalyzeStatus } from './components/PopupAutoAnalyzeStatus'
import { PopupContentHost } from './components/PopupContentHost'
import { PopupModalsHost } from './components/PopupModalsHost'
import { PopupSavedSearches } from './components/PopupSavedSearches'
import { PopupSearchChips } from './components/PopupSearchChips'
import { PopupSmartClassifierHost } from './components/PopupSmartClassifierHost'
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

          <PopupSmartClassifierHost />
        </section>

        <section className="toolbar" aria-label="当前视图状态">
          <p className="view-caption" id="view-caption">书签栏</p>
          <p className="key-hint">↑ ↓ 切换 · Enter 打开 · Esc 返回</p>
        </section>

        <section id="error-banner" className="error-banner hidden" role="alert"></section>

        <section className="content-shell">
          <PopupContentHost />
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
        <PopupModalsHost />
      </DialogOverlay>

      <PopupToasts />
    </>
  )
}
