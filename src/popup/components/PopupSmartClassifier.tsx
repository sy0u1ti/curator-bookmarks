import type { CSSProperties } from 'react'
import { Toolbar } from '../../ui/base/Toolbar'
import { Icon } from '../../ui/icons/Icon'
import { Button } from '../../ui/primitives/Button'
import { DotMatrixLoader } from '../../ui/primitives/DotMatrixLoader'
import { Input } from '../../ui/primitives/Input'
import { Progress } from '../../ui/primitives/Progress'
import type { PopupSmartClassifierViewModel, PopupSmartPageViewModel } from './PopupViewModels'

export interface PopupSmartClassifierActionHandlers {
  onAction?: (action: string) => void
  onCurrentPageAction?: (action: string) => void
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
        <div className="smart-panel-head smart-panel-head-standalone">
          <p>智能分类失败</p>
          <PopupSmartExitButton handlers={handlers} />
        </div>
        <div className="error-banner">{state.error || '智能分类失败，请稍后重试。'}</div>
        <Toolbar className="smart-actions smart-actions-three" unstyled>
          <Button
            className="smart-cancel-button"
            type="button"
            data-smart-action="manual-folder"
            onClick={() => handlers?.onAction?.('manual-folder')}
            unstyled
          >
            手动选择
          </Button>
          <Button
            className="smart-settings-action"
            type="button"
            data-smart-action="open-ai-settings"
            onClick={() => handlers?.onAction?.('open-ai-settings')}
            unstyled
          >
            AI 设置
          </Button>
          <Button
            className="smart-classify-button"
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
      className={['current-page-reveal-shell', 't-skel', loading ? 'is-loading' : 'is-revealed'].join(' ')}
      data-state={loading ? 'loading' : 'ready'}
      aria-busy={loading ? 'true' : 'false'}
      role={loading ? 'status' : undefined}
      aria-live="polite"
    >
      <div className="smart-page-card current-page-skeleton-card t-skel-skeleton is-pulsing" aria-hidden="true">
        <PopupSmartPageSkeletonContent />
      </div>
      <article className={[getPopupSmartPageCardClassName(page), 'current-page-card-content', 't-skel-content'].join(' ')}>
        <PopupSmartPageCardContent handlers={handlers} page={page} />
      </article>
    </div>
  )
}

function getPopupSmartPageCardClassName(page: PopupSmartPageViewModel | null) {
  return [
    'smart-page-card',
    page ? (page.bookmarked ? 'bookmarked' : 'unbookmarked') : 'current-page-placeholder'
  ].join(' ')
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
      <div className="smart-page-main">
        <span className="smart-page-icon" aria-hidden="true">
          {page.favicon ? <img src={page.favicon} alt="" /> : page.fallbackIcon}
        </span>
        <div className="smart-page-copy">
          <p className="smart-page-title" title={page.title}>{page.title}</p>
          <p className="smart-page-status" title={page.statusTitle}>{page.status}</p>
        </div>
      </div>
      {page.bookmarked ? (
        <Toolbar className="current-page-actions" aria-label="当前页快捷操作" unstyled>
          <Button
            className={['current-page-action', 'primary', page.pinned ? 'pressed' : ''].filter(Boolean).join(' ')}
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
            className="current-page-action"
            type="button"
            data-current-page-action="edit"
            onClick={() => handlers?.onCurrentPageAction?.('edit')}
            unstyled
          >
            编辑
          </Button>
        </Toolbar>
      ) : (
        <Toolbar className="current-page-actions" aria-label="当前页快捷操作" unstyled>
          <Button
            className="current-page-action primary"
            type="button"
            data-current-page-action="save"
            onClick={() => handlers?.onCurrentPageAction?.('save')}
            unstyled
          >
            快速保存
          </Button>
          <Button
            className="current-page-action"
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
      <div className="smart-page-main current-page-skeleton-main">
        <span className="popup-skeleton-dot current-page-skeleton-icon" aria-hidden="true"></span>
        <span className="current-page-skeleton-copy" aria-hidden="true">
          <span
            className="popup-skeleton-bar current-page-skeleton-title"
            style={{ '--skeleton-width': 0.64 } as CSSProperties}
          ></span>
          <span
            className="popup-skeleton-bar current-page-skeleton-status"
            style={{ '--skeleton-width': 0.86 } as CSSProperties}
          ></span>
        </span>
      </div>
      <span className="current-page-actions current-page-skeleton-actions" aria-hidden="true">
        <span className="popup-skeleton-bar current-page-skeleton-action"></span>
        <span className="popup-skeleton-bar current-page-skeleton-action secondary"></span>
      </span>
    </>
  )
}

function PopupSmartPagePlaceholderContent() {
  return (
    <>
      <div className="smart-page-main">
        <span className="smart-page-icon current-page-placeholder-icon" aria-hidden="true">
          <Icon name="PanelRight" size={15} />
        </span>
        <div className="smart-page-copy">
          <p className="smart-page-title">当前标签页</p>
          <p className="smart-page-status" title="打开网页后可快速保存或智能分类">
            打开网页后可快速保存或智能分类
          </p>
        </div>
      </div>
      <Toolbar className="current-page-actions is-placeholder" aria-label="当前页快捷操作" unstyled>
        <Button className="current-page-action primary" type="button" disabled unstyled>
          快速保存
        </Button>
        <Button className="current-page-action" type="button" disabled unstyled>
          智能分类
        </Button>
      </Toolbar>
    </>
  )
}

function PopupSmartExitButton({ handlers }: { handlers?: PopupSmartClassifierActionHandlers }) {
  return (
    <Button
      className="smart-exit-button"
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
      className="smart-manual-button"
      type="button"
      data-smart-action="manual-folder"
      onClick={() => handlers?.onAction?.('manual-folder')}
      unstyled
    >
      <span className="smart-folder-icon" aria-hidden="true"></span>
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
    <article className="smart-permission-card">
      <div className="smart-panel-head">
        <p>需要授权 AI 渠道</p>
        <PopupSmartExitButton handlers={handlers} />
      </div>
      <div className="smart-permission-body">
        <p className="smart-permission-copy">
          智能分类需要访问你配置的 AI 服务地址。当前网页不会申请额外权限，正文读取失败时会用标题和 URL 继续推荐。
        </p>
        {state.permissionOrigins.length ? (
          <div className="smart-permission-origins">
            {state.permissionOrigins.map((origin) => <span key={origin}>{origin}</span>)}
          </div>
        ) : null}
        {state.error ? <p className="smart-permission-error">{state.error}</p> : null}
      </div>
      <Toolbar className="smart-actions" unstyled>
        <Button
          className="smart-cancel-button"
          type="button"
          data-smart-action="manual-folder"
          onClick={() => handlers?.onAction?.('manual-folder')}
          unstyled
        >
          手动选择
        </Button>
        <Button
          className="smart-settings-action"
          type="button"
          data-smart-action="open-ai-settings"
          onClick={() => handlers?.onAction?.('open-ai-settings')}
          unstyled
        >
          AI 设置
        </Button>
        <Button
          className="smart-classify-button"
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
    <span className="button-loading-label">
      <DotMatrixLoader variant="bar" className="button-dot-loader" />
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
    <article className="smart-loading-card">
      <div className="smart-panel-head">
        <p>智能分类</p>
        <PopupSmartExitButton handlers={handlers} />
      </div>
      <div className="smart-loading-body">
        <DotMatrixLoader variant="spiral" className="smart-loading-loader" />
        <div className="smart-loading-content">
          <p className="smart-loading-copy">
            <span>{state.loadingLabel}</span>
            <small>{state.loadingStep}/{state.loadingStepCount}</small>
          </p>
          <Progress
            className="smart-progress-track"
            indicatorClassName="smart-progress-bar"
            indicatorProps={{ 'data-smart-progress-target': state.loadingProgress } as Record<string, string | number>}
            indicatorStyle={{ '--smart-progress-scale': state.loadingStartProgress / 100 } as CSSProperties}
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
    <article className="smart-result-card">
      <div className="smart-panel-head">
        <p>推荐文件夹</p>
        <PopupSmartExitButton />
      </div>
      <div className="smart-title-row">
        <Input
          id="smart-title-input"
          className="smart-title-input"
          type="text"
          spellCheck={false}
          maxLength={180}
          defaultValue={state.suggestedTitle}
          aria-label="推荐书签标题"
          onValueChange={(value) => handlers?.onTitleChange?.(value)}
        />
      </div>
      <p className="smart-section-label">推荐文件夹</p>
      <div className="smart-recommendations">
        {state.recommendations.length ? (
          state.recommendations.map((recommendation) => (
            <Button
              className={['smart-folder-option', recommendation.selected ? 'selected' : ''].filter(Boolean).join(' ')}
              type="button"
              data-smart-recommendation={recommendation.id}
              onClick={() => handlers?.onRecommendationSelect?.(recommendation.id)}
              key={recommendation.id}
              unstyled
            >
              <span className="smart-folder-main">
                <span className="smart-folder-head">
                  <span className="smart-folder-icon" aria-hidden="true"></span>
                  <span className="smart-folder-name">{recommendation.title}</span>
                </span>
                <span className="smart-folder-path" title={recommendation.path}>{recommendation.path}</span>
              </span>
              <span className="smart-folder-meta">
                {recommendation.isNew ? <span className="smart-new-badge">新建</span> : null}
                {recommendation.selected ? <span className="smart-checkmark">{'\u2713'}</span> : null}
                <span>{recommendation.confidence}%</span>
              </span>
            </Button>
          ))
        ) : (
          <div className="state-panel compact">未生成可用推荐，请手动选择文件夹。</div>
        )}
      </div>
      <Toolbar className="smart-actions" unstyled>
        <Button
          className="smart-cancel-button"
          type="button"
          data-smart-action="reset"
          onClick={() => handlers?.onAction?.('reset')}
          unstyled
        >
          取消
        </Button>
        <Button
          className={['smart-save-button', state.saved ? 'saved' : ''].filter(Boolean).join(' ')}
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
