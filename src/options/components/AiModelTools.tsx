import { Button } from '../../ui/primitives/Button.js'
import { DotMatrixLoader } from '../../ui/primitives/DotMatrixLoader.js'
import { dispatchAiModelToolsAction } from './ai-model-tools-events.js'
import type { AiModelToolsState } from './ai-model-tools-types.js'

export function AiModelTools({ state }: { state: AiModelToolsState }) {
  const statusClassName = [
    'ai-provider-connectivity',
    state.fetchModelsStatusTone || 'muted',
    state.fetchModelsStatus ? '' : 'hidden'
  ].filter(Boolean).join(' ')

  return (
    <>
      <div className="ai-model-field-controls">
        <div id="ai-model-selector-host" className="ai-model-selector-host" />
        <Button
          id="ai-fetch-models"
          className="options-button secondary small"
          size="sm"
          type="button"
          variant="secondary"
          aria-label="从自定义 AI 渠道获取模型列表"
          disabled={state.fetchDisabled}
          focusableWhenDisabled={state.fetchingModels}
          onClick={() => dispatchAiModelToolsAction('fetch-models')}
        >
          {state.fetchingModels ? (
            <LoadingLabel label={state.fetchLabel} loaderClassName="button-dot-loader" wrapperClassName="button-loading-label" />
          ) : (
            state.fetchLabel
          )}
        </Button>
      </div>
      <p id="ai-fetch-models-status" className={statusClassName}>
        {state.fetchModelsStatusBusy ? (
          <LoadingLabel label={state.fetchModelsStatus} loaderClassName="status-dot-loader" wrapperClassName="status-loading-label" />
        ) : (
          state.fetchModelsStatus
        )}
      </p>
      <p className="ai-provider-field-tip">
        支持搜索预设、自定义和已拉取的模型；若目标服务使用自定义模型 ID，可在{' '}
        <Button
          id="ai-manage-models"
          className="ai-inline-action"
          type="button"
          aria-label="打开自定义模型列表设置"
          disabled={state.manageDisabled}
          onClick={() => dispatchAiModelToolsAction('manage-models')}
          unstyled
        >
          设置更多模型
        </Button>
        {' '}里追加。
      </p>
    </>
  )
}

function LoadingLabel({
  label,
  loaderClassName,
  wrapperClassName
}: {
  label: string
  loaderClassName: string
  wrapperClassName: string
}) {
  return (
    <span className={wrapperClassName}>
      <DotMatrixLoader variant="bar" className={loaderClassName} />
      <span>{label}</span>
    </span>
  )
}
