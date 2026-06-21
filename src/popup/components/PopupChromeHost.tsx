import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Icon } from '../../ui/icons/Icon'
import { Button } from '../../ui/base/Button'
import { Input } from '../../ui/base/Input'
import { Popover } from '../../ui/base/Popover'
import {
  dispatchPopupChromeAction,
  usePopupChromeView,
  usePopupSearchFocusRequest
} from '../popup-controller-store'
import { PopupSavedSearches } from './PopupSavedSearches'
import { PopupSearchChips } from './PopupSearchChips'

const searchHelpPopoverClass =
  'w-[min(260px,calc(100vw-28px))] max-w-[260px] gap-2 rounded-[var(--ui-radius-panel)] border-[var(--ui-divider)] bg-[var(--ui-surface-raised)] p-3 text-[11px] leading-snug text-[var(--ui-text-secondary)] shadow-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[rgba(245,245,247,0.38)] focus-visible:outline-offset-2'

const searchHelpTitleClass = 'text-xs font-semibold text-[var(--ui-text-primary)]'
const searchHelpListClass = 'm-0 grid list-none gap-1.5 p-0'
const searchHelpItemClass = 'grid grid-cols-[52px_minmax(0,1fr)] items-baseline gap-2'
const searchHelpTagClass =
  'inline-flex min-h-5 items-center justify-center rounded-[var(--ui-radius-pill)] border border-[var(--ui-divider)] bg-[var(--ui-surface)] px-1.5 text-[10px] font-semibold text-[var(--ui-text-secondary)]'
const searchHelpExampleClass =
  'flex min-w-0 flex-wrap items-center gap-1 text-[var(--ui-text-primary)]'
const searchHelpCodeClass =
  'rounded-[5px] border border-[var(--ui-divider)] bg-[var(--ui-bg-main)] px-1 py-0.5 font-mono text-[10px] text-[var(--ui-text-primary)]'
const searchHelpHintClass = 'text-[10px] text-[var(--ui-text-muted)]'
const searchHelpToggleClass = [
  'relative inline-flex h-[18px] min-h-[18px] w-[18px] min-w-[18px] flex-none cursor-help items-center justify-center rounded-[var(--ui-radius-icon)] border border-[#3a3d46] bg-[#16181c] p-0 text-[var(--ui-text-secondary)] shadow-none',
  'transition-[background,border-color,color,transform] duration-150 ease-[var(--ui-ease-standard)]',
  'hover:border-[var(--ui-divider-strong)] hover:bg-[var(--ui-surface-hover)] hover:text-[var(--ui-text-primary)]',
  'focus-visible:border-[var(--ui-divider-strong)] focus-visible:bg-[var(--ui-surface-hover)] focus-visible:text-[var(--ui-text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[rgba(245,245,247,0.38)] focus-visible:outline-offset-2',
  'active:scale-[0.96]'
].join(' ')
const errorBannerClass =
  'relative z-[1] flex-none rounded-[var(--ui-radius-panel)] border border-[rgba(255,138,130,0.42)] bg-[rgba(255,138,130,0.10)] px-3.5 py-3 text-xs leading-[1.5] tracking-[0.01em] text-[#ffd5d0] shadow-none'
const toolbarClass =
  'relative z-[1] flex min-h-[18px] items-center justify-between gap-2.5 px-px'
const viewCaptionClass =
  'm-0 min-w-0 text-[11px] font-semibold leading-normal tracking-[0.01em] text-[var(--ui-text-primary)]'
const keyHintClass =
  'm-0 max-w-[210px] truncate text-right text-[10px] leading-normal tracking-[0.01em] text-[var(--ui-text-disabled)] opacity-60 transition-opacity duration-150 ease-[var(--ui-ease-standard)] group-focus-within:opacity-100'
const heroBaseClass =
  'hero relative z-[5] -mx-3.5 flex h-[31px] min-h-[31px] flex-[0_0_31px] items-center overflow-hidden border-b border-[#202228] bg-[#1a1c1d] px-3.5'
const heroBrandClass =
  'hero-brand flex min-w-0 flex-none items-center justify-start gap-2.5'
const heroMarkClass =
  'hero-mark relative block h-[27px] w-[27px] flex-none overflow-hidden rounded-lg border border-[#2d3038] bg-[#050607] shadow-none'
const heroLogoClass =
  'hero-logo block h-full w-full object-cover'
const heroCopyClass =
  'hero-copy flex min-w-0 flex-none flex-col gap-px'
const heroEyebrowClass =
  'hero-eyebrow m-0 text-[11px] font-semibold uppercase tracking-[0.01em] text-[var(--ui-text-disabled)]'
const heroTitleRowClass =
  'hero-title-row flex min-w-0 items-center gap-[5px]'
const heroActionsClass =
  'hero-actions inline-flex items-center gap-3.5'
const heroSettingsButtonClass = [
  'hero-settings-button inline-flex h-6 min-h-6 min-w-0 items-center justify-center gap-1.5 border-0 bg-transparent p-0 text-[13px] font-[720] text-[#c7ccd7] shadow-none',
  'transition-[color,background,transform] duration-150 ease-[var(--ui-ease-standard)]',
  'hover:bg-transparent hover:text-white',
  'focus-visible:bg-transparent focus-visible:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[rgba(245,245,247,0.38)] focus-visible:outline-offset-2',
  'active:scale-[0.96]'
].join(' ')
const commandPanelBaseClass = 'grid gap-2'
const commandPanelDefaultClass =
  'min-h-[67px] flex-none rounded-lg border border-[var(--popup-line)] bg-[#101114] p-3'
const commandPanelSmartClass =
  'min-h-0 flex-auto grid-rows-[minmax(0,1fr)] border-0 bg-transparent p-0'
const searchBlockClass = 'flex flex-col gap-2'
const searchShellClass = [
  'group/search flex min-h-10 w-full cursor-text items-center gap-1.5 rounded-[var(--ui-radius-pill)] border border-[var(--ui-divider)] bg-[var(--ui-surface-raised)] py-0 pl-3 pr-1.5 text-[var(--ui-text-primary)]',
  'transition-[border-color,background,box-shadow] duration-[var(--ui-motion-fast)] ease-[var(--ui-ease-standard)]',
  'hover:border-[var(--ui-divider-strong)] hover:bg-[var(--ui-surface-hover)]',
  'focus-within:border-[var(--ui-focus-ring)] focus-within:bg-[var(--ui-surface-hover)] focus-within:shadow-[0_0_0_3px_var(--ui-focus-ring-soft)]'
].join(' ')
const searchIconClass =
  'pointer-events-none flex-none text-[var(--ui-text-tertiary)] transition-colors duration-[var(--ui-motion-fast)] ease-[var(--ui-ease-standard)] group-focus-within/search:text-[var(--ui-text-secondary)]'
const searchInputClass =
  'min-w-0 flex-auto self-stretch border-0 bg-transparent px-0.5 py-0 text-sm leading-[1.4] text-[var(--ui-text-primary)] outline-none placeholder:text-[var(--ui-text-tertiary)] [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:hidden [&::-webkit-search-decoration]:appearance-none'
const clearSearchButtonClass = [
  'inline-flex h-[26px] w-[26px] flex-none items-center justify-center rounded-[var(--ui-radius-pill)] border-0 bg-transparent p-0 text-[var(--ui-text-tertiary)]',
  'transition-[background,color] duration-[var(--ui-motion-fast)] ease-[var(--ui-ease-standard)]',
  'hover:bg-[var(--ui-surface-pressed)] hover:text-[var(--ui-text-primary)]',
  'focus-visible:bg-[var(--ui-surface-pressed)] focus-visible:text-[var(--ui-text-primary)] focus-visible:outline-none'
].join(' ')
const semanticSearchBaseClass = [
  'relative inline-flex h-7 min-w-14 flex-none items-center justify-center gap-[5px] whitespace-nowrap rounded-[var(--ui-radius-pill)] border border-[var(--ui-divider)] bg-transparent px-3.5 text-xs font-medium tracking-[0.01em] text-[var(--ui-text-secondary)]',
  'transition-[background,border-color,color,box-shadow] duration-[var(--ui-motion-fast)] ease-[var(--ui-ease-standard)]',
  'hover:border-[var(--ui-divider-strong)] hover:bg-[var(--ui-surface-hover)] hover:text-[var(--ui-text-primary)]',
  'focus-visible:border-[var(--ui-divider-strong)] focus-visible:bg-[var(--ui-surface-hover)] focus-visible:text-[var(--ui-text-primary)] focus-visible:shadow-[0_0_0_3px_var(--ui-focus-ring-soft)] focus-visible:outline-none'
].join(' ')
const semanticSearchNotConfiguredClass =
  'border-dashed text-[var(--ui-text-disabled)] hover:text-[var(--ui-text-secondary)] focus-visible:text-[var(--ui-text-secondary)]'
const semanticSearchActiveClass =
  'border-[var(--ui-accent)] bg-[var(--ui-accent)] text-[var(--ui-text-inverse)] hover:border-[var(--ui-accent-strong)] hover:bg-[var(--ui-accent-strong)] hover:text-[var(--ui-text-inverse)] focus-visible:border-[var(--ui-accent-strong)] focus-visible:bg-[var(--ui-accent-strong)] focus-visible:text-[var(--ui-text-inverse)]'
const semanticSearchFallbackClass =
  'border-[var(--ui-warning)] bg-[rgba(248,214,109,0.14)] text-[var(--ui-warning)] hover:border-[var(--ui-warning)] hover:bg-[rgba(248,214,109,0.14)] hover:text-[var(--ui-warning)] focus-visible:border-[var(--ui-warning)] focus-visible:bg-[rgba(248,214,109,0.14)] focus-visible:text-[var(--ui-warning)]'
const semanticSearchPendingDotClass =
  'h-1.5 w-1.5 rounded-full bg-current animate-[cb-search-pulse_1s_var(--ui-ease-standard)_infinite] motion-reduce:animate-none'

export function PopupChromeHost({
  children,
  smartActive = false
}: {
  children?: ReactNode
  smartActive?: boolean
}) {
  const state = usePopupChromeView()
  const searchFocusRequest = usePopupSearchFocusRequest()
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

  const commandPanelClassName = [
    commandPanelBaseClass,
    smartActive ? commandPanelSmartClass : commandPanelDefaultClass
  ].join(' ')
  const naturalSearchClassName = [
    semanticSearchBaseClass,
    state.search.notConfigured ? semanticSearchNotConfiguredClass : '',
    state.search.pressed ? semanticSearchActiveClass : '',
    state.search.fallback ? semanticSearchFallbackClass : ''
  ].filter(Boolean).join(' ')

  return (
    <>
      <header className={[heroBaseClass, smartActive ? 'justify-center' : 'justify-between'].join(' ')}>
        <div className={heroBrandClass}>
          <div className={heroMarkClass} aria-hidden="true">
            <img className={heroLogoClass} src="../assets/icon128.png" alt="" />
          </div>
          <div className={heroCopyClass}>
            <p className={heroEyebrowClass} hidden>Chrome Bookmark Manager</p>
            <div className={heroTitleRowClass}>
              {smartActive ? null : <SearchHelpControl />}
            </div>
          </div>
        </div>
        {smartActive ? null : (
          <div className={heroActionsClass}>
            <Button
              id="open-settings"
              className={heroSettingsButtonClass}
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
        )}
      </header>

      <section className={commandPanelClassName} aria-label="书签搜索与操作">
        {smartActive ? null : (
          <section className={searchBlockClass} aria-label="搜索书签">
            <label className={searchShellClass} htmlFor="search-input">
              <Icon name="Search" className={searchIconClass} size={16} aria-hidden="true" />
              <Input
                ref={searchInputRef}
                id="search-input"
                className={searchInputClass}
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
                className={clearSearchButtonClass}
                hidden={!state.search.clearVisible}
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
              onClick={(event) => dispatchPopupChromeAction('toggle-natural-search', undefined, event.currentTarget)}
              unstyled
            >
                {state.search.pending ? <span className={semanticSearchPendingDotClass} aria-hidden="true" /> : null}
                {state.search.label}
              </Button>
            </label>

            <PopupSearchChips />
            <PopupSavedSearches />
          </section>
        )}
        {children}
      </section>

      {smartActive ? null : (
        <section className={toolbarClass} aria-label="当前视图状态">
          <p className={viewCaptionClass} id="view-caption">{state.viewCaption}</p>
          <p className={keyHintClass}>↑ ↓ 切换 · Enter 打开 · Esc 返回</p>
        </section>
      )}

      {state.loadError ? (
        <section id="error-banner" className={errorBannerClass} role="alert">{state.loadError}</section>
      ) : null}
    </>
  )
}

function SearchHelpControl() {
  const [open, setOpen] = useState(false)

  return (
    <Popover
      id="search-help-popover"
      className={searchHelpPopoverClass}
      open={open}
      onOpenChange={setOpen}
      portal={false}
      triggerId="search-help-toggle"
      align="start"
      sideOffset={6}
      trigger={
        <Button
          id="search-help-toggle"
          className={searchHelpToggleClass}
          type="button"
          aria-label="查看高级搜索语法"
          title="查看高级搜索语法（site / folder / type / -排除）"
          aria-controls="search-help-popover"
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault()
              setOpen(true)
            }
          }}
          unstyled
        >
          <Icon name="CircleHelp" size={13} aria-hidden="true" />
        </Button>
      }
    >
      <strong className={searchHelpTitleClass}>高级搜索语法</strong>
      <ul className={searchHelpListClass}>
        <li className={searchHelpItemClass}>
          <span className={searchHelpTagClass}>站点</span>
          <span className={searchHelpExampleClass}><code className={searchHelpCodeClass}>site:github.com</code></span>
        </li>
        <li className={searchHelpItemClass}>
          <span className={searchHelpTagClass}>文件夹</span>
          <span className={searchHelpExampleClass}><code className={searchHelpCodeClass}>folder:"前端资料"</code></span>
        </li>
        <li className={searchHelpItemClass}>
          <span className={searchHelpTagClass}>类型</span>
          <span className={searchHelpExampleClass}><code className={searchHelpCodeClass}>type:文档</code></span>
        </li>
        <li className={searchHelpItemClass}>
          <span className={searchHelpTagClass}>排除</span>
          <span className={searchHelpExampleClass}>
            <code className={searchHelpCodeClass}>-youtube</code>
            <span>或</span>
            <code className={searchHelpCodeClass}>-"短视频"</code>
          </span>
        </li>
      </ul>
      <span className={searchHelpHintClass}>Esc 关闭 · 点击外部收起</span>
    </Popover>
  )
}
