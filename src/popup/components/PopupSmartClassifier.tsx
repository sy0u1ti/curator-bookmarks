import type { CSSProperties } from 'react'
import { Button } from '../../ui/base/Button'
import { DotMatrixLoader } from '../../ui/base/DotMatrixLoader'
import { Input } from '../../ui/base/Input'
import { Progress } from '../../ui/base/Progress'
import { Toolbar } from '../../ui/base/Toolbar'
import { cx } from '../../ui/base/utils'
import { Icon } from '../../ui/icons/Icon'
import type { PopupSmartClassifierViewModel, PopupSmartPageViewModel } from './PopupViewModels'

const SMART_ERROR_BANNER_CLASS =
  'relative z-[1] flex-none rounded-[var(--ui-radius-panel)] border border-[rgba(255,138,130,0.42)] bg-[rgba(255,138,130,0.10)] px-3.5 py-3 text-xs leading-[1.5] tracking-[0.01em] text-[#ffd5d0] shadow-none'

const pageRevealShellClass = 'relative min-h-12 w-full'
const pageLayerClass = 'absolute inset-0 min-h-12'
const pageSkeletonLayerClass = cx(
  pageLayerClass,
  'z-[1] opacity-100 transition-[opacity,filter] duration-[var(--reveal-dur)] ease-[var(--reveal-ease)] motion-reduce:transition-none',
  '[&>*]:animate-[popup-skeleton-pulse_var(--pulse-dur)_ease-in-out_var(--pulse-count)] motion-reduce:[&>*]:animate-none'
)
const pageSkeletonHiddenClass = 'pointer-events-none opacity-0 blur-[var(--reveal-blur)]'
const pageContentLayerClass = cx(
  pageLayerClass,
  'z-[2] opacity-0 transition-[opacity,filter] duration-[var(--reveal-dur)] ease-[var(--reveal-ease)] motion-reduce:transition-none'
)
const pageContentLoadingClass = 'pointer-events-none blur-[var(--reveal-blur)]'
const pageContentReadyClass = 'opacity-100'
const pageCardClass =
  'grid min-h-12 w-full grid-cols-[minmax(0,1fr)_156px] items-center gap-[7px] overflow-hidden rounded-lg border border-[var(--popup-line)] bg-[#101114] px-[7px] py-1.5 shadow-none'
const pageMainClass = 'grid min-w-0 grid-cols-[26px_minmax(0,1fr)] items-center gap-[7px]'
const pageIconClass =
  'grid h-[26px] w-[26px] place-items-center overflow-hidden rounded-md border border-[var(--popup-line)] bg-[#15171b] text-sm font-bold leading-none text-[var(--popup-text)]'
const pageFaviconClass = 'block h-full w-full object-cover'
const pageCopyClass = 'min-w-0'
const pageTitleClass = 'm-0 min-w-0 truncate text-[13px] font-[760] leading-tight text-[var(--popup-text)]'
const pageStatusClass = 'mt-[3px] mb-0 min-w-0 truncate text-[11px] leading-tight text-[var(--popup-faint)]'
const placeholderPageCardClass = 'text-[#9da4b3]'
const placeholderIconClass = 'border-[var(--popup-line)] bg-[#15171b] text-[#aeb7c6]'
const placeholderTitleClass = 'text-[#dce2ed]'
const placeholderStatusClass = 'text-[var(--popup-faint)]'

const currentPageActionsClass =
  'grid w-[156px] grid-cols-[minmax(0,1fr)_auto] gap-1 justify-self-end'
const currentPageActionBaseClass = [
  'inline-flex min-h-6 min-w-0 items-center justify-center overflow-hidden truncate whitespace-nowrap rounded-md border px-[7px] text-[11px] font-[750] leading-none outline-none',
  'transition-[border-color,background,color,transform,opacity] duration-[var(--ui-motion-fast)] ease-[var(--ui-ease-standard)]',
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-[rgba(245,245,247,0.32)] focus-visible:outline-offset-1',
  'active:scale-[0.98] disabled:cursor-default disabled:opacity-70'
].join(' ')
const currentPageSecondaryActionClass = cx(
  currentPageActionBaseClass,
  'min-w-[42px] border-white/20 bg-[#171719] text-[rgba(244,246,251,0.72)] hover:border-white/40 hover:bg-[#26262a] hover:text-[var(--popup-text)] focus-visible:border-white/40 focus-visible:bg-[#26262a] focus-visible:text-[var(--popup-text)]'
)
const currentPagePrimaryActionClass = cx(
  currentPageActionBaseClass,
  'w-full border-[rgba(245,245,247,0.82)] bg-[#f5f5f7] text-[#111113] hover:border-white hover:bg-white hover:text-[#111113] focus-visible:border-white focus-visible:bg-white focus-visible:text-[#111113]'
)
const currentPagePinnedActionClass = cx(
  currentPageActionBaseClass,
  'w-full border-[rgba(245,245,247,0.5)] bg-[#203026] text-[#d6f6dc] hover:border-[rgba(245,245,247,0.62)] hover:bg-[#26382d] hover:text-[#e6fbe9] focus-visible:border-[rgba(245,245,247,0.62)] focus-visible:bg-[#26382d] focus-visible:text-[#e6fbe9]'
)
const placeholderSecondaryActionClass = cx(
  currentPageActionBaseClass,
  'min-w-[42px] border-[var(--popup-line)] bg-[#15171b] text-[#737d8c] disabled:opacity-100'
)
const placeholderPrimaryActionClass = cx(
  currentPageActionBaseClass,
  'w-full border-[var(--popup-line-strong)] bg-[#1a1d22] text-[#8992a1] disabled:opacity-100'
)

const skeletonBarClass =
  'block h-[9px] w-[calc(var(--skeleton-width,0.7)*100%)] overflow-hidden rounded-full bg-[linear-gradient(90deg,rgba(255,255,255,0.055),rgba(255,255,255,0.12),rgba(255,255,255,0.055))] bg-[length:220%_100%] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.018)] animate-[popup-skeleton-shimmer_1500ms_ease-in-out_infinite] motion-reduce:animate-none'
const skeletonDotClass =
  'block h-7 w-7 overflow-hidden rounded-md bg-[linear-gradient(90deg,rgba(255,255,255,0.055),rgba(255,255,255,0.12),rgba(255,255,255,0.055))] bg-[length:220%_100%] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.018)] animate-[popup-skeleton-shimmer_1500ms_ease-in-out_infinite] motion-reduce:animate-none'
const pageSkeletonCopyClass = 'grid min-w-0 gap-[7px]'
const pageSkeletonTitleClass = cx(skeletonBarClass, 'h-[11px] min-w-24')
const pageSkeletonStatusClass = cx(skeletonBarClass, 'h-2 min-w-[132px] opacity-[0.68]')
const pageSkeletonActionsClass = cx(currentPageActionsClass, 'items-center')
const pageSkeletonActionClass = cx(skeletonBarClass, 'h-6 w-full rounded-md')
const pageSkeletonSecondaryActionClass = cx(pageSkeletonActionClass, 'min-w-[42px]')

const panelCardClass =
  'w-full rounded-lg border border-[var(--popup-line)] bg-[#101114] shadow-none'
const panelHeaderClass = 'flex items-center justify-between gap-3'
const panelHeaderTitleClass = 'm-0 text-xs font-[650] text-[var(--ui-text-secondary)]'
const panelHeaderWithMarginClass = cx(panelHeaderClass, 'mb-3')
const panelHeaderLargeMarginClass = cx(panelHeaderClass, 'mb-[22px]')
const panelHeaderStandaloneClass = panelHeaderClass
const exitButtonClass = [
  'inline-flex h-7 min-w-[42px] items-center justify-center rounded-md border border-[var(--popup-line)] bg-[#171719] px-2 text-xs font-[650] text-[var(--ui-text-secondary)] outline-none',
  'transition-[border-color,background,color,transform] duration-[var(--ui-motion-fast)] ease-[var(--ui-ease-standard)]',
  'hover:border-[var(--popup-line-strong)] hover:bg-[#26262a] hover:text-[var(--popup-text)]',
  'focus-visible:border-[var(--popup-line-strong)] focus-visible:bg-[#26262a] focus-visible:text-[var(--popup-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[rgba(245,245,247,0.32)] focus-visible:outline-offset-1',
  'active:scale-[0.98]'
].join(' ')

const actionsClass = 'mt-3 grid grid-cols-[repeat(auto-fit,minmax(86px,1fr))] gap-2'
const actionsThreeClass = cx(actionsClass, 'grid-cols-3')
const actionButtonBaseClass = [
  'inline-flex min-h-[38px] w-full items-center justify-center gap-2 rounded-lg border px-3 text-[13px] font-[750] leading-none outline-none',
  'transition-[border-color,background,color,transform,opacity] duration-[var(--ui-motion-fast)] ease-[var(--ui-ease-standard)]',
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-[rgba(245,245,247,0.32)] focus-visible:outline-offset-1',
  'active:scale-[0.98] disabled:cursor-default'
].join(' ')
const secondaryActionButtonClass = cx(
  actionButtonBaseClass,
  'border-[var(--popup-line)] bg-[#171719] text-[var(--popup-text)] hover:border-[var(--popup-line-strong)] hover:bg-[#202126] focus-visible:border-[var(--popup-line-strong)] focus-visible:bg-[#202126]'
)
const settingsActionButtonClass = cx(
  actionButtonBaseClass,
  'border-[#3f3f46] bg-[#222226] text-[var(--popup-text)] hover:border-[#5a5a63] hover:bg-[#2c2c31] focus-visible:border-[#5a5a63] focus-visible:bg-[#2c2c31]'
)
const primaryActionButtonClass = cx(
  actionButtonBaseClass,
  'border-[rgba(245,245,247,0.92)] bg-[#f5f5f7] text-[#111113] hover:border-white hover:bg-white focus-visible:border-white focus-visible:bg-white'
)
const savedActionButtonClass =
  'border-[rgba(245,245,247,0.36)] bg-[rgba(245,245,247,0.16)] !text-[#9bd8ad] disabled:opacity-100'

const manualButtonClass = [
  'mx-auto inline-flex w-fit items-center justify-center gap-[7px] rounded-md border border-transparent bg-transparent px-2 py-1.5 text-xs font-semibold text-[var(--ui-text-secondary)] outline-none',
  'transition-[color,background,transform] duration-[var(--ui-motion-fast)] ease-[var(--ui-ease-standard)]',
  'hover:bg-[var(--ui-surface-hover)] hover:text-[var(--popup-text)]',
  'focus-visible:bg-[var(--ui-surface-hover)] focus-visible:text-[var(--popup-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[rgba(245,245,247,0.32)] focus-visible:outline-offset-1',
  'active:scale-[0.98]'
].join(' ')
const folderIconClass = 'h-3.5 w-3.5 flex-none text-[var(--ui-text-secondary)]'

const permissionCardClass = cx(panelCardClass, 'flex h-full min-h-0 flex-col overflow-hidden p-[18px]')
const permissionBodyClass = 'grid gap-2.5'
const permissionCopyClass = 'm-0 text-xs leading-[1.55] text-[var(--ui-text-secondary)]'
const permissionErrorClass = 'm-0 text-xs leading-[1.55] text-[#ffd1cc]'
const permissionOriginsClass = 'flex flex-wrap gap-1.5'
const permissionOriginClass =
  'max-w-full overflow-hidden truncate whitespace-nowrap rounded-md border border-[var(--popup-line)] bg-[#171719] px-2 py-1.5 text-[11px] leading-tight text-[var(--popup-text)]'

const buttonLoadingLabelClass = 'inline-flex min-w-0 items-center justify-center gap-[7px]'
const buttonDotLoaderClass = 'h-3.5 w-3.5'
const loadingCardClass = cx(panelCardClass, 'grid h-full min-h-0 content-center overflow-hidden p-[18px]')
const loadingBodyClass = 'grid grid-cols-[46px_minmax(0,1fr)] items-center gap-3.5'
const loadingLoaderClass = 'h-[46px] w-[46px] text-[var(--popup-text)]'
const loadingContentClass = 'min-w-0'
const loadingCopyClass =
  'mb-2.5 mt-0 flex items-center justify-between gap-3 text-[13px] font-[650] text-[var(--popup-text)]'
const loadingStepClass = 'text-[11px] font-medium text-[var(--ui-text-secondary)]'
const progressTrackClass = 'h-[5px] overflow-hidden rounded-full bg-white/[0.08]'
const progressBarClass =
  'block h-full w-full origin-left rounded-[inherit] bg-[linear-gradient(90deg,#f5f5f7,#8e8e93)] transition-transform duration-[760ms] ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform motion-reduce:transition-none'

const resultCardClass = cx(panelCardClass, 'flex h-full min-h-0 flex-col overflow-hidden p-[18px]')
const titleRowClass = 'mb-3.5 grid grid-cols-[minmax(0,1fr)] gap-2'
const titleInputClass =
  'min-h-9 w-full rounded-md border border-[var(--popup-line)] bg-[#15171b] px-3 text-[13px] font-[650] leading-tight text-[var(--popup-text)] outline-none placeholder:text-[rgba(244,246,251,0.38)] focus:border-[var(--ui-focus-ring)] focus:bg-[var(--ui-surface-hover)] focus:shadow-none focus-visible:border-[var(--ui-focus-ring)] focus-visible:bg-[var(--ui-surface-hover)] focus-visible:shadow-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[rgba(245,245,247,0.32)] focus-visible:outline-offset-1 [&&:focus]:!border-[var(--ui-focus-ring)] [&&:focus]:![background:var(--ui-surface-hover)] [&&:focus]:!shadow-none [&&:focus-visible]:!border-[var(--ui-focus-ring)] [&&:focus-visible]:![background:var(--ui-surface-hover)] [&&:focus-visible]:!shadow-none [&&:focus-visible]:![outline:1px_solid_var(--ui-focus-ring)] [&&:focus-visible]:!outline-offset-2'
const sectionLabelClass = 'mb-[9px] mt-0 text-xs font-semibold text-[var(--ui-text-secondary)]'
const recommendationsClass =
  'flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-0.5 [scrollbar-color:#333741_transparent] [scrollbar-gutter:stable] [scrollbar-width:thin]'
const folderOptionBaseClass = [
  'grid min-h-[50px] w-full grid-cols-[minmax(0,1fr)_auto] items-start gap-2.5 rounded-lg border border-[var(--popup-line)] bg-[#15171b] px-3 py-2.5 text-left outline-none',
  'transition-[border-color,background,color,transform] duration-[var(--ui-motion-fast)] ease-[var(--ui-ease-standard)]',
  'hover:border-[var(--popup-line-strong)] hover:bg-[#202126] focus-visible:border-[var(--popup-line-strong)] focus-visible:bg-[#202126] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[rgba(245,245,247,0.32)] focus-visible:outline-offset-1',
  'active:scale-[0.993]'
].join(' ')
const folderOptionSelectedClass =
  'border-[var(--popup-line-strong)] bg-[var(--ui-surface-selected)] text-[var(--popup-text)]'
const folderMainClass = 'grid min-w-0 gap-1'
const folderHeadClass = 'flex min-w-0 items-center gap-2'
const folderNameClass = 'min-w-0 truncate text-[13px] font-bold leading-tight text-[var(--popup-text)]'
const folderPathClass = 'ml-[22px] min-w-0 break-all text-[11px] leading-snug text-[var(--ui-text-secondary)]'
const folderMetaClass =
  'flex items-start gap-2 text-[11px] font-[650] text-[var(--ui-text-secondary)]'
const checkIconClass = 'h-3.5 w-3.5 text-[var(--popup-text)]'
const newBadgeClass =
  'inline-flex min-h-[18px] items-center rounded-full border border-[var(--popup-line)] bg-[var(--ui-surface-raised)] px-1.5 text-[10px] font-extrabold text-[var(--ui-text-secondary)]'
const compactStateClass =
  'grid min-h-[90px] place-items-center px-4 py-3 text-center text-xs leading-[1.55] text-[var(--popup-faint)]'

export interface PopupSmartClassifierActionHandlers {
  onAction?: (action: string, returnFocusElement?: HTMLElement | null) => void
  onCurrentPageAction?: (action: string, returnFocusElement?: HTMLElement | null) => void
  onRecommendationSelect?: (recommendationId: string) => void
  onTitleChange?: (title: string) => void
}

export function PopupSmartClassifier({
  handlers,
  state
}: {
  handlers?: PopupSmartClassifierActionHandlers
  state: PopupSmartClassifierViewModel
}) {
  if (state.status === 'hidden') {
    return null
  }

  if (state.status === 'page-loading') {
    return <PopupSmartPageRevealCard handlers={handlers} page={state.page} loading />
  }

  if (state.status === 'loading') {
    return <PopupSmartLoading handlers={handlers} state={state} />
  }

  if (state.status === 'results') {
    return (
      <>
        <PopupSmartResult handlers={handlers} state={state} />
        <PopupSmartManualButton handlers={handlers} />
      </>
    )
  }

  if (state.status === 'error') {
    return (
      <>
        <PopupSmartPageCard handlers={handlers} page={state.page} />
        <div className={panelHeaderStandaloneClass}>
          <p className={panelHeaderTitleClass}>智能分类失败</p>
          <PopupSmartExitButton handlers={handlers} />
        </div>
        <div className={SMART_ERROR_BANNER_CLASS}>{state.error || '智能分类失败，请稍后重试。'}</div>
        <Toolbar className={actionsThreeClass} unstyled>
          <Button
            className={secondaryActionButtonClass}
            type="button"
            data-smart-action="manual-folder"
            onClick={(event) => handlers?.onAction?.('manual-folder', event.currentTarget)}
            unstyled
          >
            手动选择
          </Button>
          <Button
            className={settingsActionButtonClass}
            type="button"
            data-smart-action="open-ai-settings"
            onClick={() => handlers?.onAction?.('open-ai-settings')}
            unstyled
          >
            AI 设置
          </Button>
          <Button
            className={primaryActionButtonClass}
            type="button"
            data-smart-action="classify"
            onClick={() => handlers?.onAction?.('classify')}
            unstyled
          >
            重试
          </Button>
        </Toolbar>
      </>
    )
  }

  if (state.status === 'permission') {
    return <PopupSmartPermission handlers={handlers} state={state} />
  }

  return <PopupSmartPageRevealCard handlers={handlers} page={state.page} loading={false} />
}

function PopupSmartPageCard({
  handlers,
  page
}: {
  handlers?: PopupSmartClassifierActionHandlers
  page: PopupSmartPageViewModel | null
}) {
  return (
    <article className={getPopupSmartPageCardClassName(page)}>
      <PopupSmartPageCardContent handlers={handlers} page={page} />
    </article>
  )
}

function PopupSmartPageRevealCard({
  handlers,
  loading,
  page
}: {
  handlers?: PopupSmartClassifierActionHandlers
  loading: boolean
  page: PopupSmartPageViewModel | null
}) {
  return (
    <div
      className={pageRevealShellClass}
      data-state={loading ? 'loading' : 'ready'}
      aria-busy={loading ? 'true' : 'false'}
      role={loading ? 'status' : undefined}
      aria-live="polite"
    >
      <div className={cx(pageCardClass, pageSkeletonLayerClass, loading ? '' : pageSkeletonHiddenClass)} aria-hidden="true">
        <PopupSmartPageSkeletonContent />
      </div>
      <article className={cx(getPopupSmartPageCardClassName(page), pageContentLayerClass, loading ? pageContentLoadingClass : pageContentReadyClass)}>
        <PopupSmartPageCardContent handlers={handlers} page={page} />
      </article>
    </div>
  )
}

function getPopupSmartPageCardClassName(page: PopupSmartPageViewModel | null) {
  return cx(pageCardClass, page ? '' : placeholderPageCardClass)
}

function PopupSmartPageCardContent({
  handlers,
  page
}: {
  handlers?: PopupSmartClassifierActionHandlers
  page: PopupSmartPageViewModel | null
}) {
  if (!page) {
    return <PopupSmartPagePlaceholderContent />
  }

  return (
    <>
      <div className={pageMainClass}>
        <span className={pageIconClass} aria-hidden="true">
          {page.favicon ? <img className={pageFaviconClass} src={page.favicon} alt="" /> : page.fallbackIcon}
        </span>
        <div className={pageCopyClass}>
          <p className={pageTitleClass} title={page.title}>{page.title}</p>
          <p className={pageStatusClass} title={page.statusTitle}>{page.status}</p>
        </div>
      </div>
      {page.bookmarked ? (
        <Toolbar className={currentPageActionsClass} aria-label="当前页快捷操作" unstyled>
          <Button
            className={page.pinned ? currentPagePinnedActionClass : currentPagePrimaryActionClass}
            type="button"
            data-current-page-action="pin-newtab"
            aria-pressed={page.pinned}
            disabled={page.pinPending}
            onClick={() => handlers?.onCurrentPageAction?.('pin-newtab')}
            unstyled
          >
            {page.pinPending ? <PopupButtonLoadingLabel label={page.pinned ? '取消中' : '固定中'} /> : page.pinLabel}
          </Button>
          <Button
            className={currentPageSecondaryActionClass}
            type="button"
            data-current-page-action="edit"
            onClick={(event) => handlers?.onCurrentPageAction?.('edit', event.currentTarget)}
            unstyled
          >
            编辑
          </Button>
        </Toolbar>
      ) : (
        <Toolbar className={currentPageActionsClass} aria-label="当前页快捷操作" unstyled>
          <Button
            className={currentPagePrimaryActionClass}
            type="button"
            data-current-page-action="save"
            onClick={(event) => handlers?.onCurrentPageAction?.('save', event.currentTarget)}
            unstyled
          >
            快速保存
          </Button>
          <Button
            className={currentPageSecondaryActionClass}
            type="button"
            data-smart-action="classify"
            onClick={() => handlers?.onAction?.('classify')}
            unstyled
          >
            智能分类
          </Button>
        </Toolbar>
      )}
    </>
  )
}

function PopupSmartPageSkeletonContent() {
  return (
    <>
      <div className={pageMainClass}>
        <span className={skeletonDotClass} aria-hidden="true"></span>
        <span className={pageSkeletonCopyClass} aria-hidden="true">
          <span
            className={pageSkeletonTitleClass}
            style={{ '--skeleton-width': 0.64 } as CSSProperties}
          ></span>
          <span
            className={pageSkeletonStatusClass}
            style={{ '--skeleton-width': 0.86 } as CSSProperties}
          ></span>
        </span>
      </div>
      <span className={pageSkeletonActionsClass} aria-hidden="true">
        <span className={pageSkeletonActionClass}></span>
        <span className={pageSkeletonSecondaryActionClass}></span>
      </span>
    </>
  )
}

function PopupSmartPagePlaceholderContent() {
  return (
    <>
      <div className={pageMainClass}>
        <span className={cx(pageIconClass, placeholderIconClass)} aria-hidden="true">
          <Icon name="PanelRight" size={15} />
        </span>
        <div className={pageCopyClass}>
          <p className={cx(pageTitleClass, placeholderTitleClass)}>当前标签页</p>
          <p className={cx(pageStatusClass, placeholderStatusClass)} title="打开网页后可快速保存或智能分类">
            打开网页后可快速保存或智能分类
          </p>
        </div>
      </div>
      <Toolbar className={cx(currentPageActionsClass, 'pointer-events-none')} aria-label="当前页快捷操作" unstyled>
        <Button className={placeholderPrimaryActionClass} type="button" disabled unstyled>
          快速保存
        </Button>
        <Button className={placeholderSecondaryActionClass} type="button" disabled unstyled>
          智能分类
        </Button>
      </Toolbar>
    </>
  )
}

function PopupSmartExitButton({ handlers }: { handlers?: PopupSmartClassifierActionHandlers }) {
  return (
    <Button
      className={exitButtonClass}
      type="button"
      data-smart-action="exit"
      aria-label="退出智能分类"
      onClick={() => handlers?.onAction?.('exit')}
      unstyled
    >
      退出
    </Button>
  )
}

function PopupSmartManualButton({ handlers }: { handlers?: PopupSmartClassifierActionHandlers }) {
  return (
    <Button
      className={manualButtonClass}
      type="button"
      data-smart-action="manual-folder"
      onClick={(event) => handlers?.onAction?.('manual-folder', event.currentTarget)}
      unstyled
    >
      <Icon name="Folder" className={folderIconClass} aria-hidden="true" />
      <span>手动选择文件夹</span>
    </Button>
  )
}

function PopupSmartPermission({
  handlers,
  state
}: {
  handlers?: PopupSmartClassifierActionHandlers
  state: PopupSmartClassifierViewModel
}) {
  return (
    <article className={permissionCardClass}>
      <div className={panelHeaderWithMarginClass}>
        <p className={panelHeaderTitleClass}>需要授权 AI 渠道</p>
        <PopupSmartExitButton handlers={handlers} />
      </div>
      <div className={permissionBodyClass}>
        <p className={permissionCopyClass}>
          智能分类需要访问你配置的 AI 服务地址。当前网页不会申请额外权限，正文读取失败时会用标题和 URL 继续推荐。
        </p>
        {state.permissionOrigins.length ? (
          <div className={permissionOriginsClass}>
            {state.permissionOrigins.map((origin) => <span className={permissionOriginClass} key={origin}>{origin}</span>)}
          </div>
        ) : null}
        {state.error ? <p className={permissionErrorClass}>{state.error}</p> : null}
      </div>
      <Toolbar className={actionsClass} unstyled>
        <Button
          className={secondaryActionButtonClass}
          type="button"
          data-smart-action="manual-folder"
          onClick={(event) => handlers?.onAction?.('manual-folder', event.currentTarget)}
          unstyled
        >
          手动选择
        </Button>
        <Button
          className={settingsActionButtonClass}
          type="button"
          data-smart-action="open-ai-settings"
          onClick={() => handlers?.onAction?.('open-ai-settings')}
          unstyled
        >
          AI 设置
        </Button>
        <Button
          className={primaryActionButtonClass}
          type="button"
          data-smart-action="grant-permission"
          onClick={() => handlers?.onAction?.('grant-permission')}
          unstyled
        >
          授权并继续
        </Button>
      </Toolbar>
    </article>
  )
}

function PopupButtonLoadingLabel({ label }: { label: string }) {
  return (
    <span className={buttonLoadingLabelClass}>
      <DotMatrixLoader variant="bar" className={buttonDotLoaderClass} />
      <span>{label}</span>
    </span>
  )
}

function PopupSmartLoading({
  handlers,
  state
}: {
  handlers?: PopupSmartClassifierActionHandlers
  state: PopupSmartClassifierViewModel
}) {
  return (
    <article className={loadingCardClass}>
      <div className={panelHeaderLargeMarginClass}>
        <p className={panelHeaderTitleClass}>智能分类</p>
        <PopupSmartExitButton handlers={handlers} />
      </div>
      <div className={loadingBodyClass}>
        <DotMatrixLoader variant="spiral" className={loadingLoaderClass} />
        <div className={loadingContentClass}>
          <p className={loadingCopyClass}>
            <span>{state.loadingLabel}</span>
            <small className={loadingStepClass}>{state.loadingStep}/{state.loadingStepCount}</small>
          </p>
          <Progress
            className={progressTrackClass}
            indicatorClassName={progressBarClass}
            indicatorProps={{ 'data-smart-progress-target': state.loadingProgress } as Record<string, string | number>}
            indicatorStyle={{
              '--smart-progress-scale': state.loadingProgress / 100,
              '--smart-progress-start': state.loadingStartProgress / 100,
              transform: `scaleX(${state.loadingProgress / 100})`
            } as CSSProperties}
            label="智能分类进度"
            value={state.loadingProgress}
            unstyled
          />
        </div>
      </div>
    </article>
  )
}

function PopupSmartResult({
  handlers,
  state
}: {
  handlers?: PopupSmartClassifierActionHandlers
  state: PopupSmartClassifierViewModel
}) {
  const canSave = Boolean(state.recommendations.length && !state.saving && !state.saved)

  return (
    <article className={resultCardClass}>
      <div className={panelHeaderWithMarginClass}>
        <p className={panelHeaderTitleClass}>推荐文件夹</p>
        <PopupSmartExitButton handlers={handlers} />
      </div>
      <div className={titleRowClass}>
        <Input
          id="smart-title-input"
          className={titleInputClass}
          type="text"
          spellCheck={false}
          maxLength={180}
          defaultValue={state.suggestedTitle}
          aria-label="推荐书签标题"
          onValueChange={(value) => handlers?.onTitleChange?.(value)}
          unstyled
        />
      </div>
      <p className={sectionLabelClass}>推荐文件夹</p>
      <div className={recommendationsClass}>
        {state.recommendations.length ? (
          state.recommendations.map((recommendation) => (
            <Button
              className={cx(folderOptionBaseClass, recommendation.selected ? folderOptionSelectedClass : '')}
              type="button"
              data-smart-recommendation={recommendation.id}
              aria-pressed={recommendation.selected}
              onClick={() => handlers?.onRecommendationSelect?.(recommendation.id)}
              key={recommendation.id}
              unstyled
            >
              <span className={folderMainClass}>
                <span className={folderHeadClass}>
                  <Icon name="Folder" className={folderIconClass} aria-hidden="true" />
                  <span className={folderNameClass}>{recommendation.title}</span>
                </span>
                <span className={folderPathClass} title={recommendation.path}>{recommendation.path}</span>
              </span>
              <span className={folderMetaClass}>
                {recommendation.isNew ? <span className={newBadgeClass}>新建</span> : null}
                {recommendation.selected ? <Icon name="Check" className={checkIconClass} aria-hidden="true" /> : null}
                <span>{recommendation.confidence}%</span>
              </span>
            </Button>
          ))
        ) : (
          <div className={compactStateClass}>未生成可用推荐，请手动选择文件夹。</div>
        )}
      </div>
      <Toolbar className={actionsClass} unstyled>
        <Button
          className={secondaryActionButtonClass}
          type="button"
          data-smart-action="reset"
          onClick={() => handlers?.onAction?.('reset')}
          unstyled
        >
          取消
        </Button>
        <Button
          className={cx(primaryActionButtonClass, state.saved ? savedActionButtonClass : '')}
          type="button"
          data-smart-action="save"
          disabled={!canSave}
          onClick={() => handlers?.onAction?.('save')}
          unstyled
        >
          {state.saved ? '已保存' : state.saving ? <PopupButtonLoadingLabel label="保存中" /> : '确认保存'}
        </Button>
      </Toolbar>
    </article>
  )
}
