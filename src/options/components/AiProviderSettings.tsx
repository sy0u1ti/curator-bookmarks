import { Dialog as BaseDialog } from '@base-ui/react/dialog'
import { useEffect, useRef, useState } from 'react'
import { AiProviderCard } from '../../ui/ai/AiProviderCard.js'
import { Button } from '../../ui/base/Button.js'
import {
  CollapsiblePanel,
  CollapsibleRoot,
  CollapsibleTrigger
} from '../../ui/base/Collapsible.js'
import { Input } from '../../ui/base/Input.js'
import { Select, type SelectOption } from '../../ui/base/Select.js'
import { SwitchControl } from '../../ui/base/Switch.js'
import { Textarea } from '../../ui/base/Textarea.js'
import { AiModelSelector } from './AiModelSelector.js'
import {
  ButtonBusyLoadingLabel,
  StatusBusyLoadingLabel
} from './LoadingLabel.js'
import { handleAiProviderSettingsAction } from '../options-controller'
import {
  AI_PROVIDER_ACTION_BUTTONS_CLASS,
  AI_PROVIDER_ACTIONS_CLASS,
  AI_PROVIDER_ADVANCED_CLASS,
  AI_PROVIDER_ADVANCED_PANEL_CLASS,
  AI_PROVIDER_ADVANCED_TRIGGER_CLASS,
  AI_PROVIDER_BODY_CLASS,
  AI_PROVIDER_CARD_CLASS,
  AI_PROVIDER_CARD_ATTENTION_CLASS,
  AI_PROVIDER_CHECK_CLASS,
  AI_PROVIDER_CONNECTIVITY_CLASS,
  AI_PROVIDER_CONNECTIVITY_TONE_CLASS,
  AI_PROVIDER_COPY_CLASS,
  AI_PROVIDER_DIALOG_ACTIONS_CLASS,
  AI_PROVIDER_DIALOG_BACKDROP_CLASS,
  AI_PROVIDER_DIALOG_CLASS,
  AI_PROVIDER_DIALOG_CLOSE_CLASS,
  AI_PROVIDER_DIALOG_COPY_CLASS,
  AI_PROVIDER_DIALOG_EYEBROW_CLASS,
  AI_PROVIDER_DIALOG_FIELD_CLASS,
  AI_PROVIDER_DIALOG_HINT_CLASS,
  AI_PROVIDER_DIALOG_TITLE_CLASS,
  AI_PROVIDER_FETCH_BUTTON_CLASS,
  AI_PROVIDER_FIELD_CLASS,
  AI_PROVIDER_FIELD_LABEL_CLASS,
  AI_PROVIDER_FIELD_TIP_CLASS,
  AI_PROVIDER_FLOW_CLASS,
  AI_PROVIDER_FLOW_COPY_CLASS,
  AI_PROVIDER_FLOW_INDEX_CLASS,
  AI_PROVIDER_FLOW_STEP_CLASS,
  AI_PROVIDER_FLOW_TITLE_CLASS,
  AI_PROVIDER_GRID_CLASS,
  AI_PROVIDER_HEADER_CLASS,
  AI_PROVIDER_INLINE_ACTION_CLASS,
  AI_PROVIDER_INPUT_CLASS,
  AI_PROVIDER_MODEL_CONTROL_CLASS,
  AI_PROVIDER_MODEL_FIELD_CLASS,
  AI_PROVIDER_MODEL_LABEL_CLASS,
  AI_PROVIDER_MODEL_TOOLS_CLASS,
  AI_PROVIDER_NOTICE_CLASS,
  AI_PROVIDER_QUICK_ROW_CLASS,
  AI_PROVIDER_SAVE_STATE_CLASS,
  AI_PROVIDER_SAVE_TONE_CLASS,
  AI_PROVIDER_SELECT_HOST_CLASS,
  AI_PROVIDER_SELECT_ROOT_CLASS,
  AI_PROVIDER_SELECT_TRIGGER_CLASS,
  AI_PROVIDER_STATUS_BADGE_CLASS,
  AI_PROVIDER_STATUS_TONE_CLASS,
  AI_PROVIDER_SUBTITLE_CLASS,
  AI_PROVIDER_TEXTAREA_CLASS,
  AI_PROVIDER_TITLE_CLASS,
  aiProviderToneClass
} from './ai-provider-settings-classes.js'
import { useAiProviderSettingsState } from './ai-provider-settings-store.js'
import type { AiProviderSettingsState } from './ai-provider-settings-types.js'
import {
  AI_SETTINGS_SWITCH_CONTROL_CLASS,
  AI_SETTINGS_SWITCH_THUMB_CLASS,
  AI_SETTINGS_SWITCH_WRAP_CLASS
} from './ai-settings-card-classes.js'

const aiProviderSteps = [
  { id: 'api-key', index: '1', title: '填写密钥', copy: '先填 API Key；Base URL 在高级选项' },
  { id: 'fetch-models', index: '2', title: '获取模型', copy: '读取可用列表' },
  { id: 'select-model', index: '3', title: '选择模型', copy: '用于命名与分类' },
  { id: 'test-connection', index: '4', title: '测试连接', copy: '确认模型可用' },
  { id: 'save-settings', index: '5', title: '保存', copy: '同步到 AI 功能' }
] as const

export function AiProviderSettings({
  attentionRequestId = 0
}: {
  attentionRequestId?: number
}) {
  const state = useAiProviderSettingsState()
  const attentionTimerRef = useRef<number>(0)
  const [attention, setAttention] = useState(false)
  const [customModelsOpen, setCustomModelsOpen] = useState(false)
  const description = (
    <>
      <p className={AI_PROVIDER_NOTICE_CLASS}>{state.noticeText}</p>
      <p className={AI_PROVIDER_SUBTITLE_CLASS}>API Key 仅保存在本地，不会上传到 Curator Bookmark 服务器。</p>
    </>
  )
  const status = (
    <span
      className={`${AI_PROVIDER_STATUS_BADGE_CLASS} ${aiProviderToneClass(state.configTone, AI_PROVIDER_STATUS_TONE_CLASS)}`}
    >
      {state.configStatusText}
    </span>
  )
  const connectivityClassName = [
    AI_PROVIDER_CONNECTIVITY_CLASS,
    aiProviderToneClass(state.connectivityTone, AI_PROVIDER_CONNECTIVITY_TONE_CLASS)
  ].filter(Boolean).join(' ')
  const apiStyleOptions = state.apiStyleOptions.map((option): SelectOption => ({
    label: option.label,
    value: option.value
  }))

  useEffect(() => {
    const showAttention = () => {
      window.clearTimeout(attentionTimerRef.current)
      setAttention(true)
      attentionTimerRef.current = window.setTimeout(() => {
        setAttention(false)
        attentionTimerRef.current = 0
      }, 1400)
    }

    if (attentionRequestId > 0) {
      showAttention()
    }

    return () => {
      window.clearTimeout(attentionTimerRef.current)
    }
  }, [attentionRequestId])

  return (
    <>
      <AiProviderCard
        id="ai-provider-settings"
        className={[
          AI_PROVIDER_CARD_CLASS,
          attention ? AI_PROVIDER_CARD_ATTENTION_CLASS : ''
        ].filter(Boolean).join(' ')}
        title={<h2 className={AI_PROVIDER_TITLE_CLASS}>自定义 AI 渠道</h2>}
        description={description}
        status={status}
        headerClassName={AI_PROVIDER_HEADER_CLASS}
        copyClassName={AI_PROVIDER_COPY_CLASS}
        iconName="Bot"
        bodyClassName={AI_PROVIDER_BODY_CLASS}
      >
        <ol className={AI_PROVIDER_FLOW_CLASS} aria-label="AI 渠道配置流程">
          {aiProviderSteps.map((step) => (
            <li className={AI_PROVIDER_FLOW_STEP_CLASS} key={step.id}>
              <span className={AI_PROVIDER_FLOW_INDEX_CLASS}>{step.index}</span>
              <strong className={AI_PROVIDER_FLOW_TITLE_CLASS}>{step.title}</strong>
              <p className={AI_PROVIDER_FLOW_COPY_CLASS}>{step.copy}</p>
            </li>
          ))}
        </ol>

        <div className={AI_PROVIDER_QUICK_ROW_CLASS}>
          <label className={AI_PROVIDER_FIELD_CLASS} htmlFor="ai-api-key">
            <span className={AI_PROVIDER_FIELD_LABEL_CLASS}>API Key</span>
            <Input
              id="ai-api-key"
              className={AI_PROVIDER_INPUT_CLASS}
              type={state.revealApiKey ? 'text' : 'password'}
              spellCheck={false}
              autoComplete="off"
              placeholder={state.apiKeyPlaceholder}
              value={state.apiKey}
              onValueChange={(value) => handleAiProviderSettingsAction({
                action: 'change',
                field: 'apiKey',
                value
              })}
              unstyled
            />
          </label>

          <div className={AI_PROVIDER_MODEL_FIELD_CLASS}>
            <AiProviderModelToolsContent
              state={state}
              onOpenCustomModels={() => setCustomModelsOpen(true)}
            />
          </div>
        </div>

        <label className={AI_PROVIDER_CHECK_CLASS}>
          <span>显示密码</span>
          <span className={AI_SETTINGS_SWITCH_WRAP_CLASS}>
            <SwitchControl
              aria-label="显示密码"
              checked={state.revealApiKey}
              className={AI_SETTINGS_SWITCH_CONTROL_CLASS}
              thumbClassName={AI_SETTINGS_SWITCH_THUMB_CLASS}
              onCheckedChange={(checked) => handleAiProviderSettingsAction({
                action: 'toggle-api-key',
                value: checked
              })}
              unstyled
            />
          </span>
        </label>

        {state.connectivityVisible ? (
          <p className={connectivityClassName}>
            {state.connectivityBusy ? (
                <StatusBusyLoadingLabel label={state.connectivityCopy} />
            ) : (
              state.connectivityCopy
            )}
          </p>
        ) : null}

        <CollapsibleRoot id="ai-advanced-settings" className={AI_PROVIDER_ADVANCED_CLASS}>
          <CollapsibleTrigger className={AI_PROVIDER_ADVANCED_TRIGGER_CLASS}>Base URL 与接口选项</CollapsibleTrigger>
          <CollapsiblePanel className={AI_PROVIDER_ADVANCED_PANEL_CLASS}>
            <div className={AI_PROVIDER_GRID_CLASS}>
              <label className={AI_PROVIDER_FIELD_CLASS} htmlFor="ai-base-url">
                <span className={AI_PROVIDER_FIELD_LABEL_CLASS}>自定义 API 接口地址</span>
                <Input
                  id="ai-base-url"
                  className={AI_PROVIDER_INPUT_CLASS}
                  type="url"
                  spellCheck={false}
                  autoComplete="off"
                  placeholder="https://api.openai.com/v1"
                  value={state.baseUrl}
                  onValueChange={(value) => handleAiProviderSettingsAction({
                    action: 'change',
                    field: 'baseUrl',
                    value
                  })}
                  unstyled
                />
              </label>

              <div className={AI_PROVIDER_FIELD_CLASS}>
                <span className={AI_PROVIDER_FIELD_LABEL_CLASS}>接口类型</span>
                <div className={AI_PROVIDER_SELECT_HOST_CLASS}>
                  <Select
                    className={AI_PROVIDER_SELECT_ROOT_CLASS}
                    disabled={state.modelToolsDisabled}
                    label="接口类型"
                    options={apiStyleOptions}
                    triggerClassName={AI_PROVIDER_SELECT_TRIGGER_CLASS}
                    value={state.apiStyle}
                    onValueChange={(value) => handleAiProviderSettingsAction({
                      action: 'api-style-change',
                      value: value || ''
                    })}
                  />
                </div>
              </div>

              <label className={AI_PROVIDER_FIELD_CLASS} htmlFor="ai-timeout-ms" hidden>
                <span className={AI_PROVIDER_FIELD_LABEL_CLASS}>请求超时 (ms)</span>
                <Input
                  id="ai-timeout-ms"
                  className={AI_PROVIDER_INPUT_CLASS}
                  type="number"
                  min="5000"
                  max="120000"
                  step="1000"
                  inputMode="numeric"
                  placeholder="30000"
                  value={state.timeoutMs}
                  onValueChange={(value) => handleAiProviderSettingsAction({
                    action: 'change',
                    field: 'timeoutMs',
                    value
                  })}
                  unstyled
                />
              </label>

              <label className={AI_PROVIDER_FIELD_CLASS} htmlFor="ai-batch-size">
                <span className={AI_PROVIDER_FIELD_LABEL_CLASS}>每批最大请求数</span>
                <Input
                  id="ai-batch-size"
                  className={AI_PROVIDER_INPUT_CLASS}
                  type="number"
                  min="1"
                  max="20"
                  step="1"
                  inputMode="numeric"
                  placeholder="6"
                  value={state.batchSize}
                  onValueChange={(value) => handleAiProviderSettingsAction({
                    action: 'change',
                    field: 'batchSize',
                    value
                  })}
                  unstyled
                />
              </label>
            </div>
          </CollapsiblePanel>
        </CollapsibleRoot>

        <div className={AI_PROVIDER_ACTIONS_CLASS}>
          <span
            className={`${AI_PROVIDER_SAVE_STATE_CLASS} ${aiProviderToneClass(state.configTone, AI_PROVIDER_SAVE_TONE_CLASS)}`}
          >
            {state.saveStatusText}
          </span>
          <div className={AI_PROVIDER_ACTION_BUTTONS_CLASS}>
            <Button
              variant={state.testButtonSecondary ? 'secondary' : 'primary'}
              type="button"
              aria-label="测试自定义 AI 渠道连接"
              disabled={state.testDisabled}
              focusableWhenDisabled={state.testingConnection}
              onClick={() => handleAiProviderSettingsAction({ action: 'test-connection' })}
            >
              {state.testingConnection ? (
                <ButtonBusyLoadingLabel label={state.testLabel} />
              ) : (
                state.testLabel
              )}
            </Button>
            {state.showSaveSettingsButton ? (
              <Button
                variant="primary"
                type="button"
                aria-label="保存自定义 AI 渠道设置"
                disabled={state.saveDisabled}
                onClick={() => handleAiProviderSettingsAction({ action: 'save' })}
              >
                保存设置
              </Button>
            ) : null}
          </div>
        </div>
      </AiProviderCard>
      <AiCustomModelsDialog
        disabled={state.modelToolsDisabled}
        open={customModelsOpen}
        value={state.customModels.join('\n')}
        onOpenChange={setCustomModelsOpen}
      />
    </>
  )
}

function AiProviderModelToolsContent({
  onOpenCustomModels,
  state
}: {
  onOpenCustomModels: () => void
  state: AiProviderSettingsState
}) {
  const modelTools = state.modelTools
  const fetchModelsStatusClassName = [
    AI_PROVIDER_CONNECTIVITY_CLASS,
    aiProviderToneClass(modelTools.fetchModelsStatusTone, AI_PROVIDER_CONNECTIVITY_TONE_CLASS)
  ].filter(Boolean).join(' ')

  return (
    <>
      <div className={AI_PROVIDER_MODEL_TOOLS_CLASS}>
        <div className={AI_PROVIDER_MODEL_CONTROL_CLASS}>
          <span className={AI_PROVIDER_MODEL_LABEL_CLASS}>模型</span>
          <div className={AI_PROVIDER_SELECT_HOST_CLASS}>
            <AiModelSelector
              state={modelTools.selector}
              onModelSelect={(model) => handleAiProviderSettingsAction({
                action: 'model-change',
                value: model
              })}
            />
          </div>
        </div>
        <div className={AI_PROVIDER_MODEL_CONTROL_CLASS}>
          <span className={AI_PROVIDER_MODEL_LABEL_CLASS}>拉取模型</span>
          <Button
            className={AI_PROVIDER_FETCH_BUTTON_CLASS}
            size="sm"
            type="button"
            variant="secondary"
            aria-label="从自定义 AI 渠道获取模型列表"
            disabled={modelTools.fetchDisabled}
            focusableWhenDisabled={modelTools.fetchingModels}
            onClick={() => handleAiProviderSettingsAction({ action: 'fetch-models' })}
          >
            {modelTools.fetchingModels ? (
              <ButtonBusyLoadingLabel label={modelTools.fetchLabel} />
            ) : (
              modelTools.fetchLabel
            )}
          </Button>
        </div>
      </div>
      {modelTools.fetchModelsStatus ? (
        <p className={fetchModelsStatusClassName}>
          {modelTools.fetchModelsStatusBusy ? (
            <StatusBusyLoadingLabel label={modelTools.fetchModelsStatus} />
          ) : (
            modelTools.fetchModelsStatus
          )}
        </p>
      ) : null}
      <p className={AI_PROVIDER_FIELD_TIP_CLASS}>
        支持搜索预设、自定义和已拉取的模型；若目标服务使用自定义模型 ID，可在{' '}
        <Button
          className={AI_PROVIDER_INLINE_ACTION_CLASS}
          type="button"
          aria-label="打开自定义模型列表设置"
          disabled={modelTools.manageDisabled}
          onClick={onOpenCustomModels}
          unstyled
        >
          设置更多模型
        </Button>
        {' '}里追加。
      </p>
    </>
  )
}

function AiCustomModelsDialog({
  disabled,
  onOpenChange,
  open,
  value
}: {
  disabled: boolean
  onOpenChange: (open: boolean) => void
  open: boolean
  value: string
}) {
  const [draft, setDraft] = useState(value)

  useEffect(() => {
    if (!open) {
      setDraft(value)
    }
  }, [open, value])

  return (
    <BaseDialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (disabled && nextOpen) {
          return
        }
        onOpenChange(nextOpen)
      }}
    >
      <BaseDialog.Portal keepMounted={false}>
        <BaseDialog.Backdrop className={AI_PROVIDER_DIALOG_BACKDROP_CLASS} />
        <BaseDialog.Popup
          className={AI_PROVIDER_DIALOG_CLASS}
          aria-describedby="ai-model-modal-copy"
          initialFocus={false}
          finalFocus={false}
        >
          <p className={AI_PROVIDER_DIALOG_EYEBROW_CLASS}>AI Models</p>
          <BaseDialog.Title className={AI_PROVIDER_DIALOG_TITLE_CLASS}>自定义模型列表</BaseDialog.Title>
          <BaseDialog.Description id="ai-model-modal-copy" className={AI_PROVIDER_DIALOG_COPY_CLASS}>
            每行一个模型 ID，保存后会加入模型选择器。已拉取模型和预设模型不会被这里删除。
          </BaseDialog.Description>
          <label className={AI_PROVIDER_DIALOG_FIELD_CLASS} htmlFor="ai-custom-models-input">
            <span className={AI_PROVIDER_FIELD_LABEL_CLASS}>模型 ID</span>
            <Textarea
              id="ai-custom-models-input"
              className={AI_PROVIDER_TEXTAREA_CLASS}
              value={draft}
              onChange={(event) => setDraft(event.currentTarget.value)}
              placeholder={'gpt-4o\nclaude-3-5-sonnet-latest\nmy-custom-model'}
            />
          </label>
          <p className={AI_PROVIDER_DIALOG_HINT_CLASS}>重复项会自动合并，空行会被忽略。</p>
          <div className={AI_PROVIDER_DIALOG_ACTIONS_CLASS}>
            <BaseDialog.Close
              className={AI_PROVIDER_DIALOG_CLOSE_CLASS}
              type="button"
              aria-label="取消自定义模型设置"
            >
              取消
            </BaseDialog.Close>
            <Button
              variant="primary"
              type="button"
              aria-label="保存自定义模型列表"
              onClick={() => {
                handleAiProviderSettingsAction({
                  action: 'custom-models-save',
                  value: draft.split(/\r?\n/)
                })
                onOpenChange(false)
              }}
            >
              保存模型
            </Button>
          </div>
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  )
}
