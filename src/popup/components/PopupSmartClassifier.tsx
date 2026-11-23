import { useEffect, useLayoutEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { AiThinkingOrb } from '../../ui/ai/AiThinkingOrb'
import { Button } from '../../ui/base/Button'
import { ErrorState } from '../../ui/base/ErrorState'
import { StatusMessage } from '../../ui/base/StatusMessage'
import { DotMatrixLoader } from '../../ui/base/DotMatrixLoader'
import { Input } from '../../ui/base/Input'
import { Progress } from '../../ui/base/Progress'
import {
  SHEEN_PROGRESS_BAR_CLASS,
  SHEEN_PROGRESS_TRACK_CLASS,
  getSheenProgressBarStyle,
  getSheenProgressTrackStyle
} from '../../ui/base/sheen-progress'
import { Toolbar } from '../../ui/base/Toolbar'
import { cx } from '../../ui/base/utils'
import { Icon } from '../../ui/icons/Icon'
import { prefersReducedMotion } from '../../shared/motion'
import { usePopupSyncStatus } from '../popup-sync-state'
import { getSmartDisplayProgress, getSmartLoadingOrbState, SMART_LOADING_STAGE_STARTS } from '../smart-loading-progress.js'
import { isSidePanelSurface } from '../../shared/extension-surfaces'
import type { PopupSmartClassifierViewModel, PopupSmartPageViewModel } from './PopupViewModels'

const pageRevealShellClass = 't-skel popup-t-skel popup-page-reveal relative min-h-12 w-full'
const pageLayerClass = 'absolute inset-0 min-h-12'
const pageSkeletonLayerClass = cx(
  pageLayerClass,
  't-skel-skeleton popup-page-skeleton pointer-events-none z-[1]'
)
const pageContentLayerClass = cx(
  pageLayerClass,
  't-skel-content popup-page-content z-[2]'
)
const pageCardClass =
  'popup-surface grid min-h-12 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 overflow-hidden border-0 bg-ds-surface-1 px-2.5 py-1.5 shadow-none @max-[520px]/popup:grid-cols-[minmax(0,1fr)] @max-[520px]/popup:items-stretch @max-[520px]/popup:gap-2 @max-[520px]/popup:p-2.5'
const pageMainClass = 'grid min-w-0 grid-cols-[26px_minmax(0,1fr)] items-center gap-2.5'
const pageIconClass =
  'grid h-[26px] w-[26px] place-items-center overflow-hidden rounded-ds-sm border-0 bg-ds-surface-2 text-sm font-bold leading-none text-ds-text-primary'
const pageFaviconClass = 'block h-full w-full object-cover'
const pageCopyClass = 'min-w-0'
const pageTitleClass = 'm-0 min-w-0 truncate text-[13px] font-semibold leading-tight text-ds-text-primary'
const pageStatusClass = 'mt-0.5 mb-0 min-w-0 truncate text-xs leading-4 text-ds-text-secondary'
const placeholderPageCardClass = 'text-ds-text-secondary'
const placeholderIconClass = 'border-ds-border bg-ds-surface-2 text-ds-text-secondary'
const placeholderTitleClass = 'text-ds-text-primary'
const placeholderStatusClass = 'text-ds-text-muted'

const currentPageActionsBaseClass =
  'flex h-7 w-36 items-center rounded-ds-sm justify-self-end @max-[520px]/popup:w-full @max-[520px]/popup:justify-self-stretch'
const currentPageActionsClass = cx(currentPageActionsBaseClass, 'bg-ds-text-primary text-ds-text-inverse')
const savedPageActionsClass = cx(currentPageActionsBaseClass, 'bg-ds-surface-3 text-ds-text-primary')
const placeholderPageActionsClass = cx(currentPageActionsBaseClass, 'pointer-events-none bg-ds-surface-2 text-ds-text-disabled')
const currentPageActionClass = [
  'inline-flex h-full min-w-0 flex-1 items-center justify-center gap-1.5 whitespace-nowrap bg-transparent px-2 text-xs font-semibold leading-none text-current outline-none',
  'first:rounded-l-ds-sm last:rounded-r-ds-sm',
  'transition-[background-color,color,opacity] duration-ds-fast ease-ds-standard',
  'hover:bg-[color-mix(in_srgb,currentColor_10%,transparent)] focus-visible:bg-[color-mix(in_srgb,currentColor_10%,transparent)]',
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-ds-focus focus-visible:outline-offset-1',
  'disabled:cursor-default disabled:bg-transparent disabled:opacity-45'
].join(' ')
const currentPagePinnedActionClass = cx(currentPageActionClass, 'text-ds-success-text')
const placeholderPageActionClass = cx(currentPageActionClass, 'disabled:opacity-100')
const currentPageActionDividerClass = 'h-3.5 w-px flex-none bg-current opacity-20'
const currentPageActionIconClass = 'flex-none'

const skeletonSurfaceBaseClass =
  'popup-skeleton-pulse block bg-[rgba(255,255,255,0.065)]'
const skeletonBarBaseClass =
  cx(skeletonSurfaceBaseClass, 'rounded-full')
const skeletonDotClass =
  cx(skeletonSurfaceBaseClass, 'h-[26px] w-[26px] rounded-ds-sm')
const pageSkeletonCopyClass = 'grid min-w-0 gap-[6px]'
const pageSkeletonTitleClass = cx(skeletonBarBaseClass, 'h-[10px] w-[148px] max-w-[64%]')
const pageSkeletonStatusClass = cx(skeletonBarBaseClass, 'h-2 w-[104px] max-w-[48%] opacity-[0.72]')
const pageSkeletonActionsClass = cx(skeletonSurfaceBaseClass, 'h-7 w-36 flex-none rounded-ds-sm @max-[520px]/popup:w-full')
const pageSkeletonSyncActionClass = cx(skeletonSurfaceBaseClass, 'h-7 w-[88px] flex-none rounded-ds-sm @max-[520px]/popup:w-20')
const PAGE_SYNC_HOLD_MAX_MS = 120

const panelCardClass =
  'w-full bg-transparent shadow-none'
const panelHeaderClass = 'flex items-center justify-between gap-3 px-px'
const panelHeaderTitleClass = 'm-0 text-xs font-[650] text-ds-text-secondary'
const panelHeaderWithMarginClass = cx(panelHeaderClass, 'mb-3.5')
const panelHeaderLargeMarginClass = panelHeaderClass
const exitButtonClass = [
  'inline-flex h-7 min-w-[42px] items-center justify-center rounded-ds-sm border border-ds-border bg-ds-surface-2 px-2 text-xs font-[650] text-ds-text-secondary outline-none',
  'transition-[border-color,background-color,color,scale] duration-ds-fast ease-ds-standard',
  'hover:border-ds-border-hover hover:bg-ds-hover hover:text-ds-text-primary',
  'focus-visible:border-ds-border-hover focus-visible:bg-ds-hover focus-visible:text-ds-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-ds-focus focus-visible:outline-offset-1',
  'active:scale-[var(--ds-press-scale)]'
].join(' ')

const actionsClass = 'mt-3 grid grid-cols-[repeat(auto-fit,minmax(86px,1fr))] gap-2'
const actionButtonBaseClass = [
  'inline-flex min-h-[38px] w-full items-center justify-center gap-2 rounded-ds-sm border px-3 text-[13px] font-semibold leading-none outline-none',
  'transition-[border-color,background-color,color,scale,opacity] duration-ds-fast ease-ds-standard',
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-ds-focus focus-visible:outline-offset-1',
  'active:scale-[var(--ds-press-scale)] disabled:cursor-default'
].join(' ')
const secondaryActionButtonClass = cx(
  actionButtonBaseClass,
  'border-ds-border bg-ds-surface-2 text-ds-text-primary hover:border-ds-border-hover hover:bg-ds-hover focus-visible:border-ds-border-hover focus-visible:bg-ds-hover'
)
const settingsActionButtonClass = cx(
  actionButtonBaseClass,
  'border-ds-border bg-ds-surface-3 text-ds-text-primary hover:border-ds-border-hover hover:bg-ds-active focus-visible:border-ds-border-hover focus-visible:bg-ds-active'
)
const primaryActionButtonClass = cx(
  actionButtonBaseClass,
  'border-transparent bg-ds-text-primary text-ds-text-inverse hover:bg-[var(--ds-accent-hover)] focus-visible:bg-[var(--ds-accent-hover)]'
)
const savedActionButtonClass = cx(
  actionButtonBaseClass,
  'border-ds-success bg-ds-success-soft text-ds-success-text disabled:opacity-100'
)

const manualButtonClass = [
  'mx-auto inline-flex w-fit items-center justify-center gap-[7px] rounded-ds-sm border border-transparent bg-transparent px-2 py-1.5 text-xs font-semibold text-ds-text-secondary outline-none',
  'transition-[color,background-color,scale] duration-ds-fast ease-ds-standard',
  'hover:bg-ds-hover hover:text-ds-text-primary',
  'focus-visible:bg-ds-hover focus-visible:text-ds-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-ds-focus focus-visible:outline-offset-1',
  'active:scale-[var(--ds-press-scale)]'
].join(' ')
const manualButtonSlotClass = 'mt-auto flex justify-center pt-4'
const folderIconClass = 'h-3.5 w-3.5 flex-none text-ds-text-secondary'

const permissionCardClass = cx(panelCardClass, 'flex h-full min-h-0 flex-col overflow-hidden px-[18px] py-4')
const permissionBodyClass = 'mx-auto grid w-full max-w-[560px] gap-2.5 py-8'
const permissionCopyClass = 'm-0 text-xs leading-[1.55] text-ds-text-secondary'
const permissionErrorClass =
  'm-0 rounded-ds-sm border border-ds-danger/30 bg-ds-danger-soft/65 px-3 py-2 text-xs leading-[1.55] text-ds-danger-text'
const permissionOriginsClass = 'flex flex-wrap gap-1.5'
const permissionOriginClass =
  'max-w-full overflow-hidden truncate whitespace-nowrap rounded-ds-sm border border-ds-border bg-ds-surface-2 px-2 py-1.5 text-xs leading-tight text-ds-text-primary'

const buttonLoadingLabelClass = 'inline-flex min-w-0 items-center justify-center gap-[7px]'
const buttonDotLoaderClass = 'h-3.5 w-3.5'
const loadingCardClass = cx(panelCardClass, 'flex h-full min-h-0 flex-col overflow-hidden px-[18px] py-4')
const loadingStageClass = 'flex min-h-0 flex-1 items-center justify-center pb-8'
const loadingBodyClass = 'grid w-full max-w-[590px] grid-cols-[64px_minmax(0,1fr)] items-center gap-4 @max-[430px]/popup:grid-cols-[minmax(0,1fr)] @max-[430px]/popup:justify-items-center @max-[430px]/popup:text-center'
const loadingLoaderClass = 'opacity-90'
const loadingContentClass = 'min-w-0'
const loadingCopyClass =
  'mb-2.5 mt-0 flex items-center justify-between gap-3 text-[13px] font-[650] text-ds-text-primary'
const loadingStepClass = 'text-xs font-medium text-ds-text-secondary'
const progressTrackClass = cx('smart-progress-track', SHEEN_PROGRESS_TRACK_CLASS)
const progressBarClass = SHEEN_PROGRESS_BAR_CLASS

const resultCardClass = cx(panelCardClass, 'flex h-full min-h-0 flex-col overflow-hidden px-[18px] py-4')
const titleRowClass = 'mb-3.5 grid grid-cols-[minmax(0,1fr)] gap-2'
const titleInputClass = [
  'min-h-9 w-full rounded-ds-sm border border-ds-border bg-ds-surface-2 px-3 text-[13px] font-[650] leading-tight text-ds-text-primary outline-none',
  'transition-[border-color,background-color] duration-ds-fast ease-ds-standard',
  'placeholder:text-ds-text-muted hover:border-ds-border-hover focus:border-ds-focus focus:bg-ds-hover'
].join(' ')
const sectionLabelClass = 'mb-[9px] mt-0 text-xs font-semibold text-ds-text-secondary'
const recommendationsClass =
  'ds-scrollbar flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-0.5 [scrollbar-gutter:stable]'
const folderOptionBaseClass = [
  'popup-smart-folder-option grid min-h-[50px] w-full grid-cols-[minmax(0,1fr)_auto] items-start gap-2.5 rounded-ds-sm border px-3 py-2.5 text-left outline-none @max-[430px]/popup:grid-cols-[minmax(0,1fr)]',
  'transition-[border-color,background-color,color,scale] duration-ds-fast ease-ds-standard',
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-ds-focus focus-visible:outline-offset-1'
].join(' ')
const folderOptionDefaultClass =
  'border-ds-border bg-ds-surface-2 hover:border-ds-border-hover hover:bg-ds-hover focus-visible:border-ds-border-hover focus-visible:bg-ds-hover'
const folderOptionSelectedClass =
  'border-ds-border-hover bg-ds-selected text-ds-text-primary hover:bg-ds-selected focus-visible:bg-ds-selected'
const folderMainClass = 'grid min-w-0 gap-1'
const folderHeadClass = 'flex min-w-0 items-center gap-2'
const folderNameClass = 'min-w-0 truncate text-[13px] font-bold leading-tight text-ds-text-primary'
const folderPathClass = 'ml-[22px] min-w-0 break-all text-xs leading-snug text-ds-text-secondary'
const folderMetaClass =
  'flex items-start gap-2 text-xs font-[650] text-ds-text-secondary'
const checkIconClass = 'h-3.5 w-3.5 text-ds-text-primary'
const newBadgeClass =
  'inline-flex min-h-[18px] items-center rounded-full border border-ds-border bg-ds-surface-2 px-1.5 text-xs font-extrabold text-ds-text-secondary'
const compactStateClass =
  'grid min-h-[90px] place-items-center px-4 py-3 text-center text-xs leading-[1.55] text-ds-text-muted'

export interface PopupSmartClassifierActionHandlers {
  onAction?: (action: string, returnFocusElement?: HTMLElement | null) => void
  onCurrentPageAction?: (action: string, returnFocusElement?: HTMLElement | null) => void
  onRecommendationSelect?: (recommendationId: string) => void
  onTitleChange?: (title: string) => void
}

export function PopupSmartClassifier({
  handlers,
  state,
  pageStatusAccessory,
  pageActionAccessory
}: {
  handlers?: PopupSmartClassifierActionHandlers
  state: PopupSmartClassifierViewModel
  pageStatusAccessory?: ReactNode
  pageActionAccessory?: ReactNode
}) {
  if (state.status === 'hidden') {
    return null
  }

  if (state.status === 'page-loading') {
    return <PopupSmartPageRevealCard handlers={handlers} page={state.page} loading accessory={pageStatusAccessory} actionAccessory={pageActionAccessory} />
  }

  if (state.status === 'loading') {
    return <PopupSmartLoading handlers={handlers} state={state} />
  }

  if (state.status === 'results') {
    return <PopupSmartResult handlers={handlers} state={state} />
  }

  if (state.status === 'error') {
    return (
      <article className={permissionCardClass}>
        <div className={panelHeaderWithMarginClass}>
          <p className={panelHeaderTitleClass}>智能分类</p>
          <PopupSmartExitButton handlers={handlers} />
        </div>
        <div className={loadingStageClass}>
          <ErrorState
            size="compact"
            title="智能分类失败"
            detail={state.error || '请检查 AI 配置或稍后重试。'}
          />
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
            data-smart-action="classify"
            onClick={() => handlers?.onAction?.('classify')}
            unstyled
          >
            重试
          </Button>
        </Toolbar>
      </article>
    )
  }

  if (state.status === 'permission') {
    return <PopupSmartPermission handlers={handlers} state={state} />
  }

  return <PopupSmartPageRevealCard handlers={handlers} page={state.page} loading={false} accessory={pageStatusAccessory} actionAccessory={pageActionAccessory} />
}

function PopupSmartPageRevealCard({
  handlers,
  loading,
  page,
  accessory,
  actionAccessory
}: {
  handlers?: PopupSmartClassifierActionHandlers
  loading: boolean
  page: PopupSmartPageViewModel | null
  accessory?: ReactNode
  actionAccessory?: ReactNode
}) {
  const syncState = usePopupSyncStatus()
  const waitForSync = Boolean(actionAccessory) && !syncState.settled
  const [syncHoldExpired, setSyncHoldExpired] = useState(!waitForSync)

  useEffect(() => {
    if (!waitForSync) {
      setSyncHoldExpired(true)
      return
    }
    const timer = window.setTimeout(() => {
      setSyncHoldExpired(true)
    }, PAGE_SYNC_HOLD_MAX_MS)
    return () => window.clearTimeout(timer)
  }, [waitForSync])

  const effectiveLoading = loading || (waitForSync && !syncHoldExpired)
  const [revealed, setRevealed] = useState(!effectiveLoading)

  useLayoutEffect(() => {
    if (effectiveLoading) {
      setRevealed(false)
      return
    }
    if (prefersReducedMotion() || document.documentElement.dataset.motionInput === 'keyboard') {
      setRevealed(true)
    }
  }, [effectiveLoading])

  useEffect(() => {
    if (effectiveLoading || revealed) {
      return
    }
    let firstFrame = 0
    let secondFrame = 0
    firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        setRevealed(true)
      })
    })
    return () => {
      window.cancelAnimationFrame(firstFrame)
      window.cancelAnimationFrame(secondFrame)
    }
  }, [effectiveLoading, revealed])

  const showRevealed = !effectiveLoading && revealed
  const showSyncSkeleton = Boolean(actionAccessory && (syncState.error || syncState.status?.count))

  return (
    <div
      className={cx(pageRevealShellClass, showRevealed ? 'is-revealed' : '')}
      data-state={effectiveLoading ? 'loading' : 'ready'}
      aria-busy={effectiveLoading ? 'true' : 'false'}
      role={effectiveLoading ? 'status' : undefined}
    >
      <div className={cx(pageCardClass, pageSkeletonLayerClass)} aria-hidden="true">
        <PopupSmartPageSkeletonContent showSyncSlot={showSyncSkeleton} />
      </div>
      <article className={cx(getPopupSmartPageCardClassName(page), pageContentLayerClass, effectiveLoading ? 'pointer-events-none' : '')}>
        <PopupSmartPageCardContent handlers={handlers} page={page} accessory={accessory} actionAccessory={actionAccessory} />
      </article>
    </div>
  )
}

function getPopupSmartPageCardClassName(page: PopupSmartPageViewModel | null) {
  return cx(pageCardClass, page ? '' : placeholderPageCardClass)
}

function PopupSmartPageCardContent({
  handlers,
  page,
  accessory,
  actionAccessory
}: {
  handlers?: PopupSmartClassifierActionHandlers
  page: PopupSmartPageViewModel | null
  accessory?: ReactNode
  actionAccessory?: ReactNode
}) {
  if (!page) {
    return <PopupSmartPagePlaceholderContent accessory={accessory} actionAccessory={actionAccessory} />
  }

  return (
    <>
      <div className={pageMainClass}>
        <span className={pageIconClass} aria-hidden="true">
          {page.favicon ? <img className={pageFaviconClass} src={page.favicon} alt="" /> : page.fallbackIcon}
        </span>
        <div className={pageCopyClass}>
          <p className={pageTitleClass} title={page.title}>{page.title}</p>
          <div className={cx(pageStatusClass, 'flex items-center gap-2')}>
            <span className="truncate" title={page.statusTitle}>{page.status}</span>
            {accessory}
          </div>
        </div>
      </div>
      <div className="popup-page-actions">
      {page.bookmarked ? (
        <Toolbar className={savedPageActionsClass} aria-label="当前页快捷操作" unstyled>
          <Button
            className={currentPageActionClass}
            type="button"
            data-current-page-action="edit"
            onClick={(event) => handlers?.onCurrentPageAction?.('edit', event.currentTarget)}
            unstyled
          >
            <Icon name="Pencil" size={14} className={currentPageActionIconClass} aria-hidden="true" />
            编辑
          </Button>
          <span className={currentPageActionDividerClass} aria-hidden="true"></span>
          <Button
            className={page.pinned ? currentPagePinnedActionClass : currentPageActionClass}
            type="button"
            data-current-page-action="pin-newtab"
            aria-pressed={page.pinned}
            aria-label={page.pinned ? '取消当前页的固定入口' : '将当前页固定到新标签页'}
            disabled={page.pinPending}
            onClick={() => handlers?.onCurrentPageAction?.('pin-newtab')}
            unstyled
          >
            <Icon name="Pin" size={14} className={currentPageActionIconClass} aria-hidden="true" />
            {page.pinLabel}
          </Button>
        </Toolbar>
      ) : (
        <Toolbar className={currentPageActionsClass} aria-label="当前页快捷操作" unstyled>
          <Button
            className={currentPageActionClass}
            type="button"
            data-current-page-action="save"
            onClick={(event) => handlers?.onCurrentPageAction?.('save', event.currentTarget)}
            unstyled
          >
            <Icon name="BookmarkPlus" size={14} className={currentPageActionIconClass} aria-hidden="true" />
            保存
          </Button>
          <span className={currentPageActionDividerClass} aria-hidden="true"></span>
          <Button
            className={currentPageActionClass}
            type="button"
            data-smart-action="classify"
            aria-label={page.canClassify ? '智能分类' : '智能分类（当前页面受隐私保护）'}
            disabled={!page.canClassify}
            title={page.canClassify ? undefined : page.classificationStatusTitle}
            onClick={() => handlers?.onAction?.('classify')}
            unstyled
          >
            <Icon name="Sparkles" size={14} className={currentPageActionIconClass} aria-hidden="true" />
            智能
          </Button>
        </Toolbar>
      )}
      {actionAccessory}
      </div>
    </>
  )
}

function PopupSmartPageSkeletonContent({ showSyncSlot = false }: { showSyncSlot?: boolean }) {
  return (
    <>
      <div className={pageMainClass}>
        <span className={skeletonDotClass} data-origin="center" aria-hidden="true"></span>
        <span className={pageSkeletonCopyClass} aria-hidden="true">
          <span className={pageSkeletonTitleClass}></span>
          <span className={pageSkeletonStatusClass}></span>
        </span>
      </div>
      <div className="popup-page-actions" aria-hidden="true">
        <span className={pageSkeletonActionsClass} data-origin="right"></span>
        {showSyncSlot ? <span className={pageSkeletonSyncActionClass} data-origin="right"></span> : null}
      </div>
    </>
  )
}

function PopupSmartPagePlaceholderContent({ accessory, actionAccessory }: { accessory?: ReactNode; actionAccessory?: ReactNode }) {
  const hint = isSidePanelSurface() ? '点击工具栏图标，启用当前页操作' : '打开网页后可快速保存或智能分类'
  const hintTitle = isSidePanelSurface() ? '切换普通网页后，点击浏览器工具栏中的 Curator 图标，启用该网页的保存与分类操作。' : hint
  return (
    <>
      <div className={pageMainClass}>
        <span className={cx(pageIconClass, placeholderIconClass)} aria-hidden="true">
          <Icon name="PanelRight" size={15} />
        </span>
        <div className={pageCopyClass}>
          <p className={cx(pageTitleClass, placeholderTitleClass)}>当前标签页</p>
          <div className={cx(pageStatusClass, placeholderStatusClass, 'flex items-center gap-2')}>
            <span className="truncate" title={hintTitle}>{hint}</span>
            {accessory}
          </div>
        </div>
      </div>
      <div className="popup-page-actions">
      <Toolbar className={placeholderPageActionsClass} aria-label="当前页快捷操作" unstyled>
        <Button className={placeholderPageActionClass} type="button" disabled unstyled>
          <Icon name="BookmarkPlus" size={14} className={currentPageActionIconClass} aria-hidden="true" />
          保存
        </Button>
        <span className={currentPageActionDividerClass} aria-hidden="true"></span>
        <Button className={placeholderPageActionClass} type="button" disabled unstyled>
          <Icon name="Sparkles" size={14} className={currentPageActionIconClass} aria-hidden="true" />
          智能
        </Button>
      </Toolbar>
      {actionAccessory}
      </div>
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
        <p className={panelHeaderTitleClass}>需要授权 AI 服务</p>
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
        {state.error ? (
          <StatusMessage
            className={permissionErrorClass}
            style={{ blockSize: 'auto', maxBlockSize: 'calc(3 * 1lh)' }}
            tone="error"
          >
            {state.error}
          </StatusMessage>
        ) : null}
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
      <span className="t-shimmer" data-text={label}>{label}</span>
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
  const loadingProgress = getSmartDisplayProgress(state.loadingProgress, state.loadingStep)
  const loadingPercent = Math.round(loadingProgress)

  return (
    <article className={loadingCardClass}>
      <div className={panelHeaderLargeMarginClass}>
        <p className={panelHeaderTitleClass}>智能分类</p>
        <PopupSmartExitButton handlers={handlers} />
      </div>
      <div className={loadingStageClass}>
        <div className={loadingBodyClass}>
          <AiThinkingOrb
            state={getSmartLoadingOrbState(state.loadingStep)}
            size={64}
            className={loadingLoaderClass}
          />
          <div className={loadingContentClass}>
            <p className={loadingCopyClass}>
              <span className="t-shimmer" data-text={state.loadingLabel}>{state.loadingLabel}</span>
              <small className={loadingStepClass}>
                <span className="tabular-nums">{loadingPercent}%</span>
              </small>
            </p>
            <Progress
              className={progressTrackClass}
              indicatorClassName={progressBarClass}
              indicatorProps={{ 'data-smart-progress-target': loadingProgress } as Record<string, string | number>}
              indicatorStyle={getSheenProgressBarStyle(loadingProgress)}
              label="智能分类进度"
              value={loadingProgress}
              style={{
                ...getSheenProgressTrackStyle(loadingProgress),
                '--smart-stage-a': `${SMART_LOADING_STAGE_STARTS[1]}%`,
                '--smart-stage-b': `${SMART_LOADING_STAGE_STARTS[2]}%`
              } as CSSProperties}
              aria-valuetext={`${state.loadingLabel} 第 ${state.loadingStep}/${state.loadingStepCount} 阶段，已完成 ${loadingPercent}%`}
              unstyled
            />
          </div>
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
              className={cx(folderOptionBaseClass, recommendation.selected ? folderOptionSelectedClass : folderOptionDefaultClass)}
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
      <div className={manualButtonSlotClass}>
        <PopupSmartManualButton handlers={handlers} />
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
          className={state.saved ? savedActionButtonClass : primaryActionButtonClass}
          type="button"
          data-smart-action="save"
          disabled={!canSave}
          onClick={() => handlers?.onAction?.('save')}
          unstyled
        >
          {state.saving ? (
            <PopupButtonLoadingLabel label="保存中…" />
          ) : (
            <span className="popup-save-action-label">
              {state.saved ? (
                <svg className="popup-saved-check" viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M3.5 8.5 L6.5 11.5 L12.5 4.5" />
                </svg>
              ) : null}
              <span>{state.saved ? '已保存' : '确认保存'}</span>
            </span>
          )}
        </Button>
      </Toolbar>
    </article>
  )
}
