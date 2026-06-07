import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Icon } from '../../ui/icons/Icon'
import { Button } from '../../ui/primitives/Button'
import { Input } from '../../ui/primitives/Input'
import { Popover } from '../../ui/primitives/Popover'
import {
  dispatchPopupChromeAction,
  usePopupChromeView,
  usePopupSearchFocusRequest
} from '../popup-events'
import { PopupSavedSearches } from './PopupSavedSearches'
import { PopupSearchChips } from './PopupSearchChips'

export function PopupChromeHost({ children }: { children?: ReactNode }) {
  const state = usePopupChromeView()
  const searchFocusRequest = usePopupSearchFocusRequest()
  const [searchHelpOpen, setSearchHelpOpen] = useState(false)
  const searchInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!searchFocusRequest.id) {
      return
    }

    window.requestAnimationFrame(() => {
      searchInputRef.current?.focus()
      if (searchFocusRequest.select) {
        searchInputRef.current?.select()
      }
    })
  }, [searchFocusRequest])

  const naturalSearchClassName = [
    'cb-search__mode',
    state.search.pressed ? 'active' : '',
    state.search.pending ? 'pending' : '',
    state.search.fallback ? 'fallback' : '',
    state.search.notConfigured ? 'not-configured' : ''
  ].filter(Boolean).join(' ')

  return (
    <>
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
                    onKeyDown={(event) => {
                      if (event.key === 'ArrowDown') {
                        event.preventDefault()
                        setSearchHelpOpen(true)
                      }
                    }}
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
          <Button
            id="open-settings"
            className="hero-settings-button"
            type="button"
            aria-label="打开设置页"
            title="打开设置页"
            onClick={() => dispatchPopupChromeAction('open-settings')}
            unstyled
          >
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
              ref={searchInputRef}
              id="search-input"
              className="cb-search__input search-input"
              type="text"
              role="searchbox"
              spellCheck={false}
              autoComplete="off"
              placeholder={state.search.placeholder}
              autoFocus
              aria-label={state.search.ariaLabel}
              value={state.search.query}
              onValueChange={(nextValue) => dispatchPopupChromeAction('search-change', nextValue)}
              unstyled
            />
            <Button
              id="clear-search"
              className={['cb-search__clear', state.search.clearVisible ? '' : 'hidden'].filter(Boolean).join(' ')}
              type="button"
              aria-label="清空搜索"
              onClick={() => dispatchPopupChromeAction('clear-search')}
              unstyled
            >
              <Icon name="X" size={14} aria-hidden="true" />
            </Button>
            <Button
              id="natural-search-toggle"
              className={naturalSearchClassName}
              type="button"
              aria-label="语义搜索"
              aria-pressed={state.search.pressed}
              title={state.search.title}
              onClick={() => dispatchPopupChromeAction('toggle-natural-search')}
              unstyled
            >
              {state.search.label}
            </Button>
          </label>

          <PopupSearchChips />
          <PopupSavedSearches />
        </section>
        {children}
      </section>

      <section className="toolbar" aria-label="当前视图状态">
        <p className="view-caption" id="view-caption">{state.viewCaption}</p>
        <p className="key-hint">↑ ↓ 切换 · Enter 打开 · Esc 返回</p>
      </section>

      {state.loadError ? (
        <section id="error-banner" className="error-banner" role="alert">{state.loadError}</section>
      ) : null}
    </>
  )
}
